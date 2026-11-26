// Small DOM helpers, icons, toasts, bottom sheets and the shared verse action sheet.
import * as db from './db.js';
import { R, plain } from './bible.js';

/** h('div', {class:'x', onclick}, child, 'text', [more]) */
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k in el && typeof v !== 'string' && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, kids);
  return el;
}
function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

const P = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  save: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  share: '<path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  note: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  cross: '<path d="M12 3v18M7 8h10"/>',
  flame: '<path d="M12 21c-4 0-7-3-7-6.5 0-3 2-5 3.5-6.5.5 2 1.5 3 2.5 3-.5-3 1-6 4-8 0 3 1.5 4.5 3 6.5 1 1.3 1.5 3 1.5 5 0 3.5-3 6.5-7.5 6.5z"/>',
  text: '<path d="M4 7V5h16v2M9 19h6M12 5v14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 20V8M7 13l5-5 5 5M5 4h14"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.1"/>',
};
export function icon(name) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('class', 'i');
  s.innerHTML = P[name] || '';
  return s;
}
export const iconBtn = (name, label, onclick, extra = {}) => h('button', { class: 'icon-btn', type: 'button', 'aria-label': label, title: label, onclick, ...extra }, icon(name));

export function topbar(title, { back = true, actions = [] } = {}) {
  return h('header', { class: 'topbar' },
    back ? iconBtn('back', 'Go back', () => (history.length > 1 ? history.back() : (location.hash = '#/home'))) : null,
    h('h1', {}, title),
    ...actions);
}

let toastTimer;
export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

/** Renders scripture text, drawing ‹words of Jesus› in red. */
export function scripture(text, tag = 'span', cls = '') {
  const el = h(tag, { class: cls });
  const parts = text.split(/([‹›])/);
  let red = false;
  for (const p of parts) {
    if (p === '‹') red = true;
    else if (p === '›') red = false;
    else if (p) el.append(red ? h('span', { class: 'jw' }, p) : p);
  }
  return el;
}

/** Opens a bottom sheet; returns a close() function. */
export function sheet(title, content, { onClose } = {}) {
  const prev = document.activeElement;
  const back = h('div', { class: 'sheet-backdrop' });
  const box = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'grab' }),
    h('div', { class: 'row' }, h('h2', { class: 'grow' }, title), iconBtn('close', 'Close', () => close())),
    content);
  function close() {
    back.remove(); box.remove();
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('hashchange', close);
    onClose?.();
    prev?.focus?.();
  }
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') { // keep focus inside
      const f = [...box.querySelectorAll('button, a[href], input, textarea, select')].filter((x) => !x.disabled);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
    }
  };
  back.onclick = close;
  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', close);
  document.body.append(back, box);
  box.querySelector('button')?.focus();
  return close;
}

export function confirmSheet(title, message, okLabel = 'Yes') {
  return new Promise((resolve) => {
    let ok = false;
    const close = sheet(title, h('div', { class: 'stack' },
      h('p', {}, message),
      h('div', { class: 'actions' },
        h('button', { class: 'btn primary', type: 'button', onclick: () => { ok = true; close(); } }, okLabel),
        h('button', { class: 'btn', type: 'button', onclick: () => close() }, 'Cancel'))), { onClose: () => resolve(ok) });
  });
}

// ---------- saving ----------
export async function isSaved(key) { return !!(await db.get('saved', key)); }
export async function toggleSave(r, extra = {}) {
  const key = R().key(r);
  if (await db.get('saved', key)) { await db.del('saved', key); toast('Removed from Saved'); return false; }
  await db.put('saved', { id: key, b: r.b, c: r.c, v: r.v, v2: r.v2 || r.v, ref: R().format(r), savedAt: Date.now(), ...extra });
  toast('Saved');
  return true;
}

export function saveButton(r, extra = {}) {
  const key = R().key(r);
  const btn = h('button', { class: 'btn small', type: 'button', 'aria-pressed': 'false' }, icon('save'), h('span', {}, 'Save'));
  const set = (on) => { btn.setAttribute('aria-pressed', String(on)); btn.lastChild.textContent = on ? 'Saved' : 'Save'; };
  isSaved(key).then(set);
  btn.onclick = async () => set(await toggleSave(r, extra));
  return btn;
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('Copied'); }
  catch {
    const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } }, text);
    document.body.append(ta); ta.select();
    try { document.execCommand('copy'); toast('Copied'); } catch { toast('Copy not available'); }
    ta.remove();
  }
}

export const quote = (text, r, tr) => `"${plain(text)}"\n— ${R().format(r)} (${tr === 'web' ? 'WEB' : 'KJV'})`;

export async function shareImage(text, r, tr) {
  const mod = await import('./share.js');
  mod.openShareSheet(text, r, tr);
}

export function readLink(r) {
  return `#/bible/${r.b}/${r.c}` + (r.v ? `/${r.v}` : '');
}
