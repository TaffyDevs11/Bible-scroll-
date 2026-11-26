#!/usr/bin/env node
// Converts public-domain USFM from eBible.org into compressed per-book JSON.
//
//   node tools/build-bible.mjs <kjv-usfm-dir> <web-usfm-dir>
//
// Sources (both public domain):
//   KJV: https://ebible.org/Scriptures/eng-kjv2006_usfm.zip
//   WEB: https://ebible.org/Scriptures/engwebp_usfm.zip   (66 books, "the LORD")
//
// Output: data/bible/<tr>/<BOOK>.json.gz  -> {"id","t":{chapter:title},"c":[[verse,...],...]}
//         data/books.json                 -> book list with verse counts
// Words of Jesus are wrapped in ‹ › (U+2039 / U+203A) and drawn in red by the app.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const BOOKS = [
  ['GEN', 'Genesis', ['gen', 'ge', 'gn']], ['EXO', 'Exodus', ['exo', 'ex', 'exod']], ['LEV', 'Leviticus', ['lev', 'le', 'lv']],
  ['NUM', 'Numbers', ['num', 'nu', 'nm']], ['DEU', 'Deuteronomy', ['deut', 'deu', 'dt']], ['JOS', 'Joshua', ['josh', 'jos']],
  ['JDG', 'Judges', ['judg', 'jdg', 'jg']], ['RUT', 'Ruth', ['ruth', 'rut', 'ru']], ['1SA', '1 Samuel', ['1 sam', '1sam', '1 sa', '1sa']],
  ['2SA', '2 Samuel', ['2 sam', '2sam', '2 sa', '2sa']], ['1KI', '1 Kings', ['1 kgs', '1kgs', '1 ki', '1ki']], ['2KI', '2 Kings', ['2 kgs', '2kgs', '2 ki', '2ki']],
  ['1CH', '1 Chronicles', ['1 chr', '1chr', '1 ch']], ['2CH', '2 Chronicles', ['2 chr', '2chr', '2 ch']], ['EZR', 'Ezra', ['ezr']],
  ['NEH', 'Nehemiah', ['neh', 'ne']], ['EST', 'Esther', ['esth', 'est', 'es']], ['JOB', 'Job', ['jb']],
  ['PSA', 'Psalms', ['psalm', 'ps', 'psa', 'pss']], ['PRO', 'Proverbs', ['prov', 'pro', 'pr', 'prv']], ['ECC', 'Ecclesiastes', ['eccl', 'ecc', 'ec', 'qoh']],
  ['SNG', 'Song of Solomon', ['song', 'song of songs', 'sos', 'sng', 'canticles']], ['ISA', 'Isaiah', ['isa', 'is']], ['JER', 'Jeremiah', ['jer', 'je']],
  ['LAM', 'Lamentations', ['lam', 'la']], ['EZK', 'Ezekiel', ['ezek', 'eze', 'ezk']], ['DAN', 'Daniel', ['dan', 'da', 'dn']],
  ['HOS', 'Hosea', ['hos', 'ho']], ['JOL', 'Joel', ['joel', 'jl']], ['AMO', 'Amos', ['amos', 'am']],
  ['OBA', 'Obadiah', ['obad', 'oba', 'ob']], ['JON', 'Jonah', ['jonah', 'jon']], ['MIC', 'Micah', ['mic', 'mi']],
  ['NAM', 'Nahum', ['nah', 'na']], ['HAB', 'Habakkuk', ['hab', 'hb']], ['ZEP', 'Zephaniah', ['zeph', 'zep']],
  ['HAG', 'Haggai', ['hag', 'hg']], ['ZEC', 'Zechariah', ['zech', 'zec']], ['MAL', 'Malachi', ['mal', 'ml']],
  ['MAT', 'Matthew', ['matt', 'mat', 'mt']], ['MRK', 'Mark', ['mark', 'mrk', 'mk', 'mr']], ['LUK', 'Luke', ['luke', 'luk', 'lk']],
  ['JHN', 'John', ['john', 'jhn', 'jn']], ['ACT', 'Acts', ['acts', 'act', 'ac']], ['ROM', 'Romans', ['rom', 'ro', 'rm']],
  ['1CO', '1 Corinthians', ['1 cor', '1cor', '1 co', '1co']], ['2CO', '2 Corinthians', ['2 cor', '2cor', '2 co', '2co']], ['GAL', 'Galatians', ['gal', 'ga']],
  ['EPH', 'Ephesians', ['eph', 'ephes']], ['PHP', 'Philippians', ['phil', 'php', 'pp']], ['COL', 'Colossians', ['col', 'co']],
  ['1TH', '1 Thessalonians', ['1 thess', '1thess', '1 th', '1th']], ['2TH', '2 Thessalonians', ['2 thess', '2thess', '2 th', '2th']], ['1TI', '1 Timothy', ['1 tim', '1tim', '1 ti', '1ti']],
  ['2TI', '2 Timothy', ['2 tim', '2tim', '2 ti', '2ti']], ['TIT', 'Titus', ['tit', 'ti']], ['PHM', 'Philemon', ['philem', 'phm', 'pm']],
  ['HEB', 'Hebrews', ['heb']], ['JAS', 'James', ['jas', 'jm']], ['1PE', '1 Peter', ['1 pet', '1pet', '1 pe', '1pe']],
  ['2PE', '2 Peter', ['2 pet', '2pet', '2 pe', '2pe']], ['1JN', '1 John', ['1 jn', '1jn', '1 jo', '1john']], ['2JN', '2 John', ['2 jn', '2jn', '2john']],
  ['3JN', '3 John', ['3 jn', '3jn', '3john']], ['JUD', 'Jude', ['jude', 'jud']], ['REV', 'Revelation', ['rev', 're', 'revelations', 'apocalypse']],
];

