import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Pressable, View, type DimensionValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isOffline } from '@/lib/api';
import { useT } from '@/lib/settings';
import { Button, Icon, Text } from './primitives';
import { color, radius, shadow, space } from './theme';
import type { IconName } from '@/lib/format';

/* ---------------------------------------------------------------- toast with optional Undo */

type Toast = { message: string; action?: { label: string; onPress: () => void }; tone?: 'default' | 'error' };
const ToastCtx = createContext<(t: Toast) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children, bottomOffset = 72 }: { children: ReactNode; bottomOffset?: number }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const hide = useCallback(() => {
    Animated.timing(anim, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => setToast(null));
  }, [anim]);

  const show = useCallback(
    (t: Toast) => {
      if (timer.current) clearTimeout(timer.current);
      setToast(t);
      AccessibilityInfo.announceForAccessibility(t.message);
      Animated.timing(anim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      timer.current = setTimeout(hide, t.action ? 5500 : 3200);
    },
    [anim, hide],
  );

  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast ? (
        <Animated.View
          accessibilityLiveRegion="polite"
          style={{
            position: 'absolute', left: space.lg, right: space.lg, bottom: insets.bottom + bottomOffset,
            opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
          }}
        >
          <View
            style={{
              backgroundColor: toast.tone === 'error' ? color.dangerText : color.text, borderRadius: radius.md,
              paddingLeft: space.lg, paddingRight: space.sm, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: space.sm,
              ...shadow.raised,
            }}
          >
            <Text variant="body" style={{ color: '#fff', flex: 1, paddingVertical: space.md }}>
              {toast.message}
            </Text>
            {toast.action ? (
              <Pressable
                onPress={() => {
                  toast.action?.onPress();
                  hide();
                }}
                accessibilityRole="button"
                style={{ minHeight: 44, paddingHorizontal: space.md, justifyContent: 'center' }}
              >
                <Text variant="label" style={{ color: color.accent }}>
                  {toast.action.label}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </ToastCtx.Provider>
  );
}

/* ---------------------------------------------------------------- skeletons */

export function Skeleton({ height = 16, width = '100%', r = radius.sm }: { height?: number; width?: DimensionValue; r?: number }) {
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={{ height, width, borderRadius: r, backgroundColor: color.surfaceAlt, opacity: pulse }} />;
}

/** Placeholder cards shaped like the list that is loading. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  const t = useT();
  return (
    <View accessibilityLabel={t('common.loading')} accessible style={{ gap: space.md, paddingTop: space.md }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={{ backgroundColor: color.surface, borderRadius: radius.lg, padding: space.lg, gap: 10, borderWidth: 1, borderColor: color.border }}>
          <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
            <Skeleton height={44} width={44} r={radius.md} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton height={16} width="55%" />
              <Skeleton height={12} width="80%" />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

/* ---------------------------------------------------------------- empty and error */

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void; icon?: IconName };
}) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: space.xxxl, paddingHorizontal: space.xl, gap: space.md }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: color.sage, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={30} tint={color.sageText} />
      </View>
      <Text variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {body ? (
        <Text tone="muted" style={{ textAlign: 'center' }}>
          {body}
        </Text>
      ) : null}
      {action ? <Button label={action.label} icon={action.icon} onPress={action.onPress} style={{ marginTop: space.sm }} /> : null}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useT();
  const offline = isOffline(error);
  return (
    <EmptyState
      icon={offline ? 'lightning-bolt-outline' : 'alert-circle-outline'}
      title={offline ? t('error.offlineTitle') : t('error.title')}
      body={offline ? t('error.offlineBody') : error instanceof Error ? error.message : String(error)}
      action={{ label: t('common.retry'), onPress: onRetry, icon: 'refresh' }}
    />
  );
}
