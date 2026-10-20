import { Group, PerspectiveCamera, Scene } from 'three';
import { clamp01, damp, easeOutBack, easeOutCubic, warmScene } from './assets.js';
import { FEATURES, makeTile } from './objects.js';

const PLATFORMS = new Set(['windows', 'android', 'huawei', 'ios']);
const BLEED = 2.1; // вьюпорт слота больше самой иконки — чтобы вращение не обрезалось

// Положение элемента относительно контейнера по layout-координатам (без учёта transform).
function offsetWithin(node, container) {
  let x = 0;
  let y = 0;
  let n = node;
  while (n && n !== container) {
    x += n.offsetLeft;
    y += n.offsetTop;
    n = n.offsetParent;
  }
  return [x, y];
}

// Одна WebGL-канва поверх всей зоны карточек; каждая иконка рисуется в своём вьюпорте.
// Канва лежит в потоке документа, поэтому при скролле 3D двигается вместе с карточками без рассинхрона.
export function createCards({ el, zoneEl, tier }) {
  const q = { curve: tier >= 2 ? 8 : 5 };
  const camera = new PerspectiveCamera(28, 1, 1, 20);
  camera.position.set(0, 0, 1 / Math.tan((14 * Math.PI) / 180));
  camera.lookAt(0, 0, 0);

  const slots = [...zoneEl.querySelectorAll('[data-slot]')].map((node, i) => {
    const type = node.dataset.slot;
    const scene = new Scene();
    const pivot = new Group();
    const obj = PLATFORMS.has(type) ? makeTile(type, q) : FEATURES[type](q);
    if (!PLATFORMS.has(type)) obj.scale.setScalar(0.74);
    pivot.add(obj);
    scene.add(pivot);
    const card = node.closest('.card');
    const s = {
      node, card, type, scene, pivot, obj, k: i * 0.9,
      x: 0, y: 0, size: 0,
      hover: false, hx: 0, hy: 0, rx: 0, ry: 0, lift: 0,
      shownAt: -1, spinAt: -1,
      d: parseFloat(card?.style.getPropertyValue('--d')) || 0,
    };
    if (card) {
      card.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'touch') return;
        const r = node.getBoundingClientRect();
        const cr = card.getBoundingClientRect();
        s.hover = true;
        s.hx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (cr.width * 0.5)));
        s.hy = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (cr.height * 0.6)));
        zone.engine?.wake();
      }, { passive: true });
      card.addEventListener('pointerleave', () => { s.hover = false; });
      card.addEventListener('click', (e) => {
        if (e.target.closest('a,button')) return;
        s.spinAt = zone.time;
        zone.dirty = true;
        zone.engine?.wake();
      });
      if (card.classList.contains('in')) s.shownAt = 0;
    }
    return s;
  });

  zoneEl.addEventListener('rm-reveal', (e) => {
    const s = slots.find((x) => x.card === e.target);
    if (s && s.shownAt < 0) {
      s.shownAt = zone.time + s.d * 0.09 + 0.1;
      zone.dirty = true;
      zone.engine?.wake();
    }
  });

  const layout = () => {
    zone.docTop = el.getBoundingClientRect().top + scrollY;
    for (const s of slots) {
      const [x, y] = offsetWithin(s.node, zoneEl);
      const size = s.node.offsetWidth;
      const view = Math.round(size * BLEED);
      s.size = view;
      s.x = Math.round(x + size / 2 - view / 2);
      s.y = Math.round(y + size / 2 - view / 2);
    }
  };
  document.fonts?.ready.then(() => { zone.needsSize = true; zone.dirty = true; zone.engine?.wake(); });

  const zone = {
    name: 'cards',
    el,
    priority: 2,
    time: 0,
    docTop: 0,
    dprBoost: 1.5, // вьюпорты маленькие — можно рисовать чётче без потери скорости
    warmup: (r) => Promise.all(slots.map((s) => warmScene(r, s.scene, camera))),
    onReady() {
      el.classList.add('is-ready');
      zoneEl.classList.add('gl-on');
    },
    resize() {
      layout();
    },
    update(t, dt, live) {
      zone.time = t;
      for (const s of slots) {
        if (!live) s.shownAt = 0;
        else if (s.shownAt === 0) s.shownAt = t;
        const age = live ? t - s.shownAt : 10;
        if (s.shownAt < 0 || age < 0) { s.pivot.visible = false; continue; }
        s.pivot.visible = true;
        const pop = easeOutBack(clamp01(age / 0.8));
        let spin = 0;
        if (s.spinAt >= 0) {
          const p = clamp01((t - s.spinAt) / 0.95);
          spin = easeOutCubic(p) * Math.PI * 2;
          if (p >= 1) s.spinAt = -1;
        }
        const idleY = live ? Math.sin(t * 1.05 + s.k) * 0.42 : -0.35;
        const idleX = live ? Math.sin(t * 0.8 + s.k) * 0.12 : 0.12;
        const ty = s.hover ? s.hx * 0.75 : idleY;
        const tx = s.hover ? s.hy * 0.5 : idleX;
        const lam = live ? 7 : 50;
        s.ry = damp(s.ry, ty, lam, dt);
        s.rx = damp(s.rx, tx, lam, dt);
        s.lift = damp(s.lift, s.hover ? 1 : 0, live ? 8 : 50, dt);
        s.pivot.rotation.set(s.rx, s.ry + spin + (1 - easeOutCubic(clamp01(age / 0.9))) * 1.6, 0);
        s.pivot.scale.setScalar(pop * (1 + s.lift * 0.08));
        s.pivot.position.y = live ? Math.sin(t * 1.3 + s.k) * 0.04 : 0;
        s.obj.userData.update?.(live ? t : 1.2);
      }
    },
    render(renderer) {
      const H = zone.cssH;
      // Полную очистку не делаем: без preserveDrawingBuffer браузер сам отдаёт чистый буфер на каждый кадр.
      renderer.autoClear = false;
      renderer.setScissorTest(true);
      const top = zone.docTop - scrollY;
      const vh = innerHeight;
      for (const s of slots) {
        if (!s.pivot.visible || !s.size) continue;
        const sy = top + s.y;
        if (sy > vh * 1.4 || sy + s.size < -vh * 0.4) continue;
        const y = H - (s.y + s.size);
        renderer.setViewport(s.x, y, s.size, s.size);
        renderer.setScissor(s.x, y, s.size, s.size);
        renderer.clearDepth();
        renderer.render(s.scene, camera);
      }
      renderer.setScissorTest(false);
    },
  };
  return zone;
}
