// Reading plans: list, daily check-off, progress bar and plan streak. Stored locally.
import * as bible from '../bible.js';
import * as db from '../db.js';
import { data, today, markActivity } from '../state.js';
import { h, icon, topbar, toast, confirmSheet } from '../ui.js';

export async function render({ args }) {
  const { plans } = await data('plans');
  const plan = plans.find((p) => p.id === args[0]);
  return plan ? planView(plan) : listView(plans);
}

function progressBar(pct, label) {
  return h('div', { class: 'progress', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': label }, h('span', { style: { width: `${pct}%` } }));
}

/** consecutive calendar days (ending today or yesterday) with at least one check-off */
export function planStreak(state) {
  const dates = new Set(state?.dates || []);
  let n = 0;
  const d = new Date();
  if (!dates.has(today(d))) d.setDate(d.getDate() - 1);
  while (dates.has(today(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

async function listView(plans) {
  const states = new Map((await db.all('plans')).map((s) => [s.id, s]));
  return h('section', { class: 'stack' },
    topbar('Reading plans'),
    h('p', { class: 'muted', style: { margin: '-4px 4px 0' } }, 'A little each day. Your progress is saved only on this phone.'),
    ...plans.map((p) => {
      const s = states.get(p.id);
      const done = s?.done.length || 0;
      const pct = Math.round((done / p.length) * 100);
      return h('a', { class: 'card link stack', href: `#/plans/${p.id}` },
        h('div', { class: 'row' }, h('h2', { class: 'grow' }, p.title), h('span', { class: 'badge' }, `${p.length} days`)),
        h('p', { class: 'muted' }, p.summary),
        s ? h('div', {}, progressBar(pct, `${p.title} progress`), h('p', { class: 'small muted', style: { marginTop: '6px' } }, s.finished ? 'Finished — well done!' : `${done} of ${p.length} days · ${pct}%`)) : h('span', { class: 'go row small', style: { fontWeight: 600 } }, 'Start this plan', icon('arrow')));
    }));
}

function readingLink(ref) {
  const r = bible.R().parse(ref);
  if (!r) return '#/bible';
  return `#/bible/${r.b}/${r.c}${r.v ? `/${r.v}` : ''}`;
}

async function planView(plan) {
  let state = await db.get('plans', plan.id);
  const header = h('div', { class: 'card stack' });
  const list = h('div', { class: 'plan-days', role: 'list' });

  const save = async () => { state.touched = Date.now(); await db.put('plans', state); };

  const drawHeader = () => {
    const done = state?.done.length || 0;
    const pct = Math.round((done / plan.length) * 100);
    const streak = planStreak(state);
    header.replaceChildren(
      h('p', { class: 'muted' }, plan.summary),
      state ? h('div', { class: 'stack' },
        progressBar(pct, `${plan.title} progress`),
        h('div', { class: 'row' },
          h('span', { class: 'grow small' }, `${done} of ${plan.length} days · ${pct}%`),
          h('span', { class: 'badge', 'aria-label': `Plan streak ${streak} days` }, icon('flame'), `${streak} day streak`)))
        : h('button', { class: 'btn primary', type: 'button', onclick: async () => {
          state = { id: plan.id, started: today(), done: [], dates: [], touched: Date.now(), finished: false };
          await save(); drawHeader(); drawDays(); toast('Plan started');
        } }, 'Start plan'),
      state ? h('button', { class: 'btn small ghost', type: 'button', style: { alignSelf: 'flex-start' }, onclick: async () => {
        if (!(await confirmSheet('Restart this plan?', 'Your check-offs for this plan will be cleared.', 'Restart'))) return;
        await db.del('plans', plan.id); state = null; drawHeader(); drawDays();
      } }, 'Restart plan') : null);
  };

  const drawDays = () => {
    const done = new Set(state?.done || []);
    const next = plan.days.findIndex((_, i) => !done.has(i));
    list.replaceChildren(...plan.days.map((refs, i) => {
      const id = `day-${i}`;
      const cb = h('input', { type: 'checkbox', id, checked: done.has(i), disabled: !state, 'aria-describedby': `${id}-r` });
      cb.onchange = async () => {
        if (cb.checked) {
          state.done = [...new Set([...state.done, i])];
          state.dates = [...new Set([...(state.dates || []), today()])];
          markActivity();
        } else state.done = state.done.filter((x) => x !== i);
        state.finished = state.done.length >= plan.length;
        await save();
        if (state.finished && cb.checked) toast('You finished the plan. Well done!');
        drawHeader();
        drawDays();
        list.querySelector(`#${id}`)?.focus();
      };
      return h('div', { class: 'plan-day' + (state && i === next ? ' today' : ''), role: 'listitem' },
        cb,
        h('label', { for: id }, h('strong', {}, `Day ${i + 1}`), h('span', { class: 'muted small', id: `${id}-r` }, ` · ${refs.join('; ')}`)),
        h('a', { class: 'btn small', href: readingLink(refs[0]), 'aria-label': `Read day ${i + 1}: ${refs.join('; ')}` }, 'Read'));
    }));
  };

  drawHeader();
  drawDays();
  const view = h('section', { class: 'stack' }, topbar(plan.title), header, h('div', { class: 'card' }, list));
  view.__mounted = () => {
    const t = list.querySelector('.today');
    if (t && state?.done.length) t.scrollIntoView({ block: 'center' });
  };
  view.__keepScroll = true;
  return view;
}
