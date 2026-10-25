import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import type { Lang } from '@/lib/api';
import { defaultApiUrl } from '@/lib/config';
import { useHousehold } from '@/lib/queries';
import { useSettings } from '@/lib/settings';
import { Field, Screen } from '@/ui/controls';
import { Button, Card, Icon, Segmented, Text } from '@/ui/primitives';
import { color, radius, space } from '@/ui/theme';
import type { IconName } from '@/lib/format';

export default function Welcome() {
  const { t, lang, update, apiOverride } = useSettings();
  const household = useHousehold();
  const [server, setServer] = useState(apiOverride ?? '');
  const ok = !!household.data;

  const points: [IconName, string][] = [
    ['cart-outline', t('welcome.p1')],
    ['fridge-outline', t('welcome.p2')],
    ['pot-steam-outline', t('welcome.p3')],
  ];
  return (
    <Screen>
      <View style={{ alignItems: 'flex-start', gap: space.md, marginTop: space.xl }}>
        <View style={{ width: 64, height: 64, borderRadius: radius.lg, backgroundColor: color.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="leaf" size={34} tint={color.onPrimary} />
        </View>
        <Text variant="display" accessibilityRole="header">AnnaSaathi</Text>
        <Text variant="heading" tone="muted">{t('welcome.tagline')}</Text>
      </View>

      <View style={{ gap: space.md, marginTop: space.xxl }}>
        {points.map(([icon, text]) => (
          <View key={text} style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: color.sage, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={icon} tint={color.sageText} />
            </View>
            <Text style={{ flex: 1 }}>{text}</Text>
          </View>
        ))}
      </View>

      <Text variant="label" style={{ marginTop: space.xxl, marginBottom: space.sm }}>{t('settings.language')}</Text>
      <Segmented<Lang> value={lang} onChange={(l) => update({ lang: l })}
        options={[{ value: 'en', label: 'English' }, { value: 'hi', label: 'हिंदी' }, { value: 'mr', label: 'मराठी' }]} />

      {household.isError ? (
        <Card tone="accent" style={{ marginTop: space.xl, gap: space.sm }}>
          <Text variant="label" style={{ color: color.accentText }}>{t('welcome.noServer')}</Text>
          <Text variant="caption" style={{ color: color.accentText }}>{t('welcome.noServerBody')}</Text>
          <Field label={t('settings.server')} value={server} onChange={setServer} keyboardType="url" placeholder={defaultApiUrl()} />
          <Button compact label={t('welcome.tryAgain')} onPress={() => { update({ apiOverride: server.trim() || null }); setTimeout(() => household.refetch(), 50); }} />
        </Card>
      ) : null}

      <View style={{ gap: space.sm, marginTop: space.xxl }}>
        <Button label={t('welcome.setup')} icon="account-group-outline" disabled={!ok} onPress={() => router.push('/onboarding')} />
        <Button kind="secondary" label={ok ? t('welcome.demo', { name: household.data!.family_name }) : t('welcome.demoPlain')} disabled={!ok}
          onPress={() => { update({ welcomed: true }); router.replace('/'); }} />
        <Text variant="caption" tone="muted" style={{ textAlign: 'center' }}>{t('welcome.setupNote')}</Text>
      </View>
    </Screen>
  );
}
