import { z } from 'zod';

import { apiUrl } from './config';

export type Lang = 'en' | 'hi' | 'mr';

export type Named = { name_en: string; name_hi: string; name_mr: string; emoji?: string };

export type Member = { name: string; age: number; group?: string; note?: string; needs: string[] };

export type Weather = { temp_c: number; humidity: number; source: string; city?: string; now_c?: number };

export type Profile = {
  family_name: string;
  city: string;
  language: Lang;
  diet: string;
  portion: string;
  cooked_meals_per_day: number;
  eat_out_meals_per_week: number;
  shop_interval_days: number;
  has_fridge: boolean;
  prep_styles: string[];
  members: Member[];
  setup_seconds?: number | null;
};

export type Household = Profile & { adult_equivalents: number; weather: Weather; today: string };

export type Option = { id: string; label: string };
export type ProfileOptions = {
  groups: (Option & { ages: string; default_age: number })[];
  diets: Option[];
  portions: Option[];
  prep_styles: Option[];
  needs: (Option & { kind: string })[];
};

export type CatalogueItem = Named & {
  id: string;
  unit: string;
  category: string;
  tier: string;
  pack_size: number;
  price: number;
};

export type Status = 'spoiled' | 'use_today' | 'use_soon' | 'fresh' | 'finished';
export type ShelfFactor = { kind: string; label: string; factor: number };

export type InvItem = Named & {
  item_id: string;
  category: string;
  form: string;
  tier: string;
  tier_label: string;
  storage: 'fridge' | 'pantry';
  remaining: number;
  remaining_label: string;
  bought: number;
  unit: string;
  daily_use: number;
  daily_use_label: string;
  days_left: [number, number];
  shelf_life: [number, number];
  tier_days: [number, number];
  factors: ShelfFactor[];
  age_days: number;
  at_risk: number;
  at_risk_label: string | null;
  at_risk_rupees: number;
  status: Status;
  urgency: number;
  low_stock: boolean;
  days_of_use: number | null;
  purchased_on: string;
  source: 'bill' | 'manual' | 'shopping' | 'voice';
  estimate: 'estimated' | 'printed date';
  printed_expiry: string | null;
  alt_storage: { storage: string; shelf_life: [number, number]; days_left: [number, number] } | null;
  reason: string;
};

export type Inventory = {
  items: InvItem[];
  weather: Weather;
  today: string;
  counts: Record<Status, number>;
  at_risk_rupees: number;
};

export type DishUse = Named & { item_id: string; qty_label: string; days_left: [number, number]; status: Status; rescues: boolean };
export type Dish = Named & {
  slot: 'breakfast' | 'lunch' | 'dinner';
  recipe_id: string;
  prep: string;
  time_min: number;
  serves: number;
  uses: DishUse[];
  missing: string[];
  rescued_rupees: number;
  reason: string;
  keeps: string | null;
  steps: string[];
  ingredients: (Named & { item_id: string; have: boolean; minor: boolean })[];
};

export type ShopStatus = 'buy' | 'buy_less' | 'have' | 'manual';
export type ShopRow = Named & {
  item_id: string;
  category: string;
  unit: string;
  tier: string;
  pack_size: number;
  unit_price: number;
  perishable: boolean;
  status: ShopStatus;
  qty: number;
  planned_qty: number;
  qty_label: string;
  price: number;
  edited: boolean;
  excluded: boolean;
  purchased: boolean;
  purchased_qty: number | null;
  purchased_label: string | null;
  headline: string;
  reason: string;
  daily?: boolean;
  daily_use_label?: string;
  stock_now_label: string;
  need_label: string;
  cover_days?: number;
  stock_at_shop_label?: string;
  shelf_life?: [number, number];
  habit_label?: string;
  less_than_habit?: boolean;
  saved_rupees?: number;
  topup?: { day: string; date: string; qty: number; qty_label: string; every_days: number } | null;
};

export type Shopping = {
  shop_date: string;
  shop_day: string;
  days_to_shop: number;
  interval: number;
  rows: ShopRow[];
  counts: { to_buy: number; bought: number; have: number; excluded: number };
  list_rupees: number;
  saved_rupees: number;
  saved_kg: number;
  habit_rupees: number;
  rule: string;
  trip: { trip_id: string; started_on: string } | null;
};

export type Arm = { kg: number; rs: number; shortages: number; curve: number[]; by_cat: Record<string, number> };
export type Impact = {
  households: number;
  days: number;
  seed: number;
  avg_persons: number;
  calibration: { raw_kg_per_person_year: number; factor: number; target: number; note: string };
  baseline: Arm;
  levels: Record<string, Arm>;
};

export type Alert = {
  id: string;
  kind: 'cooked' | 'check' | 'use';
  level: 'urgent' | 'soon' | 'info';
  item_id: string | null;
  cooked_id?: number;
  title: string;
  body: string;
};

