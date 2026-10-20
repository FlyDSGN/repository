const doc = document;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

function detectOS() {
  const ua = navigator.userAgent || '';
  if (/huawei|harmonyos/i.test(ua)) return 'huawei';
  if (/android/i.test(ua)) return 'android';
  if (/windows/i.test(ua)) return 'windows';
  return '';
}

function setupOS() {
  const targets = {
    windows: { id: 'github-link', label: 'Скачать для Windows' },
    android: { id: 'rustore-link', label: 'Скачать в RuStore' },
    huawei: { id: 'appgallery-link', label: 'Скачать в AppGallery' },
  };
  const os = detectOS();
  if (!os) return;
  const src = doc.getElementById(targets[os].id);
  doc.querySelectorAll('[data-os-cta]').forEach((cta) => {
    if (!src) return;
    cta.href = src.href;
    cta.target = '_blank';
    cta.rel = 'noopener';
    const label = cta.querySelector('[data-os-label]');
    if (label) label.textContent = targets[os].label;
  });
  const card = doc.querySelector(`[data-os="${os}"]`);
  if (card) card.classList.add('is-yours');
}

function setupMenu() {
  const header = doc.getElementById('header');
  const btn = doc.getElementById('menu-btn');
  const panel = doc.getElementById('mobile-nav');
  const scrim = doc.getElementById('scrim');
  const setMenu = (open) => {
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    panel.toggleAttribute('inert', !open);
    header.classList.toggle('menu-open', open);
    doc.body.classList.toggle('menu-open-body', open);
  };
  setMenu(false);
  btn.addEventListener('click', () => setMenu(btn.getAttribute('aria-expanded') !== 'true'));
  panel.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  scrim.addEventListener('click', () => setMenu(false));
  doc.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  matchMedia('(min-width:960px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });
}

function setupTheme() {
  const root = doc.documentElement;
  const btn = doc.getElementById('theme-btn');
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const current = () => root.getAttribute('data-theme') || (mq.matches ? 'dark' : 'light');
  const meta = doc.querySelectorAll('meta[name="theme-color"]');
  const sync = () => {
    const t = current();
    meta.forEach((m) => m.setAttribute('content', t === 'dark' ? '#07080f' : '#f3f4fa'));
    btn.setAttribute('aria-label', t === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему');
    window.dispatchEvent(new CustomEvent('rm-theme', { detail: t }));
  };
  btn.addEventListener('click', () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('rm-theme', next); } catch { /* приватный режим */ }
    sync();
  });
  mq.addEventListener('change', sync);
  sync();
}

function setupScroll() {
  const header = doc.getElementById('header');
  const bar = doc.getElementById('progress');
  let ticking = false;
  let full = 0;
  const measure = () => { full = doc.documentElement.scrollHeight - innerHeight; };
  new ResizeObserver(measure).observe(doc.body);
  measure();
  const onScroll = () => {
    const h = full;
    const y = scrollY;
    bar.style.setProperty('--p', h > 0 ? Math.min(1, y / h).toFixed(4) : 0);
    header.classList.toggle('scrolled', y > 8);
    ticking = false;
  };
  addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();
}

function setupRipple() {
  if (reduce) return;
  doc.addEventListener('pointerdown', (e) => {
    const t = e.target.closest && e.target.closest('.btn,.icon-btn,.socials a');
    if (!t || t.getAttribute('aria-disabled') === 'true') return;
    const r = t.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2.4;
    const s = doc.createElement('span');
    s.className = 'ripple';
    s.style.width = s.style.height = `${size}px`;
    s.style.left = `${e.clientX - r.left}px`;
    s.style.top = `${e.clientY - r.top}px`;
    t.appendChild(s);
    setTimeout(() => s.remove(), 700);
  });
}

function setupFaq() {
  doc.querySelectorAll('.faq-item').forEach((d) => {
    const s = d.querySelector('summary');
    const c = d.querySelector('.faq-body');
    s.addEventListener('click', (e) => {
      e.preventDefault();
      if (reduce || !c.animate) { d.open = !d.open; return; }
      if (d.dataset.busy) return;
      if (!d.open) {
        d.open = true;
        const h = c.offsetHeight;
        c.animate([{ height: '0px', opacity: 0 }, { height: `${h}px`, opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
      } else {
        const h = c.offsetHeight;
        d.dataset.busy = '1';
        const a = c.animate([{ height: `${h}px`, opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 260, easing: 'ease' });
        a.onfinish = () => { d.open = false; delete d.dataset.busy; };
      }
    });
  });
}

function setupReveal() {
  const els = doc.querySelectorAll('.reveal,.reveal-fade');
  if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('in');
      en.target.dispatchEvent(new CustomEvent('rm-reveal', { bubbles: true }));
      io.unobserve(en.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
  els.forEach((el) => io.observe(el));
}

export function initUI() {
  setupOS();
  setupMenu();
  setupTheme();
  setupScroll();
  setupRipple();
  setupFaq();
  setupReveal();
}
