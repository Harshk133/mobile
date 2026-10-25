import { useState } from 'react';
import { Pressable, Switch, TextInput, View } from 'react-native';

import type { Member, Profile } from '@/lib/api';
import { useProfileOptions } from '@/lib/queries';
import { useSettings, type TKey } from '@/lib/settings';
import { Sheet } from './controls';
import { Button, Card, Chip, Icon, IconButton, Text } from './primitives';
import { color, radius, space, touch } from './theme';

const GROUP_AGE: Record<string, number> = { adult: 35, elder: 68, teen: 15, child: 9, toddler: 3 };
export const groupOfAge = (a: number) => (a < 5 ? 'toddler' : a < 13 ? 'child' : a < 20 ? 'teen' : a < 60 ? 'adult' : 'elder');

export const emptyProfile = (name = ''): Profile => ({
  family_name: name, city: 'Pune', language: 'en', diet: 'veg', portion: 'normal', cooked_meals_per_day: 3,
  eat_out_meals_per_week: 0, shop_interval_days: 7, has_fridge: true, prep_styles: ['wet', 'roasted'], members: [],
});

/** Number with big − / + buttons. */
export function Counter({ label, value, onChange, min, max, hint }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; hint?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: touch + 8 }}
      accessible accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onChange(Math.min(max, Math.max(min, value + (e.nativeEvent.actionName === 'increment' ? 1 : -1))))}>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{label}</Text>
        {hint ? <Text variant="caption" tone="muted">{hint}</Text> : null}
      </View>
      <IconButton icon="minus" label={`${label} −`} onPress={() => onChange(Math.max(min, value - 1))} tint={color.primary}
        style={{ backgroundColor: color.surfaceAlt }} />
      <Text variant="heading" style={{ minWidth: 32, textAlign: 'center' }}>{value}</Text>
      <IconButton icon="plus" label={`${label} +`} onPress={() => onChange(Math.min(max, value + 1))} tint={color.primary}
        style={{ backgroundColor: color.surfaceAlt }} />
    </View>
  );
}

export function MembersEditor({ profile, onChange }: { profile: Profile; onChange: (p: Profile) => void }) {
  const { t } = useSettings();
  const opts = useProfileOptions();
  const [editing, setEditing] = useState<number | null>(null);
  const add = (group: string) => {
    const n = profile.members.length + 1;
    onChange({ ...profile, members: [...profile.members, { name: `${t(`group.${group}` as TKey)} ${n}`, age: GROUP_AGE[group], needs: [] }] });
  };
  const m = editing !== null ? profile.members[editing] : null;
  return (
    <View style={{ gap: space.sm }}>
      {profile.members.map((mem, i) => (
        <Pressable key={i} onPress={() => setEditing(i)} accessibilityRole="button"
          accessibilityLabel={`${mem.name}, ${t(`group.${groupOfAge(mem.age)}` as TKey)}, ${mem.age}`}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60, padding: space.md,
            borderRadius: radius.md, backgroundColor: color.surface, borderWidth: 1, borderColor: color.border, opacity: pressed ? 0.7 : 1 })}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: color.sage, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="bodyStrong" style={{ color: color.sageText }}>{mem.name.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{mem.name}</Text>
            <Text variant="caption" tone="muted">
              {t(`group.${groupOfAge(mem.age)}` as TKey)} · {t('profile.age', { n: mem.age })}
              {mem.needs.length ? ` · ${mem.needs.map((n) => opts.data?.needs.find((x) => x.id === n)?.label ?? n).join(', ')}` : ''}
            </Text>
          </View>
          <Icon name="pencil-outline" size={18} tint={color.textFaint} />
        </Pressable>
      ))}
      <Text variant="label" tone="muted" style={{ marginTop: space.sm }}>{t('profile.addPerson')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {['adult', 'elder', 'teen', 'child', 'toddler'].map((g) => (
          <Chip key={g} icon="plus" label={t(`group.${g}` as TKey)} onPress={() => add(g)} />
        ))}
      </View>

      {m && editing !== null ? (
        <MemberSheet
          member={m}
          needs={opts.data?.needs ?? []}
          onClose={() => setEditing(null)}
          onSave={(mm) => {
            onChange({ ...profile, members: profile.members.map((x, i) => (i === editing ? mm : x)) });
            setEditing(null);
          }}
          onRemove={() => {
            onChange({ ...profile, members: profile.members.filter((_, i) => i !== editing) });
            setEditing(null);
          }}
        />
      ) : null}
    </View>
  );
}

