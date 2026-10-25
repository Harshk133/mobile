import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { api, type InvItem } from '@/lib/api';
import { STATUS, addDays, categoryIcon, daysBetween, daysLeft, qtyLabel, qtyStep, shortDate } from '@/lib/format';
import { useInventory, useStockMutation } from '@/lib/queries';
import { useSettings } from '@/lib/settings';
import { Screen, Sheet, Stepper } from '@/ui/controls';
import { EmptyState, ErrorState, ListSkeleton, useToast } from '@/ui/feedback';
import { Button, Card, Fact, Icon, IconButton, IconTile, Pill, SectionHeader, Segmented, Text, haptic } from '@/ui/primitives';
import { color, radius, space, touch } from '@/ui/theme';

export default function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, nameOf } = useSettings();
  const inv = useInventory();
  const item = inv.data?.items.find((i) => i.item_id === id);
  const back = <IconButton icon="chevron-left" label={t('common.back')} onPress={() => router.back()} />;

  if (inv.isError) return <Screen right={back}><ErrorState error={inv.error} onRetry={() => inv.refetch()} /></Screen>;
  if (inv.isLoading) return <Screen right={back}><ListSkeleton rows={3} /></Screen>;
  if (!item || !inv.data)
    return (
      <Screen right={back}>
        <EmptyState icon="fridge-outline" title={t('item.gone')} action={{ label: t('common.back'), onPress: () => router.back() }} />
      </Screen>
    );
  return <Detail item={item} today={inv.data.today} back={back} title={nameOf(item)} />;
}

