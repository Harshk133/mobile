import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text as RNText,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import type { IconName, Tone } from '@/lib/format';
import { color, radius, shadow, space, touch, type } from './theme';

/* ---------------------------------------------------------------- haptics (no-op where unsupported) */

export const haptic = {
  tap: () => Platform.OS !== 'web' && Haptics.selectionAsync().catch(() => {}),
  success: () => Platform.OS !== 'web' && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warn: () => Platform.OS !== 'web' && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
};

/* ---------------------------------------------------------------- text */

type Variant = keyof typeof type;

export function Text({
  variant = 'body',
  tone,
  style,
  children,
  ...rest
}: TextProps & { variant?: Variant; tone?: 'muted' | 'faint' | 'primary' | 'onPrimary' | 'danger' | 'accent'; style?: StyleProp<TextStyle> }) {
  const c =
    tone === 'muted' ? color.textMuted
    : tone === 'faint' ? color.textFaint
    : tone === 'primary' ? color.primary
    : tone === 'onPrimary' ? color.onPrimary
    : tone === 'danger' ? color.dangerText
    : tone === 'accent' ? color.accentText
    : color.text;
  return (
    <RNText maxFontSizeMultiplier={1.8} style={[type[variant], { color: c }, style]} {...rest}>
      {children}
    </RNText>
  );
}

export const Icon = ({ name, size = 22, tint = color.text }: { name: IconName; size?: number; tint?: string }) => (
  <MaterialCommunityIcons name={name} size={size} color={tint} accessibilityElementsHidden importantForAccessibility="no" />
);

/* ---------------------------------------------------------------- buttons */

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger' | 'onPrimary';

export function Button({
  label,
  onPress,
  kind = 'primary',
  icon,
  loading,
  disabled,
  style,
  accessibilityHint,
  compact,
}: {
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  compact?: boolean;
}) {
  const bg = { primary: color.primary, secondary: color.surface, ghost: 'transparent', danger: color.dangerSoft, onPrimary: color.onPrimary }[kind];
  const fg = { primary: color.onPrimary, secondary: color.primary, ghost: color.primary, danger: color.dangerText, onPrimary: color.primary }[kind];
  const off = disabled || loading;
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [
        {
          minHeight: compact ? 44 : touch + 4,
          paddingHorizontal: compact ? space.md : space.xl,
          borderRadius: radius.md,
          backgroundColor: bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.sm,
          opacity: off ? 0.5 : pressed ? 0.85 : 1,
          borderWidth: kind === 'secondary' ? 1 : 0,
          borderColor: color.borderStrong,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={20} tint={fg} /> : null}
      <Text variant="label" style={{ color: fg, fontSize: compact ? 14 : 16 }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  tint = color.text,
  badge,
  style,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  tint?: string;
  badge?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
      hitSlop={4}
      style={({ pressed }) => [
        { width: touch, height: touch, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 },
        style,
      ]}
    >
      <Icon name={icon} size={24} tint={tint} />
      {badge ? (
        <View
          style={{
            position: 'absolute', top: 6, right: 6, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
            backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center',
          }}
        >
          <RNText style={{ color: color.text, fontSize: 11, fontWeight: '700' }} maxFontSizeMultiplier={1.2}>
            {badge > 9 ? '9+' : badge}
          </RNText>
        </View>
      ) : null}
    </Pressable>
  );
}

/* ---------------------------------------------------------------- surfaces */

export function Card({
  children,
  style,
  onPress,
  accessibilityLabel,
  tone = 'surface',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: PressableProps['onPress'];
  accessibilityLabel?: string;
  tone?: 'surface' | 'primary' | 'sage' | 'accent' | 'danger';
}) {
  const bg = { surface: color.surface, primary: color.primary, sage: color.sage, accent: color.accentSoft, danger: color.dangerSoft }[tone];
  const base: ViewStyle = {
    backgroundColor: bg,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: tone === 'surface' ? 1 : 0,
    borderColor: color.border,
    ...(tone === 'surface' ? shadow.card : {}),
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [base, { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.995 : 1 }] }, style]}
    >
      {children}
    </Pressable>
  );
}

const TONES: Record<Tone, { bg: string; fg: string; icon: string }> = {
  primary: { bg: color.primary, fg: color.onPrimary, icon: color.onPrimary },
  sage: { bg: color.sage, fg: color.sageText, icon: color.sageText },
  accent: { bg: color.accentSoft, fg: color.accentText, icon: color.accent },
  danger: { bg: color.dangerSoft, fg: color.dangerText, icon: color.danger },
  neutral: { bg: color.surfaceAlt, fg: color.textMuted, icon: color.textMuted },
};

/** A status label: always icon + words, never colour alone. */
export function Pill({ label, icon, tone = 'neutral', small }: { label: string; icon?: IconName; tone?: Tone; small?: boolean }) {
  const t = TONES[tone];
  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4,
        backgroundColor: t.bg, borderRadius: radius.pill, paddingHorizontal: small ? 8 : 10, paddingVertical: small ? 2 : 4,
      }}
    >
      {icon ? <Icon name={icon} size={small ? 14 : 16} tint={t.icon} /> : null}
      <Text variant="caption" style={{ color: t.fg, fontWeight: '600' }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
  count,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: IconName;
  count?: number;
}) {
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={count !== undefined ? `${label}, ${count}` : label}
      style={({ pressed }) => ({
        minHeight: 40, paddingHorizontal: 14, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: selected ? color.primary : color.surface,
        borderWidth: 1, borderColor: selected ? color.primary : color.border,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {icon ? <Icon name={icon} size={16} tint={selected ? color.onPrimary : color.textMuted} /> : null}
      <Text variant="label" style={{ color: selected ? color.onPrimary : color.text }} numberOfLines={1}>
        {label}
      </Text>
      {count !== undefined ? (
        <Text variant="caption" style={{ color: selected ? color.onPrimaryMuted : color.textFaint, fontWeight: '600' }}>
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Two or three mutually exclusive options. */
export function Segmented<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
}) {
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: 'row', backgroundColor: color.surfaceAlt, borderRadius: radius.md, padding: 4, gap: 4 }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              haptic.tap();
              onChange(o.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={{
              flex: 1, minHeight: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center',
              backgroundColor: on ? color.surface : 'transparent', ...(on ? shadow.card : {}),
            }}
          >
            <Text variant="label" style={{ color: on ? color.text : color.textMuted }} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Rounded square with a category or status icon. */
export function IconTile({ name, tone = 'neutral', size = 44 }: { name: IconName; tone?: Tone; size?: number }) {
  const t = TONES[tone];
  return (
    <View style={{ width: size, height: size, borderRadius: radius.md, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} size={size * 0.5} tint={t.icon} />
    </View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xl, marginBottom: space.sm }}>
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      {action ? (
        <Pressable onPress={action.onPress} accessibilityRole="button" hitSlop={8} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text variant="label" tone="primary">
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export const Divider = () => <View style={{ height: 1, backgroundColor: color.border, marginVertical: space.md }} />;

/** A labelled fact on one line: "At home · 500 g". */
export function Fact({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingVertical: 6 }}>
      <Text variant="body" tone="muted" style={{ flexShrink: 1 }}>
        {label}
      </Text>
      <Text variant={strong ? 'bodyStrong' : 'body'} style={{ textAlign: 'right', flexShrink: 1 }}>
        {value}
      </Text>
    </View>
  );
}
