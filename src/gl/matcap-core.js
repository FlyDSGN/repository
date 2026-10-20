const hex = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map((c) => c ** 2.2);
};

const norm = (x, y, z) => {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
};

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const aces = (x) => (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14);

const KEY = norm(-0.42, 0.78, 0.46);
const STRIP = norm(0.96, 0.08, 0.26);
const RIM = norm(0.15, 0.35, -0.92);
const FILL = norm(0.62, -0.38, 0.62);

function studio(rx, ry, rz, rough, tint) {
  const w = 0.04 + rough * 0.3;
  const sky = smooth(-0.35, 0.75, ry);
  let e = 0.035 + 0.42 * sky + 0.16 * smooth(-0.08, 0.04, ry) * (1 - sky);
  const k = rx * KEY[0] + ry * KEY[1] + rz * KEY[2];
  e += 3.2 * smooth(Math.cos(0.36 + w), Math.cos(0.26), k) * (1 - rough * 0.45);
  const sl = Math.hypot(rx, ry * 0.28, rz) || 1;
  const s = (rx * STRIP[0] + ry * 0.28 * STRIP[1] + rz * STRIP[2]) / sl;
  e += 1.5 * smooth(0.9 - w, 0.975, s) * (1 - rough * 0.4);
  const r = rx * RIM[0] + ry * RIM[1] + rz * RIM[2];
  e += 1.1 * smooth(0.55 - w, 0.9, r);
  return [e * tint[0], e * tint[1], e * tint[2]];
}

export function renderMatcap({ base, metal = 0, rough = 0.25, spec = 1, f0 = 0.04, ambient = 0.18, rim, tint = '#f2f0ff', size }) {
  const b = hex(base);
  const rc = rim ? hex(rim) : null;
  const tn = hex(tint);
  const out = new Uint8ClampedArray(size * size * 4);
  let p = 0;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let nx = ((px + 0.5) / size) * 2 - 1;
      let ny = ((py + 0.5) / size) * 2 - 1;
      let d2 = nx * nx + ny * ny;
      if (d2 > 0.998) {
        const l = Math.sqrt(d2 / 0.998);
        nx /= l; ny /= l; d2 = 0.998;
      }
      const nz = Math.sqrt(1 - d2);
      const rx = 2 * nz * nx;
      const ry = 2 * nz * ny;
      const rz = 2 * nz * nz - 1;
      const env = studio(rx, ry, rz, rough, tn);
      const fres = f0 + (1 - f0) * (1 - nz) ** 5;
      const hemi = 0.5 + 0.5 * ny;
      const dif = ambient * (0.55 + 0.45 * hemi)
        + 0.85 * Math.max(0, nx * KEY[0] + ny * KEY[1] + nz * KEY[2])
        + 0.22 * Math.max(0, nx * FILL[0] + ny * FILL[1] + nz * FILL[2]);
      const rimT = rc ? (1 - nz) ** 3 * 0.6 : 0;
      for (let c = 0; c < 3; c++) {
        let v;
        if (metal) {
          v = b[c] * dif * 0.18 + b[c] * env[c] * spec * (0.9 + 0.35 * fres) + env[c] * fres * 0.12;
        } else {
          v = b[c] * dif + env[c] * spec * fres * (1 - rough * 0.5);
        }
        if (rc) v += rc[c] * rimT;
        out[p + c] = Math.round(255 * Math.min(1, aces(v)) ** (1 / 2.2));
      }
      out[p + 3] = 255;
      p += 4;
    }
  }
  return out;
}
