// Read the Bible: book list, chapter grid, chapter reader, verse actions and search.
import * as bible from '../bible.js';
import * as db from '../db.js';
import { settings, setSetting, markActivity } from '../state.js';
import { h, icon, iconBtn, topbar, scripture, sheet, toast, toggleSave, copyText, quote, shareImage } from '../ui.js';

const R = () => bible.R();

export async function render({ args }) {
  if (args[0] === 'search') return searchView(args.slice(1).join('/'));
  if (args[0] && args[1]) return chapterView(args[0].toUpperCase(), +args[1], args[2] ? +args[2] : null);
  if (args[0]) return bookView(args[0].toUpperCase());
  return booksView();
}

export function textSettingsSheet(onChange) {
  const size = h('input', { type: 'range', min: 16, max: 30, step: 1, value: settings.fontSize, id: 'fs', 'aria-describedby': 'fs-val' });
  const val = h('span', { id: 'fs-val', class: 'muted small' }, `${settings.fontSize}px`);
  const sample = scripture('In the beginning was the Word, and the Word was with God.', 'p', 'scripture');
  size.oninput = () => { val.textContent = `${size.value}px`; setSetting('fontSize', +size.value); };
  const seg = translationToggle(onChange);
  sheet('Text', h('div', { class: 'stack' },
    h('div', {}, h('label', { for: 'fs', class: 'row' }, h('span', { class: 'grow' }, 'Text size'), val), size),
    sample,
    h('div', {}, h('p', { class: 'small muted', style: { marginBottom: '6px' } }, 'Translation'), seg)));
}

export function translationToggle(onChange) {
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Translation' });
  for (const t of Object.values(bible.TRANSLATIONS)) {
    seg.append(h('button', {
      type: 'button', 'aria-pressed': String(settings.tr === t.id),
      onclick: async () => {
        await setSetting('tr', t.id);
        seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.textContent === t.short)));
        onChange?.();
      },
    }, t.short));
  }
  return seg;
}

// ---------------- book list ----------------
async function booksView() {
  const last = await db.get('kv', 'lastPos');
  const books = R().books;
  let testament = last && books.find((b) => b.id === last.b)?.t === 'OT' ? 'OT' : 'NT';
  const list = h('ul', { class: 'book-list', id: 'book-list' });
  const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Testament' });
  const draw = () => {
    tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.t === testament)));
    list.replaceChildren(...books.filter((b) => b.t === testament).map((b) => h('li', {},
      h('a', { href: `#/bible/${b.id}` }, b.name, h('span', { class: 'muted' }, `${b.v.length} ch`)))));
  };
  for (const [t, label] of [['OT', 'Old Testament'], ['NT', 'New Testament']]) {
    tabs.append(h('button', { role: 'tab', type: 'button', 'data-t': t, 'aria-controls': 'book-list', onclick: () => { testament = t; draw(); } }, label));
  }
  draw();
  return h('section', {},
    topbar('Read the Bible', { back: false, actions: [
      h('a', { class: 'icon-btn', href: '#/bible/search', 'aria-label': 'Search the Bible', title: 'Search' }, icon('search')),
      iconBtn('text', 'Text size and translation', () => textSettingsSheet()),
    ] }),
    last ? h('a', { class: 'card link', href: `#/bible/${last.b}/${last.c}${last.v ? '/' + last.v : ''}`, style: { marginBottom: '16px' } },
      h('div', { class: 'eyebrow' }, 'Continue reading'),
      h('h3', { style: { marginTop: '4px' } }, `${R().bookName(last.b)} ${last.c}`)) : null,
    tabs, list);
}

// ---------------- chapter grid ----------------
async function bookView(id) {
  const b = R().byId.get(id);
  if (!b) { location.hash = '#/bible'; return h('div'); }
  const read = (await db.get('kv', 'read')) || {};
  const done = new Set(read[id] || []);
  return h('section', {},
    topbar(b.name, { actions: [] }),
    h('p', { class: 'muted small', style: { margin: '0 4px 12px' } }, `${b.v.length} chapters · choose one to start`),
    h('nav', { class: 'ch-grid', 'aria-label': `${b.name} chapters` },
      b.v.map((_, i) => h('a', { href: `#/bible/${id}/${i + 1}`, class: done.has(i + 1) ? 'read' : '', 'aria-label': `Chapter ${i + 1}${done.has(i + 1) ? ', read' : ''}` }, String(i + 1)))));
}

