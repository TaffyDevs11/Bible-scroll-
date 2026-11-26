// Ask Bible Advisor — answer providers.
//
// ┌──────────────────────────────────────────────────────────────────────────────┐
// │ askProvider interface (plug-in point for an optional AI provider later)       │
// │                                                                              │
// │   {                                                                          │
// │     id: string,             // e.g. 'offline'                                │
// │     name: string,           // shown in the UI                               │
// │     async ask(question, { tr }) -> AskResult                                 │
// │   }                                                                          │
// │                                                                              │
// │   AskResult = {                                                              │
// │     kind: 'topics' | 'search' | 'none',                                      │
// │     topics?:  [{ topic, score }],     // matched entries from topics.json     │
// │     verses?:  [{ ref: 'John 3:16', reflection?: string }],                   │
// │     crisis?:  boolean,               // show the crisis message first        │
// │   }                                                                          │
// │                                                                              │
// │ RULE: providers return references only, never verse text. The app always    │
// │ looks the text up in the bundled public-domain Bible, so a quote can never   │
// │ be invented or misquoted. Drop any reference that R().exists() rejects.      │
// │                                                                              │
// │ To plug in another provider:  import { setAskProvider } from './ask-provider.js'
// │                               setAskProvider(myProvider)                     │
// │ Bible Advisor ships with the offline engine only: no network, no API keys.   │
// └──────────────────────────────────────────────────────────────────────────────┘

import * as bible from './bible.js';
import { data } from './state.js';

const norm = (s) => ` ${s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim()} `;
export const stem = (w) => w
  .replace(/ies$/, 'y')
  .replace(/(ing|ed|es|s)$/, (m, _s, i) => (w.length - m.length >= 3 ? '' : m));

export function matchTopics(question, topics) {
  const q = norm(question);
  const stems = new Set(q.trim().split(' ').filter(Boolean).map(stem));
  const out = [];
  for (const topic of topics) {
    let score = 0;
    for (const kw of topic.keywords) {
      const k = norm(kw);
      if (k.trim().includes(' ')) { if (q.includes(k)) score += 3 + k.trim().split(' ').length; }
      else if (stems.has(stem(k.trim()))) score += 2;
    }
    if (score) out.push({ topic, score: score + (topic.priority || 0) + (topic.crisis ? 100 : 0) });
  }
  return out.sort((a, b) => b.score - a.score);
}

export const offlineProvider = {
  id: 'offline',
  name: 'Offline topic guide',
  async ask(question, { tr }) {
    const { topics } = await data('topics');
    const matched = matchTopics(question, topics);
    if (matched.length) return { kind: 'topics', topics: matched.slice(0, 3), crisis: matched.some((m) => m.topic.crisis) };
    const hits = await bible.search(tr, question, { mode: 'rank', limit: 20 });
    if (!hits.length) return { kind: 'none' };
    return { kind: 'search', verses: hits.map((x) => ({ ref: bible.R().format({ b: x.b, c: x.c, v: x.v, v2: x.v }) })) };
  },
};

let provider = offlineProvider;
export const getAskProvider = () => provider;
export function setAskProvider(p) {
  if (!p || typeof p.ask !== 'function') throw new Error('askProvider needs an ask(question, ctx) method');
  provider = p;
}