const DROP_LINE = /^\\(id|ide|h|toc\d|mt\d?|mte\d?|ms\d?|mr|s\d?|sr|r|sp|rem|ip|is\d?|imt\d?|io\d?|ili\d?|iot|cl|cp|sts|usfm)\b/;

function clean(s) {
  return s
    .replace(/\\f\s.*?\\f\*/g, '')                 // footnotes
    .replace(/\\x\s.*?\\x\*/g, '')                 // cross references
    .replace(/\\\+?w\s+([^|\\]*?)(\|[^\\]*?)?\\\+?w\*/g, '$1') // strong's words
    .replace(/\\wj\*/g, '›').replace(/\\wj\s?/g, '‹') // words of Jesus
    .replace(/\\\+?[a-z]+\d?\*?/g, ' ')            // any other marker
    .replace(/¶/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/‹\s+/g, '‹').replace(/\s+›/g, '›')
    .replace(/\s+([,.;:!?’”)])/g, '$1')
    .replace(/‹›/g, '')
    .replace(/›(\s*)‹/g, '$1')                     // join spans split by a removed note
    .trim();
}

function parseBook(file) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const chapters = []; const titles = {};
  let ch = null; let v = null; let buf = '';
  const flush = () => { if (ch && v != null) ch.v[v - 1] = clean(buf); buf = ''; };
  for (let raw of lines) {
    const line = raw.trim();
    if (!line || DROP_LINE.test(line)) continue;
    const c = line.match(/^\\c\s+(\d+)/);
    if (c) { flush(); v = null; ch = { v: [] }; chapters[+c[1] - 1] = ch; continue; }
    if (!ch) continue;
    if (/^\\d\b/.test(line)) { // psalm superscription
      if (v == null) titles[chapters.length] = clean(line.replace(/^\\d\s*/, ''));
      continue;
    }
    // split line on verse markers
    const parts = line.split(/(\\v\s+\d+[a-z]?(?:-\d+)?\s)/);
    for (const p of parts) {
      const vm = p.match(/^\\v\s+(\d+)/);
      if (vm) { flush(); v = +vm[1]; } else if (v != null) buf += ' ' + p;
    }
  }
  flush();
  // fill any gaps with empty strings so indices stay aligned
  return { t: titles, c: chapters.map(c => Array.from(c.v, x => x ?? '')) };
}

function build(tr, dir) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.usfm'));
  const out = path.join(ROOT, 'data', 'bible', tr);
  fs.mkdirSync(out, { recursive: true });
  const meta = {};
  let verses = 0, red = 0, bytes = 0;
  for (const [id] of BOOKS) {
    const f = files.find(x => new RegExp(`^\\d+-${id}`).test(x));
    if (!f) throw new Error(`${tr}: missing book ${id}`);
    const book = parseBook(path.join(dir, f));
    for (const c of book.c) for (const x of c) { verses++; if (x.includes('‹')) red++; if (!x) console.warn(`${tr} ${id}: empty verse`); }
    const json = JSON.stringify({ id, t: book.t, c: book.c });
    const gz = zlib.gzipSync(json, { level: 9 });
    fs.writeFileSync(path.join(out, `${id}.json.gz`), gz);
    bytes += gz.length;
    meta[id] = book.c.map(c => c.length);
  }
  console.log(`${tr}: ${verses} verses, ${red} with words of Jesus, ${(bytes / 1024 / 1024).toFixed(2)} MB gzipped`);
  return meta;
}

const [kjvDir, webDir] = process.argv.slice(2);
if (!kjvDir || !webDir) { console.error('usage: node tools/build-bible.mjs <kjv-usfm-dir> <web-usfm-dir>'); process.exit(1); }
const kjv = build('kjv', kjvDir);
const web = build('web', webDir);
const books = BOOKS.map(([id, name, abbr], i) => {
  if (kjv[id].length !== web[id].length) console.warn(`chapter count differs in ${id}`);
  return { id, name, abbr, t: i < 39 ? 'OT' : 'NT', v: kjv[id], vw: kjv[id].some((n, j) => n !== web[id][j]) ? web[id] : undefined };
});
fs.writeFileSync(path.join(ROOT, 'data', 'books.json'), JSON.stringify(books));
console.log('wrote data/books.json');
