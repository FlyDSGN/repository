import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  ShapeGeometry,
  Vector2,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  canvas2d,
  clamp01,
  damp,
  drawIcon,
  easeOutBack,
  easeOutCubic,
  extrude,
  isDarkTheme,
  matcapMaterial,
  roundRectPath,
  roundedRect,
  toTexture,
  warmScene,
} from './assets.js';
import { makeBrandBubble, makePaperPlane, makeParticles, makeRing, makeTile } from './objects.js';

const FONT = '"Onest Variable", system-ui, sans-serif';
const SW = 272; // экран телефона в CSS-пикселях; 1 единица сцены = 100 px
const SH = 580;
const Z_SCREEN = 0.168;

// ---------- текстуры экрана ----------
function paintScreen(scale) {
  const [c, ctx] = canvas2d(SW * scale, SH * scale);
  ctx.scale(scale, scale);
  const bg = ctx.createLinearGradient(0, 0, 0, SH);
  bg.addColorStop(0, '#14163a');
  bg.addColorStop(0.7, '#0a0b15');
  bg.addColorStop(1, '#0a0b15');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SW, SH);

  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  ctx.fillRect(0, 0, SW, 94);
  ctx.fillStyle = 'rgba(255,255,255,0.09)';
  ctx.fillRect(0, 94, SW, 1);

  ctx.fillStyle = '#f3f5fb';
  ctx.font = `600 12px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('9:41', 26, 22);
  for (let i = 0; i < 4; i++) ctx.fillRect(SW - 74 + i * 4.5, 26 - (i + 1) * 2.4, 3, (i + 1) * 2.4);
  roundRectPath(ctx, SW - 48, 16, 22, 11, 3);
  ctx.strokeStyle = 'rgba(243,245,251,0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();
  roundRectPath(ctx, SW - 46, 18, 15, 7, 1.5);
  ctx.fill();

  const av = ctx.createLinearGradient(14, 46, 50, 82);
  av.addColorStop(0, '#46c8d9');
  av.addColorStop(1, '#7a5cff');
  ctx.fillStyle = av;
  ctx.beginPath();
  ctx.arc(32, 64, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `600 14px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('А', 32, 65);
  ctx.textAlign = 'left';
  ctx.fillText('Алексей', 60, 57);
  ctx.fillStyle = '#4ade80';
  ctx.beginPath();
  ctx.arc(63, 75, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7b84a0';
  ctx.font = `400 11px ${FONT}`;
  ctx.fillText('в сети', 71, 75);
  drawIcon(ctx, 'phone', 208, 55, 18, '#a1a9c2');
  drawIcon(ctx, 'video', 240, 55, 18, '#a1a9c2');

  ctx.font = `400 11px ${FONT}`;
  const dw = ctx.measureText('Сегодня').width + 20;
  roundRectPath(ctx, (SW - dw) / 2, 110, dw, 21, 10.5);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();
  ctx.fillStyle = '#7b84a0';
  ctx.textAlign = 'center';
  ctx.fillText('Сегодня', SW / 2, 121);
  ctx.textAlign = 'left';

  roundRectPath(ctx, 12, 520, SW - 24, 46, 23);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.09)';
  ctx.stroke();
  drawIcon(ctx, 'clip', 26, 534, 18, '#7b84a0');
  ctx.fillStyle = '#7b84a0';
  ctx.font = `400 13px ${FONT}`;
  ctx.fillText('Сообщение', 54, 544);
  ctx.fillStyle = '#6a4cf5';
  ctx.beginPath();
  ctx.arc(SW - 35, 543, 17, 0, Math.PI * 2);
  ctx.fill();
  drawIcon(ctx, 'mic', SW - 43, 535, 16, '#ffffff', 2);
  return toTexture(c);
}

function wrap(ctx, text, max) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > max && line) { lines.push(line); line = w; } else line = test;
  }
  lines.push(line);
  return lines;
}

const WAVE = [6, 12, 18, 9, 14, 20, 11, 16, 7, 13, 19, 10, 6, 15];

