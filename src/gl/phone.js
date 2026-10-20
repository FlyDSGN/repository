import {
  BoxGeometry,
  CircleGeometry,
  ClampToEdgeWrapping,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  ShapeGeometry,
  SphereGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvas2d, extrude, finishMatcaps, matcap, matcapMaterial, preloadMatcaps, roundedRect, toTexture } from './assets.js';
import { SH, SW } from './screens.js';

export const Z_SCREEN = 0.168;
export const px = (sx) => sx / 100 - SW / 200;
export const py = (sy) => SH / 200 - sy / 100;

const geos = new Map();
const once = (key, make) => {
  if (!geos.has(key)) geos.set(key, make());
  return geos.get(key);
};

let mats = null;

export function phoneMaterials(finish) {
  if (!mats) {
    mats = {
      frame: matcapMaterial(`${finish}:frame`),
      ring: matcapMaterial(`${finish}:ring`),
      back: matcapMaterial(`${finish}:back`),
      ink: matcapMaterial('ink'),
      lens: matcapMaterial('lens'),
      bezel: new MeshBasicMaterial({ color: 0x030306 }),
      island: new MeshBasicMaterial({ color: 0x000000 }),
      selfie: new MeshBasicMaterial({ color: 0x141c44 }),
      flash: new MeshBasicMaterial({ color: 0xf3ead2 }),
    };
  }
  return mats;
}

export async function applyFinish(id) {
  await preloadMatcaps(finishMatcaps(id));
  mats.frame.matcap = matcap(`${id}:frame`);
  mats.ring.matcap = matcap(`${id}:ring`);
  mats.back.matcap = matcap(`${id}:back`);
}

const lensGeo = (r, depth, seg, x, y, z) => new CylinderGeometry(r, r, depth, seg).rotateX(Math.PI / 2).translate(x, y, z);

function dome(r, h, seg, x, y, z) {
  const R = (r * r + h * h) / (2 * h);
  return new SphereGeometry(R, seg, Math.max(6, seg >> 2), 0, Math.PI * 2, 0, Math.asin(r / R))
    .rotateX(-Math.PI / 2)
    .translate(x, y, z + R - h);
}

function screenGeometry(curve) {
  const g = new ShapeGeometry(roundedRect(SW / 100, SH / 100, 0.38), curve + 2);
  const uv = g.attributes.uv;
  const pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / (SW / 100) + 0.5, pos.getY(i) / (SH / 100) + 0.5);
  return g;
}

export function buildPhone(q) {
  const m = phoneMaterials(q.finish);
  const c = q.curve;
  const seg = c >= 10 ? 40 : 24;
  const Z = -0.24;
  const lenses = [[0.86, 2.58], [0.86, 1.88], [0.26, 2.23]];
  const group = new Group();

  const body = new Mesh(once(`body${c}`, () => extrude(roundedRect(2.88, 5.96, 0.46), { depth: 0.2, bevel: 0.06, segments: 4, curve: c + 6 })), m.frame);
  group.add(body);
  group.add(new Mesh(once('buttons', () => mergeGeometries([
    new BoxGeometry(0.05, 0.62, 0.12).translate(1.5, 1.35, 0),
    new BoxGeometry(0.04, 0.42, 0.1).translate(1.5, -0.45, 0),
    new BoxGeometry(0.05, 0.26, 0.12).translate(-1.5, 2.1, 0),
    new BoxGeometry(0.05, 0.4, 0.12).translate(-1.5, 1.55, 0),
    new BoxGeometry(0.05, 0.4, 0.12).translate(-1.5, 1.02, 0),
  ])), m.frame));

  const plateau = new Mesh(once(`plateau${c}`, () => extrude(roundedRect(2.86, 1.44, 0.44, 0.22), { depth: 0.05, bevel: 0.03, segments: 2, curve: c })), m.frame);
  plateau.position.set(0, 2.23, -0.185);
  group.add(plateau);
  group.add(new Mesh(once(`rings${seg}`, () => mergeGeometries(lenses.map(([x, y]) => lensGeo(0.31, 0.07, seg, x, y, Z - 0.03)))), m.ring));
  group.add(new Mesh(once(`glass${seg}`, () => mergeGeometries([
    ...lenses.map(([x, y]) => lensGeo(0.25, 0.02, seg, x, y, Z - 0.062)),
    dome(0.12, 0.035, 24, -0.95, 1.92, Z),
    lensGeo(0.028, 0.01, 10, -0.95, 2.25, Z - 0.004),
  ])), m.ink));
  group.add(new Mesh(once(`lens${seg}`, () => mergeGeometries(lenses.map(([x, y]) => dome(0.17, 0.06, seg, x, y, Z - 0.072)))), m.lens));
  const flash = new Mesh(once('flash', () => new CircleGeometry(0.1, 20).rotateY(Math.PI)), m.flash);
  flash.position.set(-0.95, 2.56, Z - 0.003);
  group.add(flash);
  const panel = new Mesh(once(`panel${c}`, () => new ShapeGeometry(roundedRect(2.56, 4.1, 0.34), c).rotateY(Math.PI)), m.back);
  panel.position.set(0, -0.85, -0.163);
  group.add(panel);

  const bezel = new Mesh(once(`bezel${c}`, () => new ShapeGeometry(roundedRect(2.86, 5.94, 0.45), c)), m.bezel);
  bezel.position.z = 0.162;
  group.add(bezel);
  const island = new Mesh(once('island', () => new ShapeGeometry(roundedRect(0.6, 0.22, 0.11), 8)), m.island);
  island.position.set(0, py(21), Z_SCREEN + 0.006);
  group.add(island);
  const selfie = new Mesh(once('selfie', () => new CircleGeometry(0.042, 16)), m.selfie);
  selfie.position.set(0.19, py(21), Z_SCREEN + 0.009);
  group.add(selfie);

  const screenGeo = once(`screen${c}`, () => screenGeometry(c));
  return { group, body, screenGeo };
}

export function screenMesh(screenGeo, tex, { transparent = false, z = Z_SCREEN } = {}) {
  const mesh = new Mesh(screenGeo, new MeshBasicMaterial({ map: tex, transparent, depthWrite: !transparent }));
  mesh.position.z = z;
  return mesh;
}

function glareTexture() {
  const [c, ctx] = canvas2d(768, 256);
  const g = ctx.createLinearGradient(384 - 150, 256, 384 + 150, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.44, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.8)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.2)');
  g.addColorStop(0.62, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 768, 256);
  const tex = toTexture(c);
  tex.wrapS = ClampToEdgeWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.repeat.set(1 / 3, 1);
  tex.offset.set(1 / 3, 0);
  return tex;
}

export function glareMesh(screenGeo) {
  const mesh = new Mesh(screenGeo, new MeshBasicMaterial({ map: glareTexture(), transparent: true, depthWrite: false, opacity: 0.08 }));
  mesh.position.z = Z_SCREEN + 0.012;
  mesh.renderOrder = 5;
  mesh.userData.update = (rotY, tilt) => {
    const spin = ((rotY % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    mesh.visible = Math.abs(spin) < 1.6;
    mesh.material.map.offset.x = Math.min(2 / 3, Math.max(0, 1 / 3 - spin * 0.3 - tilt * 0.04));
  };
  return mesh;
}
