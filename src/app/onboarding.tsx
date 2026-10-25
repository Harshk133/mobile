import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Switch, View } from 'react-native';

import { api } from '@/lib/api';
import { useStockMutation } from '@/lib/queries';
import { useSettings } from '@/lib/settings';
import { Field, Screen } from '@/ui/controls';
import { useToast } from '@/ui/feedback';
import { Button, IconButton, Pill, Text, haptic } from '@/ui/primitives';
import { FoodEditor, MembersEditor, emptyProfile } from '@/ui/profileForm';
import { color, radius, space, touch } from '@/ui/theme';

const STEPS = 3;

/** Family setup in three short steps. Only what changes quantities is asked; everything has a default. */
export default function Onboarding() {
  const { t, lang, update } = useSettings();
  const toast = useToast();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [p, setP] = useState(() => ({ ...emptyProfile(), language: lang }));
  const [fresh, setFresh] = useState(true);
  const started = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.round((Date.now() - started.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  const setup = useStockMutation(() => api.setupFamily({ ...p, setup_seconds: (Date.now() - started.current) / 1000 }, fresh));

  const canNext = step === 0 ? p.family_name.trim().length > 0 : step === 1 ? p.members.length > 0 : true;
  const finish = () =>
    setup.mutate(undefined, {
      onError: (e) => toast({ message: e instanceof Error ? e.message : String(e), tone: 'error' }),
      onSuccess: () => {
        haptic.success();
        update({ welcomed: true });
        qc.invalidateQueries();
        toast({ message: t('onb.done', { s: elapsed }) });
        router.replace(fresh ? '/scan' : '/');
      },
    });

  const titles = [t('onb.s1'), t('onb.s2'), t('onb.s3')];
  return (
    <Screen
      title={titles[step]}
      subtitle={t('onb.step', { n: step + 1, total: STEPS })}
      right={<IconButton icon="close" label={t('common.close')} onPress={() => router.back()} />}
      footer={
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {step > 0 ? <Button kind="secondary" label={t('common.back')} onPress={() => setStep(step - 1)} style={{ flex: 1 }} /> : null}
          {step < STEPS - 1 ? (
            <Button label={t('common.next')} onPress={() => setStep(step + 1)} disabled={!canNext} style={{ flex: 2 }} />
          ) : (
            <Button label={t('onb.finish')} icon="check-circle-outline" onPress={finish} loading={setup.isPending} style={{ flex: 2 }} />
          )}
        </View>
      }
    >
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: space.lg }}>
        {Array.from({ length: STEPS }).map((_, i) => (
          <View key={i} style={{ flex: 1, height: 6, borderRadius: radius.pill, backgroundColor: i <= step ? color.primary : color.surfaceAlt }} />
        ))}
      </View>
      <View style={{ marginBottom: space.md }}>
        <Pill small icon="timer-sand" tone={elapsed < 120 ? 'sage' : 'accent'} label={t('onb.timer', { m: Math.floor(elapsed / 60), s: String(elapsed % 60).padStart(2, '0') })} />
      </View>

      {step === 0 ? (
        <>
          <Text tone="muted" style={{ marginBottom: space.lg }}>{t('onb.s1Body')}</Text>
          <Field label={t('family.name')} value={p.family_name} onChange={(family_name) => setP({ ...p, family_name })} placeholder={t('onb.namePlaceholder')} />
        </>
      ) : step === 1 ? (
        <>
          <Text tone="muted" style={{ marginBottom: space.lg }}>{t('onb.s2Body')}</Text>
          <MembersEditor profile={p} onChange={setP} />
        </>
      ) : (
        <>
          <Text tone="muted" style={{ marginBottom: space.lg }}>{t('onb.s3Body')}</Text>
          <FoodEditor profile={p} onChange={setP} />
          <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: touch, marginTop: space.lg }}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{t('onb.fresh')}</Text>
              <Text variant="caption" tone="muted">{t('onb.freshHint')}</Text>
            </View>
            <Switch value={fresh} onValueChange={setFresh} accessibilityLabel={t('onb.fresh')}
              trackColor={{ true: color.primary, false: color.borderStrong }} thumbColor={color.surface} />
          </View>
        </>
      )}
    </Screen>
  );
}