function paintBubble({ text, me, voice }, scale) {
  const [m] = canvas2d(4, 4);
  const mctx = m.getContext('2d');
  mctx.font = `400 13.5px ${FONT}`;
  let w;
  let h;
  let lines = [];
  if (voice) { w = 166; h = 46; } else {
    lines = wrap(mctx, text, 170);
    w = Math.ceil(Math.max(...lines.map((l) => mctx.measureText(l).width)) + 26);
    h = Math.ceil(lines.length * 18.2 + 18);
  }
  const [c, ctx] = canvas2d(Math.ceil(w * scale), Math.ceil(h * scale));
  ctx.scale(scale, scale);
  roundRectPath(ctx, 0, 0, w, h, me ? [18, 18, 6, 18] : [18, 18, 18, 6]);
  if (me) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#7a5cff');
    g.addColorStop(1, '#5169ff');
    ctx.fillStyle = g;
  } else ctx.fillStyle = '#1d2033';
  ctx.fill();
  ctx.fillStyle = '#f3f5fb';
  ctx.textBaseline = 'middle';
  if (voice) {
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(23, 23, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a45f5';
    ctx.beginPath();
    ctx.moveTo(19.5, 17);
    ctx.lineTo(29, 23);
    ctx.lineTo(19.5, 29);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `400 11px ${FONT}`;
    ctx.fillText('0:12', w - 40, 24);
  } else {
    ctx.font = `400 13.5px ${FONT}`;
    lines.forEach((l, i) => ctx.fillText(l, 13, 9 + 9.1 + i * 18.2));
  }
  return { tex: toTexture(c), w, h };
}

const MESSAGES = [
  { text: 'Привет, как дела?', me: false },
  { text: 'Отлично! Ты как?', me: true },
  { text: 'Всё супер! Скоро увидимся', me: false },
  { voice: true, me: true },
  { text: 'Голосовое огонь! Вечером созвонимся?', me: false },
  { text: 'Да, наберу по видео', me: true },
];
const LOOP = 11.5;

const px = (sx) => sx / 100 - SW / 200;
const py = (sy) => SH / 200 - sy / 100;

function buildPhone(q) {
  const phone = new Group();
  const graphite = matcapMaterial('graphite');
  const body = new Mesh(extrude(roundedRect(2.88, 5.96, 0.46), { depth: 0.2, bevel: 0.06, segments: 3, curve: q.curve + 4 }), graphite);
  phone.add(body);

  const btns = [
    new BoxGeometry(0.05, 0.62, 0.12).translate(1.5, 1.25, 0),
    new BoxGeometry(0.05, 0.42, 0.12).translate(-1.5, 1.7, 0),
    new BoxGeometry(0.05, 0.42, 0.12).translate(-1.5, 1.15, 0),
  ];
  phone.add(new Mesh(mergeGeometries(btns), graphite));

  const glass = new Mesh(new ShapeGeometry(roundedRect(2.86, 5.94, 0.45), q.curve), new MeshBasicMaterial({ color: 0x030308 }));
  glass.position.z = 0.162;
  phone.add(glass);

  const screenGeo = new ShapeGeometry(roundedRect(SW / 100, SH / 100, 0.38), q.curve + 2);
  const uv = screenGeo.attributes.uv;
  const pos = screenGeo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / (SW / 100) + 0.5, pos.getY(i) / (SH / 100) + 0.5);
  const screen = new Mesh(screenGeo, new MeshBasicMaterial({ map: paintScreen(q.texScale) }));
  screen.position.z = Z_SCREEN;
  phone.add(screen);

  const island = new Mesh(new ShapeGeometry(roundedRect(0.84, 0.24, 0.12), 6), new MeshBasicMaterial({ color: 0x000000 }));
  island.position.set(0, py(22), Z_SCREEN + 0.004);
  phone.add(island);

  // пузырьки — отдельные плоскости, «парят» над стеклом
  const bubbles = [];
  let y = 143;
  const bubbleGeo = new PlaneGeometry(1, 1);
  for (const msg of MESSAGES) {
    const { tex, w, h } = paintBubble(msg, q.texScale + 0.5);
    const m = new Mesh(bubbleGeo, new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
    m.scale.set(w / 100, h / 100, 1);
    const cx = msg.me ? SW - 14 - w / 2 : 14 + w / 2;
    const base = { x: px(cx), y: py(y + h / 2), z: Z_SCREEN + 0.05 };
    m.position.set(base.x, base.y, base.z);
    m.renderOrder = 3;
    m.visible = false;
    phone.add(m);
    bubbles.push({ mesh: m, base, w, h, me: msg.me, voice: !!msg.voice, sx: w / 100, sy: h / 100 });
    y += h + 8;
  }

  // эквалайзер голосового: 14 столбиков одним draw call
  const voice = bubbles.find((b) => b.voice);
  const bars = new InstancedMesh(new BoxGeometry(0.03, 1, 0.02), new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }), WAVE.length);
  bars.renderOrder = 4;
  bars.visible = false;
  phone.add(bars);

  return { phone, body, bubbles, voice, bars };
}

