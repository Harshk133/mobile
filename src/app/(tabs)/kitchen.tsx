import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { api, type CatalogueItem, type InvItem } from '@/lib/api';
import { CATEGORY_GROUPS, STATUS, categoryIcon, daysLeft, groupOf, qtyStep, rupees } from '@/lib/format';
import { useInventory, useRefreshStock, useStockMutation } from '@/lib/queries';
import { useSettings } from '@/lib/settings';
import { CookedList } from '@/ui/cooked';
import { CataloguePicker, Screen, Sheet, Stepper } from '@/ui/controls';
import { EmptyState, ErrorState, ListSkeleton, useToast } from '@/ui/feedback';
import { Button, Card, Chip, Icon, IconButton, IconTile, Pill, Segmented, Text, haptic } from '@/ui/primitives';
import { color, space } from '@/ui/theme';

type Filter = 'all' | 'use' | 'fresh' | 'low' | 'cooked';

const FILTERS: Record<Exclude<Filter, 'cooked'>, (i: InvItem) => boolean> = {
  all: (i) => i.status !== 'finished',
  use: (i) => ['spoiled', 'use_today', 'use_soon'].includes(i.status),
  fresh: (i) => i.status === 'fresh',
  low: (i) => i.low_stock || i.status === 'finished',
};

export default function Kitchen() {
  const { t, nameOf } = useSettings();
  const toast = useToast();
  const inv = useInventory();
  const refresh = useRefreshStock();
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<'urgency' | 'category'>('urgency');
  const [picking, setPicking] = useState(false);
  const [adding, setAdding] = useState<CatalogueItem | null>(null);
  const [qty, setQty] = useState(1);
  const add = useStockMutation((v: { item_id: string; qty: number }) => api.addItem(v));

  const items = inv.data?.items ?? [];
  const counts = useMemo(
    () => ({
      all: items.filter(FILTERS.all).length,
      use: items.filter(FILTERS.use).length,
      fresh: items.filter(FILTERS.fresh).length,
      low: items.filter(FILTERS.low).length,
    }),
    [items],
  );
  const shown = filter === 'cooked' ? [] : items.filter(FILTERS[filter]); // already sorted by urgency on the server
  const sections =
    sort === 'category'
      ? CATEGORY_GROUPS.map((g) => ({ g, rows: shown.filter((i) => groupOf(i.category).key === g.key) })).filter((s) => s.rows.length)
      : [{ g: null, rows: shown }];

  const w = inv.data?.weather;
  return (
    <Screen
      title={t('kitchen.title')}
      subtitle={
        inv.data
          ? inv.data.at_risk_rupees > 0
            ? t('kitchen.subtitleRisk', { n: counts.all, amount: rupees(inv.data.at_risk_rupees) })
            : t('kitchen.subtitle', { n: counts.all })
          : ' '
      }
      right={
        <>
          <IconButton icon="camera-outline" label={t('home.scan')} onPress={() => router.push('/scan')} />
          <IconButton icon="plus" label={t('kitchen.add')} onPress={() => setPicking(true)} tint={color.primary} />
        </>
      }
      refreshing={inv.isRefetching}
      onRefresh={() => refresh()}
    >
      {w ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: space.md }}>
          <Icon name="thermometer" size={18} tint={color.textMuted} />
          <Text variant="caption" tone="muted">
            {t('kitchen.weather', { temp: Math.round(w.temp_c), city: w.city || '', source: w.source })}
          </Text>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.lg }}
        contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg }}>
        <Chip label={t('kitchen.f.all')} count={counts.all} selected={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label={t('kitchen.f.use')} icon="clock-alert-outline" count={counts.use} selected={filter === 'use'} onPress={() => setFilter('use')} />
        <Chip label={t('kitchen.f.fresh')} icon="check-circle-outline" count={counts.fresh} selected={filter === 'fresh'} onPress={() => setFilter('fresh')} />
        <Chip label={t('kitchen.f.low')} icon="arrow-down-circle-outline" count={counts.low} selected={filter === 'low'} onPress={() => setFilter('low')} />
        <Chip label={t('kitchen.f.cooked')} icon="pot-steam-outline" selected={filter === 'cooked'} onPress={() => setFilter('cooked')} />
      </ScrollView>

      {filter === 'cooked' ? (
        <View style={{ marginTop: space.lg }}>
          <CookedList />
        </View>
      ) : inv.isError ? (
        <ErrorState error={inv.error} onRetry={() => inv.refetch()} />
      ) : inv.isLoading ? (
        <ListSkeleton rows={5} />
      ) : !items.length ? (
        <EmptyState
          icon="fridge-outline"
          title={t('kitchen.emptyTitle')}
          body={t('kitchen.emptyBody')}
          action={{ label: t('home.scan'), icon: 'camera-outline', onPress: () => router.push('/scan') }}
        />
      ) : (
        <>
          <Card tone="sage" onPress={() => router.push('/check')} accessibilityLabel={t('kitchen.checkTitle')}
            style={{ marginTop: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md }}>
            <Icon name="format-list-checks" tint={color.sageText} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong" style={{ color: color.sageText }}>{t('kitchen.checkTitle')}</Text>
              <Text variant="caption" style={{ color: color.sageText }}>{t('kitchen.checkBody')}</Text>
            </View>
            <Icon name="chevron-right" tint={color.sageText} />
          </Card>
          <View style={{ marginTop: space.md }}>
            <Segmented value={sort} onChange={setSort}
              options={[{ value: 'urgency', label: t('kitchen.sortUrgency') }, { value: 'category', label: t('kitchen.sortCategory') }]} />
          </View>
          {shown.length ? (
            sections.map(({ g, rows }) => (
              <View key={g?.key ?? 'all'} style={{ marginTop: space.lg, gap: space.sm }}>
                {g ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <Icon name={g.icon} size={20} tint={color.textMuted} />
                    <Text variant="heading" accessibilityRole="header">{t(g.key)}</Text>
                  </View>
                ) : null}
                {rows.map((i) => <KitchenRow key={i.item_id} item={i} />)}
              </View>
            ))
          ) : (
            <EmptyState icon="check-circle-outline" title={t('kitchen.filterEmpty')} />
          )}
          <Text variant="caption" tone="faint" style={{ marginTop: space.xl }}>
            {t('kitchen.disclaimer')}
          </Text>
        </>
      )}

      <CataloguePicker
        visible={picking}
        title={t('kitchen.add')}
        onClose={() => setPicking(false)}
        onPick={(i) => {
          setPicking(false);
          setQty(i.pack_size);
          setAdding(i);
        }}
      />
      {adding ? (
        <Sheet
          visible
          onClose={() => setAdding(null)}
          title={t('kitchen.addTitle', { name: nameOf(adding) })}
          footer={
            <Button
              label={t('kitchen.addConfirm')}
              icon="plus"
              loading={add.isPending}
              onPress={() =>
                add.mutate({ item_id: adding.id, qty }, {
                  onError: (e) => toast({ message: e instanceof Error ? e.message : String(e), tone: 'error' }),
                  onSuccess: () => {
                    haptic.success();
                    toast({ message: t('kitchen.added', { name: nameOf(adding) }) });
                    setAdding(null);
                  },
                })
              }
            />
          }
        >
          <Text tone="muted" style={{ marginBottom: space.md }}>{t('kitchen.addBody')}</Text>
          <Stepper value={qty} onChange={setQty} step={qtyStep(adding.unit, adding.pack_size)} min={qtyStep(adding.unit, adding.pack_size)}
            label={nameOf(adding)} unitLabel={{ unit: adding.unit, like: adding.category === 'leafy' ? '2 bunches' : undefined }} />
        </Sheet>
      ) : null}
    </Screen>
  );
}