function MemberSheet({ member, needs, onClose, onSave, onRemove }: {
  member: Member; needs: { id: string; label: string }[]; onClose: () => void; onSave: (m: Member) => void; onRemove: () => void;
}) {
  const { t } = useSettings();
  const [m, setM] = useState<Member>(member);
  return (
    <Sheet visible onClose={onClose} title={t('profile.editPerson')}
      footer={<><Button label={t('common.save')} onPress={() => onSave({ ...m, name: m.name.trim() || member.name })} />
        <Button kind="ghost" label={t('profile.removePerson')} onPress={onRemove} /></>}>
      <Text variant="label" style={{ marginBottom: 6 }}>{t('profile.name')}</Text>
      <TextInput value={m.name} onChangeText={(name) => setM({ ...m, name })} accessibilityLabel={t('profile.name')} maxLength={30}
        style={{ minHeight: touch, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, backgroundColor: color.surface,
          paddingHorizontal: space.md, fontSize: 16, color: color.text, marginBottom: space.md }} />
      <Counter label={t('profile.ageLabel')} value={m.age} min={0} max={110} onChange={(age) => setM({ ...m, age })}
        hint={t(`group.${groupOfAge(m.age)}` as TKey)} />
      <Text variant="label" style={{ marginTop: space.md, marginBottom: 6 }}>{t('profile.needs')}</Text>
      <Text variant="caption" tone="muted" style={{ marginBottom: space.sm }}>{t('profile.needsHint')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {needs.map((n) => {
          const on = m.needs.includes(n.id);
          return <Chip key={n.id} label={n.label} selected={on}
            onPress={() => setM({ ...m, needs: on ? m.needs.filter((x) => x !== n.id) : [...m.needs, n.id] })} />;
        })}
      </View>
    </Sheet>
  );
}

export function FoodEditor({ profile: p, onChange }: { profile: Profile; onChange: (p: Profile) => void }) {
  const { t } = useSettings();
  const opts = useProfileOptions();
  const set = (patch: Partial<Profile>) => onChange({ ...p, ...patch });
  return (
    <View style={{ gap: space.md }}>
      <View>
        <Text variant="label" style={{ marginBottom: space.sm }}>{t('profile.diet')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {(opts.data?.diets ?? []).map((d) => <Chip key={d.id} label={d.label} selected={p.diet === d.id} onPress={() => set({ diet: d.id })} />)}
        </View>
      </View>
      <Card style={{ paddingVertical: space.xs }}>
        <Counter label={t('profile.meals')} value={p.cooked_meals_per_day} min={1} max={4}
          onChange={(v) => set({ cooked_meals_per_day: v, eat_out_meals_per_week: Math.min(p.eat_out_meals_per_week, v * 7) })} />
        <Counter label={t('profile.eatOut')} hint={t('profile.eatOutHint')} value={p.eat_out_meals_per_week} min={0} max={p.cooked_meals_per_day * 7}
          onChange={(v) => set({ eat_out_meals_per_week: v })} />
        <Counter label={t('profile.interval')} hint={t('profile.intervalHint')} value={p.shop_interval_days} min={2} max={14}
          onChange={(v) => set({ shop_interval_days: v })} />
      </Card>
      <View>
        <Text variant="label" style={{ marginBottom: space.sm }}>{t('profile.portion')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {(opts.data?.portions ?? []).map((d) => <Chip key={d.id} label={d.label} selected={p.portion === d.id} onPress={() => set({ portion: d.id })} />)}
        </View>
      </View>
      <View>
        <Text variant="label" style={{ marginBottom: 4 }}>{t('profile.prep')}</Text>
        <Text variant="caption" tone="muted" style={{ marginBottom: space.sm }}>{t('profile.prepHint')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {(opts.data?.prep_styles ?? []).map((d) => {
            const on = p.prep_styles.includes(d.id);
            return <Chip key={d.id} label={d.label} selected={on}
              onPress={() => (on ? p.prep_styles.length > 1 && set({ prep_styles: p.prep_styles.filter((x) => x !== d.id) })
                : set({ prep_styles: [...p.prep_styles, d.id] }))} />;
          })}
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: touch }}>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">{t('profile.fridge')}</Text>
          <Text variant="caption" tone="muted">{t('profile.fridgeHint')}</Text>
        </View>
        <Switch value={p.has_fridge} onValueChange={(v) => set({ has_fridge: v })} accessibilityLabel={t('profile.fridge')}
          trackColor={{ true: color.primary, false: color.borderStrong }} thumbColor={color.surface} />
      </View>
    </View>
  );
}
