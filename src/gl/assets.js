import {
  CanvasTexture,
  DataTexture,
  ExtrudeGeometry,
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
  ink: { base: '#040507', f0: 0.06, rough: 0.04, spec: 2.2, ambient: 0.1 },
  lens: { base: '#22276a', metal: 1, rough: 0.05, spec: 1.1 },
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
