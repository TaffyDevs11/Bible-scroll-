// Bible Advisor — app entry: router, splash, service worker.
import * as bible from './bible.js';
import { loadSettings } from './state.js';
import { h } from './ui.js';

const main = document.getElementById('main');

// route -> [module, tab]
const ROUTES = {
  home: ['./views/home.js', 'home'],
  feelings: ['./views/feelings.js', 'feelings'],
  ask: ['./views/ask.js', 'ask'],
  bible: ['./views/reader.js', 'bible'],
  saved: ['./views/saved.js', 'saved'],
  jesus: ['./views/jesus.js', 'home'],
  plans: ['./views/plans.js', 'home'],
  settings: ['./views/settings.js', 'home'],
  about: ['./views/settings.js', 'home'],
};

let current = null;
let navId = 0;

async function route() {
  const id = ++navId;
  const parts = (location.hash.replace(/^#\/?/, '') || 'home').split('/').map(decodeURIComponent);
  const name = ROUTES[parts[0]] ? parts[0] : 'home';
  const [path, tab] = ROUTES[name];

  document.querySelectorAll('.tabbar a').forEach((a) => {
    if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });

  try {
    const mod = await import(path);
    const view = await mod.render({ name, args: parts.slice(1) });
    if (id !== navId) { view?.__cleanup?.(); return; } // a newer navigation won
    current?.__cleanup?.();
    current = view;
    main.classList.toggle('full', !!view.__full);
    view.classList.add('view');
    main.replaceChildren(view);
    if (!view.__keepScroll) window.scrollTo(0, 0);
    const heading = view.querySelector('h1');
    document.title = heading && name !== 'home' ? `${heading.textContent} · Bible Advisor` : 'Bible Advisor';
    view.__mounted?.();
  } catch (err) {
    console.error(err);
    if (id !== navId) return;
    main.replaceChildren(h('div', { class: 'empty' },
      h('h2', {}, 'Something went wrong'),
      h('p', {}, 'Please check your connection the first time you open this page, then try again.'),
      h('p', {}, h('a', { class: 'btn', href: '#/home' }, 'Go home'))));
  }
}

function hideSplash() {
  const s = document.getElementById('splash');
  if (!s) return;
  s.classList.add('hide');
  setTimeout(() => s.remove(), 600);
}

async function start() {
  const t0 = performance.now();
  await Promise.all([loadSettings(), bible.init()]);
  window.addEventListener('hashchange', route);
  await route();
  // keep the splash briefly so it reads as a calm welcome, not a flicker
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  setTimeout(hideSplash, Math.max(0, (reduce ? 300 : 900) - (performance.now() - t0)));
  registerSW();
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const ask = () => navigator.serviceWorker.controller?.postMessage({ type: 'cache-bible' }) ?? reg.active?.postMessage({ type: 'cache-bible' });
    // after the shell is ready, save the whole Bible for offline use in the background
    if (document.readyState === 'complete') setTimeout(ask, 1500); else addEventListener('load', () => setTimeout(ask, 1500));
    navigator.serviceWorker.ready.then((r) => r.active?.postMessage({ type: 'cache-bible' }));
  }).catch((e) => console.warn('SW registration failed', e));
}

start();
