// Quick end-to-end smoke test: node tools/smoke.cjs [baseUrl] [outDir]
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://localhost:8080/';
const out = process.argv[3] || '.';
const steps = (process.env.STEPS || 'home,bible,chapter,sheet,settings,dark,offline').split(',');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
  const go = async (hash) => { await page.goto(base + hash); await page.waitForTimeout(1400); };
  for (const s of steps) {
    if (s === 'home') { await go('#/home'); await shot('home'); }
    if (s === 'bible') { await go('#/bible'); await shot('bible'); }
    if (s === 'chapter') { await go('#/bible/JHN/14/6'); await shot('chapter'); }
    if (s === 'sheet') { await page.click('#v27'); await page.waitForTimeout(400); await shot('sheet'); await page.click('[aria-label="Highlight Gold"]'); await page.keyboard.press('Escape'); }
    if (s === 'search') { await go('#/bible/search/living%20water'); await page.waitForTimeout(2500); await shot('search'); }
    if (s === 'settings') { await go('#/settings'); await shot('settings'); }
    if (s === 'dark') { await page.emulateMedia({ colorScheme: 'dark' }); await go('#/bible/MAT/5/3'); await shot('dark'); await page.emulateMedia({ colorScheme: 'light' }); }
    if (s === 'offline') {
      await page.waitForTimeout(6000);
      const n = await page.evaluate(async () => { let n = 0; for (const k of await caches.keys()) n += (await (await caches.open(k)).keys()).length; return n; });
      console.log('cached entries:', n);
      await ctx.setOffline(true);
      await go('#/bible/PSA/23'); await shot('offline');
      console.log('offline psalm 23 text:', (await page.textContent('.chapter-text')).slice(0, 80));
      await ctx.setOffline(false);
    }
    if (s.startsWith('#')) { await go(s); await shot(s.replace(/[^a-z0-9]+/gi, '_')); }
  }
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})();
