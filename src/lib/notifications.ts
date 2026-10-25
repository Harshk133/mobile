/**
 * Phone notifications for AnnaSaathi: local and scheduled on the device from the family's
 * own data. No push server, and no network needed at reminder time.
 * expo-notifications is reached only through ./notifyNative, which never crashes the app
 * when a native part is missing (e.g. in Expo Go): reminders just report as unavailable.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { native, nativeFailure } from './notifyNative';
import { useCooked, useInventory, useShopping } from './queries';
import { planReminders, type Channel, type Reminder } from './reminders';
import { useSettings } from './settings';

/** True when this build can schedule notifications (false on the web preview, and when a native part is missing). */
export const notificationsAvailable = () => native() !== null;
export { nativeFailure };

const PREFIX = 'anna:';
const STATE_KEY = 'annasaathi.reminders.v1';
type State = { delivered: string[]; scheduled: Record<string, number>; signature: string };

let configured = false;

/** Foreground display and Android channels. Safe to call more than once. */
export async function configureNotifications() {
  const N = native();
  if (!N || configured) return;
  configured = true;
  N.setHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  if (Platform.OS === 'android') {
    const ch = (id: Channel, name: string, importance: Notifications.AndroidImportance) =>
      N.setChannel(id, { name, importance, lightColor: '#1F4D3A' });
    await Promise.all([
      ch('use-first', 'Use first today', N.Importance.DEFAULT),
      ch('cooked', 'Cooked food finish-by', N.Importance.HIGH),
      ch('planning', 'Shopping day and weekly check', N.Importance.LOW),
    ]).catch(() => {});
  }
}

export type Permission = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export async function getPermission(): Promise<Permission> {
  const N = native();
  if (!N) return 'unsupported';
  const p = await N.getPermissions();
  return p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
}

/** Ask only when the family turns reminders on, never on launch. */
export async function requestPermission(): Promise<Permission> {
  const N = native();
  if (!N) return 'unsupported';
  await configureNotifications();
  const cur = await N.getPermissions();
  if (cur.granted) return 'granted';
  if (!cur.canAskAgain) return 'denied';
  const p = await N.requestPermissions();
  return p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
}

async function loadState(): Promise<State> {
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    if (raw) return JSON.parse(raw) as State;
  } catch {}
  return { delivered: [], scheduled: {}, signature: '' };
}

/** Keys whose time has passed were delivered: never plan them again. */
export async function deliveredKeys(now = Date.now()): Promise<Set<string>> {
  const s = await loadState();
  const done = new Set(s.delivered);
  for (const [k, at] of Object.entries(s.scheduled)) if (at <= now) done.add(k);
  return done;
}

/**
 * Make the phone's schedule match the plan. Only AnnaSaathi's own notifications
 * (identifier prefix) are touched, and nothing changes when the plan is the same.
 */
export async function applyReminders(plan: Reminder[]) {
  const N = native();
  if (!N) return;
  const state = await loadState();
  const now = Date.now();
  const delivered = await deliveredKeys(now);
  const signature = JSON.stringify(plan.map((r) => [r.key, 'at' in r ? r.at : r.weekly, r.title, r.body]));
  const existing = (await N.getAllScheduled()).filter((n) => n.identifier.startsWith(PREFIX));
  const wanted = new Set(plan.map((r) => PREFIX + r.key));
  const allThere = [...wanted].every((id) => existing.some((n) => n.identifier === id));
  if (signature === state.signature && allThere && existing.every((n) => wanted.has(n.identifier))) return;

  await Promise.all(existing.map((n) => N.cancel(n.identifier)));
  const scheduled: Record<string, number> = {};
  for (const r of plan) {
    const trigger: Notifications.NotificationTriggerInput =
      'at' in r
        ? { type: N.Trigger.DATE, date: r.at, channelId: r.channel }
        : { type: N.Trigger.WEEKLY, channelId: r.channel, ...r.weekly };
    try {
      await N.schedule({
        identifier: PREFIX + r.key,
        content: { title: r.title, body: r.body, data: { url: r.url, key: r.key } },
        trigger,
      });
      if ('at' in r) scheduled[r.key] = r.at;
    } catch {
      // one bad reminder (e.g. a time that passed while scheduling) shouldn't stop the rest
    }
  }
  const next: State = { delivered: [...delivered].slice(-200), scheduled, signature };
  await AsyncStorage.setItem(STATE_KEY, JSON.stringify(next)).catch(() => {});
}

/** Turn every AnnaSaathi reminder off (reminders switched off in Settings). */
export async function cancelAllReminders() {
  const N = native();
  if (!N) return;
  const existing = await N.getAllScheduled();
  await Promise.all(existing.filter((n) => n.identifier.startsWith(PREFIX)).map((n) => N.cancel(n.identifier)));
  const s = await loadState();
  await AsyncStorage.setItem(STATE_KEY, JSON.stringify({ ...s, scheduled: {}, signature: '' })).catch(() => {});
}

/** Keeps the phone's reminders in step with the kitchen, cooked food and shopping list. */
export function useReminderSync() {
  const { reminders, t, inlineNameOf: nameOf } = useSettings();
  const inv = useInventory();
  const cooked = useCooked();
  const shopping = useShopping();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!notificationsAvailable()) return;
    if (!reminders.enabled) {
      cancelAllReminders().catch(() => {});
      return;
    }
    if (!inv.data || !cooked.data || !shopping.data) return;
    if (timer.current) clearTimeout(timer.current);
    // debounce: a burst of edits (ticking items off) resyncs once
    timer.current = setTimeout(async () => {
      try {
        if ((await getPermission()) !== 'granted') return;
        await configureNotifications();
        const plan = planReminders({
          prefs: reminders, items: inv.data!.items, cooked: cooked.data!.rows, shopping: shopping.data,
          delivered: await deliveredKeys(), now: new Date(), t, nameOf,
        });
        await applyReminders(plan);
      } catch {}
    }, 1500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [reminders, inv.data, cooked.data, shopping.data, t, nameOf]);
}

/** Tapping a reminder opens the screen it is about, including from a cold start. */
export function useNotificationTaps() {
  useEffect(() => {
    const N = native();
    if (!N) return;
    configureNotifications().catch(() => {});
    const open = (r: Notifications.NotificationResponse | null) => {
      const url = r?.notification.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('/')) router.push(url as never);
    };
    N.lastResponse().then((r) => {
      open(r);
      if (r) N.clearLastResponse().catch(() => {});
    }).catch(() => {});
    const sub = N.onResponse(open);
    return () => sub.remove();
  }, []);
}
