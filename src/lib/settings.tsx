import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Lang, Named } from './api';
import { setApiOverride } from './config';
import en from '../locales/en.json';
import hi from '../locales/hi.json';
import mr from '../locales/mr.json';

const DICTS: Record<Lang, Record<string, string>> = { en, hi, mr };
export type TKey = keyof typeof en;

type Settings = {
  lang: Lang;
  apiOverride: string | null;
  welcomed: boolean;
  dismissedAlerts: string[];
};

const KEY = 'annasaathi.settings.v1';
const DEFAULTS: Settings = { lang: 'en', apiOverride: null, welcomed: false, dismissedAlerts: [] };

type Ctx = Settings & {
  ready: boolean;
  update: (patch: Partial<Settings>) => void;
  t: (key: TKey, params?: Record<string, string | number>) => string;
  /** The item's name in the chosen language. */
  nameOf: (x: Named) => string;
  /** The English name when the UI is in Hindi/Marathi (and vice versa), for a second line. */
  altNameOf: (x: Named) => string | null;
};

const SettingsCtx = createContext<Ctx | null>(null);

function deviceLang(): Lang {
  const code = getLocales()[0]?.languageCode;
  return code === 'hi' || code === 'mr' ? code : 'en';
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      let loaded: Settings = { ...DEFAULTS, lang: deviceLang() };
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) loaded = { ...loaded, ...JSON.parse(raw) };
      } catch {}
      setApiOverride(loaded.apiOverride);
      setS(loaded);
      setReady(true);
    })();
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setS((cur) => {
      const next = { ...cur, ...patch };
      if ('apiOverride' in patch) setApiOverride(next.apiOverride);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<Ctx>(() => {
    const dict = DICTS[s.lang];
    const t = (key: TKey, params?: Record<string, string | number>) => {
      let str = dict[key] ?? (en as Record<string, string>)[key] ?? key;
      if (params) for (const [k, v] of Object.entries(params)) str = str.replaceAll(`{${k}}`, String(v));
      return str;
    };
    const nameOf = (x: Named) => (s.lang === 'hi' ? x.name_hi : s.lang === 'mr' ? x.name_mr : x.name_en) || x.name_en;
    const altNameOf = (x: Named) => {
      const alt = s.lang === 'en' ? x.name_mr || x.name_hi : x.name_en;
      return alt && alt !== nameOf(x) ? alt : null;
    };
    return { ...s, ready, update, t, nameOf, altNameOf };
  }, [s, ready, update]);

  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
}

export function useSettings() {
  const c = useContext(SettingsCtx);
  if (!c) throw new Error('useSettings outside SettingsProvider');
  return c;
}

export const useT = () => useSettings().t;
