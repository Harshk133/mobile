import { useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCatalogue } from '@/lib/queries';
import type { CatalogueItem } from '@/lib/api';
import { categoryIcon, qtyLabel } from '@/lib/format';
import { useSettings } from '@/lib/settings';
import { Icon, IconButton, IconTile, Text, haptic } from './primitives';
import { color, radius, space, touch } from './theme';

/* ---------------------------------------------------------------- screen scaffold */

export function Screen({
  title,
  subtitle,
  right,
  children,
  refreshing,
  onRefresh,
  footer,
  scroll = true,
  contentStyle,
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const header = title ? (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md, marginBottom: space.md }}>
      <View style={{ flex: 1 }}>
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text tone="muted" style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={{ flexDirection: 'row', alignItems: 'center' }}>{right}</View> : null}
    </View>
  ) : null;
  const pad = { paddingHorizontal: space.lg, paddingTop: insets.top + space.md };
  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[pad, { paddingBottom: space.xxxl + (footer ? 72 : 0) }, contentStyle]}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={color.primary} colors={[color.primary]} /> : undefined}
        >
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={[pad, { flex: 1 }, contentStyle]}>
          {header}
          {children}
        </View>
      )}
      {footer ? (
        <View
          style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: space.md,
            paddingBottom: space.md, backgroundColor: color.bg, borderTopWidth: 1, borderTopColor: color.border,
          }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

/* ---------------------------------------------------------------- bottom sheet */

export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: color.overlay }} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: color.bg, borderTopLeftRadius: radius.lg + 4, borderTopRightRadius: radius.lg + 4,
            maxHeight: '88%', paddingBottom: insets.bottom + space.md,
            // the web preview shows the app at phone width; keep sheets inside that column
            ...(Platform.OS === 'web' ? { width: '100%', maxWidth: 440, alignSelf: 'center' } : {}),
          }}
        >
          <View style={{ alignItems: 'center', paddingTop: space.sm }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: color.borderStrong }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: space.lg, paddingRight: space.xs, paddingTop: space.xs }}>
            <Text variant="heading" style={{ flex: 1 }} accessibilityRole="header" numberOfLines={2}>
              {title}
            </Text>
            <IconButton icon="close" label="Close" onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.md }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.sm }}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ---------------------------------------------------------------- quantity stepper */

export function Stepper({
  value,
  onChange,
  step,
  min = 0,
  max = 999,
  label,
  unitLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  step: number;
  min?: number;
  max?: number;
  label: string;
  /** a server label for the same item, so the live label uses its word ("bunches", "packs") */
  unitLabel: { unit: string; like?: string };
}) {
  const round = (v: number) => Math.round(v * 1000) / 1000;
  min = Math.min(min, value); // a smaller amount already entered (e.g. from a bill) stays valid
  const set = (v: number) => {
    haptic.tap();
    onChange(Math.min(max, Math.max(min, round(v))));
  };
  const text = qtyLabel(value, unitLabel.unit, unitLabel.like);
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => set(value + (e.nativeEvent.actionName === 'increment' ? step : -step))}
      style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: color.surface, borderRadius: radius.md, borderWidth: 1, borderColor: color.border }}
    >
      <Pressable
        onPress={() => set(value - step)}
        disabled={value <= min}
        accessibilityLabel={`Less ${label}`}
        accessibilityRole="button"
        style={{ width: touch + 8, height: touch + 8, alignItems: 'center', justifyContent: 'center', opacity: value <= min ? 0.35 : 1 }}
      >
        <Icon name="minus" size={24} tint={color.primary} />
      </Pressable>
      <Text variant="heading" style={{ flex: 1, textAlign: 'center' }} numberOfLines={1}>
        {text}
      </Text>
      <Pressable
        onPress={() => set(value + step)}
        disabled={value >= max}
        accessibilityLabel={`More ${label}`}
        accessibilityRole="button"
        style={{ width: touch + 8, height: touch + 8, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="plus" size={24} tint={color.primary} />
      </Pressable>
    </View>
  );
}

/* ---------------------------------------------------------------- search field */

export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color.surface, borderRadius: radius.md,
        borderWidth: 1, borderColor: color.border, paddingHorizontal: space.md, minHeight: touch,
      }}
    >
      <Icon name="magnify" size={22} tint={color.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={color.textFaint}
        accessibilityLabel={placeholder}
        style={{ flex: 1, fontSize: 16, color: color.text, paddingVertical: 10 }}
        autoCorrect={false}
        returnKeyType="search"
      />
      {value ? <IconButton icon="close" label="Clear search" onPress={() => onChange('')} /> : null}
    </View>
  );
}

/** Text matches an item in any of its three names (so "टोमॅटो", "tamatar" via English, or "tomato" all work). */
export function matches(q: string, x: { name_en: string; name_hi: string; name_mr: string }) {
  const s = q.trim().toLowerCase();
  return !s || [x.name_en, x.name_hi, x.name_mr].some((n) => n?.toLowerCase().includes(s));
}

/* ---------------------------------------------------------------- catalogue picker */

export function CataloguePicker({
  visible,
  onClose,
  onPick,
  title,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (item: CatalogueItem) => void;
  title: string;
}) {
  const { t, nameOf, altNameOf } = useSettings();
  const cat = useCatalogue();
  const [q, setQ] = useState('');
  const items = (cat.data ?? []).filter((i) => matches(q, i)).slice(0, 40);
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <SearchField value={q} onChange={setQ} placeholder={t('picker.search')} />
      <View style={{ marginTop: space.md }}>
        {items.map((i) => (
          <Pressable
            key={i.id}
            onPress={() => {
              haptic.tap();
              setQ('');
              onPick(i);
            }}
            accessibilityRole="button"
            accessibilityLabel={nameOf(i)}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60, paddingVertical: space.sm,
              borderBottomWidth: 1, borderBottomColor: color.border, opacity: pressed ? 0.6 : 1,
            })}
          >
            <IconTile name={categoryIcon(i.category)} tone="sage" size={40} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{nameOf(i)}</Text>
              {altNameOf(i) ? (
                <Text variant="caption" tone="muted">
                  {altNameOf(i)}
                </Text>
              ) : null}
            </View>
            <Icon name="plus" tint={color.primary} />
          </Pressable>
        ))}
        {cat.isLoading ? <Text tone="muted">{t('common.loading')}</Text> : null}
        {!cat.isLoading && !items.length ? (
          <Text tone="muted" style={{ paddingVertical: space.lg }}>
            {t('picker.none')}
          </Text>
        ) : null}
      </View>
    </Sheet>
  );
}

/** A labelled input row for forms. */
export function Field({
  label,
  value,
  onChange,
  keyboardType,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad' | 'url';
  placeholder?: string;
  hint?: string;
}) {
  return (
    <View style={{ gap: 6, marginBottom: space.md }}>
      <Text variant="label">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={color.textFaint}
        accessibilityLabel={label}
        autoCapitalize={keyboardType === 'url' ? 'none' : 'sentences'}
        autoCorrect={false}
        style={{
          minHeight: touch, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, backgroundColor: color.surface,
          paddingHorizontal: space.md, fontSize: 16, color: color.text,
        }}
      />
      {hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