// ---------------- chapter reader ----------------
async function chapterView(id, c, focusV) {
  const b = R().byId.get(id);
  if (!b || c < 1 || c > b.v.length) { location.hash = '#/bible'; return h('div'); }
  const tr = settings.tr;
  const [{ verses, title }, hls, notes] = await Promise.all([bible.getChapter(tr, id, c), db.all('highlights'), db.all('notes')]);
  const prefix = `${id}.${c}.`;
  const hl = new Map(hls.filter((x) => x.id.startsWith(prefix)).map((x) => [x.id, x.color]));
  const nt = new Map(notes.filter((x) => x.id.startsWith(prefix)).map((x) => [x.id, x.text]));

  const body = h('div', { class: 'scripture chapter-text' });
  verses.forEach((t, i) => {
    const v = i + 1;
    const key = `${prefix}${v}`;
    const span = h('span', { class: 'v' + (t ? '' : ' missing'), id: `v${v}`, 'data-v': v, role: 'button', tabindex: '0', 'aria-label': `Verse ${v}, options` },
      h('sup', {}, String(v)),
      t ? scripture(t) : '(This verse is not in the oldest manuscripts used by this translation.)',
      nt.has(key) ? h('span', { class: 'note-mark', title: 'Has a note' }) : null);
    if (hl.has(key)) span.dataset.hl = hl.get(key);
    body.append(span, ' ');
  });

  const open = (span) => {
    const v = +span.dataset.v;
    const t = verses[v - 1];
    if (!t) return;
    span.classList.add('sel');
    verseSheet({ b: id, c, v, v2: v }, t, tr, span, () => span.classList.remove('sel'));
  };
  body.addEventListener('click', (e) => { const s = e.target.closest('.v'); if (s) open(s); });
  body.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('v')) { e.preventDefault(); open(e.target); } });

  const prev = c > 1 ? `#/bible/${id}/${c - 1}` : prevBook(id);
  const next = c < b.v.length ? `#/bible/${id}/${c + 1}` : nextBook(id);
  const trName = bible.TRANSLATIONS[tr].short;

  const view = h('article', { class: 'chapter' },
    topbar(`${b.name} ${c}`, { actions: [
      h('a', { class: 'icon-btn', href: '#/bible/search', 'aria-label': 'Search the Bible', title: 'Search' }, icon('search')),
      iconBtn('text', 'Text size and translation', () => textSettingsSheet(() => window.dispatchEvent(new HashChangeEvent('hashchange')))),
    ] }),
    h('p', { class: 'center muted small' }, h('a', { href: `#/bible/${id}` }, b.name), ` · ${trName}`),
    h('h2', {}, id === 'PSA' ? `Psalm ${c}` : `Chapter ${c}`),
    title ? h('p', { class: 'title' }, title) : null,
    body,
    h('nav', { class: 'pager', 'aria-label': 'Chapters' },
      prev ? h('a', { class: 'btn', href: prev }, icon('left'), 'Previous') : h('span'),
      next ? h('a', { class: 'btn', href: next }, 'Next', icon('right')) : h('span')));

  // remember position (top-most visible verse) and mark today's reading
  let t;
  const onScroll = () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const top = [...body.querySelectorAll('.v')].find((s) => s.getBoundingClientRect().bottom > 80);
      db.put('kv', { b: id, c, v: top ? +top.dataset.v : 1 }, 'lastPos');
    }, 300);
  };
  view.__mounted = () => {
    db.put('kv', { b: id, c, v: focusV || 1 }, 'lastPos');
    markActivity();
    db.get('kv', 'read').then((r = {}) => { const s = new Set(r[id] || []); s.add(c); r[id] = [...s]; return db.put('kv', r, 'read'); });
    if (focusV) {
      const el = body.querySelector(`#v${focusV}`);
      if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); }
    }
    addEventListener('scroll', onScroll, { passive: true });
  };
  view.__keepScroll = !!focusV;
  view.__cleanup = () => removeEventListener('scroll', onScroll);
  return view;
}

