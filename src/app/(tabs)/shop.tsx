import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { api, type ShopRow } from '@/lib/api';
import { CATEGORY_GROUPS, categoryIcon, groupOf, qtyLabel, qtyStep, rupees, shopStatus, shortDate } from '@/lib/format';
import { useRefreshStock, useShopMutation, useShopping } from '@/lib/queries';
import { useSettings } from '@/lib/settings';
import { CataloguePicker, Screen, SearchField, Sheet, Stepper, matches } from '@/ui/controls';
import { EmptyState, ErrorState, ListSkeleton, useToast } from '@/ui/feedback';
import { Button, Card, Chip, Fact, Icon, IconButton, IconTile, Pill, Segmented, Text, haptic } from '@/ui/primitives';
import { color, radius, space, touch } from '@/ui/theme';

type View_ = 'recommended' | 'all';

export default function Shop() {
  const { t, nameOf } = useSettings();
  const toast = useToast();
  const shopping = useShopping();
  const refresh = useRefreshStock();
  const [view, setView] = useState<View_>('recommended');
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const [open, setOpen] = useState<ShopRow | null>(null);
  const [picking, setPicking] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const onError = (e: unknown) => toast({ message: e instanceof Error ? e.message : String(e), tone: 'error' });
  const purchase = useShopMutation((v: { id: string; qty?: number }) => api.purchase(v.id, v.qty));
  const unpurchase = useShopMutation((id: string) => api.unpurchase(id));
  const edit = useShopMutation((v: { id: string; qty?: number; excluded?: boolean }) => api.editShopItem(v.id, { qty: v.qty, excluded: v.excluded }));
  const reset = useShopMutation((id: string) => api.resetShopItem(id));
  const add = useShopMutation((id: string) => api.addShopItem(id));
  const start = useShopMutation(() => api.startShopping());
  const finish = useShopMutation(async () => (await api.finishShopping()).shopping);

  const s = shopping.data;
  const rows = useMemo(() => {
    let r = s?.rows ?? [];
    if (view === 'recommended') r = r.filter((x) => x.status !== 'have');
    if (group) r = r.filter((x) => groupOf(x.category).key === group);
    return r.filter((x) => matches(q, x));
  }, [s, view, group, q]);
  const groupsPresent = CATEGORY_GROUPS.filter((g) => (s?.rows ?? []).some((r) => g.categories.includes(r.category)));

  const togglePurchase = (r: ShopRow) => {
    setPending(r.item_id);
    const done = { onSettled: () => setPending(null), onError };
    if (r.purchased) unpurchase.mutate(r.item_id, done);
    else
      purchase.mutate({ id: r.item_id, qty: r.qty }, {
        ...done,
        onSuccess: () => {
          haptic.success();
          toast({ message: t('shop.addedToKitchen', { name: nameOf(r), qty: r.qty_label }) });
        },
      });
  };

  const skip = (r: ShopRow) => {
    edit.mutate({ id: r.item_id, excluded: true }, {
      onError,
      onSuccess: () =>
        toast({
          message: t('shop.skipped', { name: nameOf(r) }),
          action: { label: t('common.undo'), onPress: () => edit.mutate({ id: r.item_id, excluded: false }, { onError }) },
        }),
    });
    setOpen(null);
  };

  const subtitle = !s
    ? ' '
    : s.trip
      ? t('shop.tripSubtitle', { bought: s.counts.bought, total: s.counts.to_buy })
      : t('shop.subtitle', { day: shortDate(s.shop_date, t), n: s.counts.to_buy, amount: rupees(s.list_rupees) });

  const footer = s ? (
    s.trip ? (
      <Button icon="basket-check-outline" label={t('shop.finish', { n: s.counts.bought })} onPress={() => setFinishing(true)} />
    ) : (
      <Button icon="store-outline" label={t('shop.start')} loading={start.isPending} onPress={() => start.mutate(undefined, { onError })}
        accessibilityHint={t('shop.startHint')} />
    )
  ) : null;

  return (
    <Screen
      title={t('shop.title')}
      subtitle={subtitle}
      right={<IconButton icon="plus" label={t('shop.addItem')} onPress={() => setPicking(true)} tint={color.primary} />}
      refreshing={shopping.isRefetching}
      onRefresh={() => refresh()}
      footer={footer}
    >
      {shopping.isError ? (
        <ErrorState error={shopping.error} onRetry={() => shopping.refetch()} />
      ) : (
        <>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'recommended', label: `${t('shop.recommended')} · ${s ? s.counts.to_buy : '–'}` },
              { value: 'all', label: `${t('shop.all')} · ${s ? s.rows.length : '–'}` },
            ]}
          />
          <View style={{ marginTop: space.md }}>
            <SearchField value={q} onChange={setQ} placeholder={t('shop.search')} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: space.md, marginHorizontal: -space.lg }}
            contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg }}>
            <Chip label={t('common.all')} selected={!group} onPress={() => setGroup(null)} />
            {groupsPresent.map((g) => (
              <Chip key={g.key} label={t(g.key)} icon={g.icon} selected={group === g.key} onPress={() => setGroup(group === g.key ? null : g.key)} />
            ))}
          </ScrollView>

          {s && s.saved_rupees > 0 && view === 'recommended' && !q && !group ? (
            <Card tone="sage" style={{ marginTop: space.md, flexDirection: 'row', gap: space.md, alignItems: 'center', padding: space.md }}>
              <Icon name="leaf" tint={color.sageText} />
              <Text style={{ flex: 1, color: color.sageText }}>
                {t('shop.savedBanner', { amount: rupees(s.saved_rupees), kg: s.saved_kg })}
              </Text>
            </Card>
          ) : null}

          <View style={{ marginTop: space.md, gap: space.sm }}>
            {shopping.isLoading ? (
              <ListSkeleton rows={5} />
            ) : rows.length ? (
              rows.map((r) => (
                <ShopItem key={r.item_id} row={r} busy={pending === r.item_id} onToggle={() => togglePurchase(r)} onOpen={() => setOpen(r)} />
              ))
            ) : (
              <EmptyState
                icon={q || group ? 'magnify' : 'basket-check-outline'}
                title={q || group ? t('shop.noMatch') : t('shop.emptyTitle')}
                body={q || group ? undefined : t('shop.emptyBody')}
                action={q || group ? undefined : { label: t('home.scan'), icon: 'camera-outline', onPress: () => router.push('/scan') }}
              />
            )}
          </View>
          {s ? (
            <Text variant="caption" tone="faint" style={{ marginTop: space.lg }}>
              {t('shop.rule')}
            </Text>
          ) : null}
        </>
      )}

      {open ? (
        <ShopItemSheet
          row={s?.rows.find((r) => r.item_id === open.item_id) ?? open}
          onClose={() => setOpen(null)}
          onSave={(qty) => edit.mutate({ id: open.item_id, qty, excluded: false }, { onError })}
          onToggle={() => togglePurchase(s?.rows.find((r) => r.item_id === open.item_id) ?? open)}
          onSkip={() => skip(open)}
          onInclude={() => edit.mutate({ id: open.item_id, excluded: false }, { onError })}
          onReset={() => reset.mutate(open.item_id, { onError, onSuccess: () => setOpen(null) })}
          busy={edit.isPending || purchase.isPending || unpurchase.isPending}
        />
      ) : null}

      <CataloguePicker
        visible={picking}
        title={t('shop.addItem')}
        onClose={() => setPicking(false)}
        onPick={(i) => {
          setPicking(false);
          add.mutate(i.id, {
            onError,
            onSuccess: () => {
              setView('all');
              toast({ message: t('shop.added', { name: nameOf(i) }) });
            },
          });
        }}
      />

      <Sheet
        visible={finishing}
        onClose={() => setFinishing(false)}
        title={t('shop.finishTitle')}
        footer={
          <Button
            label={t('shop.finishConfirm')}
            icon="check-circle-outline"
            loading={finish.isPending}
            onPress={() =>
              finish.mutate(undefined, {
                onError,
                onSuccess: () => {
                  haptic.success();
                  setFinishing(false);
                  toast({ message: t('shop.finished') });
                },
              })
            }
          />
        }
      >
        {s ? (
          <View style={{ gap: space.sm }}>
            <Fact label={t('shop.boughtCount')} value={String(s.counts.bought)} strong />
            <Fact label={t('shop.notBought')} value={String(Math.max(0, s.counts.to_buy - s.counts.bought))} />
            <Text tone="muted" style={{ marginTop: space.sm }}>
              {t('shop.finishBody')}
            </Text>
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

function ShopItem({ row: r, onToggle, onOpen, busy }: { row: ShopRow; onToggle: () => void; onOpen: () => void; busy: boolean }) {
  const { t, nameOf, altNameOf } = useSettings();
  const st = shopStatus(r);
  const headline = useHeadline();
  const dim = r.excluded || r.status === 'have';
  const canTick = !r.excluded && r.status !== 'have';
  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'stretch', backgroundColor: r.purchased ? color.sage : color.surface,
        borderRadius: radius.lg, borderWidth: 1, borderColor: r.purchased ? color.sageStrong : color.border, overflow: 'hidden',
      }}
    >
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${nameOf(r)}. ${t(st.key)}. ${r.status === 'have' ? r.reason : headline(r)}`}
        accessibilityHint={t('shop.openHint')}
        style={({ pressed }) => ({ flex: 1, flexDirection: 'row', gap: space.md, padding: space.md, opacity: pressed ? 0.7 : 1 })}
      >
        <IconTile name={categoryIcon(r.category)} tone={dim ? 'neutral' : r.purchased ? 'sage' : 'sage'} />
        <View style={{ flex: 1, gap: 4, opacity: dim ? 0.75 : 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            <Text variant="bodyStrong" style={{ textDecorationLine: r.excluded ? 'line-through' : 'none' }}>
              {nameOf(r)}
            </Text>
            {altNameOf(r) ? (
              <Text variant="caption" tone="faint">
                {altNameOf(r)}
              </Text>
            ) : null}
          </View>
          <Text variant="heading" style={{ color: r.status === 'have' ? color.sageText : color.text }}>
            {r.purchased ? t('shop.boughtQty', { qty: r.purchased_label ?? r.qty_label }) : r.status === 'have' ? t('shop.skipToday') : headline(r)}
          </Text>
          <Text variant="caption" tone="muted">
            {t('shop.atHomeNeed', { home: none(r.stock_at_shop_label ?? r.stock_now_label, t), need: r.need_label })}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={2}>
            {r.reason}
          </Text>
          <View style={{ marginTop: 2 }}>
            <Pill label={t(st.key)} icon={st.icon} tone={st.tone} small />
          </View>
        </View>
      </Pressable>
      {canTick ? (
        <Pressable
          onPress={onToggle}
          disabled={busy}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: r.purchased, busy }}
          accessibilityLabel={r.purchased ? t('shop.unmark', { name: nameOf(r) }) : t('shop.mark', { name: nameOf(r) })}
          style={({ pressed }) => ({
            width: touch + 16, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1,
            borderLeftColor: r.purchased ? color.sageStrong : color.border, opacity: pressed || busy ? 0.5 : 1,
          })}
        >
          <Icon name={r.purchased ? 'check-circle' : 'checkbox-blank-circle-outline'} size={32} tint={r.purchased ? color.primary : color.borderStrong} />
        </Pressable>
      ) : null}
    </View>
  );
}

function ShopItemSheet({
  row: r,
  onClose,
  onSave,
  onToggle,
  onSkip,
  onInclude,
  onReset,
  busy,
}: {
  row: ShopRow;
  onClose: () => void;
  onSave: (qty: number) => void;
  onToggle: () => void;
  onSkip: () => void;
  onInclude: () => void;
  onReset: () => void;
  busy: boolean;
}) {
  const { t, nameOf } = useSettings();
  const [qty, setQty] = useState(r.qty || r.pack_size);
  const changed = Math.abs(qty - r.qty) > 1e-6;
  const st = shopStatus(r);
  return (
    <Sheet
      visible
      onClose={onClose}
      title={nameOf(r)}
      footer={
        <>
          {r.status === 'have' && !r.purchased ? (
            <Button label={t('shop.buyAnyway', { qty: qtyLabelFor(qty, r) })} icon="cart-outline" kind="secondary" onPress={() => onSave(qty)} loading={busy} />
          ) : r.excluded ? (
            <Button label={t('shop.addBack')} icon="undo-variant" onPress={onInclude} loading={busy} />
          ) : (
            <>
              {changed && !r.purchased ? (
                <Button label={t('shop.saveQty', { qty: qtyLabelFor(qty, r) })} kind="secondary" onPress={() => onSave(qty)} loading={busy} />
              ) : null}
              <Button
                label={r.purchased ? t('shop.unmarkShort') : t('shop.markShort', { qty: r.qty_label })}
                icon={r.purchased ? 'undo-variant' : 'check-circle-outline'}
                onPress={onToggle}
                loading={busy}
                disabled={changed && !r.purchased}
              />
              {!r.purchased ? <Button label={t('shop.skipTrip')} kind="ghost" icon="eye-off-outline" onPress={onSkip} /> : null}
            </>
          )}
          {(r.edited || r.status === 'manual') && !r.purchased ? (
            <Button label={r.status === 'manual' ? t('shop.removeManual') : t('shop.resetQty')} kind="ghost" onPress={onReset} compact />
          ) : null}
        </>
      }
    >
      <View style={{ gap: space.md }}>
        <Pill label={t(st.key)} icon={st.icon} tone={st.tone} />
        <Card style={{ paddingVertical: space.sm }}>
          <Fact label={t('shop.fact.atHome')} value={none(r.stock_now_label, t)} strong />
          {r.stock_at_shop_label && r.stock_at_shop_label !== r.stock_now_label ? (
            <Fact label={t('shop.fact.stillFresh')} value={none(r.stock_at_shop_label, t)} />
          ) : null}
          <Fact label={t('shop.fact.need', { n: r.cover_days ?? '–' })} value={r.need_label} />
          {r.daily_use_label ? <Fact label={t('shop.fact.uses')} value={r.daily_use_label} /> : null}
          {r.shelf_life ? <Fact label={t('shop.fact.keeps')} value={t('fresh.range', { a: Math.round(r.shelf_life[0]), b: Math.round(r.shelf_life[1]) })} /> : null}
          {r.habit_label && r.status !== 'manual' ? <Fact label={t('shop.fact.lastTime')} value={r.habit_label} /> : null}
          <Fact label={t('shop.fact.recommended')} value={r.planned_qty > 0 ? r.qty_label : t('shop.skipToday')} strong />
        </Card>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Icon name="information-outline" tint={color.textMuted} size={20} />
          <Text tone="muted" style={{ flex: 1 }}>
            {r.reason}
          </Text>
        </View>
        {r.topup ? (
          <Card tone="accent" style={{ padding: space.md }}>
            <Text style={{ color: color.accentText }}>{t('shop.topup', { qty: r.topup.qty_label, day: r.topup.day })}</Text>
          </Card>
        ) : null}
        {!r.purchased && !r.excluded ? (
          <View style={{ gap: 6 }}>
            <Text variant="label">{t('shop.howMuch')}</Text>
            <Stepper
              value={qty}
              onChange={setQty}
              step={qtyStep(r.unit, r.pack_size)}
              min={qtyStep(r.unit, r.pack_size)}
              label={t('shop.qtyFor', { name: nameOf(r) })}
              unitLabel={{ unit: r.unit, like: r.qty_label }}
            />
            <Text variant="caption" tone="muted">
              {t('shop.price', { amount: rupees(qty * r.unit_price) })}
            </Text>
          </View>
        ) : null}
      </View>
    </Sheet>
  );
}

/** "Buy 1 kg, not 2 kg" in the chosen language, from the row's numbers. */
function useHeadline() {
  const { t } = useSettings();
  return (r: ShopRow) => {
    const qty = r.daily ? t('shop.perDay', { qty: r.qty_label.replace(/ a day$/, '') }) : r.qty_label;
    return r.less_than_habit && !r.edited && r.status !== 'manual' && r.habit_label
      ? t('shop.headLess', { qty, habit: r.habit_label })
      : t('shop.head', { qty });
  };
}

const none = (label: string | undefined, t: (k: 'shop.none') => string) => (!label || label === 'none' ? t('shop.none') : label);

function qtyLabelFor(qty: number, r: ShopRow) {
  return qtyLabel(qty, r.unit, r.qty_label);
}
