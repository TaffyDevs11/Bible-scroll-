// Home: greeting, verse of the day, feelings, continue reading, streak and plan.
import * as bible from '../bible.js';
import * as db from '../db.js';
import { settings, getStreak, data, today } from '../state.js';
import { h, icon, scripture, saveButton, shareImage, readLink } from '../ui.js';

function greeting() {
  const hr = new Date().getHours();
  if (hr < 5) return 'Peace to you tonight';
  if (hr < 12) return 'Good morning';
  if (hr < 17) return 'Good afternoon';
  if (hr < 21) return 'Good evening';
  return 'Peace to you tonight';
}

export function dayOfYear(d = new Date()) {
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 864e5);
}

export async function verseOfTheDay() {
  const { verses } = await data('votd');
  const d = new Date();
  // a different verse every day, cycling through the whole list over the years
  const i = (dayOfYear(d) - 1 + d.getFullYear() * 366) % verses.length;
  return verses[i];
}

async function votdCard() {
  try {
    const ref = await verseOfTheDay();
    const r = bible.R().parse(ref);
    const tr = settings.tr;
    const text = await bible.refText(r, tr);
    return h('section', { class: 'card verse-card', 'aria-labelledby': 'votd-h' },
      h('div', { class: 'row' }, h('h2', { class: 'eyebrow grow', id: 'votd-h' }, 'Verse of the day'), h('span', { class: 'small muted' }, bible.TRANSLATIONS[tr].short)),
      h('blockquote', {}, scripture(text, 'p', 'scripture')),
      h('p', { class: 'ref' }, bible.R().format(r)),
      h('div', { class: 'actions', style: { marginTop: '14px' } },
        saveButton(r, { source: 'votd' }),
        h('button', { class: 'btn small', type: 'button', onclick: () => shareImage(text, r, tr) }, icon('share'), 'Share'),
        h('a', { class: 'btn small', href: readLink(r) }, icon('book'), 'Read in context')));
  } catch (e) {
    console.warn(e);
    return null;
  }
}

async function progressCards() {
  const [last, streak, plansState] = await Promise.all([db.get('kv', 'lastPos'), getStreak(), db.all('plans')]);
  const cards = [];
  const tiles = h('div', { class: 'grid-2' });

  tiles.append(h('div', { class: 'card tile', 'aria-label': `Reading streak: ${streak.count} day${streak.count === 1 ? '' : 's'}` },
    h('span', { class: 'eyebrow' }, 'Streak'),
    h('div', { class: 'stat' }, h('b', {}, String(streak.count)), h('span', { class: 'muted small' }, streak.count === 1 ? 'day' : 'days')),
    h('span', { class: 'small muted' }, streak.last === today() ? 'You read today' : streak.count ? 'Read today to keep it' : 'Start today')));

  const active = plansState.filter((p) => !p.finished).sort((a, b) => (b.touched || 0) - (a.touched || 0))[0];
  let planTile = h('a', { class: 'card link tile', href: '#/plans' },
    h('span', { class: 'eyebrow' }, 'Reading plan'), h('strong', {}, 'Choose a plan'), h('span', { class: 'small muted' }, '5 plans to start'));
  if (active) {
    try {
      const { plans } = await data('plans');
      const p = plans.find((x) => x.id === active.id);
      if (p) {
        const pct = Math.round((active.done.length / p.length) * 100);
        planTile = h('a', { class: 'card link tile', href: `#/plans/${p.id}` },
          h('span', { class: 'eyebrow' }, 'Reading plan'),
          h('strong', {}, p.title),
          h('div', { class: 'progress', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': `${p.title} progress` }, h('span', { style: { width: `${pct}%` } })),
          h('span', { class: 'small muted' }, `Day ${Math.min(active.done.length + 1, p.length)} of ${p.length}`));
      }
    } catch { /* plans not loaded */ }
  }
  tiles.append(planTile);

  if (last) {
    cards.push(h('a', { class: 'card link', href: `#/bible/${last.b}/${last.c}${last.v ? '/' + last.v : ''}` },
      h('div', { class: 'row' },
        h('div', { class: 'grow' }, h('span', { class: 'eyebrow' }, 'Continue reading'), h('h3', { style: { marginTop: '4px' } }, `${bible.R().bookName(last.b)} ${last.c}`)),
        icon('arrow'))));
  }
  cards.push(tiles);
  return cards;
}

export async function render() {
  const [votd, progress] = await Promise.all([votdCard(), progressCards()]);
  return h('div', { class: 'stack' },
    h('header', { class: 'hello row' },
      h('div', { class: 'grow' }, h('p', { class: 'muted' }, new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })), h('h1', {}, greeting())),
      h('a', { class: 'icon-btn', href: '#/settings', 'aria-label': 'Settings', title: 'Settings' }, icon('gear'))),
    h('a', { class: 'card feature link', href: '#/feelings' },
      h('span', { class: 'eyebrow' }, 'Bring it to God'),
      h('h2', {}, 'How are you feeling today?'),
      h('p', {}, 'Choose a feeling and find verses that speak to it, starting with the words of Jesus.'),
      h('span', { class: 'go' }, 'Begin', icon('arrow'))),
    votd,
    ...progress,
    h('div', { class: 'grid-2' },
      h('a', { class: 'card link tile', href: '#/jesus' }, h('span', { class: 'eyebrow' }, 'Meet Jesus'), h('strong', {}, 'Who is He?'), h('span', { class: 'small muted' }, 'His words, works and love')),
      h('a', { class: 'card link tile', href: '#/plans' }, h('span', { class: 'eyebrow' }, 'Plans'), h('strong', {}, 'Reading plans'), h('span', { class: 'small muted' }, 'A little each day'))),
    h('a', { class: 'card link', href: '#/ask' },
      h('div', { class: 'row' }, h('div', { class: 'grow' }, h('span', { class: 'eyebrow' }, 'Ask Bible Advisor'), h('p', { style: { marginTop: '4px' } }, 'Bring a question. Find what Scripture says.')), icon('arrow'))));
}
