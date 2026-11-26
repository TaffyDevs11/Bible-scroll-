// Settings and About.
import * as db from '../db.js';
import { settings, setSetting } from '../state.js';
import { h, topbar, toast, confirmSheet } from '../ui.js';
import { translationToggle } from './reader.js';

export async function render({ name }) {
  return name === 'about' ? about() : settingsView();
}

function themeToggle() {
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Theme' });
  for (const [id, label] of [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']]) {
    seg.append(h('button', { type: 'button', 'aria-pressed': String(settings.theme === id), onclick: async () => {
      await setSetting('theme', id);
      seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.textContent === label)));
    } }, label));
  }
  return seg;
}

async function offlineStatus() {
  const el = h('p', { class: 'small muted' }, 'Checking offline Bible…');
  const update = async () => {
    if (!('caches' in window)) { el.textContent = 'Offline storage is not available in this browser.'; return; }
    const m = await fetch('precache-manifest.js').then((r) => r.text()).catch(() => '');
    const total = (m.match(/\.json\.gz"/g) || []).length;
    let n = 0;
    for (const k of await caches.keys()) if (k.startsWith('ba-bible')) n += (await (await caches.open(k)).keys()).length;
    el.textContent = total && n >= total ? `The full Bible (KJV and Easy English) is saved on this phone — ${n} books.` : `Saving the Bible for offline use: ${n} of ${total || 132} books.`;
  };
  update();
  const onMsg = (e) => { if (e.data?.type === 'bible-progress') update(); };
  navigator.serviceWorker?.addEventListener('message', onMsg);
  el.__cleanup = () => navigator.serviceWorker?.removeEventListener('message', onMsg);
  return el;
}

async function enableReminder(on, status) {
  if (!on) { await setSetting('reminder', false); status.textContent = 'Reminder is off.'; return true; }
  if (!('Notification' in window)) { status.textContent = 'This browser cannot show reminders.'; return false; }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { status.textContent = 'Notifications are blocked. You can allow them in your phone settings.'; return false; }
  await setSetting('reminder', true);
  let periodic = false;
  try {
    const reg = await navigator.serviceWorker.ready;
    if ('periodicSync' in reg) {
      const p = await navigator.permissions.query({ name: 'periodic-background-sync' });
      if (p.state === 'granted') { await reg.periodicSync.register('daily-reminder', { minInterval: 12 * 60 * 60 * 1000 }); periodic = true; }
    }
  } catch { /* not supported */ }
  status.textContent = periodic
    ? 'Reminder on. Android decides the exact moment, so it may arrive a little after the time you chose.'
    : 'Reminder on. Background reminders need the installed app on Android Chrome; on this device it may not appear.';
  return true;
}

async function settingsView() {
  const size = h('input', { type: 'range', id: 'set-fs', min: 16, max: 30, step: 1, value: settings.fontSize });
  const sizeVal = h('span', { class: 'muted small' }, `${settings.fontSize}px`);
  size.oninput = () => { sizeVal.textContent = `${size.value}px`; setSetting('fontSize', +size.value); };

  const remStatus = h('p', { class: 'small muted', 'aria-live': 'polite' }, settings.reminder ? 'Reminder is on.' : 'Off. Nothing is sent anywhere; the reminder is created on your phone.');
  const rem = h('input', { type: 'checkbox', id: 'rem', checked: settings.reminder, role: 'switch' });
  rem.onchange = async () => { if (!(await enableReminder(rem.checked, remStatus))) rem.checked = false; };
  const time = h('input', { type: 'time', id: 'rem-time', class: 'input', value: settings.reminderTime, style: { maxWidth: '160px' } });
  time.onchange = () => setSetting('reminderTime', time.value || '08:00');

  const offline = await offlineStatus();
  const view = h('section', { class: 'stack' },
    topbar('Settings'),
    h('div', { class: 'card stack' },
      h('h2', {}, 'Appearance'),
      h('div', {}, h('p', { class: 'small muted', style: { marginBottom: '6px' } }, 'Theme'), themeToggle()),
      h('div', {}, h('label', { for: 'set-fs', class: 'row' }, h('span', { class: 'grow' }, 'Bible text size'), sizeVal), size)),
    h('div', { class: 'card stack' },
      h('h2', {}, 'Translation'),
      translationToggle(),
      h('p', { class: 'small muted' }, 'KJV is the classic King James Version. Easy English is the World English Bible, written in modern words.')),
    h('div', { class: 'card stack' },
      h('h2', {}, 'Daily reminder'),
      h('label', { class: 'switch', for: 'rem' }, h('span', {}, 'Remind me to read each day'), rem),
      h('label', { class: 'row', for: 'rem-time' }, h('span', { class: 'grow' }, 'Time'), time),
      remStatus),
    h('div', { class: 'card stack' },
      h('h2', {}, 'Offline'),
      offline,
      h('a', { class: 'btn', href: '#/saved' }, 'Back up or restore my data')),
    h('div', { class: 'card stack' },
      h('h2', {}, 'Reset'),
      h('p', { class: 'small muted' }, 'Deletes saved verses, highlights, notes, plan progress, streak and settings from this phone.'),
      h('button', { class: 'btn danger', type: 'button', onclick: async () => {
        if (!(await confirmSheet('Reset all data?', 'This cannot be undone. Export a backup first if you want to keep anything.', 'Delete everything'))) return;
        await db.resetAll();
        try { localStorage.clear(); } catch { /* ignore */ }
        toast('All data deleted');
        setTimeout(() => location.reload(), 600);
      } }, 'Reset all data')),
    h('a', { class: 'btn block', href: '#/about' }, 'About Bible Advisor'));
  view.__cleanup = () => offline.__cleanup?.();
  return view;
}

function about() {
  return h('section', { class: 'stack' },
    topbar('About'),
    h('div', { class: 'card stack center' },
      h('img', { src: 'icons/logo.svg', alt: '', width: 72, height: 72, style: { margin: '0 auto', borderRadius: '16px' } }),
      h('h2', {}, 'Bible Advisor'),
      h('p', { class: 'scripture', style: { fontStyle: 'italic' } }, 'Every answer leads to Jesus.'),
      h('p', {}, 'Bible Advisor helps you bring how you feel to God and find His Word for it. Every page points to Jesus Christ, the Word who became flesh (John 1:1, 14).')),
    h('div', { class: 'card stack' },
      h('h2', {}, 'Privacy'),
      h('p', { style: { fontWeight: 600 } }, 'No account. No tracking. Your data stays on your phone.'),
      h('p', { class: 'small muted' }, 'There are no ads, no analytics and no server. Saved verses, notes and highlights are stored only on this device. Use Export in Saved to keep a backup.')),
    h('div', { class: 'card stack' },
      h('h2', {}, 'Bible text'),
      h('p', {}, 'Both texts are in the public domain: the King James Version (KJV) and the World English Bible (WEB).'),
      h('p', { class: 'small muted' }, 'Texts from eBible.org. “World English Bible” is a trademark of eBible.org. Reflections and prayers in this app were written for Bible Advisor in plain English and are not Scripture.')),
    h('div', { class: 'card stack' },
      h('h2', {}, 'A gentle note'),
      h('p', { class: 'small' }, 'Bible Advisor shares Scripture, not personal advice. For big decisions, talk with your pastor or a trusted believer. If you are in danger or thinking of harming yourself, please contact local emergency services or a crisis line now, and tell someone you trust.')),
    h('p', { class: 'small muted center' }, 'Fonts: EB Garamond and Inter, SIL Open Font License. Free forever.'));
}
