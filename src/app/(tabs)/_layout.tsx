import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconName } from '@/lib/format';
import { useReminderSync } from '@/lib/notifications';
import { useShopping } from '@/lib/queries';
import { useSettings } from '@/lib/settings';
import { color } from '@/ui/theme';

const icon = (name: IconName, active: IconName) =>
  function TabIcon({ color: c, focused }: { color: ColorValue; focused: boolean }) {
    return <MaterialCommunityIcons name={focused ? active : name} size={26} color={c as string} />;
  };

export default function TabsLayout() {
  const { t, welcomed } = useSettings();
  const insets = useSafeAreaInsets();
  const shop = useShopping();
  useReminderSync();
  if (!welcomed) return <Redirect href="/welcome" />;
  const toBuy = shop.data ? shop.data.counts.to_buy - shop.data.counts.bought : 0;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.primary,
        tabBarInactiveTintColor: color.textMuted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: color.surface,
          borderTopColor: color.border,
          height: 64 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 6,
        },
        tabBarAllowFontScaling: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tab.home'), tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen
        name="shop"
        options={{
          title: t('tab.shop'),
          tabBarIcon: icon('cart-outline', 'cart'),
          tabBarBadge: toBuy > 0 ? toBuy : undefined,
          tabBarBadgeStyle: { backgroundColor: color.accent, color: color.text, fontSize: 11 },
        }}
      />
      <Tabs.Screen name="kitchen" options={{ title: t('tab.kitchen'), tabBarIcon: icon('fridge-outline', 'fridge') }} />
      <Tabs.Screen name="cook" options={{ title: t('tab.cook'), tabBarIcon: icon('pot-steam-outline', 'chef-hat') }} />
      <Tabs.Screen name="impact" options={{ title: t('tab.impact'), tabBarIcon: icon('chart-box-outline', 'chart-bar') }} />
    </Tabs>
  );
}
