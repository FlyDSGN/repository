import {
  CanvasTexture,
  DoubleSide,
  ExtrudeGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  MeshBasicMaterial,
  MeshMatcapMaterial,
  Shape,
  SRGBColorSpace,
} from 'three';

// --- easing ---------------------------------------------------------------
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const easeOutCubic = (t) => 1 - (1 - t) ** 3;
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOutBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};
export const damp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));

// --- canvas helpers --------------------------------------------------------
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function toTexture(canvas) {
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 2;
  return tex;
}

const hex = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const toLin = (c) => c ** 2.2;
const toSrgb = (c) => Math.round(255 * Math.min(1, Math.max(0, c)) ** (1 / 2.2));

function norm(x, y, z) {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

// Процедурный matcap: «студийный» свет запечён в маленькую текстуру.
// Шейдер — одна выборка из текстуры, поэтому это самый дешёвый красивый материал для слабых GPU.
export function makeMatcap({ base, rim = '#8f7bff', fill = '#3b82ff', spec = 1, shine = 48, ambient = 0.22, rimK = 0.55, size = 128 }) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const b = hex(base).map(toLin);
  const r = hex(rim).map(toLin);
  const f = hex(fill).map(toLin);
  const L1 = norm(-0.45, 0.62, 0.65);
  const H1 = norm(L1[0], L1[1], L1[2] + 1);
  const L2 = norm(0.7, -0.45, 0.4);
  const S2 = norm(0.55, 0.75, 0.9);
  const H2 = norm(S2[0], S2[1], S2[2] + 1);
  let p = 0;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let nx = ((px + 0.5) / size) * 2 - 1;
      let ny = 1 - ((py + 0.5) / size) * 2;
      let d2 = nx * nx + ny * ny;
      if (d2 > 0.999) {
        const l = Math.sqrt(d2) / 0.9995;
        nx /= l; ny /= l; d2 = nx * nx + ny * ny;
      }
      const nz = Math.sqrt(Math.max(0, 1 - d2));
      const d1 = Math.max(0, nx * L1[0] + ny * L1[1] + nz * L1[2]);
      const d2l = Math.max(0, nx * L2[0] + ny * L2[1] + nz * L2[2]);
      const s1 = Math.max(0, nx * H1[0] + ny * H1[1] + nz * H1[2]) ** shine;
      const s2 = Math.max(0, nx * H2[0] + ny * H2[1] + nz * H2[2]) ** (shine * 0.6);
      const rimT = (1 - nz) ** 2.4;
      for (let k = 0; k < 3; k++) {
        const v = b[k] * (ambient + 0.9 * d1) + f[k] * 0.28 * d2l + r[k] * rimK * rimT + spec * (0.85 * s1 + 0.25 * s2);
        img.data[p + k] = toSrgb(v);
      }
      img.data[p + 3] = 255;
      p += 4;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c);
}

const matcapCache = new Map();
const PRESETS = {
  graphite: { base: '#262a40', rim: '#6a58c9', fill: '#4b6bff', spec: 0.85, shine: 60, ambient: 0.3, rimK: 0.36 },
  violet: { base: '#7a5cff', rim: '#d7ccff', fill: '#4f7dff', spec: 0.75, shine: 40 },
  white: { base: '#e6e9f5', rim: '#b4a6ff', fill: '#8fa8ff', spec: 0.55, shine: 36, ambient: 0.35 },
  lavender: { base: '#b8aef0', rim: '#ffffff', fill: '#6a4cf5', spec: 0.6, shine: 36, ambient: 0.3 },
  blue: { base: '#2f8fff', rim: '#bfe0ff', fill: '#7a5cff', spec: 0.75, shine: 44 },
  green: { base: '#22c46c', rim: '#c6ffe0', fill: '#3b82ff', spec: 0.7, shine: 44 },
  red: { base: '#ff3f62', rim: '#ffc7d2', fill: '#7a5cff', spec: 0.7, shine: 44 },
  silver: { base: '#b9c0d8', rim: '#ffffff', fill: '#7a5cff', spec: 0.8, shine: 50, ambient: 0.3 },
  amber: { base: '#ffb02e', rim: '#fff0c9', fill: '#ff5f8a', spec: 0.7, shine: 40 },
  ink: { base: '#0b0c14', rim: '#3a3f60', fill: '#3b82ff', spec: 0.5, shine: 70, ambient: 0.4, rimK: 0.4 },
};

export function matcap(name) {
  if (!matcapCache.has(name)) matcapCache.set(name, makeMatcap(PRESETS[name]));
  return matcapCache.get(name);
}

export function matcapMaterial(name, extra = {}) {
  return new MeshMatcapMaterial({ matcap: matcap(name), ...extra });
}

