import type { ComponentProps } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';

import type { ShopRow, Status } from './api';
import type { TKey } from './settings';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
export type Tone = 'primary' | 'sage' | 'accent' | 'danger' | 'neutral';

type T = (key: TKey, params?: Record<string, string | number>) => string;

export const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const WEEKDAY_KEYS: TKey[] = ['day.sun', 'day.mon', 'day.tue', 'day.wed', 'day.thu', 'day.fri', 'day.sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-10-27' → 'Tue 27 Oct' (dates are calendar days, parsed without timezone shifts). */
export function shortDate(iso: string, t: T) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${t(WEEKDAY_KEYS[dt.getUTCDay()])} ${d} ${MONTHS[m - 1]}`;
}

export function addDays(iso: string, n: number) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string) {
  const a = Date.parse(fromIso.slice(0, 10) + 'T00:00:00Z');
  const b = Date.parse(toIso.slice(0, 10) + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}

export function clockTime(iso: string) {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${((h + 11) % 12) + 1}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}

/** A freshness window as a range, never false precision: "2–3 days left", "today". */
export function daysLeft([lo, hi]: [number, number], t: T) {
  const a = Math.round(lo);
  const b = Math.round(hi);
  if (b <= 0) return t('fresh.past');
  if (a <= 0) return b <= 1 ? t('fresh.today') : t('fresh.upTo', { n: b });
  if (a === b) return a === 1 ? t('fresh.oneDay') : t('fresh.days', { n: a });
  return t('fresh.range', { a, b });
}

export const STATUS: Record<Status, { key: TKey; icon: IconName; tone: Tone }> = {
  spoiled: { key: 'status.check', icon: 'alert-circle-outline', tone: 'danger' },
  use_today: { key: 'status.useFirst', icon: 'clock-alert-outline', tone: 'accent' },
  use_soon: { key: 'status.useSoon', icon: 'clock-outline', tone: 'accent' },
  fresh: { key: 'status.fresh', icon: 'check-circle-outline', tone: 'sage' },
  finished: { key: 'status.finished', icon: 'checkbox-blank-circle-outline', tone: 'neutral' },
};

export function shopStatus(r: ShopRow): { key: TKey; icon: IconName; tone: Tone } {
  if (r.purchased) return { key: 'shop.status.bought', icon: 'check-circle', tone: 'sage' };
  if (r.excluded) return { key: 'shop.status.skipped', icon: 'eye-off-outline', tone: 'neutral' };
  if (r.status === 'have') return { key: 'shop.status.have', icon: 'home-outline', tone: 'sage' };
  if (r.status === 'buy_less') return { key: 'shop.status.buyLess', icon: 'arrow-down-circle-outline', tone: 'accent' };
  if (r.status === 'manual') return { key: 'shop.status.manual', icon: 'pencil-outline', tone: 'neutral' };
  return { key: 'shop.status.buy', icon: 'cart-outline', tone: 'primary' };
}

/** Kitchen sections, in the order a cook thinks about them. */
export const CATEGORY_GROUPS: { key: TKey; icon: IconName; categories: string[] }[] = [
  { key: 'cat.vegFruit', icon: 'carrot', categories: ['veg', 'leafy', 'fruit'] },
  { key: 'cat.dairy', icon: 'cow', categories: ['dairy', 'egg'] },
  { key: 'cat.meat', icon: 'food-drumstick-outline', categories: ['meat'] },
  { key: 'cat.grains', icon: 'rice', categories: ['grain', 'flour', 'pulse'] },
  { key: 'cat.spices', icon: 'shaker-outline', categories: ['spice', 'oil'] },
  { key: 'cat.packaged', icon: 'package-variant-closed', categories: ['packaged', 'bakery', 'nuts'] },
  { key: 'cat.other', icon: 'basket-outline', categories: ['misc'] },
];

export function groupOf(category: string) {
  return CATEGORY_GROUPS.find((g) => g.categories.includes(category)) ?? CATEGORY_GROUPS[CATEGORY_GROUPS.length - 1];
}

const CATEGORY_ICON: Record<string, IconName> = {
  veg: 'carrot', leafy: 'leaf', fruit: 'food-apple', dairy: 'cow', egg: 'egg-outline', meat: 'food-drumstick-outline',
  grain: 'rice', flour: 'grain', pulse: 'seed', spice: 'shaker-outline', oil: 'bottle-tonic-outline',
  packaged: 'package-variant-closed', bakery: 'bread-slice-outline', nuts: 'peanut-outline', misc: 'package-variant',
};
export const categoryIcon = (c: string): IconName => CATEGORY_ICON[c] ?? 'basket-outline';

/** Step size for quantity editors: whole packs for pieces, sensible kitchen steps for weights. */
export function qtyStep(unit: string, pack: number) {
  if (unit === 'pc') return pack >= 4 ? Math.max(1, pack / 2) : 1;
  if (pack <= 0.1) return pack; // spices: 50 g, 100 g
  if (pack < 0.25) return 0.1; // paneer 200 g
  return pack < 1 ? 0.25 : 0.5;
}

const SINGULAR: Record<string, string> = { bunches: 'bunch', loaves: 'loaf', packs: 'pack' };
const PLURAL: Record<string, string> = { bunch: 'bunches', loaf: 'loaves', pack: 'packs' };

/**
 * Client-side mirror of the server's fmt_qty, for live stepper labels before saving.
 * `like` is any server label for the same item ("3 bunches"), so piece items reuse its word.
 */
export function qtyLabel(qty: number, unit: string, like?: string) {
  if (unit === 'kg' || unit === 'L') {
    const small = unit === 'kg' ? 'g' : 'ml';
    if (qty < 1) {
      const v = qty >= 0.1 ? Math.round((qty * 1000) / 50) * 50 : Math.round((qty * 1000) / 5) * 5;
      return `${Math.max(v, qty > 0 ? 5 : 0)} ${small}`;
    }
    return `${Math.round(qty * 4) / 4} ${unit}`;
  }
  const n = qty < 3 ? Math.round(qty * 2) / 2 : Math.round(qty);
  let word = like?.match(/^[\d.]+ ([^\s]+)/)?.[1] ?? 'pc';
  word = n === 1 ? SINGULAR[word] ?? word : PLURAL[word] ?? word;
  return `${n} ${word}`;
}

export function greetingKey(hour = new Date().getHours()): TKey {
  return hour < 12 ? 'home.morning' : hour < 17 ? 'home.afternoon' : 'home.evening';
}