function prevBook(id) {
  const i = R().books.findIndex((b) => b.id === id);
  const p = R().books[i - 1];
  return p ? `#/bible/${p.id}/${p.v.length}` : null;
}
function nextBook(id) {
  const i = R().books.findIndex((b) => b.id === id);
  const n = R().books[i + 1];
  return n ? `#/bible/${n.id}/1` : null;
}

// ---------------- verse action sheet ----------------
const HL = [['1', 'Gold'], ['2', 'Olive'], ['3', 'Blue'], ['4', 'Rose']];

export function verseSheet(r, text, tr, span, onClose, { mood } = {}) {
  const key = R().key(r);
  const swatches = h('div', { class: 'swatches', role: 'group', 'aria-label': 'Highlight colour' });
  const setHl = async (color) => {
    if (color) await db.put('highlights', { id: key, b: r.b, c: r.c, v: r.v, color, at: Date.now() });
    else await db.del('highlights', key);
    if (span) { if (color) span.dataset.hl = color; else delete span.dataset.hl; }
    swatches.querySelectorAll('.swatch').forEach((s) => s.setAttribute('aria-pressed', String(s.dataset.c === color)));
    toast(color ? 'Highlighted' : 'Highlight removed');
    if (color) markActivity();
  };
  for (const [c, name] of HL) {
    swatches.append(h('button', { class: 'swatch', type: 'button', 'data-c': c, 'aria-label': `Highlight ${name}`, 'aria-pressed': 'false', style: { background: `var(--hl-${c})` }, onclick: () => setHl(c) }));
  }
  swatches.append(h('button', { class: 'swatch', type: 'button', 'data-c': '', 'aria-label': 'Remove highlight', style: { background: 'transparent' }, onclick: () => setHl(null) }, icon('close')));
  db.get('highlights', key).then((x) => x && swatches.querySelector(`[data-c="${x.color}"]`)?.setAttribute('aria-pressed', 'true'));

  const saveBtn = h('button', { class: 'btn', type: 'button', 'aria-pressed': 'false' }, icon('save'), h('span', {}, 'Save'));
  db.get('saved', key).then((x) => { if (x) { saveBtn.setAttribute('aria-pressed', 'true'); saveBtn.lastChild.textContent = 'Saved'; } });
  saveBtn.onclick = async () => {
    const on = await toggleSave(r, mood ? { mood } : {});
    saveBtn.setAttribute('aria-pressed', String(on)); saveBtn.lastChild.textContent = on ? 'Saved' : 'Save';
  };

  const close = sheet(R().format(r), h('div', {},
    scripture(text, 'p', 'scripture'),
    h('p', { class: 'small muted', style: { margin: '12px 0 8px' } }, 'Highlight'),
    swatches,
    h('div', { class: 'menu' },
      saveBtn,
      h('button', { class: 'btn', type: 'button', onclick: () => { close(); noteSheet(r, span); } }, icon('note'), 'Note'),
      h('button', { class: 'btn', type: 'button', onclick: () => copyText(quote(text, r, tr)) }, icon('copy'), 'Copy'),
      h('button', { class: 'btn', type: 'button', onclick: () => { close(); shareImage(text, r, tr); } }, icon('image'), 'Share image'))),
  { onClose });
}

