#!/usr/bin/env node
// Checks every scripture reference in /data against the bundled KJV and WEB text,
// plus the content rules from the brief. Exits with code 1 on any problem.
//   node tools/validate.mjs [--print]   (--print shows each curated verse's KJV text for review)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { createRefs } from '../js/ref.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const exists = (f) => fs.existsSync(path.join(ROOT, f));

export async function validate({ print = false } = {}) {
  const errors = [];
  const warn = [];
  const books = readJson('data/books.json');
  const R = createRefs(books);
  const bookCache = {};
  const text = (tr, r) => {
    const k = `${tr}/${r.b}`;
    bookCache[k] ??= JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(ROOT, `data/bible/${k}.json.gz`))));
    const ch = bookCache[k].c[r.c - 1] || [];
    if (r.v == null) return ch.join(' ');
    return ch.slice(r.v - 1, r.v2).join(' ');
  };
  let checked = 0;

  /** checks one reference string in both translations; returns KJV text */
  function check(ref, where, { allowChapters = false } = {}) {
    checked++;
    const r = R.parse(ref);
    if (!r) { errors.push(`${where}: cannot parse reference "${ref}"`); return ''; }
    if (r.v == null && !allowChapters) { errors.push(`${where}: "${ref}" needs a verse number`); return ''; }
    for (const tr of ['kjv', 'web']) {
      if (!R.exists(r, tr)) { errors.push(`${where}: "${ref}" does not exist in ${tr.toUpperCase()}`); return ''; }
      if (r.v != null && !text(tr, r).trim()) { errors.push(`${where}: "${ref}" is empty in ${tr.toUpperCase()}`); return ''; }
    }
    return r.v != null ? text('kjv', r) : '';
  }
  const need = (cond, msg) => { if (!cond) errors.push(msg); };
  const words = (s) => (s || '').trim().split(/\s+/).filter(Boolean).length;
  const sentences = (s) => (s || '').split(/(?<=[.!?])\s+(?=[A-Z“"])/).filter((x) => x.trim()).length;

  // ---------- moods ----------
  if (exists('data/moods.json')) {
    const { moods } = readJson('data/moods.json');
    const REQUIRED = ['anxious', 'afraid', 'sad', 'lonely', 'grieving', 'angry', 'tired', 'tempted', 'guilty', 'confused', 'doubting', 'sick', 'money', 'hurt', 'grateful', 'joyful', 'hopeful', 'guidance', 'new-to-faith'];
    const ids = new Set(moods.map((m) => m.id));
    for (const id of REQUIRED) need(ids.has(id), `moods.json: missing mood "${id}"`);
    for (const m of moods) {
      const where = `moods.json › ${m.id}`;
      need(m.label && m.intro, `${where}: needs label and intro`);
      need(m.verses?.length >= 12, `${where}: has ${m.verses?.length || 0} verses, needs at least 12`);
      need(m.verses?.[0]?.jesus === true, `${where}: card 1 must be "What Jesus says" (jesus: true)`);
      const seen = new Set();
      m.verses?.forEach((v, i) => {
        const w = `${where} #${i + 1} (${v.ref})`;
        if (seen.has(v.ref)) errors.push(`${w}: duplicate reference`);
        seen.add(v.ref);
        const kjv = check(v.ref, w);
        need(v.reflection && sentences(v.reflection) <= 3, `${w}: reflection must be 1–3 sentences`);
        need(v.prayer && words(v.prayer) <= 40, `${w}: needs a one-line prayer`);
        if (v.jesusSpeaks && kjv && !kjv.includes('‹')) warn.push(`${w}: marked jesusSpeaks but has no red-letter text`);
        if (i === 0 && kjv && !kjv.includes('‹') && !v.aboutJesus) warn.push(`${w}: first card is not red-letter; mark aboutJesus: true if it is about Him`);
        if (print) console.log(`[${m.id}] ${v.ref}: ${kjv.replace(/[‹›]/g, '').slice(0, 150)}\n    → ${v.reflection}`);
      });
    }
  } else errors.push('data/moods.json is missing');

  // ---------- topics ----------
  if (exists('data/topics.json')) {
    const { topics } = readJson('data/topics.json');
    need(topics.length >= 60, `topics.json: has ${topics.length} topics, needs at least 60`);
    const ids = new Set();
    for (const t of topics) {
      const where = `topics.json › ${t.id}`;
      need(!ids.has(t.id), `${where}: duplicate id`); ids.add(t.id);
      need(t.keywords?.length >= 3, `${where}: needs at least 3 keywords`);
      need(t.verses?.length >= 4, `${where}: needs at least 4 verses`);
      t.verses?.forEach((v, i) => {
        const w = `${where} #${i + 1} (${v.ref})`;
        const kjv = check(v.ref, w);
        need(v.reflection, `${w}: needs a reflection`);
        if (print) console.log(`[${t.id}] ${v.ref}: ${kjv.replace(/[‹›]/g, '').slice(0, 150)}\n    → ${v.reflection}`);
      });
    }
  } else errors.push('data/topics.json is missing');

  // ---------- verse of the day ----------
  if (exists('data/votd.json')) {
    const { verses } = readJson('data/votd.json');
    need(verses.length >= 365, `votd.json: has ${verses.length} verses, needs at least 365`);
    const seen = new Set();
    verses.forEach((ref, i) => {
      if (seen.has(ref)) errors.push(`votd.json #${i + 1}: duplicate "${ref}"`);
      seen.add(ref);
      const kjv = check(ref, `votd.json #${i + 1}`);
      if (print) console.log(`[votd] ${ref}: ${kjv.replace(/[‹›]/g, '').slice(0, 120)}`);
    });
    const gospels = verses.filter((r) => /^(Matthew|Mark|Luke|John) /.test(r)).length;
    console.log(`votd.json: ${verses.length} verses, ${gospels} from the Gospels (${Math.round((gospels / verses.length) * 100)}%)`);
  } else errors.push('data/votd.json is missing');

  // ---------- plans ----------
  if (exists('data/plans.json')) {
    const { plans } = readJson('data/plans.json');
    for (const p of plans) {
      need(p.days.length === p.length, `plans.json › ${p.id}: has ${p.days.length} days, expected ${p.length}`);
      p.days.forEach((d, i) => d.forEach((ref) => check(ref, `plans.json › ${p.id} day ${i + 1}`, { allowChapters: true })));
    }
  } else errors.push('data/plans.json is missing');

  // ---------- Meet Jesus ----------
  if (exists('data/jesus.json')) {
    const j = readJson('data/jesus.json');
    for (const s of j.sections) for (const it of s.items) check(it.ref, `jesus.json › ${s.id}`);
    for (const it of j.know.verses) check(it.ref, 'jesus.json › know');
  } else errors.push('data/jesus.json is missing');

  for (const w of warn) console.warn('warning: ' + w);
  if (errors.length) {
    console.error(`\n${errors.length} problem(s):`);
    for (const e of errors) console.error('  ✗ ' + e);
    return false;
  }
  console.log(`validate: ${checked} references checked against KJV and WEB — all good.`);
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ok = await validate({ print: process.argv.includes('--print') });
  process.exit(ok ? 0 : 1);
}