// --- icons (Lucide paths, viewBox 24) ------------------------------------
export const ICONS = {
  windows: { fill: true, d: ['M3 5.6 10.5 4.5v6.3H3z', 'M13 4.2 21 3v7.8h-8z', 'M3 13.2h7.5v6.3L3 18.4z', 'M13 13.2h8V21l-8-1.2z'] },
  android: { d: ['M5 14.5a7 7 0 0 1 14 0z', 'M7 16h10a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2z', 'M9.5 11.5h.01M14.5 11.5h.01', 'M8.5 6.5 7 4.5M15.5 6.5 17 4.5'] },
  huawei: { d: ['M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z', 'M3 6h18', 'M16 10a4 4 0 0 1-8 0'] },
  ios: { d: ['M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z', 'M10 2c1 .5 2 2 2 5'] },
  phone: { d: ['M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z'] },
  video: { d: ['m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5', 'M4 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z'] },
  clip: { d: ['m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48'] },
  mic: { d: ['M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z', 'M19 10v2a7 7 0 0 1-14 0v-2', 'M12 19v3'] },
  check: { d: ['M20 6 9 17l-5-5'] },
};

export function drawIcon(ctx, name, x, y, size, color, width = 1.8) {
  const icon = ICONS[name];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  for (const d of icon.d) {
    const p = new Path2D(d);
    if (icon.fill) ctx.fill(p);
    else ctx.stroke(p);
  }
  ctx.restore();
}

export function iconTexture(name, { size = 256, color = '#ffffff', width = 2 } = {}) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const pad = size * 0.14;
  drawIcon(ctx, name, pad, pad, size - pad * 2, color, width);
  return toTexture(c);
}

export function iconMaterial(name, opts) {
  return new MeshBasicMaterial({ map: iconTexture(name, opts), transparent: true, depthWrite: false });
}

// --- shapes ---------------------------------------------------------------
export function roundedRect(w, h, r) {
  const s = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function extrude(shape, { depth = 0.2, bevel = 0.05, segments = 3, curve = 10 } = {}) {
  const g = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: segments,
    curveSegments: curve,
  });
  g.center();
  g.computeBoundingSphere();
  return g;
}

// Фирменный «пузырь» из логотипа: скруглённый прямоугольник с хвостиком.
export function bubbleShape(w = 1.6, h = 1.2, r = 0.42) {
  const s = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + 0.46, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + 0.36);
  s.quadraticCurveTo(x, y - 0.06, x - 0.2, y - 0.26);
  s.quadraticCurveTo(x + 0.22, y - 0.22, x + 0.46, y);
  return s;
}

export function planeGeometry() {
  // Бумажный самолётик: 3 плоских треугольника, flat-shading, двусторонний.
  const N = [0.95, 0, 0];
  const LW = [-0.7, 0.05, -0.62];
  const RW = [-0.7, 0.05, 0.62];
  const T = [-0.5, 0.08, 0];
  const K = [-0.55, -0.26, 0];
  const tris = [N, LW, T, N, T, RW, N, K, T];
  const pos = new Float32BufferAttribute(tris.flat(), 3);
  const g = new BufferGeometry();
  g.setAttribute('position', pos);
  g.computeVertexNormals();
  return g;
}

export function planeMaterial() {
  return matcapMaterial('white', { flatShading: true, side: DoubleSide });
}

export function dotTexture(size = 64) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,1)');
  g.addColorStop(0.6, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return toTexture(c);
}

export function canvas2d(w, h) {
  const c = makeCanvas(w, h);
  return [c, c.getContext('2d')];
}

export function roundRectPath(ctx, x, y, w, h, r) {
  const rr = typeof r === 'number' ? [r, r, r, r] : r;
  ctx.beginPath();
  ctx.moveTo(x + rr[0], y);
  ctx.lineTo(x + w - rr[1], y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr[1]);
  ctx.lineTo(x + w, y + h - rr[2]);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr[2], y + h);
  ctx.lineTo(x + rr[3], y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr[3]);
  ctx.lineTo(x, y + rr[0]);
  ctx.quadraticCurveTo(x, y, x + rr[0], y);
  ctx.closePath();
}

// Прогрев: шейдеры и текстуры зоны загружаются в рендерер заранее, а не на первом кадре.
export async function warmScene(renderer, scene, camera) {
  scene.traverse((o) => {
    const m = o.material;
    if (!m) return;
    if (m.map) renderer.initTexture(m.map);
    if (m.matcap) renderer.initTexture(m.matcap);
  });
  await renderer.compileAsync(scene, camera);
  // Один невидимый кадр в 1×1 пиксель: загружает в GPU геометрию, в том числе у скрытых пока объектов.
  const hidden = [];
  scene.traverse((o) => { if (!o.visible) { hidden.push(o); o.visible = true; } });
  const autoClear = renderer.autoClear;
  renderer.autoClear = false;
  renderer.setScissorTest(true);
  renderer.setScissor(0, 0, 1, 1);
  renderer.setViewport(0, 0, 1, 1);
  renderer.render(scene, camera);
  renderer.setScissorTest(false);
  renderer.autoClear = autoClear;
  for (const o of hidden) o.visible = false;
}

export function isDarkTheme() {
  const t = document.documentElement.getAttribute('data-theme');
  if (t) return t === 'dark';
  return matchMedia('(prefers-color-scheme: dark)').matches;
}