export type CheckCard = Named & { item_id: string; category: string; remaining_label: string; status: Status; days_left: [number, number] };

export type Cooked = {
  id: number;
  dish: string;
  emoji: string;
  prep: string;
  storage: 'room' | 'fridge';
  cooked_at: string;
  finish_by: string;
  official: string | null;
  consumed: { item_id: string; qty: number; qty_label: string }[];
};

export type Consumption = Named & {
  item_id: string;
  unit: string;
  pack_size: number;
  qty: number;
  qty_label: string;
  recipe_qty: number;
  recipe_label: string;
  have: number;
  have_label: string;
};

export type Waste = { rows: { item_id: string; qty: number; kg: number; rupees: number; logged_on: string }[]; kg: number; rupees: number };

/* ---------------------------------------------------------------- bill scan (validated: it comes from OCR / an LLM) */

const ScanLine = z.object({
  raw: z.string().default(''),
  item_id: z.string(),
  qty: z.coerce.number().nonnegative().catch(0),
  unit: z.string().default('pc'),
  price: z.number().nullable().optional().transform((v) => v ?? null),
  name_en: z.string().optional(),
  name_hi: z.string().optional(),
  name_mr: z.string().optional(),
  qty_label: z.string().optional(),
  category: z.string().optional(),
  tier: z.string().optional(),
  tier_label: z.string().optional(),
  days_left: z.tuple([z.number(), z.number()]).optional(),
  matched: z.boolean(),
  confidence: z.number().min(0).max(1),
  needs_review: z.boolean(),
  issues: z.array(z.string()).default([]),
  printed_expiry: z.string().nullable().optional(),
});
export type ScanLine = z.infer<typeof ScanLine>;

const ScanResult = z.object({
  bill_id: z.string(),
  shop: z.string(),
  source: z.string(),
  mode: z.enum(['claude', 'preloaded', 'parsed']),
  note: z.string().nullable().optional(),
  lines: z.array(ScanLine),
  already_imported: z.string().nullable(),
  review_count: z.number(),
  total: z.number(),
});
export type ScanResult = z.infer<typeof ScanResult>;

/* ---------------------------------------------------------------- transport */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public detail?: unknown,
  ) {
    super(message);
  }
}

/** True when the server couldn't be reached at all (as opposed to answering with an error). */
export const isOffline = (e: unknown) => e instanceof ApiError && e.status === 0;

const TIMEOUT_MS = 15000;

async function j<T>(path: string, init?: RequestInit & { timeout?: number }): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init?.timeout ?? TIMEOUT_MS);
  let r: Response;
  try {
    r = await fetch(`${apiUrl()}${path}`, { ...init, signal: ctrl.signal });
  } catch {
    throw new ApiError(0, "Can't reach the AnnaSaathi server. Check that it's running and on the same Wi-Fi.");
  } finally {
    clearTimeout(timer);
  }
  if (!r.ok) {
    let message = `Something went wrong (${r.status}).`;
    let code: string | undefined;
    let detail: unknown;
    try {
      const body = await r.json();
      detail = body.detail;
      if (Array.isArray(body.detail)) {
        message = body.detail
          .map((d: { loc?: (string | number)[]; msg: string }) =>
            `${(d.loc ?? []).filter((x) => x !== 'body').join(' › ')}: ${d.msg.replace(/^Value error, /, '')}`)
          .join('\n');
      } else if (body.detail && typeof body.detail === 'object') {
        message = body.detail.message ?? message;
        code = body.detail.code;
      } else if (body.detail) {
        message = String(body.detail);
      }
    } catch {}
    throw new ApiError(r.status, message, code, detail);
  }
  return r.json() as Promise<T>;
}

const send = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

async function scan(path: string, init: RequestInit & { timeout?: number }): Promise<ScanResult> {
  const raw = await j<unknown>(path, init);
  const parsed = ScanResult.safeParse(raw);
  if (!parsed.success) throw new ApiError(502, "The bill came back in an unexpected format. Please try again.");
  return parsed.data;
}

export type ConfirmLine = { item_id: string; qty: number; price: number | null; raw: string };

