import { createCards } from './cards.js';
import { createCta } from './cta.js';
import { detectTier, Engine } from './engine.js';
import { createHero } from './hero.js';
import { isDarkTheme } from './assets.js';
import { applyTheme } from './objects.js';

function fontsReady() {
  if (!document.fonts) return Promise.resolve();
  const load = Promise.all([
    document.fonts.load('400 14px "Onest Variable"', 'Привет'),
    document.fonts.load('600 14px "Onest Variable"', 'Алексей'),
  ]);
  return Promise.race([load, new Promise((r) => setTimeout(r, 1500))]);
}

export async function boot() {
  const heroEl = document.getElementById('gl-hero');
  const cardsEl = document.getElementById('gl-cards');
  const ctaEl = document.getElementById('gl-cta');
  if (!heroEl) return;
  await fontsReady();

  const engine = new Engine({ tier: detectTier(), max: 3 });
  engine.createSlot();
  const tier = engine.gov.tier;
  const hero = createHero({ el: heroEl, stage: document.getElementById('stage'), tier });
  const heroReady = hero.onReady;
  hero.onReady = () => {
    heroReady();
    setTimeout(() => engine.prewarm(), 400);
  };
  engine.add(hero);
  if (cardsEl) engine.add(createCards({ el: cardsEl, zoneEl: document.getElementById('zone-cards'), tier }));
  if (ctaEl) engine.add(createCta({ el: ctaEl, stage: ctaEl.closest('.cta-stage'), tier }));
  applyTheme(isDarkTheme());
  document.documentElement.dataset.gl = 'on';
}
