import { createCards } from './cards.js';
import { createCta } from './cta.js';
import { detectTier, Engine } from './engine.js';
import { createHero } from './hero.js';
import { BASE_MATCAPS, FINISHES, finishMatcaps, isDarkTheme, preloadMatcaps } from './assets.js';
import { applyTheme } from './objects.js';

function fontsReady() {
  if (!document.fonts) return Promise.resolve();
  const load = Promise.all([
    document.fonts.load('400 14px "Onest Variable"', 'Привет'),
    document.fonts.load('600 14px "Onest Variable"', 'Алексей'),
  ]);
  return Promise.race([load, new Promise((r) => setTimeout(r, 1500))]);
}

function savedFinish() {
  try {
    const id = localStorage.getItem('rm-finish');
    if (FINISHES.some((f) => f.id === id)) return id;
  } catch {}
  return FINISHES[0].id;
}

function setupPicker(hero, initial) {
  const picker = document.getElementById('finish-picker');
  if (!picker) return;
  const name = document.getElementById('finish-name');
  const buttons = [...picker.querySelectorAll('[data-finish]')];
  const mark = (id) => {
    for (const b of buttons) b.setAttribute('aria-checked', b.dataset.finish === id ? 'true' : 'false');
    name.textContent = FINISHES.find((f) => f.id === id)?.label || '';
  };
  mark(initial);
  picker.addEventListener('click', (e) => {
    const b = e.target.closest('[data-finish]');
    if (!b) return;
    const id = b.dataset.finish;
    mark(id);
    try { localStorage.setItem('rm-finish', id); } catch {}
    hero.setFinish(id);
  });
}

export async function boot() {
  const heroEl = document.getElementById('gl-hero');
  const cardsEl = document.getElementById('gl-cards');
  const ctaEl = document.getElementById('gl-cta');
  if (!heroEl) return;

  const engine = new Engine({ tier: detectTier(), max: 3 });
  engine.createSlot();
  const tier = engine.gov.tier;
  const finish = savedFinish();
  const size = engine.gov.software ? 128 : tier >= 2 ? 256 : 192;
  await Promise.all([fontsReady(), preloadMatcaps([...BASE_MATCAPS, ...finishMatcaps(finish)], size)]);

  const hero = createHero({ el: heroEl, stage: document.getElementById('stage'), tier, finish });
  const heroReady = hero.onReady;
  hero.onReady = () => {
    heroReady();
    setTimeout(() => {
      engine.prewarm();
      preloadMatcaps(FINISHES.flatMap((f) => finishMatcaps(f.id)));
    }, 400);
  };
  engine.add(hero);
  setupPicker(hero, finish);
  if (cardsEl) engine.add(createCards({ el: cardsEl, zoneEl: document.getElementById('zone-cards'), tier }));
  if (ctaEl) engine.add(createCta({ el: ctaEl, stage: ctaEl.closest('.cta-stage'), tier }));
  applyTheme(isDarkTheme());
  document.documentElement.dataset.gl = 'on';
}
