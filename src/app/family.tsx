import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { api, toProfile, type Lang, type Profile } from '@/lib/api';
import { defaultApiUrl } from '@/lib/config';
import { useHousehold, useStockMutation } from '@/lib/queries';
import { useSettings } from '@/lib/settings';
import { Field, Screen, Sheet } from '@/ui/controls';
import { ErrorState, ListSkeleton, useToast } from '@/ui/feedback';
import { Button, Card, Fact, IconButton, SectionHeader, Segmented, Text, haptic } from '@/ui/primitives';
import { FoodEditor, MembersEditor } from '@/ui/profileForm';
import { ReminderSettings } from '@/ui/reminders';
import { space } from '@/ui/theme';

export default function Family() {
  const { t, lang, update, apiOverride } = useSettings();
  const toast = useToast();
  const qc = useQueryClient();
  const household = useHousehold();
  const [p, setP] = useState<Profile | null>(null);
  const [server, setServer] = useState(apiOverride ?? '');
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => {
    if (household.data && !p) setP(toProfile(household.data));
  }, [household.data, p]);

  const save = useStockMutation((x: Profile) => api.saveHousehold(x));
  const reset = useStockMutation(() => api.reset());
  const dirty = !!(p && household.data && JSON.stringify(p) !== JSON.stringify(toProfile(household.data)));
  const onError = (e: unknown) => toast({ message: e instanceof Error ? e.message : String(e), tone: 'error' });

  const back = <IconButton icon="chevron-left" label={t('common.back')} onPress={() => router.back()} />;
  return (
    <Screen
      title={t('family.title')}
      subtitle={household.data ? t('family.eatsLike', { n: household.data.members.length, ae: household.data.adult_equivalents }) : ' '}
      right={back}
      footer={dirty && p ? (
        <Button label={t('family.save')} icon="check-circle-outline" loading={save.isPending}
          onPress={() => save.mutate(p, { onError, onSuccess: (h) => { haptic.success(); setP(toProfile(h)); toast({ message: t('family.saved') }); } })} />
      ) : null}
    >
      {household.isError ? (
        <ErrorState error={household.error} onRetry={() => household.refetch()} />
      ) : !p ? (
        <ListSkeleton rows={3} />
      ) : (
        <>
          <Field label={t('family.name')} value={p.family_name} onChange={(family_name) => setP({ ...p, family_name })} />
          <SectionHeader title={t('family.people')} />
          <MembersEditor profile={p} onChange={setP} />
          <SectionHeader title={t('family.food')} />
          <FoodEditor profile={p} onChange={setP} />
          <Text variant="caption" tone="faint" style={{ marginTop: space.md }}>{t('family.noMedical')}</Text>
        </>
      )}

      <SectionHeader title={t('rem.title')} />
      <ReminderSettings />

      <SectionHeader title={t('settings.title')} />
      <Text variant="label" style={{ marginBottom: space.sm }}>{t('settings.language')}</Text>
      <Segmented<Lang> value={lang} onChange={(l) => update({ lang: l })}
        options={[{ value: 'en', label: 'English' }, { value: 'hi', label: 'हिंदी' }, { value: 'mr', label: 'मराठी' }]} />
      <Text variant="caption" tone="muted" style={{ marginTop: space.sm, marginBottom: space.lg }}>{t('settings.languageNote')}</Text>

      <Field label={t('settings.server')} value={server} onChange={setServer} keyboardType="url" placeholder={defaultApiUrl()} hint={t('settings.serverHint')} />
      <Button kind="secondary" compact label={t('settings.serverSave')} onPress={() => {
        update({ apiOverride: server.trim() || null });
        qc.invalidateQueries();
        toast({ message: t('settings.serverSaved') });
      }} />

      <Card style={{ marginTop: space.xl, gap: space.sm }}>
        <Text variant="bodyStrong">{t('settings.demo')}</Text>
        <Text variant="caption" tone="muted">{t('settings.demoBody')}</Text>
        <View style={{ gap: space.sm, marginTop: space.sm }}>
          <Button compact kind="secondary" label={t('settings.newFamily')} onPress={() => router.push('/onboarding')} />
          <Button compact kind="danger" label={t('settings.reset')} onPress={() => setConfirmReset(true)} />
        </View>
      </Card>
      {household.data ? (
        <Card style={{ marginTop: space.md, paddingVertical: space.sm }}>
          <Fact label={t('settings.today')} value={household.data.today} />
          <Fact label={t('settings.weather')} value={`${Math.round(household.data.weather.temp_c)}°C · ${household.data.weather.source}`} />
          {household.data.setup_seconds ? <Fact label={t('settings.setupTime')} value={t('settings.seconds', { n: Math.round(household.data.setup_seconds) })} /> : null}
        </Card>
      ) : null}

      <Sheet visible={confirmReset} onClose={() => setConfirmReset(false)} title={t('settings.resetTitle')}
        footer={<>
          <Button kind="danger" label={t('settings.resetConfirm')} loading={reset.isPending} onPress={() => reset.mutate(undefined, {
            onError, onSuccess: () => { setConfirmReset(false); setP(null); qc.invalidateQueries(); toast({ message: t('settings.resetDone') }); },
          })} />
          <Button kind="ghost" label={t('common.cancel')} onPress={() => setConfirmReset(false)} />
        </>}>
        <Text tone="muted">{t('settings.resetBody')}</Text>
      </Sheet>
    </Screen>
  );
}
