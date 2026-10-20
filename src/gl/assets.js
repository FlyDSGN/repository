import {
  CanvasTexture,
  ExtrudeGeometry,
  Shape,
  SRGBColorSpace,
} from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

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
  { id: 'glacier-blue', label: 'Glacier Blue', frame: '#9db6cb', back: '#839cb1' },
  { id: 'burgundy', label: 'Burgundy', frame: '#4f1a26', back: '#461722' },
  { id: 'silver', label: 'Silver', frame: '#cfd2d8', back: '#bfc2c8' },
  { id: 'deep-black', label: 'Deep Black', frame: '#2b2c31', back: '#28292e' },
];

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

export function extrude(shape, { depth = 0.2, bevel = 0.05, segments = 3, curve = 10, smooth = false } = {}) {
  let g = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: segments,
    curveSegments: curve,
  });
  g.center();
  if (smooth) {
    g.deleteAttribute('uv');
    g = mergeVertices(g, 1e-4);
    g.computeVertexNormals();
  }
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
    if (m?.map) renderer.initTexture(m.map);
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