function Detail({ item: i, today, back, title }: { item: InvItem; today: string; back: React.ReactNode; title: string }) {
  const { t, nameOf } = useSettings();
  const toast = useToast();
  const st = STATUS[i.status];
  const onError = (e: unknown) => toast({ message: e instanceof Error ? e.message : String(e), tone: 'error' });
  const edit = useStockMutation((body: Parameters<typeof api.editItem>[1]) => api.editItem(i.item_id, body));
  const remove = useStockMutation(() => api.removeItem(i.item_id));
  const restore = useStockMutation((ids: number[]) => api.restoreItem(ids));

  const [qty, setQty] = useState(i.remaining);
  useEffect(() => setQty(i.remaining), [i.remaining]);
  const [dateSheet, setDateSheet] = useState<null | 'printed' | 'bought'>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const step = qtyStep(i.unit, i.unit === 'pc' ? 1 : 0.25);
  const save = (body: Parameters<typeof api.editItem>[1], msg: string) =>
    edit.mutate(body, { onError, onSuccess: () => { haptic.success(); toast({ message: msg }); } });

  const names = [i.name_en, i.name_hi, i.name_mr].filter((n, k, a) => n && a.indexOf(n) === k && n !== nameOf(i)).join(' · ');

  return (
    <Screen title={title} subtitle={names} right={back}>
      {/* status and freshness */}
      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
          <IconTile name={categoryIcon(i.category)} tone={st.tone} size={52} />
          <View style={{ flex: 1 }}>
            <Text variant="title">{i.printed_expiry ? t('item.printedUntil', { date: shortDate(i.printed_expiry, t) }) : daysLeft(i.days_left, t)}</Text>
            <Text tone="muted">{i.estimate === 'printed date' ? t('item.fromPrinted') : t('item.estimated')}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Pill label={t(st.key)} icon={st.icon} tone={st.tone} />
          {i.low_stock ? <Pill label={t('status.low')} icon="arrow-down-circle-outline" /> : null}
        </View>
        <Text tone="muted">{i.reason}</Text>
        {i.status === 'spoiled' ? (
          <Card tone="danger" style={{ padding: space.md }}>
            <Text style={{ color: color.dangerText }}>{t('item.spoiledAdvice')}</Text>
          </Card>
        ) : null}
      </Card>

      {/* how the estimate was made */}
      <SectionHeader title={t('item.howTitle')} />
      <Card style={{ paddingVertical: space.sm }}>
        {i.printed_expiry ? (
          <Fact label={t('item.printedDate')} value={shortDate(i.printed_expiry, t)} strong />
        ) : (
          <>
            <Fact label={t('item.tier', { tier: i.tier })} value={t('fresh.range', { a: i.tier_days[0], b: i.tier_days[1] })} />
            {i.factors.map((f) => (
              <Fact key={f.label} label={f.label} value={`× ${f.factor}`} />
            ))}
            <Fact label={t('item.shelfHere')} value={t('fresh.range', { a: Math.round(i.shelf_life[0]), b: Math.round(i.shelf_life[1]) })} />
            <Fact label={t('item.age')} value={i.age_days === 0 ? t('date.today') : t('item.daysAgo', { n: i.age_days })} />
          </>
        )}
        <Fact label={t('item.uses')} value={i.daily_use_label} />
        {i.days_of_use !== null ? <Fact label={t('item.lasts')} value={t('item.lastsDays', { n: Math.round(i.days_of_use) })} /> : null}
        {i.at_risk_label ? <Fact label={t('item.atRisk')} value={i.at_risk_label} strong /> : null}
        <Fact label={t('item.source')} value={t(`source.${i.source}` as 'source.bill')} />
      </Card>
      <Text variant="caption" tone="faint" style={{ marginTop: space.sm }}>
        {t('kitchen.disclaimer')}
      </Text>

      {/* corrections */}
      <SectionHeader title={t('item.howMuchLeft')} />
      <Stepper value={qty} onChange={setQty} step={step} min={0} label={t('item.howMuchLeft')} unitLabel={{ unit: i.unit, like: i.remaining_label }} />
      {Math.abs(qty - i.remaining) > 1e-6 ? (
        <Button
          style={{ marginTop: space.sm }}
          label={qty === 0 ? t('item.saveFinished') : t('item.saveQty', { qty: qtyLabel(qty, i.unit, i.remaining_label) })}
          loading={edit.isPending}
          onPress={() => save({ qty }, t('item.saved'))}
        />
      ) : null}

      {i.form === 'fresh' || i.form === 'wet' || i.form === 'liquid' ? (
        <>
          <SectionHeader title={t('item.kept')} />
          <Segmented
            value={i.storage}
            onChange={(v) => v !== i.storage && save({ storage: v }, t('item.moved'))}
            options={[{ value: 'fridge', label: t('storage.fridge') }, { value: 'pantry', label: t('storage.counter') }]}
          />
          {i.alt_storage ? (
            <Text variant="caption" tone="muted" style={{ marginTop: space.sm }}>
              {t('item.altStorage', {
                place: i.alt_storage.storage === 'fridge' ? t('storage.fridge') : t('storage.counter'),
                range: daysLeft(i.alt_storage.days_left, t),
              })}
            </Text>
          ) : null}
        </>
      ) : null}

      <SectionHeader title={t('item.dates')} />
      <Card style={{ padding: 0 }}>
        <DateRow icon="calendar-check-outline" label={t('item.printedDate')} value={i.printed_expiry ? shortDate(i.printed_expiry, t) : t('item.none')} onPress={() => setDateSheet('printed')} />
        <View style={{ height: 1, backgroundColor: color.border }} />
        <DateRow icon="calendar-outline" label={t('item.boughtOn')} value={shortDate(i.purchased_on, t)} onPress={() => setDateSheet('bought')} />
      </Card>

      <Button kind="danger" icon="delete-outline" label={t('item.remove')} onPress={() => setConfirmRemove(true)} style={{ marginTop: space.xxl }} />

      {dateSheet ? (
        <DateSheet
          kind={dateSheet}
          today={today}
          initial={dateSheet === 'printed' ? i.printed_expiry ?? addDays(today, 3) : i.purchased_on}
          hasValue={dateSheet === 'bought' || !!i.printed_expiry}
          onClose={() => setDateSheet(null)}
          onSave={(d) => {
            setDateSheet(null);
            save(dateSheet === 'printed' ? { printed_expiry: d } : { purchased_on: d }, t('item.saved'));
          }}
          onClear={() => {
            setDateSheet(null);
            save({ clear_printed_expiry: true }, t('item.saved'));
          }}
        />
      ) : null}

      <Sheet
        visible={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title={t('item.removeTitle', { name: nameOf(i) })}
        footer={
          <>
            <Button
              kind="danger"
              label={t('item.removeConfirm')}
              loading={remove.isPending}
              onPress={() =>
                remove.mutate(undefined, {
                  onError,
                  onSuccess: (r) => {
                    setConfirmRemove(false);
                    router.back();
                    toast({
                      message: t('item.removed', { name: nameOf(i) }),
                      action: { label: t('common.undo'), onPress: () => restore.mutate(r.lot_ids, { onError }) },
                    });
                  },
                })
              }
            />
            <Button kind="ghost" label={t('common.cancel')} onPress={() => setConfirmRemove(false)} />
          </>
        }
      >
        <Text tone="muted">{t('item.removeBody')}</Text>
      </Sheet>
    </Screen>
  );
}

function DateRow({ icon, label, value, onPress }: { icon: 'calendar-outline' | 'calendar-check-outline'; label: string; value: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, minHeight: touch + 8, opacity: pressed ? 0.6 : 1 })}>
      <Icon name={icon} tint={color.textMuted} />
      <Text style={{ flex: 1 }}>{label}</Text>
      <Text variant="bodyStrong">{value}</Text>
      <Icon name="pencil-outline" size={18} tint={color.primary} />
    </Pressable>
  );
}

