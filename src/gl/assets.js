import {
  CanvasTexture,
  DataTexture,
  DoubleSide,
  ExtrudeGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshMatcapMaterial,
  RGBAFormat,
  Shape,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three';
import { renderMatcap } from './matcap-core.js';

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const easeOutCubic = (t) => 1 - (1 - t) ** 3;
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOutBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};
export const damp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function toTexture(canvas) {
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export const FINISHES = [
  { id: 'glacier-blue', label: 'Glacier Blue', css: '#a9c3d8', base: '#a3bfd6', back: '#a9c2d6' },
  { id: 'burgundy', label: 'Burgundy', css: '#5b1e2a', base: '#4c1623', back: '#5a1e2b' },
  { id: 'silver', label: 'Silver', css: '#d6d9de', base: '#cfd3da', back: '#d3d7dd' },
  { id: 'deep-black', label: 'Deep Black', css: '#2b2c31', base: '#2c2d33', back: '#36373d' },
];

const BASE_PRESETS = {
  violet: { base: '#7a5cff', f0: 0.1, rough: 0.18, spec: 1.3, ambient: 0.24 },
  white: { base: '#e9ebf5', f0: 0.08, rough: 0.22, spec: 1.1, ambient: 0.3 },
  lavender: { base: '#b6abf2', f0: 0.08, rough: 0.22, spec: 1.1, ambient: 0.28 },
  blue: { base: '#2f8fff', f0: 0.1, rough: 0.18, spec: 1.3 },
  green: { base: '#1fc46a', f0: 0.1, rough: 0.18, spec: 1.3 },
  red: { base: '#ff3d61', f0: 0.1, rough: 0.18, spec: 1.3 },
  silver: { base: '#c3c9dc', f0: 0.1, rough: 0.2, spec: 1.2, ambient: 0.26 },
  amber: { base: '#ffae22', f0: 0.1, rough: 0.18, spec: 1.3 },
  ink: { base: '#040507', f0: 0.07, rough: 0.04, spec: 2.4, ambient: 0.1 },
  lens: { base: '#22276a', metal: 1, rough: 0.05, spec: 1.1 },
  steel: { base: '#a2a8ba', metal: 1, rough: 0.18, spec: 1 },
};

function finishPresets(f) {
  return {
    [`${f.id}:frame`]: { base: f.base, metal: 1, rough: 0.26, spec: 1 },
    [`${f.id}:ring`]: { base: f.base, metal: 1, rough: 0.12, spec: 1.1 },
    [`${f.id}:back`]: { base: f.back, f0: 0.05, rough: 0.7, spec: 0.7, ambient: 0.26 },
  };
}

const PRESETS = Object.assign({}, BASE_PRESETS, ...FINISHES.map(finishPresets));
const matcapCache = new Map();
let matcapSize = 256;

function toMatcapTexture(data, size) {
  const tex = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
  tex.colorSpace = SRGBColorSpace;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

let worker = null;
let jobId = 0;
const pending = new Map();

function getWorker() {
  if (worker !== null) return worker;
  try {
    worker = new Worker(new URL('./matcap.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const done = pending.get(e.data.id);
      pending.delete(e.data.id);
      done?.(e.data.result);
    };
    worker.onerror = () => { worker = false; };
  } catch {
    worker = false;
  }
  return worker;
}

export async function preloadMatcaps(names, size = matcapSize) {
  matcapSize = size;
  const todo = names.filter((n) => !matcapCache.has(n) && PRESETS[n]);
  if (!todo.length) return;
  const jobs = todo.map((name) => ({ ...PRESETS[name], name, size }));
  const w = getWorker();
  let result;
  if (w) {
    const id = ++jobId;
    result = await Promise.race([
      new Promise((resolve) => { pending.set(id, resolve); w.postMessage({ id, jobs }); }),
      new Promise((resolve) => setTimeout(() => resolve(null), 6000)),
    ]);
  }
  if (!result) result = jobs.map((j) => ({ name: j.name, size: j.size, data: renderMatcap({ ...j, size: Math.min(j.size, 128) }) }));
  for (const r of result) {
    const s = Math.round(Math.sqrt(r.data.length / 4));
    if (!matcapCache.has(r.name)) matcapCache.set(r.name, toMatcapTexture(r.data, s));
  }
}

export const finishMatcaps = (id) => [`${id}:frame`, `${id}:ring`, `${id}:back`];
export const BASE_MATCAPS = Object.keys(BASE_PRESETS);

export function matcap(name) {
  if (!matcapCache.has(name)) matcapCache.set(name, toMatcapTexture(renderMatcap({ ...PRESETS[name], size: 128 }), 128));
  return matcapCache.get(name);
}

export function matcapMaterial(name, extra = {}) {
  return new MeshMatcapMaterial({ matcap: matcap(name), ...extra });
}

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

export function roundedRect(w, h, r, rb = r) {
  const s = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + rb, y);
  s.lineTo(x + w - rb, y);
  s.quadraticCurveTo(x + w, y, x + w, y + rb);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + rb);
  s.quadraticCurveTo(x, y, x + rb, y);
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

export async function warmScene(renderer, scene, camera) {
  scene.traverse((o) => {
    const m = o.material;
    if (!m) return;
    if (m.map) renderer.initTexture(m.map);
    if (m.matcap) renderer.initTexture(m.matcap);
  });
  await renderer.compileAsync(scene, camera);
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
