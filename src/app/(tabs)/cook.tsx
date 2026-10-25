import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { api, type Dish } from '@/lib/api';
import { clockTime, daysLeft, qtyStep, rupees } from '@/lib/format';
import { useInventory, usePlan, useRefreshStock, useStockMutation } from '@/lib/queries';
import { useSettings, type TKey } from '@/lib/settings';
import { CookedList } from '@/ui/cooked';
import { Screen, Sheet, Stepper } from '@/ui/controls';
import { EmptyState, ErrorState, ListSkeleton, useToast } from '@/ui/feedback';
import { Button, Card, Chip, Icon, IconTile, Pill, SectionHeader, Segmented, Text, haptic } from '@/ui/primitives';
import { color, space } from '@/ui/theme';

const PREP_ICON = { roasted: 'fire', fried: 'pot-steam-outline', wet: 'pot-steam-outline', sprouts: 'seed', raw: 'leaf' } as const;

export default function Cook() {
  const { t, nameOf } = useSettings();
  const plan = usePlan();
  const inv = useInventory();
  const refresh = useRefreshStock();
  const [cooking, setCooking] = useState<Dish | null>(null);
  const atRisk = (inv.data?.items ?? []).filter((i) => ['use_today', 'use_soon', 'spoiled'].includes(i.status));

  return (
    <Screen title={t('cook.title')} subtitle={t('cook.subtitle')} refreshing={plan.isRefetching} onRefresh={() => refresh()}>
      {atRisk.length ? (
        <>
          <Text variant="label" tone="muted" style={{ marginBottom: space.sm }}>
            {t('cook.useFirst')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.lg, marginBottom: space.md }}
            contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg }}>
            {atRisk.map((i) => (
              <Chip key={i.item_id} label={`${nameOf(i)} · ${daysLeft(i.days_left, t)}`} icon="clock-alert-outline"
                onPress={() => router.push(`/item/${i.item_id}`)} />
            ))}
          </ScrollView>
        </>
      ) : null}

      {plan.isError ? (
        <ErrorState error={plan.error} onRetry={() => plan.refetch()} />
      ) : plan.isLoading ? (
        <ListSkeleton rows={3} />
      ) : plan.data?.dishes.length ? (
        <View style={{ gap: space.md }}>
          {plan.data.dishes.map((d) => (
            <DishCard key={d.recipe_id} dish={d} onCook={() => setCooking(d)} />
          ))}
        </View>
      ) : (
        <EmptyState icon="pot-steam-outline" title={t('cook.emptyTitle')} body={t('cook.emptyBody')}
          action={{ label: t('home.scan'), icon: 'camera-outline', onPress: () => router.push('/scan') }} />
      )}

      <SectionHeader title={t('cook.cookedFood')} />
      <CookedList compactEmpty />

      {cooking ? <CookSheet dish={cooking} onClose={() => setCooking(null)} /> : null}
    </Screen>
  );
}

function DishCard({ dish: d, onCook }: { dish: Dish; onCook: () => void }) {
  const { t, nameOf, altNameOf } = useSettings();
  const [open, setOpen] = useState(false);
  const have = d.ingredients.filter((i) => i.have);
  const missing = d.ingredients.filter((i) => !i.have && !i.minor);
  return (
    <Card style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
        <IconTile name={PREP_ICON[d.prep as keyof typeof PREP_ICON] ?? 'silverware-fork-knife'} tone="accent" size={52} />
        <View style={{ flex: 1 }}>
          <Text variant="caption" tone="muted">
            {t(`slot.${d.slot}` as TKey)} · {t('cook.minutes', { n: d.time_min })} · {t(`prep.${d.prep}` as TKey)}
          </Text>
          <Text variant="heading">{nameOf(d)}</Text>
          {altNameOf(d) ? <Text variant="caption" tone="faint">{altNameOf(d)}</Text> : null}
        </View>
      </View>

      <Text>{d.reason}</Text>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {d.rescued_rupees > 0 ? <Pill tone="sage" icon="leaf" label={t('cook.saves', { amount: rupees(d.rescued_rupees) })} /> : null}
        {d.uses.filter((u) => u.rescues).map((u) => (
          <Pill key={u.item_id} tone="accent" icon="clock-alert-outline" label={`${nameOf(u)} · ${u.qty_label}`} />
        ))}
      </View>

      <View style={{ gap: 4 }}>
        <Text variant="label">{t('cook.have', { n: have.length, total: d.ingredients.length })}</Text>
        <Text variant="caption" tone="muted">{have.map((i) => nameOf(i)).join(', ') || '—'}</Text>
        {missing.length ? (
          <>
            <Text variant="label" style={{ marginTop: 6, color: color.accentText }}>{t('cook.missing')}</Text>
            <Text variant="caption" tone="muted">{missing.map((i) => nameOf(i)).join(', ')}</Text>
          </>
        ) : null}
      </View>

      {d.keeps ? (
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Icon name="timer-sand" size={16} tint={color.textMuted} />
          <Text variant="caption" tone="muted" style={{ flex: 1 }}>{d.keeps}</Text>
        </View>
      ) : null}

      <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }}>
        <Text variant="label" tone="primary">{open ? t('cook.hideMethod') : t('cook.showMethod')}</Text>
        <Icon name={open ? 'chevron-left' : 'chevron-right'} size={18} tint={color.primary} />
      </Pressable>
      {open ? (
        <View style={{ gap: space.sm }}>
          {d.steps.map((s, n) => (
            <View key={n} style={{ flexDirection: 'row', gap: space.sm }}>
              <Text variant="label" tone="primary" style={{ width: 20 }}>{n + 1}.</Text>
              <Text style={{ flex: 1 }}>{s}</Text>
            </View>
          ))}
          <Text variant="caption" tone="faint">{t('cook.methodNote', { n: d.serves })}</Text>
        </View>
      ) : null}

      <Button label={t('cook.markCooked')} icon="check-circle-outline" onPress={onCook} />
    </Card>
  );
}