export function createHero({ el, stage, tier }) {
  const q = {
    curve: tier >= 2 ? 10 : 6,
    texScale: tier >= 3 ? 2.5 : 2,
    particles: tier >= 3 ? 420 : tier === 2 ? 260 : 130,
  };
  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1, 2, 60);
  const root = new Group();
  scene.add(root);

  const rig = new Group();
  root.add(rig);
  const { phone, body, bubbles, voice, bars } = buildPhone(q);
  rig.add(phone);

  const tiles = [
    { os: 'windows', p: [-2.2, 1.85, 0.7], s: 0.8, k: 0 },
    { os: 'android', p: [2.2, 0.8, -0.4], s: 0.74, k: 1 },
    { os: 'huawei', p: [-2.05, -1.25, -0.3], s: 0.72, k: 2 },
    { os: 'ios', p: [2.05, -2.0, 0.8], s: 0.76, k: 3 },
  ].map((d) => {
    const g = makeTile(d.os, q);
    g.scale.setScalar(0);
    root.add(g);
    return { ...d, g, spin: -1, hit: g.userData.hit };
  });

  const bubbleA = makeBrandBubble(q, { color: 'violet' });
  bubbleA.position.set(1.75, 2.75, -1.3);
  bubbleA.scale.setScalar(0.62);
  const bubbleB = makeBrandBubble(q, { color: 'white', dots: false, mirror: true });
  bubbleB.position.set(-1.6, -2.9, 0.9);
  bubbleB.scale.setScalar(0.42);
  root.add(bubbleA, bubbleB);

  const orbit = new Group();
  orbit.rotation.set(0.42, 0, -0.18);
  const ring = makeRing(3.25);
  orbit.add(ring);
  const plane = makePaperPlane();
  plane.scale.setScalar(0.32);
  orbit.add(plane);
  root.add(orbit);

  const dust = makeParticles(q.particles, 3.0, 7.0, 0.055);
  root.add(dust);

  const theme = () => {
    const dark = isDarkTheme();
    dust.material.color = new Color(dark ? '#b9aaff' : '#6a4cf5');
    dust.material.opacity = dark ? 0.75 : 0.55;
    ring.material.color = new Color(dark ? '#8f7bff' : '#6a4cf5');
    ring.material.opacity = dark ? 0.32 : 0.28;
  };
  theme();

  // ---------- ввод ----------
  const st = {
    tx: 0, ty: 0, // наклон от курсора
    drag: false, dragX: 0, dragAt: 0, downX: 0, downY: 0, downT: 0,
    rotY: 0, vel: 0, flip: -1, intro: -1,
  };
  const hero = stage.closest('section') || stage;
  hero.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const r = stage.getBoundingClientRect();
    st.tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
    st.ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { st.tx = 0; st.ty = 0; });

  const ray = new Raycaster();
  const ndc = new Vector2();
  el.addEventListener('pointerdown', (e) => {
    st.drag = true;
    st.dragX = st.downX = e.clientX;
    st.downY = e.clientY;
    st.downT = performance.now();
    st.vel = 0;
    stage.classList.add('touched');
    el.setPointerCapture?.(e.pointerId);
  });
  el.addEventListener('pointermove', (e) => {
    if (!st.drag) return;
    const dx = e.clientX - st.dragX;
    st.dragX = e.clientX;
    st.rotY += dx * 0.012;
    st.vel = dx * 0.012 * 60;
    zone.dirty = true;
    zone.engine?.wake();
  });
  const end = (e) => {
    if (!st.drag) return;
    st.drag = false;
    const moved = Math.hypot(e.clientX - st.downX, e.clientY - st.downY);
    if (moved < 8 && performance.now() - st.downT < 400) tap(e);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', () => { st.drag = false; });

  function tap(e) {
    const r = el.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([body, bubbleA.userData.hit, ...tiles.map((t) => t.hit)], false);
    if (!hits.length) return;
    const obj = hits[0].object;
    const tile = tiles.find((t) => t.hit === obj);
    if (tile) tile.spin = zone.time;
    else if (obj === body) st.flip = zone.time;
    else bubbleA.userData.pop = zone.time;
    zone.dirty = true;
    zone.engine?.wake();
  }

  let heroH = 800;
  const dummy = new Object3D();

  const zone = {
    name: 'hero',
    el,
    priority: 3,
    time: 0,
    warmup: (r) => warmScene(r, scene, camera),
    onReady() {
      el.classList.add('is-ready');
      stage.classList.add('gl-on');
    },
    onTheme: theme,
    resize(w, h) {
      camera.aspect = w / h;
      // вписываем композицию и по высоте, и по ширине
      const tan = Math.tan((camera.fov * Math.PI) / 360);
      const needH = 7.2;
      const needW = 5.9;
      const d = Math.max(needH / (2 * tan), needW / (2 * tan * camera.aspect));
      camera.position.set(0, 0, d);
      camera.near = Math.max(1, d - 9);
      camera.far = d + 12;
      camera.updateProjectionMatrix();
      heroH = hero.offsetHeight || 800;
    },
    update(t, dt, live) {
      zone.time = t;
      if (!live) t = 4.2;
      if (st.intro < 0) st.intro = t;
      const it = live ? clamp01((t - st.intro) / 1.6) : 1;
      const ie = easeOutCubic(it);

      // телефон: появление + idle-покачивание + курсор + свайп + скролл
      const scroll = live ? clamp01(scrollY / heroH) : 0;
      root.position.y = -2.4 * (1 - ie) + scroll * 1.2;
      root.rotation.x = scroll * 0.35;
      const sway = live ? Math.sin(t * 0.7) : 0;
      if (!st.drag) {
        st.rotY += st.vel * dt;
        st.vel *= Math.exp(-3.2 * dt);
        if (Math.abs(st.vel) < 0.6) {
          const home = Math.round(st.rotY / (Math.PI * 2)) * Math.PI * 2;
          st.rotY = damp(st.rotY, home, 2.2, dt);
        }
      }
      let flip = 0;
      if (st.flip >= 0) {
        const p = clamp01((zone.time - st.flip) / 1.1);
        flip = easeOutCubic(p) * Math.PI * 2;
        if (p >= 1) st.flip = -1;
      }
      rig.rotation.y = damp(rig.rotation.y, st.tx * 0.38 + sway * 0.1 + st.rotY + flip - (1 - ie) * 1.1, live ? 8 : 50, dt);
      rig.rotation.x = damp(rig.rotation.x, st.ty * 0.2, live ? 6 : 50, dt);
      rig.rotation.z = live ? Math.sin(t * 0.7 + 1) * 0.012 : 0;
      rig.position.y = live ? Math.sin(t * 0.7) * 0.12 : 0;

      // плитки платформ
      for (const tl of tiles) {
        const pop = live ? easeOutBack(clamp01((t - st.intro - 0.5 - tl.k * 0.12) / 0.7)) : 1;
        const [x, y, z] = tl.p;
        const depth = z + 1.5;
        tl.g.position.set(x + st.tx * 0.18 * depth, y + Math.sin(t * 1.2 + tl.k * 1.3) * 0.12 - st.ty * 0.12 * depth, z);
        tl.g.scale.setScalar(tl.s * pop);
        let spin = 0;
        if (tl.spin >= 0) {
          const p = clamp01((zone.time - tl.spin) / 0.95);
          spin = easeOutCubic(p) * Math.PI * 2;
          if (p >= 1) tl.spin = -1;
        }
        tl.g.rotation.y = Math.sin(t * 1.0 + tl.k * 1.4) * 0.45 + spin - x * 0.08;
        tl.g.rotation.x = Math.sin(t * 0.8 + tl.k) * 0.14;
      }

      // фирменные пузыри
      const bpop = live ? easeOutBack(clamp01((t - st.intro - 0.9) / 0.8)) : 1;
      let pop = 0;
      if (bubbleA.userData.pop >= 0) {
        const p = clamp01((zone.time - bubbleA.userData.pop) / 0.6);
        pop = Math.sin(p * Math.PI) * 0.25;
        if (p >= 1) bubbleA.userData.pop = -1;
      }
      bubbleA.scale.setScalar(0.62 * bpop * (1 + pop));
      bubbleA.rotation.set(Math.sin(t * 0.6) * 0.12, -0.35 + Math.sin(t * 0.5) * 0.25 + st.tx * 0.2, 0.05);
      bubbleA.position.y = 2.75 + Math.sin(t * 0.9) * 0.1;
      bubbleA.userData.update(t);
      bubbleB.scale.setScalar(0.42 * bpop);
      bubbleB.rotation.set(Math.sin(t * 0.7 + 2) * 0.15, 0.4 + Math.sin(t * 0.45 + 1) * 0.3 + st.tx * 0.2, -0.05);
      bubbleB.position.y = -2.9 + Math.sin(t * 0.8 + 2) * 0.1;

      // самолётик по орбите
      const a = t * 0.42;
      const R = 3.25;
      plane.position.set(Math.cos(a) * R, Math.sin(a * 2) * 0.18, Math.sin(a) * R);
      dummy.position.set(Math.cos(a + 0.05) * R, Math.sin((a + 0.05) * 2) * 0.18, Math.sin(a + 0.05) * R);
      orbit.localToWorld(dummy.position);
      plane.lookAt(dummy.position);
      plane.rotateZ(-0.5);
      plane.visible = ie > 0.6;
      orbit.rotation.y = st.tx * 0.1;

      dust.rotation.y = t * 0.03;
      dust.position.x = -st.tx * 0.25;

      // чат: пузырьки «приземляются» на экран по очереди
      const ct = live ? (t - st.intro) % LOOP : 6;
      const out = live ? clamp01((ct - (LOOP - 1.1)) / 0.5) : 0;
      bubbles.forEach((b, i) => {
        const p = clamp01((ct - (0.6 + i * 0.85)) / 0.65);
        const e = easeOutBack(p);
        const m = b.mesh;
        m.visible = p > 0 && out < 1;
        m.material.opacity = Math.min(1, p * 2.2) * (1 - out);
        const s = 0.7 + 0.3 * e;
        m.scale.set(b.sx * s, b.sy * s, 1);
        m.position.set(b.base.x + (b.me ? 1 : -1) * (1 - e) * 0.18, b.base.y - (1 - e) * 0.25 + out * 0.12, b.base.z + (1 - easeOutCubic(p)) * 0.9);
      });
      bars.visible = voice.mesh.visible;
      if (bars.visible) {
        bars.material.opacity = voice.mesh.material.opacity;
        const vm = voice.mesh;
        const s = vm.scale.x / voice.sx;
        for (let i = 0; i < WAVE.length; i++) {
          const k = live ? 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 7 + i * 1.7)) : 0.8;
          const bx = vm.position.x + (-voice.w / 2 + 48 + i * 5 + 1.5) / 100 * s;
          dummy.position.set(bx, vm.position.y, vm.position.z + 0.012);
          dummy.scale.set(1, (WAVE[i] / 100) * k * s, 1);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          bars.setMatrixAt(i, dummy.matrix);
        }
        bars.instanceMatrix.needsUpdate = true;
      }
    },
    render(renderer) {
      renderer.setScissorTest(false);
      renderer.autoClear = true;
      renderer.setViewport(0, 0, zone.cssW, zone.cssH);
      renderer.render(scene, camera);
    },
  };
  bubbleA.userData.pop = -1;
  return zone;
}