export async function noteSheet(r, span) {
  const key = R().key(r);
  const existing = await db.get('notes', key);
  const ta = h('textarea', { class: 'input', id: 'note-text', placeholder: 'What is God showing you in this verse?' }, existing?.text || '');
  const close = sheet(`Note · ${R().format(r)}`, h('div', { class: 'stack' },
    h('label', { for: 'note-text', class: 'sr-only' }, 'Your note'),
    ta,
    h('div', { class: 'actions' },
      h('button', { class: 'btn primary', type: 'button', onclick: async () => {
        const text = ta.value.trim();
        if (text) await db.put('notes', { id: key, b: r.b, c: r.c, v: r.v, text, at: Date.now() });
        else await db.del('notes', key);
        if (span && text && !span.querySelector('.note-mark')) span.append(h('span', { class: 'note-mark', title: 'Has a note' }));
        if (span && !text) span.querySelector('.note-mark')?.remove();
        toast(text ? 'Note saved' : 'Note removed');
        close();
      } }, 'Save note'),
      existing ? h('button', { class: 'btn danger', type: 'button', onclick: async () => { await db.del('notes', key); span?.querySelector('.note-mark')?.remove(); toast('Note deleted'); close(); } }, 'Delete') : null)));
  setTimeout(() => ta.focus(), 50);
}

// ---------------- search ----------------
async function searchView(q) {
  const input = h('input', { class: 'input', type: 'search', id: 'bible-q', value: q || '', placeholder: 'Search words, e.g. “peace”', enterkeyhint: 'search', autocomplete: 'off' });
  const out = h('div', { 'aria-live': 'polite' });
  const form = h('form', { class: 'search', role: 'search', onsubmit: (e) => { e.preventDefault(); const v = input.value.trim(); if (v) location.hash = `#/bible/search/${encodeURIComponent(v)}`; } },
    h('label', { for: 'bible-q', class: 'sr-only' }, 'Search the Bible'), input,
    h('button', { class: 'btn primary', type: 'submit' }, 'Search'));
  const view = h('section', {}, topbar('Search the Bible'), form, h('div', { style: { marginTop: '12px' } }, translationToggle(() => run())), out);

  async function run() {
    if (!q) { out.replaceChildren(h('p', { class: 'muted', style: { marginTop: '16px' } }, 'Type a word or phrase. Results are grouped by book.')); return; }
    const tr = settings.tr;
    const status = h('p', { class: 'muted small', style: { marginTop: '16px' } }, 'Opening the whole Bible…');
    out.replaceChildren(status);
    const res = await bible.search(tr, q, { mode: 'phrase', limit: 500, onProgress: (d, n) => { status.textContent = `Opening the whole Bible… ${Math.round((d / n) * 100)}%`; } });
    if (!res.length) { out.replaceChildren(h('p', { class: 'empty' }, `No verses found for “${q}”. Try fewer or simpler words.`)); return; }
    const groups = new Map();
    for (const r of res.sort((a, b) => R().books.findIndex((x) => x.id === a.b) - R().books.findIndex((x) => x.id === b.b) || a.c - b.c || a.v - b.v)) {
      if (!groups.has(r.b)) groups.set(r.b, []);
      groups.get(r.b).push(r);
    }
    const words = (q.toLowerCase().match(/[a-z0-9’']+/g) || []).filter((w) => w.length > 1);
    out.replaceChildren(
      h('p', { class: 'muted small', style: { marginTop: '16px' } }, `${res.length}${res.length >= 500 ? '+' : ''} verses in ${groups.size} book${groups.size > 1 ? 's' : ''}`),
      ...[...groups].map(([b, rows]) => h('details', { class: 'result-group', open: groups.size <= 6 },
        h('summary', {}, h('h2', { style: { display: 'inline', fontSize: '19px' } }, R().bookName(b, false)), h('span', { class: 'muted small' }, ` · ${rows.length}`)),
        rows.slice(0, 100).map((r) => h('a', { class: 'result', href: `#/bible/${r.b}/${r.c}/${r.v}` },
          h('div', { class: 'ref' }, R().format({ b: r.b, c: r.c, v: r.v, v2: r.v })),
          markWords(bible.plain(r.t), words))))));
  }
  view.__mounted = () => { run(); if (!q) input.focus(); };
  return view;
}

function markWords(text, words) {
  const p = h('p', { class: 'scripture' });
  if (!words.length) { p.textContent = text; return p; }
  const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  for (const part of text.split(re)) p.append(re.test(part) ? h('mark', {}, part) : part), (re.lastIndex = 0);
  return p;
}