function KitchenRow({ item: i }: { item: InvItem }) {
  const { t, nameOf } = useSettings();
  const st = STATUS[i.status];
  const fresh = i.printed_expiry ? t('kitchen.printed', { date: i.printed_expiry.slice(5) }) : daysLeft(i.days_left, t);
  return (
    <Card
      onPress={() => router.push(`/item/${i.item_id}`)}
      accessibilityLabel={`${nameOf(i)}, ${i.remaining_label}, ${fresh}, ${t(st.key)}`}
      style={{ flexDirection: 'row', gap: space.md, alignItems: 'center', padding: space.md }}
    >
      <IconTile name={categoryIcon(i.category)} tone={st.tone === 'primary' ? 'sage' : st.tone} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{nameOf(i)}</Text>
        <Text variant="caption" tone="muted">
          {i.remaining_label} · {fresh}
        </Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
          <Pill small label={t(st.key)} icon={st.icon} tone={st.tone} />
          {i.low_stock && i.status !== 'finished' ? <Pill small label={t('status.low')} icon="arrow-down-circle-outline" tone="neutral" /> : null}
          <Pill small label={i.storage === 'fridge' ? t('storage.fridge') : t('storage.counter')} icon={i.storage === 'fridge' ? 'fridge-outline' : 'home-outline'} />
        </View>
      </View>
      <Icon name="chevron-right" tint={color.textFaint} />
    </Card>
  );
}
