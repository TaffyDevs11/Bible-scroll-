// Saved verses, highlights and notes, with mood/book filters and JSON backup.
import * as bible from '../bible.js';
import * as db from '../db.js';
import { settings, data } from '../state.js';
import { h, icon, topbar, scripture, toast, confirmSheet, shareImage, readLink } from '../ui.js';
import { noteSheet } from './reader.js';

const TABS = [['saved', 'Verses'], ['highlights', 'Highlights'], ['notes', 'Notes']];

export async function render({ args }) {
  let tab = TABS.some(([t]) => t === args[0]) ? args[0] : 'saved';
  let filter = { mood: null, book: null };
  const { moods } = await data('moods');
  const moodLabel = Object.fromEntries(moods.map((m) => [m.id, m.label]));
  const R = bible.R();

  const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Saved items' });
  const filters = h('div', { class: 'stack' });
  const list = h('div', { class: 'stack', id: 'saved-list', role: 'tabpanel' });

  async function draw() {
    tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.t === tab)));
    let rows = await db.all(tab);
    rows.sort((a, b) => (b.savedAt || b.at || 0) - (a.savedAt || a.at || 0));

    // filters: mood (saved verses only) and book
    const moodsUsed = [...new Set(rows.map((r) => r.mood).filter(Boolean))];
    const booksUsed = [...new Set(rows.map((r) => r.b))].sort((a, b) => R.books.findIndex((x) => x.id === a) - R.books.findIndex((x) => x.id === b));
    if (filter.mood && !moodsUsed.includes(filter.mood)) filter.mood = null;
    if (filter.book && !booksUsed.includes(filter.book)) filter.book = null;
    const moodRow = tab === 'saved' && moodsUsed.length ? h('div', { class: 'filters', role: 'group', 'aria-label': 'Filter by feeling' },
      h('button', { class: 'btn small', type: 'button', 'aria-pressed': String(!filter.mood), onclick: () => { filter.mood = null; draw(); } }, 'All feelings'),
      moodsUsed.map((m) => h('button', { class: 'btn small', type: 'button', 'aria-pressed': String(filter.mood === m), onclick: () => { filter.mood = m; draw(); } }, moodLabel[m] || m))) : null;
    const bookSel = booksUsed.length > 1 ? h('select', { class: 'input', 'aria-label': 'Filter by book', onchange: (e) => { filter.book = e.target.value || null; draw(); } },
      h('option', { value: '' }, 'All books'),
      booksUsed.map((b) => h('option', { value: b, selected: filter.book === b }, R.bookName(b, false)))) : null;
    filters.replaceChildren(...[moodRow, bookSel].filter(Boolean));

    rows = rows.filter((r) => (!filter.mood || r.mood === filter.mood) && (!filter.book || r.b === filter.book));
    if (!rows.length) {
      const msg = { saved: 'Tap Save on any verse to keep it here.', highlights: 'Tap a verse in the Bible reader to highlight it.', notes: 'Tap a verse in the Bible reader to add a note.' }[tab];
      list.replaceChildren(h('div', { class: 'empty' }, icon('save'), h('p', {}, filter.mood || filter.book ? 'Nothing matches this filter.' : msg)));
      return;
    }
    const tr = settings.tr;
    list.replaceChildren(...(await Promise.all(rows.map(async (row) => {
      const r = row.v2 ? { b: row.b, c: row.c, v: row.v, v2: row.v2 } : { b: row.b, c: row.c, v: row.v, v2: row.v };
      const text = await bible.refText(r, tr).catch(() => '');
      const remove = async () => {
        await db.del(tab, row.id);
        toast(tab === 'notes' ? 'Note deleted' : tab === 'highlights' ? 'Highlight removed' : 'Removed');
        draw();
      };
      return h('article', { class: 'card verse-card', style: tab === 'highlights' ? { borderLeft: `6px solid var(--hl-${row.color})` } : null },
        h('div', { class: 'row' },
          h('p', { class: 'ref grow' }, R.format(r)),
          row.mood ? h('span', { class: 'badge' }, moodLabel[row.mood] || row.mood) : null),
        scripture(text || '(Not available in this translation.)', 'p', 'scripture'),
        tab === 'notes' ? h('p', { style: { marginTop: '10px', whiteSpace: 'pre-wrap' } }, row.text) : null,
        h('div', { class: 'actions', style: { marginTop: '12px' } },
          h('a', { class: 'btn small', href: readLink(r) }, icon('book'), 'Open'),
          tab === 'notes' ? h('button', { class: 'btn small', type: 'button', onclick: () => noteSheet(r, null).then(() => {}) }, icon('note'), 'Edit') : null,
          text ? h('button', { class: 'btn small', type: 'button', onclick: () => shareImage(text, r, tr) }, icon('share'), 'Share') : null,
          h('button', { class: 'btn small ghost', type: 'button', 'aria-label': `Remove ${R.format(r)}`, onclick: remove }, icon('trash'), 'Remove')));
    }))));
  }

  for (const [t, label] of TABS) {
    tabs.append(h('button', { role: 'tab', type: 'button', 'data-t': t, 'aria-controls': 'saved-list', onclick: () => { tab = t; filter = { mood: null, book: null }; history.replaceState(null, '', `#/saved/${t}`); draw(); } }, label));
  }

  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only', id: 'import-file', tabindex: '-1' });
  fileInput.onchange = async () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    try {
      const json = JSON.parse(await f.text());
      const replace = await confirmSheet('Import backup', 'Add the items from this backup to what is already on this phone? Choose Cancel to stop.', 'Import');
      if (!replace) return;
      await db.importAll(json, { replace: false });
      toast('Backup imported');
      draw();
    } catch (e) {
      toast(e.message || 'Could not read that file');
    } finally { fileInput.value = ''; }
  };

  const view = h('section', {},
    topbar('Saved', { back: false }),
    tabs,
    filters,
    h('div', { style: { height: '12px' } }),
    list,
    h('div', { class: 'card stack', style: { marginTop: '24px' } },
      h('h2', {}, 'Backup'),
      h('p', { class: 'small muted' }, 'There are no accounts, so your saved verses, highlights, notes and plan progress live only on this phone. Export a file to keep them safe or move them to a new phone.'),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', type: 'button', onclick: exportBackup }, icon('download'), 'Export'),
        h('label', { class: 'btn', for: 'import-file', tabindex: '0', onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } } }, icon('upload'), 'Import'),
        fileInput)));
  view.__mounted = draw;
  return view;
}

async function exportBackup() {
  const json = JSON.stringify(await db.exportAll(), null, 1);
  const name = `bible-advisor-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([json], { type: 'application/json' });
  // A plain download is the most predictable on Android: the file lands in Downloads.
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Backup downloaded');
}
