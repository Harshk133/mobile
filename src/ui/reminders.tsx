import { useEffect, useState } from 'react';
import { Linking, Switch, View } from 'react-native';

import { clockTime } from '@/lib/format';
import { getPermission, nativeFailure, notificationsAvailable, requestPermission, type Permission } from '@/lib/notifications';
import { native } from '@/lib/notifyNative';
import { useCooked, useInventory, useShopping } from '@/lib/queries';
import { planReminders, type ReminderPrefs } from '@/lib/reminders';
import { useSettings, type TKey } from '@/lib/settings';
import { useToast } from './feedback';
import { Button, Card, Icon, Text } from './primitives';
import { Counter } from './profileForm';
import { color, space, touch } from './theme';

/** Turn reminders on: asks the phone for permission first and explains a refusal. */
export function useEnableReminders() {
  const { reminders, update, t } = useSettings();
  const toast = useToast();
  return async () => {
    const p = await requestPermission();
    if (p === 'granted') {
      update({ reminders: { ...reminders, enabled: true } });
      toast({ message: t('rem.on') });
    } else if (p === 'denied') {
      toast({ message: t('rem.denied'), action: { label: t('scan.settings'), onPress: () => Linking.openSettings() } });
    } else if (p === 'unsupported') {
      // web preview, or a build without the native notification module (Expo Go):
      // keep the setting so the "Coming up" preview shows what would be scheduled; nothing is sent
      update({ reminders: { ...reminders, enabled: true } });
      toast({ message: nativeFailure() === 'web' ? t('rem.webOnly') : t('rem.needsBuild') });
    }
    return p;
  };
}

function Row({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: touch + 4, gap: space.md }}>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{label}</Text>
        {hint ? <Text variant="caption" tone="muted">{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label}
        trackColor={{ true: color.primary, false: color.borderStrong }} thumbColor={color.surface} />
    </View>
  );
}

export function ReminderSettings() {
  const { reminders, update, t, inlineNameOf: nameOf } = useSettings();
  const toast = useToast();
  const enable = useEnableReminders();
  const [perm, setPerm] = useState<Permission | null>(null);
  const inv = useInventory();
  const cooked = useCooked();
  const shopping = useShopping();
  useEffect(() => {
    getPermission().then(setPerm).catch(() => setPerm('unsupported'));
  }, [reminders.enabled]);

  const set = (patch: Partial<ReminderPrefs>) => update({ reminders: { ...reminders, ...patch } });
  // the same plan the phone schedules (without the "already sent" filter), shown so the family knows what to expect
  const plan = reminders.enabled && inv.data && cooked.data
    ? planReminders({ prefs: reminders, items: inv.data.items, cooked: cooked.data.rows, shopping: shopping.data,
        delivered: new Set(), now: new Date(), t, nameOf })
    : [];

  const test = async () => {
    const N = native();
    if (!N) return;
    await N.schedule({
      identifier: 'anna-test',
      content: { title: t('rem.testTitle'), body: t('rem.testBody'), data: { url: '/alerts' } },
      trigger: { type: N.Trigger.TIME_INTERVAL, seconds: 5, channelId: 'use-first' },
    });
    toast({ message: t('rem.testSent') });
  };

  return (
    <View style={{ gap: space.sm }}>
      <Row
        label={t('rem.master')}
        hint={notificationsAvailable() ? t('rem.masterHint') : nativeFailure() === 'web' ? t('rem.webOnly') : t('rem.needsBuild')}
        value={reminders.enabled}
        onChange={(v) => (v ? enable() : set({ enabled: false }))}
      />
      {perm === 'denied' && reminders.enabled ? (
        <Card tone="accent" style={{ padding: space.md, gap: space.sm }}>
          <Text style={{ color: color.accentText }}>{t('rem.denied')}</Text>
          <Button compact kind="secondary" label={t('scan.settings')} onPress={() => Linking.openSettings()} />
        </Card>
      ) : null}
      {reminders.enabled ? (
        <>
          <Row label={t('rem.prefUse')} hint={t('rem.prefUseHint')} value={reminders.useFirst} onChange={(v) => set({ useFirst: v })} />
          <Row label={t('rem.prefCooked')} hint={t('rem.prefCookedHint')} value={reminders.cooked} onChange={(v) => set({ cooked: v })} />
          <Row label={t('rem.prefShop')} hint={t('rem.prefShopHint')} value={reminders.shopDay} onChange={(v) => set({ shopDay: v })} />
          <Row label={t('rem.prefWeekly')} hint={t('rem.prefWeeklyHint')} value={reminders.weekly} onChange={(v) => set({ weekly: v })} />
          <Counter label={t('rem.hour')} hint={t('rem.hourHint', { time: `${reminders.hour}:00` })} value={reminders.hour} min={6} max={11}
            onChange={(hour) => set({ hour })} />

          <Text variant="label" style={{ marginTop: space.md }}>{t('rem.upcoming')}</Text>
          {plan.length ? (
            <Card style={{ paddingVertical: space.sm, gap: space.sm }}>
              {plan.map((r) => (
                <View key={r.key} style={{ flexDirection: 'row', gap: space.md, paddingVertical: 4 }}>
                  <Icon name={r.channel === 'cooked' ? 'pot-steam-outline' : r.channel === 'use-first' ? 'clock-alert-outline' : 'calendar-outline'}
                    size={20} tint={color.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text variant="caption" tone="muted">
                      {'at' in r ? whenLabel(r.at, t) : t('rem.everySunday', { time: `${r.weekly.hour}:00` })}
                    </Text>
                    <Text variant="bodyStrong">{r.title}</Text>
                    <Text variant="caption" tone="muted">{r.body}</Text>
                  </View>
                </View>
              ))}
            </Card>
          ) : (
            <Text variant="caption" tone="muted">{t('rem.none')}</Text>
          )}
          {notificationsAvailable() && perm === 'granted' ? (
            <Button compact kind="secondary" icon="bell-outline" label={t('rem.test')} onPress={test} />
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function whenLabel(at: number, t: (k: TKey, p?: Record<string, string | number>) => string) {
  const d = new Date(at);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / 86400000);
  const time = clockTime(d.toISOString());
  return diff === 0 ? t('rem.todayAt', { time }) : diff === 1 ? t('rem.tomorrowAt', { time }) : t('rem.inDaysAt', { n: diff, time });
}

/** A one-line invitation shown where reminders matter, until the family decides. */
export function ReminderPrompt() {
  const { reminders, t } = useSettings();
  const enable = useEnableReminders();
  if (reminders.enabled || !notificationsAvailable()) return null;
  return (
    <Card tone="sage" style={{ gap: space.sm, marginBottom: space.md }}>
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
        <Icon name="bell-outline" tint={color.sageText} />
        <Text variant="bodyStrong" style={{ flex: 1, color: color.sageText }}>{t('rem.promptTitle')}</Text>
      </View>
      <Text variant="caption" style={{ color: color.sageText }}>{t('rem.promptBody')}</Text>
      <Button compact label={t('rem.promptCta')} icon="bell-outline" onPress={enable} />
    </Card>
  );
}
