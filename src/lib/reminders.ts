/**
 * Which phone reminders to schedule, worked out from the household's own data.
 * Pure (no native modules), so the same plan can be previewed on any platform.
 *
 * One reminder per issue, each with a stable key:
 *   use:<date>     morning digest of what to use first that day (up to 7 days ahead)
 *   cooked:<id>    30 minutes before a cooked dish's finish-by time
 *   shop:<date>    morning of the planned shopping day
 *   weekly         every Sunday: the 10-second weekly check
 * Keys already delivered are never scheduled again, so reopening the app can't repeat one.
 */
import type { Cooked, InvItem, Named, Shopping } from './api';
import type { TKey } from './settings';

export type ReminderPrefs = {
  enabled: boolean;
  useFirst: boolean;
  cooked: boolean;
  shopDay: boolean;
  weekly: boolean;
  hour: number; // morning reminder hour, local time
};

export const DEFAULT_PREFS: ReminderPrefs = { enabled: false, useFirst: true, cooked: true, shopDay: true, weekly: true, hour: 9 };

export type Channel = 'use-first' | 'cooked' | 'planning';

export type Reminder = {
  key: string;
  channel: Channel;
  title: string;
  body: string;
  url: string; // screen to open when tapped
} & ({ at: number } | { weekly: { weekday: number; hour: number; minute: number } });

type T = (key: TKey, params?: Record<string, string | number>) => string;

const LOOKAHEAD_DAYS = 7;
const EVENING_HOUR = 17; // fallback for today's digest when the morning has already passed
const COOKED_LEAD_MIN = 30;
const MIN_LEAD_MS = 60_000; // never schedule something that would fire immediately

function atLocal(day: Date, hour: number, minute = 0) {
  const d = new Date(day);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

function listNames(names: string[], t: T) {
  if (names.length <= 2) return names.join(t('rem.and'));
  return t('rem.andMore', { list: names.slice(0, 2).join(', '), n: names.length - 2 });
}

/** Days from today until an item needs using first (0 = today), or null if it'll be eaten before then. */
export function useFirstDay(i: InvItem): number | null {
  if (i.status === 'finished' || i.remaining <= 0) return null;
  if (i.status === 'spoiled' || i.status === 'use_today') return 0;
  const k = Math.max(0, Math.ceil(i.days_left[0] - 1)); // the day its window's low end reaches 1 day
  if (i.days_of_use !== null && i.days_of_use < k) return null; // finished at the usual pace first
  return k;
}

export function planReminders(input: {
  prefs: ReminderPrefs;
  items: InvItem[];
  cooked: Cooked[];
  shopping: Shopping | undefined;
  delivered: Set<string>;
  now: Date;
  t: T;
  nameOf: (x: Named) => string;
}): Reminder[] {
  const { prefs, items, cooked, shopping, delivered, now, t, nameOf } = input;
  if (!prefs.enabled) return [];
  const out: Reminder[] = [];
  const nowMs = now.getTime();
  const future = (ms: number) => ms - nowMs >= MIN_LEAD_MS;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  if (prefs.useFirst) {
    const byDay = new Map<number, InvItem[]>();
    for (const i of items) {
      const k = useFirstDay(i);
      if (k === null || k >= LOOKAHEAD_DAYS) continue;
      byDay.set(k, [...(byDay.get(k) ?? []), i]);
    }
    for (const [k, list] of byDay) {
      const day = new Date(today);
      day.setDate(day.getDate() + k);
      const key = `use:${day.toISOString().slice(0, 10)}`;
      if (delivered.has(key)) continue;
      let at = atLocal(day, prefs.hour);
      if (k === 0 && !future(at)) at = atLocal(day, EVENING_HOUR); // morning passed: remind before dinner
      if (!future(at)) continue;
      // most urgent first; spoiled items get "check" wording, not "use"
      list.sort((a, b) => b.urgency - a.urgency);
      const check = list.filter((i) => k === 0 && i.status === 'spoiled');
      const use = list.filter((i) => !check.includes(i));
      const names = use.map((i) => nameOf(i).split(' (')[0]);
      const title = use.length
        ? use.length === 1 ? t('rem.useOne', { name: names[0] }) : t('rem.useMany', { list: listNames(names, t) })
        : t('rem.checkOnly', { list: listNames(check.map((i) => nameOf(i)), t) });
      const body = check.length && use.length
        ? t('rem.useBodyCheck', { list: listNames(check.map((i) => nameOf(i)), t) })
        : use.length ? t('rem.useBody') : t('rem.checkBody');
      out.push({ key, channel: 'use-first', title, body, at, url: use.length === 1 && !check.length ? `/item/${use[0].item_id}` : '/cook' });
    }
  }

  if (prefs.cooked) {
    for (const c of cooked) {
      const key = `cooked:${c.id}`;
      if (delivered.has(key)) continue;
      const finish = Date.parse(c.finish_by);
      let at = finish - COOKED_LEAD_MIN * 60_000;
      if (!future(at)) at = finish; // less than 30 minutes left: remind at the deadline itself
      if (!future(at)) continue;
      const time = new Date(finish);
      const clock = `${((time.getHours() + 11) % 12) + 1}:${String(time.getMinutes()).padStart(2, '0')} ${time.getHours() < 12 ? 'AM' : 'PM'}`;
      out.push({
        key, channel: 'cooked', at, url: '/cook',
        title: t('rem.cookedTitle', { dish: c.dish, time: clock }),
        body: c.storage === 'room' ? t('rem.cookedBodyRoom') : t('rem.cookedBodyFridge'),
      });
    }
  }

  if (prefs.shopDay && shopping && !shopping.trip) {
    const key = `shop:${shopping.shop_date}`;
    const [y, m, d] = shopping.shop_date.split('-').map(Number);
    const at = atLocal(new Date(y, m - 1, d), prefs.hour);
    if (!delivered.has(key) && future(at)) {
      out.push({
        key, channel: 'planning', at, url: '/shop',
        title: t('rem.shopTitle'),
        body: shopping.counts.have > 0 ? t('rem.shopBodyHave', { n: shopping.counts.have }) : t('rem.shopBody'),
      });
    }
  }

  if (prefs.weekly) {
    // weekday 1 = Sunday (Expo calendar convention)
    out.push({ key: 'weekly', channel: 'planning', url: '/check', title: t('rem.weeklyTitle'), body: t('rem.weeklyBody'),
      weekly: { weekday: 1, hour: Math.min(prefs.hour + 1, 21), minute: 0 } });
  }
  // soonest first; the repeating weekly check last
  return out.sort((a, b) => ('at' in a ? a.at : Infinity) - ('at' in b ? b.at : Infinity));
}
