import { router } from 'expo-router';
import { View } from 'react-native';

import { STATUS, categoryIcon, daysLeft, greetingKey, rupees, shortDate } from '@/lib/format';
import { useAlerts, useHousehold, useInventory, usePlan, useRefreshStock, useShopping } from '@/lib/queries';
import { useSettings } from '@/lib/settings';
import { Screen } from '@/ui/controls';
import { ErrorState, ListSkeleton, Skeleton } from '@/ui/feedback';
import { Button, Card, Icon, IconButton, IconTile, Pill, SectionHeader, Text } from '@/ui/primitives';
import { color, radius, space } from '@/ui/theme';

export default function Home() {
  const { t, nameOf, dismissedAlerts } = useSettings();
  const household = useHousehold();
  const shopping = useShopping();
  const inventory = useInventory();
  const plan = usePlan();
  const alerts = useAlerts();
  const refresh = useRefreshStock();

  const h = household.data;
  const alertCount = (alerts.data?.alerts ?? []).filter((a) => !dismissedAlerts.includes(a.id)).length;
  const attention = (inventory.data?.items ?? []).filter((i) => ['spoiled', 'use_today', 'use_soon'].includes(i.status)).slice(0, 3);
  const dish = [...(plan.data?.dishes ?? [])].sort((a, b) => b.rescued_rupees - a.rescued_rupees)[0];
  const s = shopping.data;
  const stillToBuy = s ? s.counts.to_buy - s.counts.bought : 0;

  if (household.isError) {
    return (
      <Screen>
        <ErrorState error={household.error} onRetry={() => refresh()} />
      </Screen>
    );
  }

  return (
    <Screen
      refreshing={household.isRefetching}
      onRefresh={() => refresh()}
      right={
        <>
          <IconButton icon="bell-outline" label={t('home.alerts')} badge={alertCount} onPress={() => router.push('/alerts')} />
          <IconButton icon="account-group-outline" label={t('home.family')} onPress={() => router.push('/family')} />
        </>
      }
      title={t(greetingKey())}
      subtitle={h ? t('home.familyLine', { name: h.family_name, n: h.members.length }) : ' '}
    >
      {/* ---------------- before you shop */}
      <Card tone="primary" style={{ padding: space.xl, gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Icon name="cart-outline" tint={color.onPrimaryMuted} size={20} />
          <Text variant="label" style={{ color: color.onPrimaryMuted }}>
            {t('home.beforeShop')}
          </Text>
        </View>
        <Text variant="title" tone="onPrimary">
          {t('home.shopHeadline')}
        </Text>
        {s ? (
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Stat value={String(stillToBuy)} label={t('home.toBuy')} />
            <Stat value={String(s.counts.have)} label={t('home.atHome')} />
            <Stat value={rupees(s.list_rupees)} label={t('home.estimate')} />
          </View>
        ) : (
          <Skeleton height={48} />
        )}
        {s ? (
          <Text variant="caption" style={{ color: color.onPrimaryMuted }}>
            {s.trip
              ? t('home.tripOpen', { n: s.counts.bought })
              : s.counts.have > 0
                ? t('home.haveLine', { n: s.counts.have, day: shortDate(s.shop_date, t) })
                : t('home.nextShop', { day: shortDate(s.shop_date, t) })}
          </Text>
        ) : null}
        <Button kind="onPrimary" icon="format-list-checks" label={t('home.reviewList')} onPress={() => router.push('/shop')} />
      </Card>

      {/* ---------------- quick actions */}
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
        <Button kind="secondary" icon="camera-outline" label={t('home.scan')} onPress={() => router.push('/scan')} style={{ flex: 1 }} />
        <Button kind="secondary" icon="microphone-outline" label={t('home.speak')} onPress={() => router.push('/voice')} style={{ flex: 1 }} />
      </View>

      {/* ---------------- needs attention */}
      <SectionHeader title={t('home.attention')} action={{ label: t('common.seeAll'), onPress: () => router.push('/kitchen') }} />
      {inventory.isLoading ? (
        <ListSkeleton rows={2} />
      ) : attention.length ? (
        <Card style={{ paddingVertical: space.sm }}>
          {attention.map((i, n) => {
            const st = STATUS[i.status];
            return (
              <Card
                key={i.item_id}
                onPress={() => router.push(`/item/${i.item_id}`)}
                accessibilityLabel={`${nameOf(i)}, ${t(st.key)}`}
                style={{
                  borderWidth: 0, padding: 0, paddingVertical: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.md,
                  borderTopWidth: n ? 1 : 0, borderTopColor: color.border, borderRadius: 0, shadowOpacity: 0, elevation: 0,
                }}
              >
                <IconTile name={categoryIcon(i.category)} tone={st.tone} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{nameOf(i)}</Text>
                  <Text variant="caption" tone="muted">
                    {i.remaining_label} · {daysLeft(i.days_left, t)}
                  </Text>
                </View>
                <Pill label={t(st.key)} icon={st.icon} tone={st.tone} small />
              </Card>
            );
          })}
        </Card>
      ) : (
        <Card tone="sage" style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
          <Icon name="check-circle-outline" tint={color.sageText} />
          <Text style={{ flex: 1, color: color.sageText }}>{t('home.nothingUrgent')}</Text>
        </Card>
      )}

      {/* ---------------- cook first */}
      <SectionHeader title={t('home.cookFirst')} action={{ label: t('common.seeAll'), onPress: () => router.push('/cook') }} />
      {plan.isLoading ? (
        <ListSkeleton rows={1} />
      ) : dish ? (
        <Card onPress={() => router.push('/cook')} accessibilityLabel={`${t('home.suggestion')}: ${nameOf(dish)}`} style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <IconTile name="pot-steam-outline" tone="accent" />
            <View style={{ flex: 1 }}>
              <Text variant="caption" tone="muted">
                {t('home.suggestion')} · {t(`slot.${dish.slot}`)}
              </Text>
              <Text variant="heading">{nameOf(dish)}</Text>
            </View>
            <Icon name="chevron-right" tint={color.textFaint} />
          </View>
          <Text tone="muted">{dish.reason}</Text>
          {dish.rescued_rupees > 0 ? (
            <Pill tone="sage" icon="leaf" label={t('cook.saves', { amount: rupees(dish.rescued_rupees) })} />
          ) : null}
        </Card>
      ) : (
        <Card>
          <Text tone="muted">{t('home.noDish')}</Text>
        </Card>
      )}

      {/* ---------------- insight */}
      {inventory.data ? (
        <View
          style={{
            marginTop: space.xl, padding: space.lg, borderRadius: radius.lg, backgroundColor: color.surfaceAlt,
            flexDirection: 'row', gap: space.md, alignItems: 'flex-start',
          }}
        >
          <Icon name="information-outline" tint={color.textMuted} />
          <Text tone="muted" style={{ flex: 1 }}>
            {inventory.data.at_risk_rupees > 0
              ? t('home.atRisk', { amount: rupees(inventory.data.at_risk_rupees) })
              : t('home.noRisk')}
          </Text>
        </View>
      ) : null}

      <Button kind="ghost" icon="format-list-checks" label={t('home.weeklyCheck')} onPress={() => router.push('/check')} style={{ marginTop: space.md }} />
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: radius.md, padding: space.md }}>
      <Text variant="title" tone="onPrimary" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text variant="caption" style={{ color: color.onPrimaryMuted }} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}
