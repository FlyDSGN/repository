import { Group, Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, Raycaster, Scene, Vector2 } from 'three';
import { clamp01, damp, easeInOut, easeOutCubic, warmScene } from './assets.js';
import { buildPhone, px, py, screenMesh, studioEnv, Z_SCREEN } from './phone.js';
import { layoutMessages, paintBubble, paintChat } from './screens.js';

const LOOP = 12;
const REST_Y = -0.34;
const T = Math.PI * 2;

export function createHero({ el, stage, tier, finish, rich }) {
  const q = { finish, rich, envSize: rich ? 256 : 128, curve: tier >= 2 ? 10 : 6, texScale: tier >= 2 ? 2.5 : 2 };
  const scene = new Scene();
  const camera = new PerspectiveCamera(26, 1, 2, 60);
  const root = new Group();
  scene.add(root);
  const rig = new Group();
  root.add(rig);

  const phone = buildPhone(q);
  rig.add(phone.group);
  phone.group.add(screenMesh(phone.screenGeo, paintChat(q.texScale)));

  const plane = new PlaneGeometry(1, 1);
  const bubbles = layoutMessages().map((b) => {
    const mesh = new Mesh(plane, new MeshBasicMaterial({ map: paintBubble(b.msg, b.size, q.texScale + 0.5), transparent: true, depthWrite: false, opacity: 0, toneMapped: false }));
    const sx = b.size.w / 100;
    const sy = b.size.h / 100;
    mesh.position.set(px(b.x + b.size.w / 2), py(b.y + b.size.h / 2), Z_SCREEN + 0.004);
    mesh.scale.set(sx, sy, 1);
    mesh.renderOrder = 3;
    mesh.visible = false;
    phone.group.add(mesh);
    return { mesh, sx, sy, base: mesh.position.y };
  });


  const st = {
    tx: 0, ty: 0, drag: false, dragX: 0, downX: 0, downY: 0, downT: 0,
    rotY: 0, vel: 0, flip: -1, auto: -1, autoAt: 0, touchAt: -1e9, flipNow: 0, intro: -1,
  };
  const hero = stage.closest('section') || stage;
  hero.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const r = stage.getBoundingClientRect();
    st.tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
    st.ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { st.tx = 0; st.ty = 0; });

  const wake = () => { zone.dirty = true; zone.engine?.wake(); };
  const ray = new Raycaster();
  const ndc = new Vector2();
  el.addEventListener('pointerdown', (e) => {
    st.drag = true;
    st.dragX = st.downX = e.clientX;
    st.downY = e.clientY;
    st.downT = performance.now();
    st.touchAt = st.downT / 1000;
    st.vel = 0;
    if (st.auto >= 0 || st.flip >= 0) {
      st.rotY += st.flipNow;
      st.flipNow = 0;
      st.auto = -1;
      st.flip = -1;
    }
    el.setPointerCapture?.(e.pointerId);
  });
  el.addEventListener('pointermove', (e) => {
    if (!st.drag) return;
    const dx = e.clientX - st.dragX;
    st.dragX = e.clientX;
    st.rotY += dx * 0.012;
    st.vel = dx * 50;
    wake();
  });
  el.addEventListener('pointerup', (e) => {
    if (!st.drag) return;
    st.drag = false;
    if (Math.hypot(e.clientX - st.downX, e.clientY - st.downY) > 8 || performance.now() - st.downT > 400) return;
    const r = el.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (ray.intersectObject(phone.body, false).length) { st.flip = zone.time; wake(); }
  });
  el.addEventListener('pointercancel', () => { st.drag = false; });

  let heroH = 800;
  const zone = {
    name: 'hero',
    el,
    priority: 2,
    time: 0,
    warmup: (r) => { scene.environment = studioEnv(r, q.envSize); return warmScene(r, scene, camera); },
    onReady() {
      el.classList.add('is-ready');
      stage.classList.add('gl-on');
    },
    showBack() {
      if (st.flip < 0 && st.auto < 0 && !st.drag) {
        st.auto = zone.time - 0.2;
        st.autoAt = zone.time + 20;
      }
      wake();
    },
    resize(w, h) {
      camera.aspect = w / h;
      const tan = Math.tan((camera.fov * Math.PI) / 360);
      const d = Math.max(7.6 / (2 * tan), 4.6 / (2 * tan * camera.aspect));
      camera.position.set(0, 0.15, d);
      camera.near = Math.max(1, d - 6);
      camera.far = d + 8;
      camera.updateProjectionMatrix();
      heroH = hero.offsetHeight || 800;
    },
    update(t, dt, live) {
      zone.time = t;
      if (!live) t = 4.2;
      if (st.intro < 0) st.intro = t;
      const ie = live ? easeOutCubic(clamp01((t - st.intro) / 1.3)) : 1;
      const scroll = live ? clamp01(scrollY / heroH) : 0;
      root.position.y = -0.8 * (1 - ie) + scroll * 0.9;

      if (!st.drag) {
        st.rotY += st.vel * dt * 0.012;
        st.vel *= Math.exp(-3.2 * dt);
        if (Math.abs(st.vel) < 2) st.rotY = damp(st.rotY, Math.round(st.rotY / T) * T, 2.2, dt);
      }
      if (live && st.flip < 0 && st.auto < 0 && !st.drag && t - st.intro > 8 && t - st.touchAt > 6 && t >= st.autoAt) {
        st.auto = t;
        st.autoAt = t + 20;
      }
      let flip = 0;
      if (st.flip >= 0) {
        const p = clamp01((zone.time - st.flip) / 1.1);
        flip = easeOutCubic(p) * T;
        if (p >= 1) { st.flip = -1; st.rotY += T; flip = 0; }
      } else if (st.auto >= 0) {
        const k = t - st.auto;
        if (k < 1.4) flip = easeInOut(k / 1.4) * Math.PI;
        else if (k < 3.6) flip = Math.PI;
        else if (k < 5) flip = Math.PI + easeInOut((k - 3.6) / 1.4) * Math.PI;
        else { st.auto = -1; st.rotY += T; flip = 0; }
      }
      st.flipNow = flip;
      const sway = live ? Math.sin(t * 0.55) * 0.05 : 0;
      const lam = live ? 7 : 50;
      rig.rotation.y = damp(rig.rotation.y, REST_Y + st.tx * 0.32 + sway + st.rotY + flip - (1 - ie) * 0.5, lam, dt);
      rig.rotation.x = damp(rig.rotation.x, 0.05 + st.ty * 0.14 + scroll * 0.2, lam, dt);
      rig.position.y = live ? Math.sin(t * 0.8) * 0.05 : 0;

      const ct = live ? (t - st.intro) % LOOP : 8;
      const out = live ? clamp01((ct - (LOOP - 1)) / 0.45) : 0;
      bubbles.forEach((b, i) => {
        const p = clamp01((ct - (0.8 + i * 1.1)) / 0.35);
        const e = easeOutCubic(p);
        const m = b.mesh;
        m.visible = p > 0 && out < 1;
        m.material.opacity = e * (1 - out);
        const s = 0.94 + 0.06 * e;
        m.scale.set(b.sx * s, b.sy * s, 1);
        m.position.y = b.base - (1 - e) * 0.08;
      });
    },
    render(renderer) {
      renderer.setScissorTest(false);
      renderer.autoClear = true;
      renderer.setViewport(0, 0, zone.cssW, zone.cssH);
      scene.environment = studioEnv(renderer, q.envSize);
      renderer.render(scene, camera);
    },
  };
  return zone;
}
