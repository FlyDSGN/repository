import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const OUT = args.out || 'test-results';
mkdirSync(OUT, { recursive: true });
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

let server;
let base = args.url;
if (!base) {
  base = 'http://127.0.0.1:4173';
  server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(base)).ok) break; } catch { }
    await new Promise((r) => setTimeout(r, 200));
  }
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

const report = { errors: [], shots: [], perf: [] };
const fail = (msg) => { report.errors.push(msg); console.log('FAIL', msg); };

async function newPage(opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' || m.text().includes('[3d] disabled')) fail(`console[${opts.name}]: ${m.text()}`);
  });
  page.on('pageerror', (e) => fail(`pageerror[${opts.name}]: ${e.message}`));
  return { ctx, page };
}

async function wait3D(page, zone = 'hero', timeout = 20000) {
  await page.waitForFunction((z) => window.__rm3d?.zones.some((x) => x.name === z && x.ready), zone, { timeout });
}

async function scrollTo(page, sel, offset = 80) {
  await page.evaluate(([s, o]) => {
    const el = document.querySelector(s);
    window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - o, behavior: 'instant' });
  }, [sel, offset]);
  await page.waitForTimeout(1400);
}

async function focusFeature(page, i) {
  await page.evaluate((k) => {
    const el = document.querySelector(`.feat[data-screen="${k}"]`);
    const band = matchMedia('(max-width:959px)').matches ? 0.73 : 0.5;
    const r = el.getBoundingClientRect();
    window.scrollTo({ top: r.top + scrollY + r.height / 2 - innerHeight * band, behavior: 'instant' });
  }, i);
  await page.waitForTimeout(1600);
}

const VIEWS = [
  { name: 'android-dark-360', viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: ANDROID_UA, colorScheme: 'dark' },
  { name: 'android-light-360', viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: ANDROID_UA, colorScheme: 'light' },
  { name: 'small-dark-320', viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: ANDROID_UA, colorScheme: 'dark' },
  { name: 'small-light-320', viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: ANDROID_UA, colorScheme: 'light' },
  { name: 'desktop-dark-1440', viewport: { width: 1440, height: 900 }, colorScheme: 'dark' },
  { name: 'desktop-light-1440', viewport: { width: 1440, height: 900 }, colorScheme: 'light' },
];

if (!args.only || args.only === 'shots') {
  for (const v of VIEWS) {
    const { ctx, page } = await newPage(v);
    await page.goto(base, { waitUntil: 'load' });
    try { await wait3D(page); } catch { fail(`${v.name}: 3D hero не запустился`); }
    await page.waitForTimeout(2600);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (overflow > 0) fail(`${v.name}: горизонтальный скролл ${overflow}px`);
    const shot = async (tag) => {
      const p = `${OUT}/${v.name}-${tag}.png`;
      await page.screenshot({ path: p });
      report.shots.push(p);
    };
    await shot('1-hero');
    await scrollTo(page, '#download');
    await shot('2-download');
    await scrollTo(page, '#features');
    try { await wait3D(page, 'showcase', 8000); } catch { fail(`${v.name}: 3D в «Возможностях» не запустился`); }
    await page.waitForTimeout(900);
    await shot('3-features');
    await focusFeature(page, 2);
    const active = await page.evaluate(() => document.querySelector('.feat.is-active')?.dataset.screen);
    if (active !== '2') fail(`${v.name}: активный пункт возможностей ${active}, ожидался 2`);
    await shot('4-feature-call');
    await scrollTo(page, '#faq');
    await shot('5-faq');
    report[v.name] = await page.evaluate(() => ({ ...window.__rm3d, zones: window.__rm3d?.zones }));
    await ctx.close();
  }
}