/** Day-by-day date picker: big +/- buttons are easier than a calendar for "3 days from now". */
function DateSheet({
  kind, today, initial, hasValue, onClose, onSave, onClear,
}: {
  kind: 'printed' | 'bought';
  today: string;
  initial: string;
  hasValue: boolean;
  onClose: () => void;
  onSave: (d: string) => void;
  onClear: () => void;
}) {
  const { t } = useSettings();
  const [d, setD] = useState(initial);
  const offset = daysBetween(today, d);
  const min = kind === 'bought' ? -60 : -7;
  const max = kind === 'bought' ? 0 : 365;
  const rel = offset === 0 ? t('date.today') : offset > 0 ? t('date.inDays', { n: offset }) : t('date.daysAgo', { n: -offset });
  const move = (n: number) => {
    const next = Math.min(max, Math.max(min, offset + n));
    haptic.tap();
    setD(addDays(today, next));
  };
  return (
    <Sheet
      visible
      onClose={onClose}
      title={kind === 'printed' ? t('item.printedDate') : t('item.boughtOn')}
      footer={
        <>
          <Button label={t('common.save')} onPress={() => onSave(d)} />
          {kind === 'printed' && hasValue ? <Button kind="ghost" label={t('item.clearPrinted')} onPress={onClear} /> : null}
        </>
      }
    >
      <Text tone="muted" style={{ marginBottom: space.md }}>
        {kind === 'printed' ? t('item.printedHelp') : t('item.boughtHelp')}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Button kind="secondary" label="−7" onPress={() => move(-7)} compact />
        <Button kind="secondary" label="−1" onPress={() => move(-1)} compact />
        <View style={{ flex: 1, alignItems: 'center', backgroundColor: color.surface, borderRadius: radius.md, paddingVertical: space.md }}
          accessible accessibilityLiveRegion="polite" accessibilityLabel={`${shortDate(d, t)}, ${rel}`}>
          <Text variant="heading">{shortDate(d, t)}</Text>
          <Text variant="caption" tone="muted">{rel}</Text>
        </View>
        <Button kind="secondary" label="+1" onPress={() => move(1)} compact />
        <Button kind="secondary" label="+7" onPress={() => move(7)} compact />
      </View>
    </Sheet>
  );
}
