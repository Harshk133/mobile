import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Pressable, Switch, TextInput, View } from 'react-native';

import { ApiError, api, type CatalogueItem, type ScanLine } from '@/lib/api';
import { categoryIcon, qtyLabel, qtyStep, rupees } from '@/lib/format';
import { useCatalogue, useStockMutation } from '@/lib/queries';
import { useSettings } from '@/lib/settings';
import { CataloguePicker, Sheet, Stepper } from './controls';
import { useToast } from './feedback';
import { Button, Card, Icon, IconTile, Pill, Text, haptic } from './primitives';
import { color, radius, space, touch } from './theme';

export type DraftLine = ScanLine & { key: string; include: boolean };
export type Draft = { bill_id: string; shop: string; source: string; mode: string; note?: string | null; already_imported: string | null; lines: DraftLine[] };

export const DRAFT_KEY = 'annasaathi.billDraft.v1';

export function toDraft(r: { bill_id: string; shop: string; source: string; mode: string; note?: string | null; already_imported?: string | null; lines: ScanLine[] }): Draft {
  return {
    bill_id: r.bill_id, shop: r.shop, source: r.source, mode: r.mode, note: r.note ?? null, already_imported: r.already_imported ?? null,
    // unknown items start left out; everything else starts included, uncertain lines flagged
    lines: r.lines.map((l, n) => ({ ...l, key: `${n}-${l.item_id}`, include: l.matched && l.qty > 0 })),
  };
}

export const saveDraft = (d: Draft | null) =>
  (d ? AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(d)) : AsyncStorage.removeItem(DRAFT_KEY)).catch(() => {});

export async function loadDraft(): Promise<Draft | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

