import {
  BufferGeometry,
  CapsuleGeometry,
  ConeGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineLoop,
  Mesh,
  Object3D,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Shape,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  bubbleShape,
  matcap,
  dotTexture,
  extrude,
  iconMaterial,
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
const iconPlane = () => once('iconPlane', () => new PlaneGeometry(0.64, 0.64));
const mat = (name, extra) => once(`m:${name}`, () => matcapMaterial(name, extra));

const OS = {
  windows: { mc: 'blue', icon: '#ffffff' },
  android: { mc: 'green', icon: '#ffffff' },
  huawei: { mc: 'red', icon: '#ffffff' },
  ios: { mc: 'silver', icon: '#262b44' },
};

export function makeTile(os, q) {
  const cfg = OS[os];
  const g = new Group();
  const body = new Mesh(tileGeo(q.curve), mat(cfg.mc));
  const icon = new Mesh(iconPlane(), once(`icon:${os}`, () => iconMaterial(os, { color: cfg.icon, width: os === 'windows' ? 0 : 2.1 })));
  icon.position.z = TILE_FRONT + 0.004;
  icon.renderOrder = 2;
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
