// Meet Jesus: who He is, "I am" sayings, parables, miracles, Sermon on the Mount, cross, resurrection,
// and a plain-English "How to know Jesus" page.
import * as bible from '../bible.js';
import { settings, data, markActivity } from '../state.js';
import { h, icon, topbar, scripture, saveButton, shareImage, readLink } from '../ui.js';

export async function render({ args }) {
  const j = await data('jesus');
  if (args[0] === 'know') return know(j.know);
  const section = j.sections.find((s) => s.id === args[0]);
  return section ? sectionView(section) : overview(j);
}

function overview(j) {
  return h('section', { class: 'stack' },
    topbar('Meet Jesus'),
    h('div', { class: 'card feature' },
      h('span', { class: 'eyebrow' }, 'The Word made flesh'),
      h('h2', {}, 'Who is Jesus?'),
      h('p', {}, j.intro)),
    ...j.sections.map((s) => h('a', { class: 'card link', href: `#/jesus/${s.id}` },
      h('div', { class: 'row' },
        h('div', { class: 'grow' }, h('h3', {}, s.title), h('p', { class: 'small muted', style: { marginTop: '4px' } }, s.summary)),
        icon('arrow')))),
    h('a', { class: 'card link', href: '#/jesus/know', style: { borderColor: 'var(--accent)' } },
      h('div', { class: 'row' },
        h('div', { class: 'grow' }, h('span', { class: 'eyebrow' }, 'Start here'), h('h3', { style: { marginTop: '4px' } }, j.know.title), h('p', { class: 'small muted', style: { marginTop: '4px' } }, 'A short, simple page in plain English.')),
        icon('arrow'))));
}

async function passage(ref, tr) {
  const R = bible.R();
  const r = R.parse(ref);
  const text = await bible.refText(r, tr);
  return { r, text };
}

async function sectionView(s) {
  const tr = settings.tr;
  const items = await Promise.all(s.items.map(async (it) => ({ ...it, ...(await passage(it.ref, tr)) })));
  const view = h('section', { class: 'stack' },
    topbar(s.title),
    h('p', { class: 'muted', style: { margin: '-4px 4px 0' } }, s.summary),
    ...items.map((it, i) => h('details', { class: 'card', open: i === 0 },
      h('summary', {}, h('span', {}, it.title)),
      h('p', { class: 'small muted', style: { marginBottom: '10px' } }, it.note),
      h('blockquote', { style: { margin: 0 } }, scripture(it.text, 'p', 'scripture')),
      h('p', { class: 'ref', style: { marginTop: '8px' } }, bible.R().format(it.r)),
      h('div', { class: 'actions', style: { marginTop: '12px' } },
        saveButton(it.r, { source: 'jesus' }),
        h('button', { class: 'btn small', type: 'button', onclick: () => shareImage(it.text, it.r, tr) }, icon('share'), 'Share'),
        h('a', { class: 'btn small', href: readLink(it.r) }, icon('book'), 'Context')))),
    h('a', { class: 'btn primary block', href: '#/jesus/know' }, 'How to know Jesus'));
  view.__mounted = () => markActivity();
  return view;
}

async function know(k) {
  const tr = settings.tr;
  const verses = await Promise.all(k.verses.map((v) => passage(v.ref, tr)));
  return h('section', { class: 'stack' },
    topbar(k.title),
    h('p', { class: 'scripture', style: { fontStyle: 'italic' } }, k.intro),
    h('ol', { class: 'card stack', style: { paddingLeft: '40px' } },
      k.steps.map((s) => h('li', {}, h('strong', {}, s.title), h('p', { class: 'muted', style: { marginTop: '2px' } }, s.text)))),
    h('h2', { style: { marginTop: '24px' } }, 'Key verses'),
    ...verses.map(({ r, text }) => h('article', { class: 'card verse-card' },
      h('blockquote', { style: { marginTop: 0 } }, scripture(text, 'p', 'scripture')),
      h('p', { class: 'ref' }, bible.R().format(r)))),
    h('div', { class: 'card feature' },
      h('span', { class: 'eyebrow' }, 'A simple prayer'),
      h('p', { class: 'scripture', style: { fontSize: '20px', marginTop: '10px', position: 'relative', zIndex: 1 } }, k.prayer)),
    h('p', {}, k.next),
    h('div', { class: 'actions' },
      h('a', { class: 'btn primary', href: '#/plans/john-21' }, 'Start reading John'),
      h('a', { class: 'btn', href: '#/feelings/new-to-faith' }, 'New to faith verses')));
}
