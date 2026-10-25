import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const API_PORT = 8000;

/**
 * Where the AnnaSaathi API lives, in order of preference:
 * 1. a URL saved in Settings (set at runtime via setApiOverride),
 * 2. EXPO_PUBLIC_API_URL from the environment,
 * 3. the computer running the Expo dev server, on port 8000 (works for a phone on the same Wi-Fi),
 * 4. the Android emulator's alias for the host machine.
 */
let override: string | null = null;

export function setApiOverride(url: string | null) {
  override = url ? url.replace(/\/+$/, '') : null;
}

export function defaultApiUrl(): string {
  const env = process.env.EXPO_PUBLIC_API_URL;
  if (env) return env.replace(/\/+$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:${API_PORT}`;
  }
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:${API_PORT}`;
  return `http://10.0.2.2:${API_PORT}`;
}

export function apiUrl(): string {
  return override ?? defaultApiUrl();
}
