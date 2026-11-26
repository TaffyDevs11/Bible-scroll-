// App-wide settings, streak and small shared state.
import * as db from './db.js';

export const DEFAULTS = { theme: 'system', tr: 'kjv', fontSize: 21, reminder: false, reminderTime: '08:00' };
export let settings = { ...DEFAULTS };
const listeners = new Set();

export async function loadSettings() {
  try { settings = { ...DEFAULTS, ...((await db.get('kv', 'settings')) || {}) }; } catch { /* private mode */ }
  apply();
  return settings;
}

export async function setSetting(k, v) {
  settings = { ...settings, [k]: v };
  apply();
  await db.put('kv', settings, 'settings');
  listeners.forEach((fn) => fn(settings, k));
}
export const onSettings = (fn) => (listeners.add(fn), () => listeners.delete(fn));

function apply() {
  const root = document.documentElement;
  if (settings.theme === 'system') delete root.dataset.theme; else root.dataset.theme = settings.theme;
  try { localStorage.setItem('ba-theme', settings.theme); } catch { /* ignore */ }
  root.style.setProperty('--verse-size', `${settings.fontSize}px`);
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1B2A3A' : '#1B2A3A');
}

// ---------- streak: any day you spend time in Scripture ----------
export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayDiff = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);

export async function getStreak() {
  const s = (await db.get('kv', 'streak')) || { count: 0, best: 0, last: null };
  // a streak survives until a full day is missed
  if (s.last && dayDiff(s.last, today()) > 1) s.count = 0;
  return s;
}

export async function markActivity() {
  const s = (await db.get('kv', 'streak')) || { count: 0, best: 0, last: null };
  const t = today();
  if (s.last === t) return s;
  s.count = s.last && dayDiff(s.last, t) === 1 ? s.count + 1 : 1;
  s.best = Math.max(s.best || 0, s.count);
  s.last = t;
  await db.put('kv', s, 'streak');
  return s;
}

// ---------- cached JSON data ----------
const json = new Map();
export function data(name) {
  if (!json.has(name)) json.set(name, fetch(`data/${name}.json`).then((r) => { if (!r.ok) throw new Error(name); return r.json(); }));
  return json.get(name);
}
