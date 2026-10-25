import { QueryClient, focusManager, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

import { api, type Shopping } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15_000, refetchOnWindowFocus: true },
    mutations: { retry: 0 },
  },
});

// Refresh when the app comes back to the foreground, so the screens and the phone's reminders
// catch up with a day that has moved on.
if (Platform.OS !== 'web') {
  focusManager.setEventListener((setFocused) => {
    const sub = AppState.addEventListener('change', (st) => setFocused(st === 'active'));
    return () => sub.remove();
  });
}

/** Everything that is computed from the pantry. Any change to stock refreshes all of it. */
const STOCK_KEYS = [['inventory'], ['plan'], ['shopping'], ['alerts'], ['check'], ['cooked'], ['household'], ['waste'], ['bills']];

export function useRefreshStock() {
  const qc = useQueryClient();
  return () => Promise.all(STOCK_KEYS.map((k) => qc.invalidateQueries({ queryKey: k })));
}

export const useHousehold = () => useQuery({ queryKey: ['household'], queryFn: api.household });
export const useInventory = () => useQuery({ queryKey: ['inventory'], queryFn: api.inventory });
export const usePlan = () => useQuery({ queryKey: ['plan'], queryFn: api.plan });
export const useShopping = () => useQuery({ queryKey: ['shopping'], queryFn: api.shopping });
export const useAlerts = () => useQuery({ queryKey: ['alerts'], queryFn: api.alerts });
export const useCooked = () => useQuery({ queryKey: ['cooked'], queryFn: api.cooked, refetchInterval: 60_000 });
export const useImpact = () => useQuery({ queryKey: ['impact'], queryFn: api.impact, staleTime: Infinity });
export const useWaste = () => useQuery({ queryKey: ['waste'], queryFn: api.waste });
export const useCheckCards = () => useQuery({ queryKey: ['check'], queryFn: api.checkCards });
export const useCatalogue = () => useQuery({ queryKey: ['catalogue'], queryFn: api.catalogue, staleTime: Infinity });
export const useProfileOptions = () => useQuery({ queryKey: ['options'], queryFn: api.profileOptions, staleTime: Infinity });
export const useScanStatus = () => useQuery({ queryKey: ['scanStatus'], queryFn: api.scanStatus });

/**
 * Shopping-list edits return the new list, so it's shown at once; the pantry-derived
 * screens are refreshed behind it.
 */
export function useShopMutation<V>(fn: (v: V) => Promise<Shopping>) {
  const qc = useQueryClient();
  const refresh = useRefreshStock();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      qc.setQueryData(['shopping'], data);
      refresh();
    },
  });
}

/** Any other change to the pantry or profile. */
export function useStockMutation<V, R>(fn: (v: V) => Promise<R>) {
  const refresh = useRefreshStock();
  return useMutation({ mutationFn: fn, onSuccess: () => refresh() });
}
