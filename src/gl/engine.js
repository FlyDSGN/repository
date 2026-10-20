import { NeutralToneMapping, WebGLRenderer } from 'three';

const PIXEL_BUDGET = [1.4e6, 1.4e6, 2.2e6, 3e6];

const SOFTWARE_GPU = /swiftshader|llvmpipe|softpipe|software|basic render/i;
const LOW_GPU = /swiftshader|llvmpipe|softpipe|software|basic render|mali-[2-4]\d\d|mali-t[6-8]|adreno \(tm\) [2-5]\d\d|powervr|intel.*(gma|hd graphics [2-5]\d{2,3}\b)/i;

const FORCE = new URLSearchParams(location.search).get('quality');

export function detectTier() {
  if (FORCE === 'high') return 3;
  if (FORCE === 'low') return 1;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  const mobile = /android|iphone|ipad|mobile/i.test(navigator.userAgent);
  if (cores <= 4 || mem <= 2) return 1;
  if (cores >= 8 && mem >= 8 && !mobile) return 3;
  return 2;
}

class Governor {
  constructor(tier) {
    this.setTier(tier);
    this.div = tier <= 1 ? 2 : 1;
    this.scales = [1, 0.75, 0.6];
    this.level = 0;
    this.ema = 16.7;
    this.cpu = 0;
    this.n = 0;
    this.sum = 0;
    this.slowN = 0;
    this.windowAt = 0;
    this.good = 0;
    this.lockUntil = 0;
    this.lastUpAt = -1e9;
    this.fails = 0;
    this.slowWindows = 0;
    this.frozen = false;
    this.warmUntil = 0;
  }

  warm(now, ms = 1500) {
    this.warmUntil = Math.max(this.warmUntil, now + ms);
  }

  setTier(tier) {
    this.tier = tier;
    const dpr = window.devicePixelRatio || 1;
    this.cap = this.software ? 1 : tier >= 2 ? 2 : 1.5;
    this.base = Math.min(dpr, this.cap);
    this.aa = !this.software && this.base < 2;
    if (tier <= 1) this.div = Math.max(this.div || 1, 2);
  }

  get dpr() {
    return Math.max(0.5, this.base * this.scales[this.level]);
  }

  frame(dt) {
    if (!(dt > 0) || dt > 1000) return;
    this.n++;
    this.sum += Math.min(dt, 50);
    if (dt > 24) this.slowN++;
  }

  skipWindow(now) {
    this.windowAt = now;
    this.n = this.sum = this.slowN = 0;
  }

  work(ms) {
    this.cpu += (ms - this.cpu) * 0.15;
  }

  evaluate(now) {
    if (!this.windowAt || now < this.warmUntil) { this.windowAt = now; this.n = this.sum = this.slowN = 0; return false; }
    if (now - this.windowAt < 1000 || this.n < 10) return false;
    this.windowAt = now;
    this.ema = this.sum / this.n;
    const slowFrac = this.slowN / this.n;
    this.n = this.sum = this.slowN = 0;
    const slow = slowFrac > 0.25;
    const fast = slowFrac < 0.06 && this.ema < 18;
    if (slow) {
      this.good = 0;
      if (now - this.lastUpAt < 5000 && ++this.fails >= 2) this.lockUntil = Infinity;
      this.lockUntil = Math.max(this.lockUntil, now + 6000);
      this.slowWindows = slowFrac > 0.7 ? this.slowWindows + 1 : 0;
      if (this.div < 2) { this.div = 2; return true; }
      if (this.level < this.scales.length - 1) { this.level++; return true; }
      if (this.div < 3) { this.div = 3; return true; }
      if (this.slowWindows >= 3) this.frozen = true;
      return false;
    }
    this.slowWindows = 0;
    if (fast && now > this.lockUntil && ++this.good >= 3) {
      this.good = 0;
      this.lastUpAt = now;
      this.lockUntil = now + 3000;
      if (this.level > 0) { this.level--; return true; }
      if (this.div > 1) { this.div--; return true; }
    }
    return false;
  }
}