export const api = {
  household: () => j<Household>('/api/household'),
  saveHousehold: (h: Profile) => j<Household>('/api/household', send('PUT', h)),
  setupFamily: (h: Profile, fresh: boolean) => j<Household>('/api/household/setup', send('POST', { household: h, fresh })),
  profileOptions: () => j<ProfileOptions>('/api/household/options'),
  reset: () => j<{ ok: boolean }>('/api/demo/reset', send('POST')),
  catalogue: () => j<CatalogueItem[]>('/api/catalogue'),

  inventory: () => j<Inventory>('/api/inventory'),
  editItem: (id: string, body: { storage?: string; printed_expiry?: string; clear_printed_expiry?: boolean; qty?: number; purchased_on?: string }) =>
    j<Inventory>(`/api/inventory/${id}`, send('PATCH', body)),
  addItem: (body: { item_id: string; qty: number; storage?: string }) => j<Inventory>('/api/inventory/add', send('POST', body)),
  removeItem: (id: string) => j<{ lot_ids: number[] }>(`/api/inventory/${id}`, send('DELETE')),
  restoreItem: (lot_ids: number[]) => j<{ restored: number }>('/api/inventory/restore', send('POST', { lot_ids })),

  plan: () => j<{ dishes: Dish[]; today: string }>('/api/plan/today'),
  consumption: (rid: string) => j<{ serves: number; items: Consumption[] }>(`/api/recipes/${rid}/consumption`),
  cook: (body: { recipe_id: string; storage: 'room' | 'fridge'; consumed: { item_id: string; qty: number }[] }) =>
    j<{ id: number; dish: string; finish_by: string; rule: string; official: string; used: { qty_label: string; left_label: string; item_id: string }[] }>(
      '/api/cooked', send('POST', body)),
  cooked: () => j<{ rows: Cooked[]; now: string }>('/api/cooked'),
  moveCooked: (id: number, storage: 'room' | 'fridge') => j<{ rows: Cooked[] }>(`/api/cooked/${id}`, send('PATCH', { storage })),
  cookedDone: (id: number, outcome: 'eaten' | 'thrown') => j<{ ok: boolean }>(`/api/cooked/${id}/done?outcome=${outcome}`, send('POST')),

  shopping: () => j<Shopping>('/api/shopping'),
  editShopItem: (id: string, body: { qty?: number; excluded?: boolean }) => j<Shopping>(`/api/shopping/items/${id}`, send('PUT', body)),
  addShopItem: (item_id: string, qty?: number) => j<Shopping>('/api/shopping/items', send('POST', { item_id, qty })),
  resetShopItem: (id: string) => j<Shopping>(`/api/shopping/items/${id}`, send('DELETE')),
  purchase: (id: string, qty?: number) => j<Shopping>(`/api/shopping/items/${id}/purchase`, send('POST', { qty })),
  unpurchase: (id: string) => j<Shopping>(`/api/shopping/items/${id}/unpurchase`, send('POST')),
  startShopping: () => j<Shopping>('/api/shopping/start', send('POST')),
  finishShopping: () => j<{ items: number; rupees: number; shopping: Shopping }>('/api/shopping/finish', send('POST')),

  alerts: () => j<{ alerts: Alert[] }>('/api/alerts'),
  impact: () => j<Impact>('/api/impact', { timeout: 60000 }),
  waste: () => j<Waste>('/api/waste'),
  checkCards: () => j<{ cards: CheckCard[] }>('/api/check'),
  check: (item_id: string, action: 'still_have' | 'finished' | 'thrown') =>
    j<{ ok: boolean; message: string }>('/api/check', send('POST', { item_id, action })),

  scanStatus: () => j<{ live_vision: boolean; model: string | null }>('/api/bills/status'),
  scanSample: (sample_id = 'ganesh_kirana_oct24') => {
    const f = new FormData();
    f.append('sample_id', sample_id);
    return scan('/api/bills/scan', { method: 'POST', body: f });
  },
  /** `file` is a React Native file descriptor ({uri, name, type}) or, on web, a Blob. */
  scanPhoto: (file: { uri: string; name: string; type: string } | Blob) => {
    const f = new FormData();
    f.append('file', file as unknown as Blob);
    f.append('sample_id', 'ganesh_kirana_oct24');
    return scan('/api/bills/scan', { method: 'POST', body: f, timeout: 90000 });
  },
  parseText: (text: string, shop?: string) => scan('/api/bills/parse_text', send('POST', { text, shop: shop || 'Pasted order' })),
  voice: (text: string) => j<{ lines: ScanLine[] }>('/api/voice/parse', send('POST', { text })),
  confirmBill: (body: { bill_id: string; shop: string; source: string; lines: ConfirmLine[]; allow_duplicate?: boolean }) =>
    j<{ ok: boolean; added: number; replaced: boolean }>('/api/bills/confirm', send('POST', body)),
};

/** Just the fields the profile endpoints accept. */
export function toProfile(h: Profile): Profile {
  return {
    family_name: h.family_name,
    city: h.city,
    language: h.language ?? 'en',
    diet: h.diet,
    portion: h.portion,
    cooked_meals_per_day: h.cooked_meals_per_day,
    eat_out_meals_per_week: h.eat_out_meals_per_week,
    shop_interval_days: h.shop_interval_days,
    has_fridge: h.has_fridge ?? true,
    prep_styles: h.prep_styles,
    members: h.members.map((m) => ({ name: m.name, age: m.age, needs: m.needs ?? [], note: m.note ?? '' })),
    setup_seconds: h.setup_seconds ?? null,
  };
}
