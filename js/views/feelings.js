// "How are you feeling?" — mood chips and the full-screen swipe-up verse feed.
import * as bible from '../bible.js';
import { settings, data, markActivity } from '../state.js';
import { h, icon, iconBtn, topbar, scripture, saveButton, shareImage, readLink } from '../ui.js';
import { textSettingsSheet } from './reader.js';

export async function render({ args }) {
  const { moods, crisisText } = await data('moods');
  if (args[0]) {
    const mood = moods.find((m) => m.id === args[0]);
    if (mood) return feed(mood, crisisText);
  }
  return chips(moods);
}

function chips(moods) {
  return h('section', {},
    topbar('How are you feeling?', { back: false }),
    h('p', { class: 'muted', style: { margin: '0 4px 16px' } }, 'Choose what is closest to your heart right now. Every list begins with Jesus.'),
    h('nav', { class: 'chips', 'aria-label': 'Feelings' },
      moods.map((m) => h('a', { class: 'chip', href: `#/feelings/${m.id}` }, h('span', { class: 'dot', 'aria-hidden': 'true' }), m.label))),
    h('p', { class: 'note', style: { marginTop: '20px' } }, 'If you are in danger or thinking of harming yourself, please contact local emergency services or a crisis line now, and tell someone you trust.'));
}

async function feed(mood, crisisText) {
  const tr = settings.tr;
  const R = bible.R();
  const items = await Promise.all(mood.verses.map(async (v) => {
    const r = R.parse(v.ref);
    return { ...v, r, text: await bible.refText(r, tr) };
  }));
  const total = items.length;

  const slides = items.map((it, i) => h('section', { class: 'slide', 'aria-label': `${i + 1} of ${total}: ${R.format(it.r)}` },
    h('div', { class: 'body' },
      it.jesus ? h('span', { class: 'badge jesus', style: { alignSelf: 'flex-start' } }, icon('cross'), 'What Jesus says') : null,
      h('blockquote', { style: { margin: 0 } }, scripture(it.text, 'p', 'scripture' + (it.text.length > 300 ? ' xlong' : it.text.length > 190 ? ' long' : ''))),
      h('p', { class: 'ref' }, R.format(it.r), h('span', { class: 'muted', style: { fontWeight: 400, textTransform: 'none', letterSpacing: 0 } }, ` · ${bible.TRANSLATIONS[tr].short}`)),
      h('p', { class: 'reflection' }, it.reflection),
      h('p', { class: 'prayer' }, h('span', { class: 'sr-only' }, 'Prayer: '), it.prayer)),
    h('div', { class: 'actions', style: { marginTop: '16px' } },
      saveButton(it.r, { mood: mood.id }),
      h('button', { class: 'btn small', type: 'button', onclick: () => shareImage(it.text, it.r, tr) }, icon('share'), 'Share'),
      h('a', { class: 'btn small', href: readLink(it.r) }, icon('book'), 'Context')),
    h('p', { class: 'count center', style: { marginTop: '10px' } }, `${i + 1} of ${total}`),
    i === 0 ? h('p', { class: 'swipe-hint', 'aria-hidden': 'true' }, icon('up'), 'Swipe up for more') : null));

  if (mood.crisis) {
    slides.push(h('section', { class: 'slide crisis', 'aria-label': 'Get help now' },
      h('div', { class: 'body' },
        h('span', { class: 'badge' }, icon('heart'), 'You matter'),
        h('h2', {}, 'Please reach out'),
        h('p', { style: { fontSize: '18px', lineHeight: 1.6 } }, crisisText),
        h('p', { class: 'muted' }, 'God made you and loves you. Your life is precious to Him.'))));
  }
  slides.push(h('section', { class: 'slide', 'aria-label': 'Keep going' },
    h('div', { class: 'body center', style: { alignItems: 'center' } },
      h('h2', {}, 'Every answer leads to Jesus'),
      h('p', { class: 'muted' }, 'Keep talking with Him. He is listening.'),
      h('div', { class: 'stack', style: { width: '100%', maxWidth: '320px' } },
        h('a', { class: 'btn primary block', href: '#/jesus' }, 'Meet Jesus'),
        h('a', { class: 'btn block', href: '#/feelings' }, 'Choose another feeling'),
        h('a', { class: 'btn block', href: '#/ask' }, 'Ask a question')))));

  const scroller = h('div', { class: 'feed', tabindex: '0', 'aria-label': `${mood.label}: verses. Scroll or use arrow keys.` }, slides);
  scroller.addEventListener('keydown', (e) => {
    const dir = { ArrowDown: 1, PageDown: 1, ' ': 1, ArrowUp: -1, PageUp: -1 }[e.key];
    if (!dir || e.target !== scroller) return;
    e.preventDefault();
    scroller.scrollBy({ top: dir * scroller.clientHeight, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });

  const view = h('div', {},
    h('header', { class: 'feed-head' },
      h('a', { class: 'icon-btn', href: '#/feelings', 'aria-label': 'Back to feelings' }, icon('back')),
      h('h1', {}, mood.label),
      iconBtn('text', 'Text size and translation', () => textSettingsSheet(() => window.dispatchEvent(new HashChangeEvent('hashchange'))))),
    h('p', { class: 'sr-only' }, mood.intro),
    scroller);
  view.__full = true;
  view.__mounted = () => { scroller.focus({ preventScroll: true }); markActivity(); };
  return view;
}