export class Engine {
  constructor({ tier, max = 2 }) {
    this.gov = new Governor(tier);
    this.max = max;
    this.zones = [];
    this.pool = [];
    this.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.raf = 0;
    this.last = 0;
    this.tick = 0;
    this.gpu = '';
    this.maxDim = 4096;
    this.frame = this.frame.bind(this);
    this.fps = { n: 0, t0: 0, value: 0 };
    this.log = [];

    this.ioNear = new IntersectionObserver((es) => {
      for (const e of es) e.target.__zone.near = e.isIntersecting;
      this.assign();
      this.wake();
    }, { rootMargin: '40% 0px 40% 0px' });
    this.ioVis = new IntersectionObserver((es) => {
      for (const e of es) e.target.__zone.visible = e.isIntersecting;
      this.assign();
      this.wake();
    });
    this.ro = new ResizeObserver((es) => {
      for (const e of es) {
        const z = e.target.__zone;
        z.cssW = Math.round(e.contentRect.width);
        z.cssH = Math.round(e.contentRect.height);
        z.needsSize = true;
        z.dirty = true;
      }
      this.wake();
    });
    this.scrollAt = -1e9;
    addEventListener('scroll', () => { this.scrollAt = performance.now(); }, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause();
      else this.wake();
    });
    addEventListener('rm-theme', () => {
      for (const z of this.zones) { z.onTheme?.(); z.dirty = true; }
      this.wake();
    });

