import { Group, PerspectiveCamera, Scene } from 'three';
import { clamp01, damp, easeInOut, warmScene } from './assets.js';
import { buildPhone, glareMesh, screenMesh, Z_SCREEN } from './phone.js';
import { SCREENS } from './screens.js';

const REST_Y = 0.3;

export function createShowcase({ el, sticky, tier, finish }) {
  const q = { finish, curve: tier >= 2 ? 10 : 6, texScale: tier >= 2 ? 2 : 1.5 };
  const scene = new Scene();
  const camera = new PerspectiveCamera(26, 1, 2, 60);
  const root = new Group();
  scene.add(root);
  const rig = new Group();
  root.add(rig);

  const phone = buildPhone(q);
  rig.add(phone.group);
  let zone = null;
  const tex = SCREENS.map(() => null);
  const paint = (i) => {
    if (!tex[i]) {
      tex[i] = SCREENS[i](q.texScale);
      zone?.slot?.renderer.initTexture(tex[i]);
    }
    return tex[i];
  };
  const front = screenMesh(phone.screenGeo, paint(0));
  const next = screenMesh(phone.screenGeo, tex[0], { transparent: true, z: Z_SCREEN + 0.003 });
  next.material.opacity = 0;
  next.visible = false;
  next.renderOrder = 2;
  phone.group.add(front, next);
  const glare = glareMesh(phone.screenGeo);
  phone.group.add(glare);

  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 120));
  const paintRest = (i = 1) => {
    if (i >= SCREENS.length) return;
    idle(() => { paint(i); paintRest(i + 1); }, { timeout: 2000 });
  };
  paintRest();

  const st = { tx: 0, ty: 0, target: 0, shown: 0, t0: -1 };
  const finishSwap = () => {
    front.material.map = tex[st.target];
    next.visible = false;
    next.material.opacity = 0;
    st.shown = st.target;
    st.t0 = -1;
  };
  addEventListener('rm-screen', (e) => {
    const i = e.detail;
    if (i === st.target || !SCREENS[i]) return;
    if (st.t0 >= 0) finishSwap();
    st.target = i;
    next.material.map = paint(i);
    next.visible = true;
    st.t0 = zone.time;
    zone.dirty = true;
    zone.engine?.wake();
  });
  sticky.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const r = sticky.getBoundingClientRect();
    st.tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
    st.ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
  }, { passive: true });
  sticky.addEventListener('pointerleave', () => { st.tx = 0; st.ty = 0; });

  zone = {
    name: 'showcase',
    el,
    priority: 1,
    time: 0,
    warmup: async (r) => {
      await warmScene(r, scene, camera);
      for (const t of tex) if (t) r.initTexture(t);
    },
    onReady() {
      el.classList.add('is-ready');
    },
    resize(w, h) {
      camera.aspect = w / h;
      const tan = Math.tan((camera.fov * Math.PI) / 360);
      const d = Math.max(7.4 / (2 * tan), 4.4 / (2 * tan * camera.aspect));
      camera.position.set(0, 0.15, d);
      camera.near = Math.max(1, d - 6);
      camera.far = d + 8;
      camera.updateProjectionMatrix();
    },
    update(t, dt, live) {
      zone.time = t;
      let turn = 0;
      if (st.t0 >= 0) {
        const p = live ? clamp01((t - st.t0) / 0.6) : 1;
        next.material.opacity = easeInOut(clamp01(p * 1.6 - 0.3));
        turn = Math.sin(p * Math.PI) * 0.45;
        if (p >= 1) finishSwap();
      }
      const lam = live ? 6 : 50;
      const sway = live ? Math.sin(t * 0.5 + 1) * 0.05 : 0;
      rig.rotation.y = damp(rig.rotation.y, REST_Y + st.tx * 0.3 + sway - turn, lam, dt);
      rig.rotation.x = damp(rig.rotation.x, 0.05 + st.ty * 0.12, lam, dt);
      rig.position.y = live ? Math.sin(t * 0.8 + 2) * 0.05 : 0;
      glare.userData.update(rig.rotation.y, st.ty);
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
