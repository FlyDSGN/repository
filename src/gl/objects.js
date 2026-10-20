import {
  BufferGeometry,
  CapsuleGeometry,
  CatmullRomCurve3,
  ConeGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineLoop,
  Mesh,
  Object3D,
  Points,
  PointsMaterial,
  Shape,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  bubbleShape,
  matcap,
  dotTexture,
  extrude,
  ICONS,
  matcapMaterial,
  planeGeometry,
  planeMaterial,
  roundedRect,
} from './assets.js';

const cache = new Map();
const once = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};

export function applyTheme(dark) {
  for (const key of ['m:white', 'planeMat']) {
    const m = cache.get(key);
    if (m) m.matcap = matcap(dark ? 'white' : 'lavender');
  }
}

export const TILE_FRONT = 0.19;
const tileGeo = (curve) => once(`tile${curve}`, () => extrude(roundedRect(0.86, 0.86, 0.26), { depth: 0.24, bevel: 0.07, segments: 3, curve }));

function densify(pts, step) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const n = Math.max(1, Math.ceil(a.distanceTo(b) / step));
    for (let k = 1; k <= n; k++) out.push(new Vector2().lerpVectors(a, b, k / n));
  }
  return out;
}

export function iconGeometry(name, q, size = 0.6, width = 2) {
  return once(`icon3d:${name}:${size}:${q.curve}`, () => {
    const icon = ICONS[name];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${icon.d.map((d) => `<path d="${d}"/>`).join('')}</svg>`;
    const { paths } = new SVGLoader().parse(svg);
    const k = size / 24;
    const r = (width / 2) * 1.15;
    const radial = q.curve >= 8 ? 10 : 7;
    const parts = [];
    const v3 = (p) => new Vector3(p.x - 12, 12 - p.y, 0);
    for (const path of paths) {
      if (icon.fill) {
        for (const shape of SVGLoader.createShapes(path)) {
          const flipped = new Shape(shape.getPoints(4).map((p) => new Vector2(p.x - 12, 12 - p.y)));
          parts.push(new ExtrudeGeometry(flipped, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.45, bevelSize: 0.35, bevelSegments: 3, curveSegments: 4 }));
        }
        continue;
      }
      for (const sub of path.subPaths) {
        const raw = sub.getPoints(8);
        const pts = [];
        for (const p of raw) if (!pts.length || pts[pts.length - 1].distanceTo(p) > 0.05) pts.push(p);
        let len = 0;
        for (let i = 1; i < pts.length; i++) len += pts[i].distanceTo(pts[i - 1]);
        if (pts.length < 2 || len < 0.3) {
          parts.push(new SphereGeometry(r * 1.2, radial, radial - 2).translate(pts[0].x - 12, 12 - pts[0].y, 0));
          continue;
        }
        const closed = pts.length > 2 && pts[0].distanceTo(pts[pts.length - 1]) < 0.3;
        if (closed) pts.pop();
        const dense = densify(closed ? [...pts, pts[0]] : pts, 0.55);
        if (closed) dense.pop();
        const curve = new CatmullRomCurve3(dense.map(v3), closed, 'centripetal');
        parts.push(new TubeGeometry(curve, Math.max(8, Math.round(len * 2.2)), r, radial, closed));
        if (!closed) {
          for (const p of [pts[0], pts[pts.length - 1]]) parts.push(new SphereGeometry(r, radial, radial - 2).translate(p.x - 12, 12 - p.y, 0));
        }
      }
    }
    const geo = mergeGeometries(parts);
    geo.scale(k, k, k);
    geo.computeBoundingSphere();
    return geo;
  });
}
const mat = (name, extra) => once(`m:${name}`, () => matcapMaterial(name, extra));

const OS = {
  windows: { mc: 'blue', icon: 'white' },
  android: { mc: 'green', icon: 'white' },
  huawei: { mc: 'red', icon: 'white' },
  ios: { mc: 'silver', icon: 'ink' },
};

export function makeTile(os, q) {
  const cfg = OS[os];
  const g = new Group();
  const body = new Mesh(tileGeo(q.curve), mat(cfg.mc));
  const icon = new Mesh(iconGeometry(os, q), once(`icon:${cfg.icon}`, () => matcapMaterial(cfg.icon)));
  icon.position.z = TILE_FRONT + 0.012;
  g.add(body, icon);
  g.userData.hit = body;
  return g;
}

export function makeBrandBubble(q, { color = 'violet', dots = true, mirror = false } = {}) {
  const g = new Group();
  const geo = once(`bubble${q.curve}`, () => extrude(bubbleShape(), { depth: 0.3, bevel: 0.08, segments: 3, curve: q.curve + 2 }));
  const body = new Mesh(geo, mat(color));
  if (mirror) body.scale.x = -1;
  g.add(body);
  let dotMesh = null;
  if (dots) {
    const sph = once('dotSphere', () => new SphereGeometry(0.13, 18, 12));
    dotMesh = new InstancedMesh(sph, mat(color === 'white' ? 'violet' : 'white'), 3);
    g.add(dotMesh);
  }
  g.userData.hit = body;
  const dummy = new Object3D();
  const cx = mirror ? -0.1 : 0.1;
  g.userData.update = (t) => {
    if (!dotMesh) return;
    for (let i = 0; i < 3; i++) {
      const ph = (t * 2.4 - i * 0.55) % (Math.PI * 2);
      const k = ph > 0 && ph < Math.PI ? Math.sin(ph) : 0;
      dummy.position.set(cx + (i - 1) * 0.38, 0.13 + k * 0.12, 0.24 + k * 0.08);
      dummy.scale.setScalar(0.85 + k * 0.3);
      dummy.updateMatrix();
      dotMesh.setMatrixAt(i, dummy.matrix);
    }
    dotMesh.instanceMatrix.needsUpdate = true;
  };
  g.userData.update(0);
  return g;
}

export function makePaperPlane() {
  const geo = once('plane', () => {
    const p = planeGeometry();
    p.rotateY(-Math.PI / 2);
    return p;
  });
  return new Mesh(geo, once('planeMat', planeMaterial));
}

export function makeParticles(count, r0, r1, size) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = Math.random() * 2 - 1;
    const a = Math.random() * Math.PI * 2;
    const r = r0 + (r1 - r0) * Math.random() ** 0.7;
    const s = Math.sqrt(1 - u * u);
    pos[i * 3] = r * s * Math.cos(a);
    pos[i * 3 + 1] = r * u * 0.8;
    pos[i * 3 + 2] = r * s * Math.sin(a) * 0.7;
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  const m = new PointsMaterial({ size, sizeAttenuation: true, map: once('dot', () => dotTexture()), transparent: true, depthWrite: false, opacity: 0.85 });
  return new Points(geo, m);
}

export function makeRing(radius, segments = 160) {
  const pts = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(Math.cos(a) * radius, 0, Math.sin(a) * radius);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pts, 3));
  return new LineLoop(geo, new LineBasicMaterial({ transparent: true, opacity: 0.32, depthWrite: false }));
}

function boltShape() {
  const s = new Shape();
  s.moveTo(0.14, 0.66);
  s.lineTo(-0.44, -0.06);
  s.lineTo(-0.03, -0.06);
  s.lineTo(-0.15, -0.66);
  s.lineTo(0.44, 0.08);
  s.lineTo(0.03, 0.08);
  s.closePath();
  return s;
}

function shieldShape() {
  const s = new Shape();
  s.moveTo(0, 0.64);
  s.bezierCurveTo(0.2, 0.5, 0.4, 0.46, 0.54, 0.46);
  s.lineTo(0.54, 0.04);
  s.bezierCurveTo(0.54, -0.34, 0.3, -0.54, 0, -0.66);
  s.bezierCurveTo(-0.3, -0.54, -0.54, -0.34, -0.54, 0.04);
  s.lineTo(-0.54, 0.46);
  s.bezierCurveTo(-0.4, 0.46, -0.2, 0.5, 0, 0.64);
  return s;
}

function capsule(len, r, material) {
  const geo = once(`cap${len}`, () => new CapsuleGeometry(r, len, 4, 10));
  return new Mesh(geo, material);
}

export const FEATURES = {
  zap(q) {
    const g = new Group();
    const bolt = new Mesh(once('bolt', () => extrude(boltShape(), { depth: 0.2, bevel: 0.05, segments: 2, curve: 2 })), mat('amber'));
    g.add(bolt);
    g.userData.update = (t) => {
      const f = (t % 2.6) / 2.6;
      const k = f < 0.12 ? Math.sin((f / 0.12) * Math.PI) : 0;
      bolt.scale.setScalar(1 + k * 0.16);
      bolt.rotation.z = -k * 0.15;
    };
    return g;
  },
  shield(q) {
    const g = new Group();
    const body = new Mesh(once('shield', () => extrude(shieldShape(), { depth: 0.2, bevel: 0.06, segments: 3, curve: q.curve })), mat('violet'));
    const check = new Group();
    const white = mat('white');
    const a = capsule(0.16, 0.055, white);
    a.position.set(-0.14, -0.04, 0);
    a.rotation.z = Math.PI / 4;
    const b = capsule(0.36, 0.055, white);
    b.position.set(0.09, 0.03, 0);
    b.rotation.z = -0.72;
    check.add(a, b);
    check.position.z = 0.2;
    g.add(body, check);
    g.userData.update = (t) => {
      const p = 1 + Math.sin(t * 2.4) * 0.05;
      check.scale.setScalar(p);
      check.position.z = 0.2 + Math.max(0, Math.sin(t * 2.4)) * 0.06;
    };
    return g;
  },
  grid() {
    const g = new Group();
    const geo = once('cube', () => new RoundedBoxGeometry(0.44, 0.44, 0.44, 3, 0.1));
    const cubes = [];
    const m = [mat('violet'), mat('white')];
    for (let i = 0; i < 4; i++) {
      const c = new Mesh(geo, m[(i + (i >> 1)) % 2]);
      c.position.set(i % 2 ? 0.27 : -0.27, i < 2 ? 0.27 : -0.27, 0);
      cubes.push(c);
      g.add(c);
    }
    g.userData.update = (t) => {
      for (let i = 0; i < 4; i++) {
        const k = Math.sin(t * 2.2 - [0, 1, 3, 2][i] * 0.8);
        cubes[i].position.z = k * 0.12;
        cubes[i].rotation.x = k * 0.25;
      }
    };
    return g;
  },
  users() {
    const g = new Group();
    const head = once('head', () => new SphereGeometry(1, 20, 14));
    const person = (material, s) => {
      const p = new Group();
      const h = new Mesh(head, material);
      h.scale.setScalar(0.2 * s);
      h.position.y = 0.3 * s;
      const body = capsule(0.18, 0.27, material);
      body.scale.set(s, s * 0.85, s);
      body.position.y = -0.2 * s;
      p.add(h, body);
      return p;
    };
    const a = person(mat('violet'), 1);
    a.position.set(-0.16, -0.06, 0.12);
    const b = person(mat('white'), 0.8);
    b.position.set(0.3, 0.06, -0.18);
    g.add(a, b);
    g.userData.update = (t) => {
      a.position.y = -0.06 + Math.sin(t * 2.2) * 0.05;
      b.position.y = 0.06 + Math.sin(t * 2.2 + 1.6) * 0.05;
    };
    return g;
  },
  sync(q) {
    const g = new Group();
    const spin = new Group();
    const arc = once('arc', () => new TorusGeometry(0.46, 0.08, 10, q.curve * 3, Math.PI * 0.78));
    const cone = once('cone', () => new ConeGeometry(0.15, 0.26, 14));
    for (let i = 0; i < 2; i++) {
      const part = new Group();
      const m = mat(i ? 'white' : 'violet');
      part.add(new Mesh(arc, m));
      const tip = new Mesh(cone, m);
      const end = Math.PI * 0.78;
      tip.position.set(Math.cos(end) * 0.46, Math.sin(end) * 0.46, 0);
      tip.rotation.z = end;
      part.add(tip);
      part.rotation.z = i * Math.PI + 0.3;
      spin.add(part);
    }
    g.add(spin);
    g.userData.update = (t) => {
      spin.rotation.z = -t * 1.25;
    };
    return g;
  },
};
