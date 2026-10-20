import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PMREMGenerator,
  Scene,
  ShapeGeometry,
  SphereGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { extrude, FINISHES, roundedRect } from './assets.js';
import { SH, SW } from './screens.js';

export const Z_SCREEN = 0.177;
export const px = (sx) => sx / 100 - SW / 200;
export const py = (sy) => SH / 200 - sy / 100;

const geos = new Map();
const once = (key, make) => {
  if (!geos.has(key)) geos.set(key, make());
  return geos.get(key);
};

function studioScene() {
  const scene = new Scene();
  const box = new BoxGeometry(1, 1, 1);
  const room = new Mesh(box, new MeshBasicMaterial({ color: 0xffffff, side: BackSide }));
  room.material.color.setScalar(0.32);
  room.scale.set(30, 24, 30);
  scene.add(room);
  const light = (x, y, z, sx, sy, sz, k) => {
    const m = new MeshBasicMaterial({ color: 0xffffff });
    m.color.setScalar(k);
    const mesh = new Mesh(box, m);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    scene.add(mesh);
  };
  light(0, 11.5, 2, 16, 0.2, 10, 4);
  light(-14.5, 2, 4, 0.2, 14, 3.5, 7);
  light(14.5, 1, -1, 0.2, 13, 3, 4);
  light(-3, 5, -14.5, 12, 7, 0.2, 2);
  light(2, 0, 14.5, 10, 6, 0.2, 1.2);
  light(0, -11.5, 0, 26, 0.2, 26, 0.12);
  return scene;
}

const envs = new WeakMap();

export function studioEnv(renderer, size = 256) {
  if (!envs.has(renderer)) {
    const pmrem = new PMREMGenerator(renderer);
    const scene = studioScene();
    envs.set(renderer, pmrem.fromScene(scene, 0.035, 0.1, 100, { size }).texture);
    pmrem.dispose();
    scene.traverse((o) => o.material?.dispose());
  }
  return envs.get(renderer);
}

let mats = null;

export function phoneMaterials(finish, rich = true) {
  if (!mats) {
    const f = FINISHES.find((x) => x.id === finish) || FINISHES[0];
    mats = {
      frame: new MeshStandardMaterial({ color: f.frame, metalness: 1, roughness: 0.3 }),
      ring: new MeshStandardMaterial({ color: f.frame, metalness: 1, roughness: 0.14 }),
      back: new MeshStandardMaterial({ color: f.back, metalness: 0, roughness: 0.4 }),
      sapphire: new MeshStandardMaterial({ color: 0x040405, metalness: 0, roughness: 0.04 }),
      lens: rich
        ? new MeshPhysicalMaterial({ color: 0x07081a, metalness: 0.3, roughness: 0.06, iridescence: 1, iridescenceIOR: 1.7, iridescenceThicknessRange: [220, 520], clearcoat: 1, clearcoatRoughness: 0.02 })
        : new MeshStandardMaterial({ color: 0x0b0d2a, metalness: 0.6, roughness: 0.08 }),
      bezel: new MeshStandardMaterial({ color: 0x020203, metalness: 0, roughness: 0.12 }),
      glass: new MeshStandardMaterial({ color: 0x000000, metalness: 0, roughness: 0.05, transparent: true, blending: AdditiveBlending, depthWrite: false }),
      island: new MeshBasicMaterial({ color: 0x000000, toneMapped: false }),
      selfie: new MeshStandardMaterial({ color: 0x0a0f2a, metalness: 0.4, roughness: 0.1 }),
      flash: new MeshBasicMaterial({ color: 0xf3ead2, toneMapped: false }),
    };
  }
  return mats;
}

