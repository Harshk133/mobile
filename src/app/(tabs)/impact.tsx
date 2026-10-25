import { useState } from 'react';
import { View } from 'react-native';

import { rupees } from '@/lib/format';
import { useImpact, useWaste } from '@/lib/queries';
import { useSettings } from '@/lib/settings';
import { Screen } from '@/ui/controls';
import { ErrorState, ListSkeleton } from '@/ui/feedback';
import { Card, Icon, Pill, SectionHeader, Segmented, Text } from '@/ui/primitives';
import { color, radius, space } from '@/ui/theme';

type Level = '50' | '70' | '100';

export default function Impact() {
  const { t } = useSettings();
  const impact = useImpact();
  const waste = useWaste();
  const [level, setLevel] = useState<Level>('70');
  const d = impact.data;

  return (
    <Screen title={t('impact.title')} subtitle={t('impact.subtitle')}>
      <Card tone="accent" style={{ flexDirection: 'row', gap: space.md, padding: space.md }}>
        <Icon name="information-outline" tint={color.accentText} />
        <Text style={{ flex: 1, color: color.accentText }}>
          {d ? t('impact.simulatedNote', { n: d.households, days: d.days, seed: d.seed }) : t('impact.simulatedShort')}
        </Text>
      </Card>

      {impact.isError ? (
        <ErrorState error={impact.error} onRetry={() => impact.refetch()} />
      ) : !d ? (
        <ListSkeleton rows={3} />
      ) : (
        <Results d={d} level={level} setLevel={setLevel} />
      )}

      <SectionHeader title={t('impact.yoursTitle')} />
      <Card style={{ gap: space.sm }}>
        <Pill label={t('impact.actual')} icon="check-circle-outline" tone="sage" small />
        {waste.data && waste.data.rows.length ? (
          <>
            <Text variant="heading">{t('impact.yoursLogged', { kg: waste.data.kg, amount: rupees(waste.data.rupees) })}</Text>
            <Text tone="muted">{t('impact.yoursBody')}</Text>
          </>
        ) : (
          <Text tone="muted">{t('impact.yoursNone')}</Text>
        )}
      </Card>
    </Screen>
  );
}

function Results({ d, level, setLevel }: { d: NonNullable<ReturnType<typeof useImpact>['data']>; level: Level; setLevel: (l: Level) => void }) {
  const { t } = useSettings();
  const base = d.baseline;
  const arm = d.levels[level];
  const cut = Math.round((1 - arm.kg / base.kg) * 100);
  return (
    <>
      <Text variant="label" style={{ marginTop: space.xl, marginBottom: space.sm }}>
        {t('impact.following')}
      </Text>
      <Segmented
        value={level}
        onChange={setLevel}
        options={[{ value: '50', label: '50%' }, { value: '70', label: '70%' }, { value: '100', label: '100%' }]}
      />
      <Text variant="caption" tone="muted" style={{ marginTop: space.sm }}>
        {t('impact.followingHelp', { n: level })}
      </Text>

      <Card style={{ marginTop: space.lg, gap: space.md }} accessibilityLabel={t('impact.cutA11y', { n: cut })}>
        <Text variant="caption" tone="muted">{t('impact.wasteLabel')}</Text>
        <Text variant="display" tone="primary">{t('impact.cut', { n: cut })}</Text>
        <Bar label={t('impact.baseline')} value={base.kg} max={base.kg} text={t('impact.kg', { n: base.kg.toFixed(1) })} tone="base" />
        <Bar label={t('impact.withApp')} value={arm.kg} max={base.kg} text={t('impact.kg', { n: arm.kg.toFixed(1) })} tone="app" />
      </Card>

      <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.md }}>
        <Card style={{ flex: 1, gap: 4 }}>
          <Text variant="caption" tone="muted">{t('impact.moneyLabel')}</Text>
          <Text variant="title">{rupees(arm.rs)}</Text>
          <Text variant="caption" tone="muted">{t('impact.vs', { v: rupees(base.rs) })}</Text>
          <Text variant="label" tone="primary">{t('impact.saved', { v: rupees(base.rs - arm.rs) })}</Text>
        </Card>
        <Card style={{ flex: 1, gap: 4 }}>
          <Text variant="caption" tone="muted">{t('impact.runOutLabel')}</Text>
          <Text variant="title">{arm.shortages.toFixed(0)}</Text>
          <Text variant="caption" tone="muted">{t('impact.vs', { v: base.shortages.toFixed(0) })}</Text>
          <Text variant="label" tone={arm.shortages <= base.shortages ? 'primary' : 'danger'}>
            {arm.shortages <= base.shortages ? t('impact.noMoreRunOuts') : t('impact.moreRunOuts')}
          </Text>
        </Card>
      </View>

      <SectionHeader title={t('impact.howTitle')} />
      <Card style={{ gap: space.sm }}>
        <Text tone="muted">{t('impact.how1', { n: d.households, days: d.days, p: d.avg_persons })}</Text>
        <Text tone="muted">{t('impact.how2')}</Text>
        <Text tone="muted">{t('impact.how3', { raw: d.calibration.raw_kg_per_person_year, target: d.calibration.target })}</Text>
        <Text tone="muted">{t('impact.how4')}</Text>
      </Card>
    </>
  );
}

function Bar({ label, value, max, text, tone }: { label: string; value: number; max: number; text: string; tone: 'base' | 'app' }) {
  return (
    <View style={{ gap: 6 }} accessible accessibilityLabel={`${label}: ${text}`}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="label">{label}</Text>
        <Text variant="label">{text}</Text>
      </View>
      <View style={{ height: 14, borderRadius: radius.pill, backgroundColor: color.surfaceAlt, overflow: 'hidden' }}>
        <View style={{ width: `${Math.max(2, (value / max) * 100)}%`, height: '100%', borderRadius: radius.pill,
          backgroundColor: tone === 'base' ? color.borderStrong : color.primary }} />
      </View>
    </View>
  );
}