/** Review a scanned / parsed / spoken bill line by line, then add it to My Kitchen. */
export function BillReview({ draft, onChange, onDone }: { draft: Draft; onChange: (d: Draft) => void; onDone: (added: number) => void }) {
  const { t, nameOf } = useSettings();
  const toast = useToast();
  const [editing, setEditing] = useState<string | null>(null);
  const [dup, setDup] = useState<string | null>(null);
  useCatalogue(); // load the item list now, so fixing a line opens instantly
  const confirm = useStockMutation((allow: boolean) =>
    api.confirmBill({
      bill_id: draft.bill_id, shop: draft.shop, source: draft.source, allow_duplicate: allow,
      lines: draft.lines.filter((l) => l.include && l.item_id !== 'unknown' && l.qty > 0)
        .map((l) => ({ item_id: l.item_id, qty: l.qty, price: l.price, raw: l.raw })),
    }));

  const included = draft.lines.filter((l) => l.include && l.item_id !== 'unknown' && l.qty > 0);
  const toCheck = draft.lines.filter((l) => l.include && l.needs_review).length;
  const total = included.reduce((s, l) => s + (l.price ?? 0), 0);
  const setLine = (key: string, patch: Partial<DraftLine>) =>
    onChange({ ...draft, lines: draft.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) });

  const submit = (allow = false) =>
    confirm.mutate(allow, {
      onSuccess: (r) => {
        haptic.success();
        saveDraft(null);
        onDone(r.added);
      },
      onError: (e) => {
        if (e instanceof ApiError && e.code === 'duplicate_bill') setDup(e.message);
        else toast({ message: `${e instanceof Error ? e.message : e} ${t('review.keptDraft')}`, tone: 'error' });
      },
    });

  const line = draft.lines.find((l) => l.key === editing);

  return (
    <View style={{ gap: space.md }}>
      {draft.mode === 'preloaded' ? (
        <Card tone="accent" style={{ padding: space.md, gap: 4 }}>
          <Text variant="label" style={{ color: color.accentText }}>{t('review.sampleTitle')}</Text>
          <Text variant="caption" style={{ color: color.accentText }}>{draft.note || t('review.sampleBody')}</Text>
        </Card>
      ) : null}
      {draft.mode === 'ocr' || draft.mode === 'claude' ? (
        <Card tone="sage" style={{ padding: space.md }}>
          <Text variant="caption" style={{ color: color.sageText }}>{t('review.fromPhoto')}</Text>
        </Card>
      ) : null}
      {draft.already_imported ? (
        <Card tone="accent" style={{ padding: space.md }}>
          <Text style={{ color: color.accentText }}>{t('review.alreadyImported', { date: draft.already_imported })}</Text>
        </Card>
      ) : null}

      <View>
        <Text variant="heading">{draft.shop}</Text>
        <Text tone="muted">
          {t('review.summary', { n: included.length, amount: rupees(total) })}
          {toCheck ? ` · ${t('review.toCheck', { n: toCheck })}` : ''}
        </Text>
      </View>

      {draft.lines.map((l) => {
        const warn = l.include && l.needs_review;
        return (
          <Pressable
            key={l.key}
            onPress={() => setEditing(l.key)}
            accessibilityRole="button"
            accessibilityLabel={`${l.matched ? nameOf(l as never) : t('review.unknown')}, ${l.qty_label ?? ''}${warn ? `, ${t('review.check')}` : ''}${l.include ? '' : `, ${t('review.leftOut')}`}`}
            accessibilityHint={t('review.editHint')}
            style={({ pressed }) => ({
              flexDirection: 'row', gap: space.md, alignItems: 'center', padding: space.md, borderRadius: radius.lg,
              backgroundColor: warn ? color.accentSoft : color.surface, borderWidth: 1,
              borderColor: warn ? color.accent : color.border, opacity: pressed ? 0.7 : l.include ? 1 : 0.55,
            })}
          >
            <IconTile name={l.matched ? categoryIcon(l.category ?? '') : 'help-circle-outline'} tone={warn ? 'accent' : l.matched ? 'sage' : 'neutral'} size={40} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong" style={{ textDecorationLine: l.include ? 'none' : 'line-through' }}>
                {l.matched ? nameOf(l as never) : t('review.unknown')}
              </Text>
              <Text variant="caption" tone="faint" numberOfLines={1}>“{l.raw}”</Text>
              {warn && l.issues[0] ? <Text variant="caption" style={{ color: color.accentText }}>{l.issues[0]}</Text> : null}
            </View>
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <Text variant="bodyStrong">{l.matched ? qtyLabel(l.qty, l.unit, l.qty_label) : '—'}</Text>
              <Text variant="caption" tone="muted">{l.price != null ? rupees(l.price) : t('review.noPrice')}</Text>
            </View>
            {warn ? <Icon name="alert-circle-outline" size={20} tint={color.accent} /> : <Icon name="pencil-outline" size={18} tint={color.textFaint} />}
          </Pressable>
        );
      })}

      <Button
        label={t('review.add', { n: included.length })}
        icon="tray-arrow-down"
        disabled={!included.length}
        loading={confirm.isPending}
        onPress={() => submit(false)}
        style={{ marginTop: space.sm }}
      />
      {toCheck ? <Text variant="caption" tone="muted" style={{ textAlign: 'center' }}>{t('review.checkHint')}</Text> : null}

      {line ? <LineSheet line={line} onClose={() => setEditing(null)} onSave={(p) => { setLine(line.key, p); setEditing(null); }} /> : null}

      <Sheet
        visible={!!dup}
        onClose={() => setDup(null)}
        title={t('review.dupTitle')}
        footer={
          <>
            <Button label={t('review.dupKeep')} onPress={() => { setDup(null); saveDraft(null); onDone(0); }} />
            <Button kind="ghost" label={t('review.dupAdd')} onPress={() => { setDup(null); submit(true); }} />
          </>
        }
      >
        <Text>{dup}</Text>
        <Text tone="muted" style={{ marginTop: space.sm }}>{t('review.dupBody')}</Text>
      </Sheet>
    </View>
  );
}

