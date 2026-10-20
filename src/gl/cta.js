import { Color, Group, PerspectiveCamera, Scene } from 'three';
import { clamp01, damp, easeOutBack, isDarkTheme, warmScene } from './assets.js';
import { makeBrandBubble, makePaperPlane, makeParticles, makeRing, makeTile } from './objects.js';

export function createCta({ el, stage, tier }) {
  const q = { curve: tier >= 2 ? 10 : 6 };
  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 1, 40);
  const root = new Group();
  scene.add(root);

  const SCALE = 1.5;
  const main = makeBrandBubble(q, { color: 'violet' });
  main.scale.setScalar(SCALE);
  const back = makeBrandBubble(q, { color: 'white', dots: false, mirror: true });
  back.scale.setScalar(0.8);
  back.position.set(1.3, 1.05, -1.2);
  root.add(back, main);

  const tiles = [
    { os: 'windows', p: [-2.05, 1.0, -0.3], s: 0.56 },
    { os: 'android', p: [2.05, -0.75, 0.2], s: 0.52 },
    { os: 'huawei', p: [-1.75, -1.25, 0.5], s: 0.5 },
  ].map((d, k) => {
    const g = makeTile(d.os, q);
    root.add(g);
    return { ...d, g, k };
  });

  const orbit = new Group();
  orbit.rotation.set(0.35, 0, 0.12);
  const ring = makeRing(2.5);
  const plane = makePaperPlane();
  plane.scale.setScalar(0.34);
  orbit.add(ring, plane);
  root.add(orbit);

  const dust = makeParticles(tier >= 2 ? 160 : 80, 2.2, 4.6, 0.045);
  root.add(dust);

  const theme = () => {
    const dark = isDarkTheme();
    dust.material.color = new Color(dark ? '#b9aaff' : '#6a4cf5');
    dust.material.opacity = dark ? 0.7 : 0.5;
    ring.material.color = new Color(dark ? '#8f7bff' : '#6a4cf5');
  };
  theme();

  const st = { tx: 0, ty: 0, rot: 0, vel: 0, drag: false, lastX: 0, shownAt: -1, pop: -1 };
  const card = stage.closest('.cta-card') || stage;
  card.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const r = stage.getBoundingClientRect();
    st.tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
    st.ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
  }, { passive: true });
  card.addEventListener('pointerleave', () => { st.tx = 0; st.ty = 0; });
  stage.addEventListener('pointerdown', (e) => {
    st.drag = true;
    st.lastX = e.clientX;
    st.pop = zone.time;
    stage.setPointerCapture?.(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    if (!st.drag) return;
    const dx = e.clientX - st.lastX;
    st.lastX = e.clientX;
    st.rot += dx * 0.012;
    st.vel = dx * 0.72;
  });
  const end = () => { st.drag = false; };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);

  const zone = {
    name: 'cta',
    el,
    priority: 1,
    time: 0,
    warmup: (r) => warmScene(r, scene, camera),
    onReady() {
      el.classList.add('is-ready');
      stage.classList.add('gl-on');
    },
    onTheme: theme,
    resize(w, h) {
      camera.aspect = w / h;
      const tan = Math.tan((camera.fov * Math.PI) / 360);
      const d = Math.max(5.2 / (2 * tan), 5.6 / (2 * tan * camera.aspect));
      camera.position.set(0, 0, d);
      camera.updateProjectionMatrix();
    },
    update(t, dt, live) {
      zone.time = t;
      if (st.shownAt < 0) st.shownAt = t;
      if (!live) t = 3;
      const pop = live ? easeOutBack(clamp01((t - st.shownAt) / 0.9)) : 1;
      if (!st.drag) {
        st.rot += st.vel * dt;
        st.vel *= Math.exp(-3 * dt);
        if (Math.abs(st.vel) < 0.5) st.rot = damp(st.rot, Math.round(st.rot / (Math.PI * 2)) * Math.PI * 2, 2, dt);
      }
      let bump = 0;
      if (st.pop >= 0) {
        const p = clamp01((zone.time - st.pop) / 0.5);
        bump = Math.sin(p * Math.PI) * 0.12;
        if (p >= 1) st.pop = -1;
      }
      const lam = live ? 6 : 50;
      main.rotation.y = damp(main.rotation.y, st.tx * 0.5 + (live ? Math.sin(t * 0.6) * 0.25 : -0.2) + st.rot, lam, dt);
      main.rotation.x = damp(main.rotation.x, st.ty * 0.3 + (live ? Math.sin(t * 0.5) * 0.08 : 0.05), lam, dt);
      main.position.y = live ? Math.sin(t * 0.9) * 0.08 : 0;
      main.scale.setScalar(SCALE * pop * (1 + bump));
      main.userData.update(live ? t : 0.6);
      back.rotation.y = 0.5 + (live ? Math.sin(t * 0.5 + 1) * 0.3 : 0) + st.tx * 0.3;
      back.position.y = 0.95 + (live ? Math.sin(t * 0.8 + 2) * 0.08 : 0);
      back.scale.setScalar(0.8 * pop);

      tiles.forEach((tl) => {
        const tp = live ? easeOutBack(clamp01((t - st.shownAt - 0.3 - tl.k * 0.12) / 0.7)) : 1;
        const [x, y, z] = tl.p;
        tl.g.position.set(x + st.tx * 0.15 * (z + 1.2), y + (live ? Math.sin(t * 1.2 + tl.k * 1.7) * 0.1 : 0), z);
        tl.g.rotation.set(live ? Math.sin(t * 0.8 + tl.k) * 0.14 : 0.1, (live ? Math.sin(t + tl.k * 1.4) * 0.45 : -0.3) - x * 0.1, 0);
        tl.g.scale.setScalar(tl.s * tp);
      });

      const a = live ? -t * 0.55 : 2.2;
      plane.position.set(Math.cos(a) * 2.5, 0, Math.sin(a) * 2.5);
      plane.rotation.set(0, -a + Math.PI, -0.45);
      orbit.rotation.y = st.tx * 0.12;
      dust.rotation.y = t * 0.04;
      root.rotation.x = st.ty * 0.06;
    },
    render(renderer) {
      renderer.setScissorTest(false);
      renderer.autoClear = true;
      renderer.setViewport(0, 0, zone.cssW, zone.cssH);
      renderer.render(scene, camera);
    },
  };
  return zone;
}
