// Loads the bundled public-domain Bible text (KJV / WEB), one gzipped JSON file per book.
import { createRefs } from './ref.js';

export const TRANSLATIONS = {
  kjv: { id: 'kjv', short: 'KJV', name: 'King James Version' },
  web: { id: 'web', short: 'Easy English', name: 'World English Bible' },
};

let refs = null;
const cache = new Map(); // "kjv/JHN" -> Promise<book>

export async function init() {
  if (refs) return refs;
  const books = await (await fetch('data/books.json')).json();
  refs = createRefs(books);
  return refs;
}
export const R = () => refs;

async function gunzipJson(res) {
  const buf = new Uint8Array(await res.arrayBuffer());
  // Some hosts send .gz with Content-Encoding: gzip, so the browser has already unpacked it.
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
    return JSON.parse(await new Response(stream).text());
  }
  return JSON.parse(new TextDecoder().decode(buf));
}

export function getBook(tr, id) {
  const k = `${tr}/${id}`;
  if (!cache.has(k)) {
    const p = fetch(`data/bible/${tr}/${id}.json.gz`).then((res) => {
      if (!res.ok) throw new Error(`Could not load ${id}`);
      return gunzipJson(res);
    });
    p.catch(() => cache.delete(k));
    cache.set(k, p);
  }
  return cache.get(k);
}

export async function getChapter(tr, id, c) {
  const book = await getBook(tr, id);
  return { verses: book.c[c - 1] || [], title: book.t?.[c] || '' };
}

/** verses for a parsed reference -> [{v, text}] */
export async function getVerses(r, tr) {
  const book = await getBook(tr, r.b);
  const ch = book.c[r.c - 1] || [];
  const from = r.v || 1, to = r.v ? r.v2 : ch.length;
  const out = [];
  for (let v = from; v <= to; v++) if (ch[v - 1]) out.push({ v, text: ch[v - 1] });
  return out;
}

/** joined text for a reference string or object, with ‹ › Jesus markers kept */
export async function refText(ref, tr) {
  const r = typeof ref === 'string' ? refs.parse(ref) : ref;
  if (!r) return '';
  const vs = await getVerses(r, tr);
  return vs.map((x) => x.text).join(' ');
}

export const plain = (t) => t.replace(/[‹›]/g, '');
export const hasJesusWords = (t) => t.includes('‹');

/** Loads every book of a translation (for full-text search). */
export async function loadAll(tr, onProgress) {
  let done = 0;
  const books = refs.books;
  await Promise.all(books.map((b) => getBook(tr, b.id).then(() => onProgress?.(++done, books.length))));
}

const index = new Map(); // tr -> [{b,c,v,t,lc}]
async function getIndex(tr, onProgress) {
  if (index.has(tr)) return index.get(tr);
  await loadAll(tr, onProgress);
  const rows = [];
  for (const b of refs.books) {
    const book = await getBook(tr, b.id);
    book.c.forEach((ch, ci) => ch.forEach((t, vi) => { if (t) rows.push({ b: b.id, c: ci + 1, v: vi + 1, t, lc: plain(t).toLowerCase() }); }));
  }
  index.set(tr, rows);
  return rows;
}

export const STOP = new Set('a an and are as at be been but by can could did do does doing for from had has have he her him his how i if im in into is it its just me my myself no not of on or our ours she so some than that the their them then there these they this those to too us was we were what when where which who whom why will with would you your yours am dont cant wont ive id ill youre want need feel feeling really very about get got make go going know like one'.split(' '));

const BOOK_WEIGHT = (id) => {
  if (['MAT', 'MRK', 'LUK', 'JHN'].includes(id)) return 1.25;
  const i = refs.books.findIndex((b) => b.id === id);
  if (['PSA', 'PRO', 'ISA'].includes(id)) return 1.1;
  return i >= 39 ? 1.12 : 1;
};

export function terms(q) {
  return [...new Set(q.toLowerCase().replace(/[’']/g, '').match(/[a-z]+/g) || [])].filter((w) => w.length > 1 && !STOP.has(w));
}

/**
 * Full-text search.
 * mode "phrase": every word must appear (reader search).
 * mode "rank": best matches by how many words appear (Ask fallback).
 */
export async function search(tr, query, { mode = 'phrase', limit = 300, onProgress } = {}) {
  const rows = await getIndex(tr, onProgress);
  const q = query.toLowerCase().trim();
  if (!q) return [];
  if (mode === 'phrase') {
    const words = q.replace(/[’']/g, '').match(/[a-z0-9]+/g) || [];
    if (!words.length) return [];
    const res = [];
    const exact = q.length > 2 ? q : null;
    for (const r of rows) {
      const lc = r.lc.replace(/[’']/g, '');
      if (words.every((w) => lc.includes(w))) {
        res.push({ ...r, score: (exact && r.lc.includes(exact) ? 2 : 1) });
        if (res.length >= limit * 3) break;
      }
    }
    return res.sort((a, b) => b.score - a.score).slice(0, limit);
  }
  const ts = terms(q);
  if (!ts.length) return [];
  const res = [];
  for (const r of rows) {
    let hit = 0;
    for (const t of ts) {
      const re = new RegExp(`\\b${t.replace(/(ies|es|s|ing|ed)$/, '')}`, 'i');
      if (re.test(r.lc)) hit++;
    }
    if (hit) res.push({ ...r, score: (hit / ts.length) * BOOK_WEIGHT(r.b) - r.lc.length / 4000 });
  }
  return res.sort((a, b) => b.score - a.score).slice(0, limit);
}