function LineSheet({ line, onClose, onSave }: { line: DraftLine; onClose: () => void; onSave: (p: Partial<DraftLine>) => void }) {
  const { t, nameOf } = useSettings();
  const cat = useCatalogue();
  const [item, setItem] = useState<CatalogueItem | null>(cat.data?.find((c) => c.id === line.item_id) ?? null);
  useEffect(() => {
    // the catalogue may arrive after the sheet opens
    if (!item && line.matched && cat.data) setItem(cat.data.find((c) => c.id === line.item_id) ?? null);
  }, [cat.data, item, line.item_id, line.matched]);
  const [qty, setQty] = useState(line.qty || item?.pack_size || 1);
  const [price, setPrice] = useState(line.price != null ? String(line.price) : '');
  const [include, setInclude] = useState(line.include || !line.matched);
  const [picking, setPicking] = useState(false);

  const save = () =>
    onSave({
      include: include && !!item,
      item_id: item?.id ?? 'unknown',
      matched: !!item,
      name_en: item?.name_en, name_hi: item?.name_hi, name_mr: item?.name_mr, category: item?.category,
      unit: item?.unit ?? line.unit,
      qty,
      qty_label: item ? qtyLabel(qty, item.unit, line.item_id === item.id ? line.qty_label : undefined) : line.qty_label,
      price: price.trim() === '' || isNaN(Number(price)) ? null : Number(price),
      needs_review: false, // the family has looked at it
      issues: [],
    });

  return (
    <Sheet visible onClose={onClose} title={t('review.editTitle')} footer={<Button label={t('common.save')} onPress={save} disabled={include && !item} />}>
      <Text variant="caption" tone="muted">{t('review.printed')}</Text>
      <Text style={{ marginBottom: space.md }}>“{line.raw}”</Text>

      <Text variant="label" style={{ marginBottom: 6 }}>{t('review.item')}</Text>
      <Pressable
        onPress={() => setPicking(true)}
        accessibilityRole="button"
        accessibilityLabel={`${t('review.item')}: ${item ? nameOf(item) : t('review.pickItem')}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: touch + 8, padding: space.md, borderRadius: radius.md,
          backgroundColor: color.surface, borderWidth: 1, borderColor: item ? color.border : color.accent }}
      >
        <Text variant="bodyStrong" style={{ flex: 1 }}>{item ? nameOf(item) : t('review.pickItem')}</Text>
        <Text variant="label" tone="primary">{t('review.change')}</Text>
      </Pressable>

      {item ? (
        <View style={{ marginTop: space.md, gap: 6 }}>
          <Text variant="label">{t('review.qty')}</Text>
          <Stepper value={qty} onChange={setQty} step={qtyStep(item.unit, item.pack_size)} min={qtyStep(item.unit, item.pack_size)}
            label={nameOf(item)} unitLabel={{ unit: item.unit, like: line.item_id === item.id ? line.qty_label : undefined }} />
        </View>
      ) : null}

      <View style={{ marginTop: space.md, gap: 6 }}>
        <Text variant="label">{t('review.price')}</Text>
        <TextInput value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="₹" placeholderTextColor={color.textFaint}
          accessibilityLabel={t('review.price')}
          style={{ minHeight: touch, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, backgroundColor: color.surface,
            paddingHorizontal: space.md, fontSize: 16, color: color.text }} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.lg, minHeight: touch }}>
        <Text style={{ flex: 1 }}>{t('review.include')}</Text>
        <Switch value={include} onValueChange={setInclude} accessibilityLabel={t('review.include')}
          trackColor={{ true: color.primary, false: color.borderStrong }} thumbColor={color.surface} />
      </View>
      {!line.matched ? <Pill small tone="neutral" icon="information-outline" label={t('review.unknownHint')} /> : null}

      <CataloguePicker visible={picking} title={t('review.pickItem')} onClose={() => setPicking(false)}
        onPick={(i) => { setItem(i); setQty(i.pack_size); setInclude(true); setPicking(false); }} />
    </Sheet>
  );
}
