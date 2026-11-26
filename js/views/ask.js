// Ask Bible Advisor — offline topic matching with full-text fallback.
import * as bible from '../bible.js';
import { settings, data, markActivity } from '../state.js';
import { getAskProvider } from '../ask-provider.js';
import { h, icon, topbar, scripture, saveButton, shareImage, readLink } from '../ui.js';

const EXAMPLES = ['I can’t forgive my brother', 'I’m scared about the future', 'How can I be saved?', 'I feel worthless', 'Money is tight this month', 'How should I pray?'];
const DISCLAIMER = 'Bible Advisor shares Scripture, not personal advice. For big decisions, talk with your pastor or a trusted believer.';

export async function render({ args }) {
  const q = args.join('/');
  const input = h('input', { class: 'input', type: 'search', id: 'ask-q', value: q, placeholder: 'Ask anything, e.g. ‘I can’t forgive my brother’', enterkeyhint: 'search', autocomplete: 'off', maxlength: 200 });
  const out = h('div', { class: 'stack', style: { marginTop: '16px' }, 'aria-live': 'polite' });
  const submit = (text) => { const v = (text ?? input.value).trim(); if (v) location.hash = `#/ask/${encodeURIComponent(v)}`; };

  const view = h('section', {},
    topbar('Ask Bible Advisor', { back: false }),
    h('form', { class: 'search', role: 'search', onsubmit: (e) => { e.preventDefault(); submit(); } },
      h('label', { for: 'ask-q', class: 'sr-only' }, 'Your question'),
      input,
      h('button', { class: 'btn primary', type: 'submit', 'aria-label': 'Ask' }, icon('search'))),
    h('p', { class: 'note', style: { marginTop: '12px' } }, DISCLAIMER),
    out);

  view.__mounted = async () => {
    if (!q) {
      out.replaceChildren(
        h('p', { class: 'muted' }, 'Tell God what is on your heart. Bible Advisor will find what Scripture says about it, right here on your phone.'),
        h('div', { class: 'actions' }, EXAMPLES.map((e) => h('button', { class: 'btn small', type: 'button', onclick: () => submit(e) }, e))));
      input.focus();
      return;
    }
    out.replaceChildren(h('p', { class: 'muted' }, 'Searching the Scriptures…'));
    try {
      out.replaceChildren(...(await answer(q)));
      markActivity();
    } catch (e) {
      console.error(e);
      out.replaceChildren(h('p', { class: 'empty' }, 'Something went wrong while searching. Please try again.'));
    }
  };
  return view;
}

async function answer(q) {
  const tr = settings.tr;
  const res = await getAskProvider().ask(q, { tr });
  const R = bible.R();
  const parts = [];

  if (res.crisis) {
    const { crisisText } = await data('moods');
    parts.push(h('div', { class: 'card', role: 'alert', style: { borderColor: 'var(--jesus)' } },
      h('h2', { style: { marginBottom: '8px' } }, 'You matter to God'),
      h('p', { style: { fontSize: '18px' } }, crisisText)));
  }

  if (res.kind === 'topics') {
    const [best, ...rest] = res.topics;
    parts.push(h('div', {}, h('p', { class: 'eyebrow' }, 'What Scripture says about'), h('h2', { style: { marginTop: '4px' } }, best.topic.title), h('p', { class: 'muted', style: { marginTop: '4px' } }, best.topic.summary)));
    parts.push(...(await verseCards(best.topic.verses, tr)));
    if (rest.length) {
      parts.push(h('div', {}, h('p', { class: 'small muted', style: { marginBottom: '8px' } }, 'Related topics'),
        h('div', { class: 'actions' }, rest.map((r) => h('a', { class: 'btn small', href: `#/ask/${encodeURIComponent(r.topic.title)}` }, r.topic.title)))));
    }
  } else if (res.kind === 'search') {
    parts.push(h('div', {}, h('p', { class: 'eyebrow' }, 'Verses that match your words'), h('p', { class: 'muted small', style: { marginTop: '4px' } }, 'No topic matched exactly, so here are the 20 closest verses from the whole Bible.')));
    parts.push(...(await verseCards(res.verses, tr)));
  } else {
    parts.push(h('div', { class: 'empty' }, h('p', {}, 'Nothing matched those words. Try a simpler question, or choose a feeling.'), h('a', { class: 'btn', href: '#/feelings' }, 'How are you feeling?')));
  }
  parts.push(h('a', { class: 'card link', href: '#/jesus' }, h('div', { class: 'row' }, h('div', { class: 'grow' }, h('span', { class: 'eyebrow' }, 'Every answer leads to Jesus'), h('p', { style: { marginTop: '4px' } }, 'Meet the One who is the Word.')), icon('arrow'))));
  return parts;
}

async function verseCards(list, tr) {
  const R = bible.R();
  const cards = await Promise.all(list.map(async (v) => {
    const r = R.parse(v.ref);
    if (!r || !R.exists(r, tr)) return null;
    const text = await bible.refText(r, tr);
    if (!text) return null;
    return h('article', { class: 'card verse-card' },
      h('blockquote', { style: { marginTop: 0 } }, scripture(text, 'p', 'scripture')),
      h('p', { class: 'ref' }, R.format(r)),
      v.reflection ? h('p', { style: { marginTop: '10px' } }, v.reflection) : null,
      h('div', { class: 'actions', style: { marginTop: '12px' } },
        saveButton(r, { source: 'ask' }),
        h('button', { class: 'btn small', type: 'button', onclick: () => shareImage(text, r, tr) }, icon('share'), 'Share'),
        h('a', { class: 'btn small', href: readLink(r) }, icon('book'), 'Context')));
  }));
  return cards.filter(Boolean);
}