function CookSheet({ dish, onClose }: { dish: Dish; onClose: () => void }) {
  const { t, nameOf } = useSettings();
  const toast = useToast();
  const est = useQuery({ queryKey: ['consumption', dish.recipe_id], queryFn: () => api.consumption(dish.recipe_id), staleTime: 0 });
  const [qty, setQty] = useState<Record<string, number>>({});
  const [storage, setStorage] = useState<'room' | 'fridge'>('room');
  useEffect(() => {
    if (est.data) setQty(Object.fromEntries(est.data.items.map((i) => [i.item_id, i.qty])));
  }, [est.data]);
  const cook = useStockMutation(() =>
    api.cook({ recipe_id: dish.recipe_id, storage, consumed: Object.entries(qty).filter(([, q]) => q > 0).map(([item_id, q]) => ({ item_id, qty: q })) }));

  const atHome = (est.data?.items ?? []).filter((i) => i.have > 0);
  const notHome = (est.data?.items ?? []).filter((i) => i.have <= 0);

  return (
    <Sheet
      visible
      onClose={onClose}
      title={t('cook.sheetTitle', { name: nameOf(dish) })}
      footer={
        <Button
          label={t('cook.confirm')}
          icon="check-circle-outline"
          loading={cook.isPending}
          disabled={!est.data}
          onPress={() =>
            cook.mutate(undefined, {
              onError: (e) => toast({ message: e instanceof Error ? e.message : String(e), tone: 'error' }),
              onSuccess: (r) => {
                haptic.success();
                onClose();
                toast({ message: t('cook.logged', { name: nameOf(dish), time: clockTime(r.finish_by) }) });
              },
            })
          }
        />
      }
    >
      <Text tone="muted" style={{ marginBottom: space.md }}>{t('cook.sheetBody')}</Text>
      {est.isLoading ? <ListSkeleton rows={2} /> : est.isError ? <ErrorState error={est.error} onRetry={() => est.refetch()} /> : null}
      <View style={{ gap: space.md }}>
        {atHome.map((i) => (
          <View key={i.item_id} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="label">{nameOf(i)}</Text>
              <Text variant="caption" tone="muted">{t('cook.haveAmount', { qty: i.have_label })}</Text>
            </View>
            <Stepper
              value={qty[i.item_id] ?? 0}
              onChange={(v) => setQty({ ...qty, [i.item_id]: v })}
              step={qtyStep(i.unit, Math.min(i.pack_size, i.unit === 'pc' ? 1 : 0.25)) / (i.unit === 'pc' ? 2 : 5)}
              max={i.have}
              label={nameOf(i)}
              unitLabel={{ unit: i.unit, like: i.have_label }}
            />
          </View>
        ))}
        {notHome.length ? (
          <Text variant="caption" tone="muted">{t('cook.notAtHome', { list: notHome.map((i) => nameOf(i)).join(', ') })}</Text>
        ) : null}
        <Text variant="label" style={{ marginTop: space.sm }}>{t('cook.leftovers')}</Text>
        <Segmented value={storage} onChange={setStorage}
          options={[{ value: 'room', label: t('storage.room') }, { value: 'fridge', label: t('storage.fridge') }]} />
        {dish.keeps ? <Text variant="caption" tone="muted">{dish.keeps}</Text> : null}
      </View>
    </Sheet>
  );
}
