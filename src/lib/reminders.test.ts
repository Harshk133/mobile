// Run with: npm test   (Node's built-in runner; Node 22.6+ runs TypeScript directly)
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Cooked, InvItem, Shopping } from './api.ts';
import { DEFAULT_PREFS, planReminders, useFirstDay, type ReminderPrefs } from './reminders.ts';

const t = (key: string, p?: Record<string, string | number>) => key + (p ? ' ' + JSON.stringify(p) : '');
const nameOf = (x: { name_en: string }) => x.name_en;
const ON: ReminderPrefs = { ...DEFAULT_PREFS, enabled: true, weekly: false, shopDay: false };

function item(id: string, over: Partial<InvItem> = {}): InvItem {
  return {
    item_id: id, name_en: id[0].toUpperCase() + id.slice(1), name_hi: id, name_mr: id, category: 'veg', form: 'fresh', tier: 'D5',
    storage: 'pantry', remaining: 1, remaining_label: '1 kg', bought: 1, unit: 'kg', daily_use: 0.1, daily_use_label: '100 g/day',
    days_left: [4, 6], shelf_life: [4, 6], tier_days: [4, 6], factors: [], age_days: 0, at_risk: 0, at_risk_label: null,
    at_risk_rupees: 0, status: 'fresh', urgency: 0.2, low_stock: false, days_of_use: 10, purchased_on: '2026-10-24', source: 'bill',
    estimate: 'estimated', printed_expiry: null, alt_storage: null, reason: '', ...over,
  } as InvItem;
}

const at = (h: number, m = 0, dayOffset = 0) => {
  const d = new Date(2026, 9, 24, h, m, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  return d;
};

function plan(over: Partial<Parameters<typeof planReminders>[0]>) {
  return planReminders({ prefs: ON, items: [], cooked: [], shopping: undefined, delivered: new Set(), now: at(8), t, nameOf, ...over });
}

test('nothing is scheduled until reminders are switched on', () => {
  assert.deepEqual(plan({ prefs: DEFAULT_PREFS, items: [item('palak', { status: 'use_today', days_left: [0.5, 1.5] })] }), []);
});

test('use-today item: morning reminder, or before dinner if the morning has passed, never immediately', () => {
  const items = [item('palak', { status: 'use_today', days_left: [0.5, 1.5] })];
  const morning = plan({ items, now: at(8) });
  assert.equal(morning.length, 1);
  assert.equal(morning[0].key, 'use:' + new Date(2026, 9, 24).toISOString().slice(0, 10));
  assert.equal('at' in morning[0] && morning[0].at, at(9).getTime());
  const later = plan({ items, now: at(11) });
  assert.equal('at' in later[0] && later[0].at, at(17).getTime());
  assert.deepEqual(plan({ items, now: at(18) }), []);
});

test('a reminder already delivered is never scheduled again', () => {
  const items = [item('palak', { status: 'use_today', days_left: [0.5, 1.5] })];
  const key = plan({ items })[0].key;
  assert.deepEqual(plan({ items, now: at(11), delivered: new Set([key]) }), []);
});

test('future use-first day is predicted from the freshness window', () => {
  const tomato = item('tomato', { days_left: [3.2, 4.8] }); // low end reaches 1 day in 2.2 → day 3
  assert.equal(useFirstDay(tomato), 3);
  const r = plan({ items: [tomato] });
  assert.equal(r.length, 1);
  assert.equal('at' in r[0] && r[0].at, at(9, 0, 3).getTime());
});

test('items eaten before they need attention get no reminder', () => {
  assert.equal(useFirstDay(item('tomato', { days_left: [5, 7], days_of_use: 2 })), null);
  assert.equal(useFirstDay(item('rice', { status: 'finished', remaining: 0 })), null);
  assert.deepEqual(plan({ items: [item('rice', { days_left: [270, 365] })] }), []); // beyond the 7-day window
});

test('several items on one day make one digest, not several notifications', () => {
  const items = ['palak', 'methi', 'paneer'].map((id) => item(id, { status: 'use_today', days_left: [0.5, 1.5] }));
  const r = plan({ items });
  assert.equal(r.length, 1);
  assert.match(r[0].title, /rem\.useMany/);
  assert.equal(r[0].url, '/cook');
});

test('spoiled food gets "check" wording, not "use"', () => {
  const r = plan({ items: [item('bhindi', { status: 'spoiled', days_left: [0, 0] })] });
  assert.match(r[0].title, /rem\.checkOnly/);
});

test('cooked food: 30 minutes before finish-by, at the deadline when closer, nothing once past', () => {
  const dish = (finish: Date): Cooked => ({ id: 7, dish: 'Dal', emoji: '', prep: 'wet', storage: 'room', cooked_at: at(8).toISOString(),
    finish_by: finish.toISOString(), official: null, consumed: [] });
  const two = plan({ cooked: [dish(at(10))], now: at(8) });
  assert.equal('at' in two[0] && two[0].at, at(9, 30).getTime());
  const close = plan({ cooked: [dish(at(8, 10))], now: at(8) });
  assert.equal('at' in close[0] && close[0].at, at(8, 10).getTime());
  assert.deepEqual(plan({ cooked: [dish(at(7))], now: at(8) }), []);
});

test('shopping day reminder, but not while already at the shop', () => {
  const shop = { shop_date: '2026-10-27', trip: null, counts: { to_buy: 9, bought: 0, have: 4, excluded: 0 } } as unknown as Shopping;
  const prefs = { ...ON, shopDay: true };
  const r = plan({ prefs, shopping: shop });
  assert.equal(r[0].key, 'shop:2026-10-27');
  assert.equal('at' in r[0] && r[0].at, new Date(2026, 9, 27, 9).getTime());
  assert.deepEqual(plan({ prefs, shopping: { ...shop, trip: { trip_id: 'x', started_on: '2026-10-24' } } }), []);
});

test('weekly check repeats on Sundays', () => {
  const r = plan({ prefs: { ...ON, weekly: true } });
  assert.equal(r.length, 1);
  assert.ok('weekly' in r[0] && r[0].weekly.weekday === 1 && r[0].weekly.hour === 10);
});

test('each reminder type can be switched off on its own', () => {
  const items = [item('palak', { status: 'use_today', days_left: [0.5, 1.5] })];
  assert.deepEqual(plan({ items, prefs: { ...ON, useFirst: false } }), []);
});