export function applyFinish(id) {
  const f = FINISHES.find((x) => x.id === id);
  if (!f || !mats) return;
  mats.frame.color.set(f.frame);
  mats.ring.color.set(f.frame);
  mats.back.color.set(f.back);
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
  const m = phoneMaterials(q.finish, q.rich);
  const c = q.curve;
  const seg = c >= 10 ? 40 : 24;
  const Z = -0.25;
  const lenses = [[0.86, 2.58], [0.86, 1.88], [0.26, 2.23]];
  const group = new Group();

  const body = new Mesh(once(`body${c}`, () => extrude(roundedRect(2.88, 5.96, 0.46), { depth: 0.2, bevel: 0.07, segments: 6, curve: c + 8, smooth: true })), m.frame);
  group.add(body);
  group.add(new Mesh(once('buttons', () => mergeGeometries([
    new BoxGeometry(0.05, 0.62, 0.12).translate(1.515, 1.35, 0),
    new BoxGeometry(0.04, 0.42, 0.1).translate(1.512, -0.45, 0),
    new BoxGeometry(0.05, 0.26, 0.12).translate(-1.515, 2.1, 0),
    new BoxGeometry(0.05, 0.4, 0.12).translate(-1.515, 1.55, 0),
    new BoxGeometry(0.05, 0.4, 0.12).translate(-1.515, 1.02, 0),
  ])), m.frame));

  const plateau = new Mesh(once(`plateau${c}`, () => extrude(roundedRect(2.86, 1.44, 0.44, 0.22), { depth: 0.05, bevel: 0.03, segments: 3, curve: c + 4, smooth: true })), m.frame);
  plateau.position.set(0, 2.23, -0.195);
  group.add(plateau);
  group.add(new Mesh(once(`rings${seg}`, () => mergeGeometries(lenses.map(([x, y]) => lensGeo(0.31, 0.07, seg, x, y, Z - 0.03)))), m.ring));
  group.add(new Mesh(once(`glass${seg}`, () => mergeGeometries([
    ...lenses.map(([x, y]) => lensGeo(0.25, 0.02, seg, x, y, Z - 0.062)),
    dome(0.12, 0.035, 24, -0.95, 1.92, Z),
    lensGeo(0.028, 0.01, 10, -0.95, 2.25, Z - 0.004),
  ])), m.sapphire));
  group.add(new Mesh(once(`lens${seg}`, () => mergeGeometries(lenses.map(([x, y]) => dome(0.17, 0.06, seg, x, y, Z - 0.072)))), m.lens));
  const flash = new Mesh(once('flash', () => new CircleGeometry(0.1, 20).rotateY(Math.PI)), m.flash);
  flash.position.set(-0.95, 2.56, Z - 0.003);
  group.add(flash);
  const panel = new Mesh(once(`panel${c}`, () => new ShapeGeometry(roundedRect(2.56, 4.1, 0.34), c).rotateY(Math.PI)), m.back);
  panel.position.set(0, -0.85, -0.173);
  group.add(panel);

  const bezel = new Mesh(once(`bezel${c}`, () => new ShapeGeometry(roundedRect(2.86, 5.94, 0.45), c)), m.bezel);
  bezel.position.z = 0.172;
  group.add(bezel);
  const island = new Mesh(once('island', () => new ShapeGeometry(roundedRect(0.6, 0.22, 0.11), 8)), m.island);
  island.position.set(0, py(21), Z_SCREEN + 0.006);
  group.add(island);
  const selfie = new Mesh(once('selfie', () => new CircleGeometry(0.042, 16)), m.selfie);
  selfie.position.set(0.19, py(21), Z_SCREEN + 0.009);
  group.add(selfie);

  const screenGeo = once(`screen${c}`, () => screenGeometry(c));
  const glass = new Mesh(screenGeo, m.glass);
  glass.position.z = Z_SCREEN + 0.014;
  glass.renderOrder = 6;
  group.add(glass);
  return { group, body, screenGeo };
}

export function screenMesh(screenGeo, tex, { transparent = false, z = Z_SCREEN } = {}) {
  const mesh = new Mesh(screenGeo, new MeshBasicMaterial({ map: tex, transparent, depthWrite: !transparent, toneMapped: false }));
  mesh.position.z = z;
  return mesh;
}
