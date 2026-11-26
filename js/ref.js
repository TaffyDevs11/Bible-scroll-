// Scripture reference parsing and formatting.
// Shared by the app (browser) and tools/validate.mjs (Node), so keep it dependency-free.

const norm = (s) => s.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();

export function createRefs(books) {
  const byId = new Map(books.map((b) => [b.id, b]));
  const lookup = new Map();
  for (const b of books) {
    for (const n of [b.id, b.name, ...(b.abbr || [])]) lookup.set(norm(n), b.id);
  }
  lookup.set('psalm', 'PSA');

  /** "John 3:16-18" | "Psalm 23" | "John 1-3" | "JHN 3:16" -> {b,c,v,v2,c2} */
  function parse(str) {
    const m = String(str).trim().match(/^(.+?)\s*(\d+)(?:\s*[:.]\s*(\d+)(?:\s*[-–]\s*(\d+))?|\s*[-–]\s*(\d+))?$/);
    if (!m) return null;
    const id = lookup.get(norm(m[1]));
    if (!id) return null;
    const r = { b: id, c: +m[2] };
    if (m[3]) { r.v = +m[3]; r.v2 = m[4] ? +m[4] : r.v; }
    if (m[5]) r.c2 = +m[5];
    return r;
  }

  function bookName(id, withChapter = true) {
    const b = byId.get(id);
    if (!b) return id;
    return id === 'PSA' && withChapter ? 'Psalm' : b.name;
  }

  function format(r) {
    if (!r) return '';
    let s = `${bookName(r.b, !r.c2)} ${r.c}`;
    if (r.c2) s += `–${r.c2}`;
    else if (r.v) s += `:${r.v}` + (r.v2 && r.v2 !== r.v ? `–${r.v2}` : '');
    return s;
  }

  /** stable key for storage, e.g. "JHN.3.16" or "JHN.3.16-18" */
  function key(r) {
    return `${r.b}.${r.c}.${r.v}` + (r.v2 && r.v2 !== r.v ? `-${r.v2}` : '');
  }
  function fromKey(k) {
    const m = k.match(/^(\w{3})\.(\d+)\.(\d+)(?:-(\d+))?$/);
    return m ? { b: m[1], c: +m[2], v: +m[3], v2: m[4] ? +m[4] : +m[3] } : null;
  }

  /** verse count for a chapter in a translation ("web" may differ slightly) */
  function verseCount(id, c, tr = 'kjv') {
    const b = byId.get(id);
    if (!b) return 0;
    const arr = tr === 'web' && b.vw ? b.vw : b.v;
    return arr[c - 1] || 0;
  }

  /** true if every verse in the reference exists in the given translation */
  function exists(r, tr = 'kjv') {
    if (!r) return false;
    const b = byId.get(r.b);
    if (!b) return false;
    const last = r.c2 || r.c;
    if (r.c < 1 || last > b.v.length || last < r.c) return false;
    if (r.v == null) return true;
    const n = verseCount(r.b, r.c, tr);
    return r.v >= 1 && r.v2 >= r.v && r.v2 <= n;
  }

  return { parse, format, key, fromKey, bookName, verseCount, exists, byId, books };
}
