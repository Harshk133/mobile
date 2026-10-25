import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient } from '@/lib/queries';
import { SettingsProvider, useSettings } from '@/lib/settings';
import { ToastProvider } from '@/ui/feedback';
import { color } from '@/ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Root() {
  const { ready } = useSettings();
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  if (!ready) return null;
  return (
    <PhoneFrame>
    <ToastProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg }, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="scan" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
        <Stack.Screen name="voice" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="check" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="alerts" />
        <Stack.Screen name="family" />
        <Stack.Screen name="item/[id]" />
      </Stack>
    </ToastProvider>
    </PhoneFrame>
  );
}

/** On the web preview, show the app at phone width instead of stretched across a desktop screen. */
function PhoneFrame({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={{ flex: 1, backgroundColor: '#E4E0D5', alignItems: 'center' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 440, overflow: 'hidden' }}>{children}</View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SettingsProvider>
          <Root />
        </SettingsProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