    const self = this;
    window.__rm3d = {
      get tier() { return self.gov.tier; },
      get gpu() { return self.gpu; },
      get dpr() { return +self.gov.dpr.toFixed(2); },
      get level() { return self.gov.level; },
      get div() { return self.gov.div; },
      get ema() { return +self.gov.ema.toFixed(2); },
      get cpu() { return +self.gov.cpu.toFixed(2); },
      get fps() { return self.fps.value; },
      get frozen() { return self.gov.frozen; },
      get renderers() { return self.pool.length; },
      get log() { return self.log; },
      get zones() { return self.zones.map((z) => ({ name: z.name, near: z.near, visible: z.visible, ready: !!z.hadFrame, attached: !!z.slot })); },
    };
  }

  note(msg) {
    if (this.log.length > 60) this.log.shift();
    this.log.push(msg);
  }

  add(zone) {
    Object.assign(zone, { near: false, visible: false, slot: null, dirty: true, needsSize: true, cssW: zone.el.clientWidth, cssH: zone.el.clientHeight, hadFrame: false, lastT: 0 });
    zone.engine = this;
    zone.el.__zone = zone;
    this.zones.push(zone);
    this.ioNear.observe(zone.el);
    this.ioVis.observe(zone.el);
    this.ro.observe(zone.el);
  }

  makeRenderer() {
    const renderer = new WebGLRenderer({ antialias: this.gov.aa, alpha: true, stencil: false, powerPreference: 'default' });
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = NeutralToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.debug.checkShaderErrors = false;
    return renderer;
  }

  createSlot() {
    let renderer = this.makeRenderer();
    this.note(`create slot${this.pool.length} t=${Math.round(performance.now())}`);
    if (!this.pool.length) {
      const gl = renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      this.gpu = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
      const vp = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
      this.maxDim = Math.min(4096, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), vp ? Math.min(vp[0], vp[1]) : 4096);
      const hadAA = this.gov.aa;
      this.gov.software = SOFTWARE_GPU.test(this.gpu) && FORCE !== 'high';
      if (LOW_GPU.test(this.gpu) && this.gov.tier > 1 && !FORCE) this.gov.setTier(1);
      else this.gov.setTier(this.gov.tier);
      if (hadAA !== this.gov.aa) {
        renderer.dispose();
        renderer.forceContextLoss();
        renderer = this.makeRenderer();
      }
    }
    const slot = { renderer, zone: null, home: null, w: 0, h: 0, dpr: 0 };
    renderer.domElement.addEventListener('webglcontextrestored', () => {
      slot.w = 0;
      if (slot.zone) { slot.zone.needsSize = true; slot.zone.dirty = true; }
      this.wake();
    });
    this.pool.push(slot);
    return slot;
  }

  assign() {
    for (const s of this.pool) if (s.zone && !s.zone.near) this.detach(s);
    const want = this.zones.filter((z) => z.near && !z.slot)
      .sort((a, b) => (b.visible - a.visible) || (b.priority - a.priority));
    for (const z of want) {
      let s = this.pool.find((p) => !p.zone && p.home === z)
        || this.pool.find((p) => !p.zone && !(p.home && p.home.near))
        || this.pool.find((p) => !p.zone);
      if (!s && this.pool.length < this.max) {
        try { s = this.createSlot(); } catch (err) { console.warn('[3d] WebGL недоступен', err); return; }
      }
      if (!s) {
        s = this.pool.find((p) => p.zone && !p.zone.visible && (z.visible || p.zone.priority < z.priority));
        if (!s) continue;
        this.detach(s);
      }
      this.attach(s, z);
    }
  }

  attach(s, z) {
    this.note(`attach ${z.name} slot${this.pool.indexOf(s)} t=${Math.round(performance.now())}`);
    const canvas = s.renderer.domElement;
    if (canvas.parentNode !== z.el) z.el.appendChild(canvas);
    s.zone = z;
    s.home = z;
    z.slot = s;
    this.gov.warm(performance.now(), 1200);
    z.needsSize = true;
    z.dirty = true;
  }

  detach(s) {
    if (s.zone) s.zone.slot = null;
    s.zone = null;
  }

  applySize(z) {
    const s = z.slot;
    const w = z.cssW;
    const h = z.cssH;
    if (!w || !h) return false;
    const boost = z.dprBoost ? Math.min(2, this.gov.dpr * z.dprBoost) : this.gov.dpr;
    const dpr = Math.min(boost, this.maxDim / w, this.maxDim / h, Math.sqrt(PIXEL_BUDGET[this.gov.tier] / (w * h)));
    if (s.w !== w || s.h !== h || Math.abs(s.dpr - dpr) > 0.01) {
      const t0 = performance.now();
      s.renderer.setPixelRatio(dpr);
      s.renderer.setSize(w, h, false);
      this.note(`size ${z.name} ${w}x${h}@${dpr.toFixed(2)} ${Math.round(performance.now() - t0)}ms`);
      s.w = w; s.h = h; s.dpr = dpr;
    }
    z.resize(w, h);
    z.needsSize = false;
    return true;
  }

  async prewarm() {
    const idle = () => new Promise((r) => ('requestIdleCallback' in window ? requestIdleCallback(r, { timeout: 400 }) : setTimeout(r, 120)));
    for (const z of this.zones) {
      let s = this.pool.find((p) => p.home === z);
      if (!s) {
        if (this.pool.length >= this.max) continue;
        await idle();
        try { s = this.createSlot(); } catch { break; }
        if (!z.slot) this.attach(s, z);
        else s.home = z;
        this.wake();
      }
      if (!z.warmup) continue;
      await idle();
      const t0 = performance.now();
      this.gov.warm(t0, 2000);
      try { await z.warmup(s.renderer); } catch (err) { console.warn('[3d] prewarm', err); }
      this.gov.warm(performance.now(), 1500);
      this.note(`warm ${z.name} ${Math.round(performance.now() - t0)}ms t=${Math.round(performance.now())}`);
    }
    this.warmed = true;
  }

  requality() {
    for (const z of this.zones) z.needsSize = true;
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 200));
    idle(() => {
      for (const z of this.zones) {
        if (z.visible || !z.needsSize) continue;
        const s = z.slot || this.pool.find((p) => p.home === z && !p.zone);
        if (!s) continue;
        const was = z.slot;
        z.slot = s;
        if (this.applySize(z)) z.dirty = true;
        z.slot = was;
        if (!was) z.needsSize = false;
      }
      this.wake();
    }, { timeout: 1500 });
  }

  wake() {
    if (!this.raf && !document.hidden) this.raf = requestAnimationFrame(this.frame);
  }

  pause() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.last = 0;
  }

  frame(now) {
    this.raf = 0;
    const dt = this.last ? now - this.last : 16.7;
    this.last = now;
    this.gov.frame(dt);
    this.tick++;
    const scrolling = now - this.scrollAt < 250;
    const scrollDiv = this.gov.tier <= 1 ? 3 : this.gov.tier === 2 ? 2 : 1;
    const div = scrolling ? Math.max(scrollDiv, this.gov.div) : this.gov.div;
    const due = this.tick % div === 0;
    const t = now / 1000;
    const live = !this.reduce && !this.gov.frozen;
    let keep = false;
    let rendered = 0;
    const w0 = performance.now();
    for (const z of this.zones) {
      if (!z.slot) continue;
      const animate = live && z.visible;
      if (animate) keep = true;
      if (!z.dirty && !(animate && due)) continue;
      if (z.needsSize && !this.applySize(z)) continue;
      const zdt = z.lastT ? Math.min(0.1, t - z.lastT) : 1 / 60;
      z.lastT = t;
      const r0 = performance.now();
      z.update(t, live ? zdt : 1, live);
      z.render(z.slot.renderer);
      const rt = performance.now() - r0;
      if (rt > 30) this.note(`slow ${z.name} ${Math.round(rt)}ms t=${Math.round(now)}`);
      z.dirty = false;
      rendered++;
      if (!z.hadFrame) { z.hadFrame = true; z.onReady?.(); this.gov.warm(now); }
    }
    if (rendered) {
      this.gov.work(performance.now() - w0);
      this.fps.n++;
    }
    if (now - this.fps.t0 >= 1000) {
      this.fps.value = Math.round((this.fps.n * 1000) / (now - this.fps.t0 || 1));
      this.fps.n = 0;
      this.fps.t0 = now;
    }
    if (scrolling) this.gov.skipWindow(now);
    else if (keep && this.gov.evaluate(now)) this.requality();
    if (keep || this.zones.some((z) => z.slot && z.dirty)) this.raf = requestAnimationFrame(this.frame);
    else this.last = 0;
  }
}