async function perfRun(name, opts, rate) {
  const { query, ...ctxOpts } = opts;
  const { ctx, page } = await newPage({ name, ...ctxOpts });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  await page.goto(base + (query || ''), { waitUntil: 'load' });
  await page.evaluate(() => {
    window.__frames = [];
    window.__long = [];
    let last = performance.now();
    const loop = (t) => { window.__frames.push(t - last); last = t; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(e.duration))).observe({ type: 'longtask', buffered: false });
  });
  if (!query) {
    try { await wait3D(page, 'hero', 40000); } catch { fail(`${name}: 3D не запустился под замедлением`); }
  }
  await page.waitForTimeout(4000);
  const measure = async (label, ms, action) => {
    await page.evaluate(() => { window.__frames.length = 0; window.__long.length = 0; });
    const t0 = Date.now();
    if (action) await action();
    const rest = ms - (Date.now() - t0);
    if (rest > 0) await page.waitForTimeout(rest);
    const r = await page.evaluate(() => {
      const f = window.__frames.slice(1);
      const sum = f.reduce((a, b) => a + b, 0);
      const sorted = [...f].sort((a, b) => a - b);
      return {
        fps: +(1000 * f.length / sum).toFixed(1),
        p95: +(sorted[Math.floor(sorted.length * 0.95)] || 0).toFixed(1),
        jank: f.filter((x) => x > 50).length,
        long: window.__long.length,
        longMax: Math.round(Math.max(0, ...window.__long)),
        gl: { dpr: window.__rm3d?.dpr, level: window.__rm3d?.level, div: window.__rm3d?.div, ema: window.__rm3d?.ema, cpu: window.__rm3d?.cpu, fps3d: window.__rm3d?.fps, tier: window.__rm3d?.tier, frozen: window.__rm3d?.frozen },
      };
    });
    const row = { run: name, cpu: `x${rate}`, phase: label, ...r };
    report.perf.push(row);
    console.log(JSON.stringify(row));
  };
  await measure('hero-idle', 5000);
  await measure('scroll-down', 7000, async () => {
    await page.mouse.move(180, 400);
    for (let i = 0; i < 28; i++) { await page.mouse.wheel(0, 160); await page.waitForTimeout(120); }
  });
  await measure('features-idle', 4000, async () => { await focusFeature(page, 1); });
  await measure('faq-idle', 4000, async () => { await scrollTo(page, '#faq'); });
  await measure('scroll-up', 6000, async () => {
    for (let i = 0; i < 30; i++) { await page.mouse.wheel(0, -220); await page.waitForTimeout(100); }
  });
  await ctx.close();
}

if (!args.only || args.only === 'perf') {
  const mobile = { viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: ANDROID_UA, colorScheme: 'dark' };
  await perfRun('mobile-baseline', mobile, 1);
  await perfRun('mobile-cpu8x', mobile, 8);
  await perfRun('desktop-cpu8x', { viewport: { width: 1366, height: 768 }, colorScheme: 'dark' }, 8);
  if (args.compare) {
    await perfRun('mobile-cpu8x-no3d', { ...mobile, query: '?no3d' }, 8);
    await perfRun('desktop-cpu8x-no3d', { viewport: { width: 1366, height: 768 }, colorScheme: 'dark', query: '?no3d' }, 8);
  }
}

if (!args.only || args.only === 'robust') {
  const mobile = { viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: ANDROID_UA, colorScheme: 'dark' };
  {
    const { ctx, page } = await newPage({ name: 'reduced-motion', ...mobile, reducedMotion: 'reduce' });
    await page.goto(base, { waitUntil: 'load' });
    try { await wait3D(page); } catch { fail('reduced-motion: 3D не отрисовался'); }
    await page.waitForTimeout(1500);
    const fps = await page.evaluate(() => window.__rm3d.fps);
    if (fps > 5) fail(`reduced-motion: 3D анимируется (${fps} fps), ожидались статичные кадры`);
    await page.screenshot({ path: `${OUT}/reduced-motion.png` });
    await ctx.close();
  }
  {
    const { ctx, page } = await newPage({ name: 'interact', viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });
    await page.goto(base, { waitUntil: 'load' });
    await wait3D(page);
    await page.waitForTimeout(2200);
    const box = await page.locator('#gl-hero').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.move(box.x + box.width / 2, box.y + 300);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 160, box.y + 300, { steps: 8 });
    await page.mouse.up();
    await page.click('#theme-btn');
    await page.waitForTimeout(600);
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    if (theme !== 'light') fail(`interact: тема не переключилась (${theme})`);
    await page.screenshot({ path: `${OUT}/interact-light.png` });
    await page.click('[data-finish="burgundy"]');
    await page.waitForTimeout(2500);
    const picked = await page.evaluate(() => [document.querySelector('[data-finish="burgundy"]').getAttribute('aria-checked'), document.getElementById('finish-name').textContent]);
    if (picked[0] !== 'true' || picked[1] !== 'Burgundy') fail(`interact: цвет не переключился (${picked})`);
    await page.screenshot({ path: `${OUT}/interact-burgundy.png` });
    await ctx.close();
  }
  {
    const nogl = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium', args: ['--disable-webgl', '--disable-webgl2'] });
    const ctx = await nogl.newContext({ ...mobile, name: undefined });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => fail(`no-webgl: ${e.message}`));
    await page.goto(base, { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    const fallback = await page.evaluate(() => getComputedStyle(document.querySelector('.phone-fallback')).opacity);
    if (fallback !== '1') fail(`no-webgl: запасной телефон скрыт (opacity ${fallback})`);
    await page.evaluate(() => document.querySelector('#stage').scrollIntoView());
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/no-webgl.png` });
    await nogl.close();
  }
}

writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
await browser.close();
server?.kill();
console.log(report.errors.length ? `ERRORS: ${report.errors.length}` : 'OK: без ошибок');
process.exit(report.errors.length ? 1 : 0);
