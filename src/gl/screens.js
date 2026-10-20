import { canvas2d, roundRectPath, toTexture } from './assets.js';
import { drawIcon } from './icons.js';

export const SW = 272;
export const SH = 580;
export const FONT = '"Onest Variable", system-ui, sans-serif';

const C = {
  bg: '#0e0f13',
  surf: '#1a1b21',
  surf2: '#25262e',
  text: '#f2f2f5',
  muted: '#8e8f99',
  sep: 'rgba(255,255,255,0.07)',
  accent: '#7b63ff',
  me: '#6d55ff',
  them: '#23242c',
  green: '#34c759',
  red: '#ff3b30',
};
const AVATAR = ['#e17076', '#7bc862', '#e5ca77', '#65aadd', '#a695e7', '#ee7aae', '#6ec9cb', '#faa774'];

function font(ctx, weight, size) {
  ctx.font = `${weight} ${size}px ${FONT}`;
}

function text(ctx, str, x, y, { weight = 400, size = 14, color = C.text, align = 'left', max } = {}) {
  font(ctx, weight, size);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  let s = str;
  if (max && ctx.measureText(s).width > max) {
    while (s.length > 1 && ctx.measureText(`${s}…`).width > max) s = s.slice(0, -1);
    s = `${s.trimEnd()}…`;
  }
  ctx.fillText(s, x, y);
  ctx.textAlign = 'left';
}

function avatar(ctx, x, y, r, initials, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, initials, x, y + 1, { weight: 600, size: r * 0.78, color: '#fff', align: 'center' });
}

function frame(scale) {
  const [c, ctx] = canvas2d(Math.round(SW * scale), Math.round(SH * scale));
  ctx.scale(scale, scale);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, SW, SH);
  text(ctx, '9:41', 30, 23, { weight: 600, size: 13 });
  drawIcon(ctx, 'signal', SW - 82, 15, 16, C.text);
  drawIcon(ctx, 'wifi', SW - 63, 15, 16, C.text);
  drawIcon(ctx, 'battery', SW - 44, 13, 21, C.text);
  return [c, ctx];
}

function wrap(ctx, str, max) {
  const words = str.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > max && line) { lines.push(line); line = w; } else line = test;
  }
  lines.push(line);
  return lines;
}

export const WAVE = [6, 12, 18, 9, 14, 20, 11, 16, 7, 13, 19, 10, 6, 15];

export function measureBubble(msg) {
  const [m] = canvas2d(4, 4);
  const ctx = m.getContext('2d');
  font(ctx, 400, 14);
  if (msg.voice) return { w: 170, h: 46, lines: [] };
  const lines = wrap(ctx, msg.text, 168);
  const textW = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const reserve = msg.me ? 58 : 40;
  let w = textW + 26 + reserve;
  let h = lines.length * 18.5 + 18;
  if (w > 222) {
    w = Math.max(textW + 26, reserve + 26);
    h += 14;
  }
  return { w: Math.ceil(w), h: Math.ceil(h), lines };
}

export function drawBubble(ctx, msg, x, y, size) {
  const { w, h, lines } = size;
  roundRectPath(ctx, x, y, w, h, msg.me ? [17, 17, 5, 17] : [17, 17, 17, 5]);
  ctx.fillStyle = msg.me ? C.me : C.them;
  ctx.fill();
  if (msg.voice) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + 23, y + 23, 15, 0, Math.PI * 2);
    ctx.fill();
    drawIcon(ctx, 'play', x + 16, y + 16, 15, C.me);
    WAVE.forEach((bh, i) => {
      ctx.fillStyle = i < 6 ? '#fff' : 'rgba(255,255,255,0.5)';
      roundRectPath(ctx, x + 48 + i * 5, y + 23 - bh / 2, 3, bh, 1.5);
      ctx.fill();
    });
    text(ctx, '0:12', x + w - 14, y + 24, { size: 11, color: 'rgba(255,255,255,0.8)', align: 'right' });
    return;
  }
  lines.forEach((l, i) => text(ctx, l, x + 13, y + 9 + 9.25 + i * 18.5, { size: 14 }));
  const meta = msg.time || '12:40';
  const tx = x + w - (msg.me ? 30 : 10);
  const ty = y + h - 11;
  text(ctx, meta, tx, ty, { size: 10, color: msg.me ? 'rgba(255,255,255,0.7)' : C.muted, align: 'right' });
  if (msg.me) drawIcon(ctx, 'checks', x + w - 26, ty - 7, 14, 'rgba(255,255,255,0.8)');
}

export const MESSAGES = [
  { text: 'Привет, как дела?', me: false, time: '12:31' },
  { text: 'Отлично! Ты как?', me: true, time: '12:32' },
  { text: 'Всё супер! Скоро увидимся', me: false, time: '12:32' },
  { voice: true, me: true },
  { text: 'Голосовое огонь! Вечером созвонимся?', me: false, time: '12:40' },
  { text: 'Да, наберу по видео', me: true, time: '12:41' },
];

export function layoutMessages() {
  let y = 146;
  return MESSAGES.map((msg) => {
    const size = measureBubble(msg);
    const x = msg.me ? SW - 12 - size.w : 12;
    const item = { msg, size, x, y };
    y += size.h + 7;
    return item;
  });
}

function chatHeader(ctx) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 40, SW, 56);
  drawIcon(ctx, 'back', 8, 54, 24, C.accent);
  avatar(ctx, 54, 68, 17, 'А', AVATAR[3]);
  text(ctx, 'Алексей', 80, 61, { weight: 600, size: 15 });
  text(ctx, 'в сети', 80, 78, { size: 12, color: C.accent });
  drawIcon(ctx, 'phone', SW - 64, 58, 21, C.accent);
  drawIcon(ctx, 'video', SW - 36, 58, 22, C.accent);
  ctx.fillStyle = C.sep;
  ctx.fillRect(0, 96, SW, 1);
  font(ctx, 500, 11);
  const dw = ctx.measureText('Сегодня').width + 18;
  roundRectPath(ctx, (SW - dw) / 2, 112, dw, 20, 10);
  ctx.fillStyle = C.surf2;
  ctx.fill();
  text(ctx, 'Сегодня', SW / 2, 122.5, { weight: 500, size: 11, color: C.muted, align: 'center' });
}

function composer(ctx) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 512, SW, 68);
  ctx.fillStyle = C.sep;
  ctx.fillRect(0, 512, SW, 1);
  drawIcon(ctx, 'clip', 12, 527, 22, C.muted);
  roundRectPath(ctx, 42, 522, SW - 92, 34, 17);
  ctx.fillStyle = C.surf;
  ctx.fill();
  text(ctx, 'Сообщение', 56, 539.5, { size: 14, color: C.muted });
  drawIcon(ctx, 'smiley', SW - 80, 528, 21, C.muted);
  ctx.fillStyle = C.accent;
  ctx.beginPath();
  ctx.arc(SW - 28, 539, 17, 0, Math.PI * 2);
  ctx.fill();
  drawIcon(ctx, 'micFill', SW - 37, 530, 18, '#fff');
}

export function paintChat(scale, { bubbles = false } = {}) {
  const [c, ctx] = frame(scale);
  chatHeader(ctx);
  if (bubbles) for (const b of layoutMessages()) drawBubble(ctx, b.msg, b.x, b.y, b.size);
  composer(ctx);
  return toTexture(c);
}

export function paintBubble(msg, size, scale) {
  const [c, ctx] = canvas2d(Math.ceil(size.w * scale), Math.ceil(size.h * scale));
  ctx.scale(scale, scale);
  drawBubble(ctx, msg, 0, 0, size);
  return toTexture(c);
}

function paintChats(scale) {
  const [c, ctx] = frame(scale);
  text(ctx, 'Чаты', 16, 74, { weight: 650, size: 28 });
  drawIcon(ctx, 'compose', SW - 42, 62, 24, C.accent);
  roundRectPath(ctx, 16, 96, SW - 32, 34, 10);
  ctx.fillStyle = C.surf;
  ctx.fill();
  drawIcon(ctx, 'search', 26, 105, 16, C.muted);
  text(ctx, 'Поиск', 48, 113.5, { size: 14, color: C.muted });
  const rows = [
    { n: 'Алексей', m: 'Голосовое сообщение', t: '12:41', badge: 2, a: 'А', c: 3, hl: true },
    { n: 'Команда проекта', m: 'Лена: Созвон в 15:00?', t: '11:58', badge: 5, a: 'КП', c: 1 },
    { n: 'Семья', m: 'Мама: Купи хлеб по дороге', t: '11:30', a: 'С', c: 0, pin: true },
    { n: 'Дизайн и код', m: 'Сетка 8pt: зачем и как', t: '10:24', a: 'ДК', c: 4 },
    { n: 'Марина', m: 'Спасибо, до встречи!', t: '09:47', a: 'М', c: 5 },
    { n: 'Игорь', m: 'Ок, договорились', t: 'Вчера', a: 'И', c: 7 },
  ];
  rows.forEach((r, i) => {
    const y = 144 + i * 62;
    avatar(ctx, 42, y + 31, 25, r.a, AVATAR[r.c]);
    text(ctx, r.n, 78, y + 21, { weight: 600, size: 15, max: SW - 78 - 54 });
    text(ctx, r.t, SW - 14, y + 21, { size: 12, color: r.badge ? C.accent : C.muted, align: 'right' });
    text(ctx, r.m, 78, y + 42, { size: 13.5, color: r.hl ? C.accent : C.muted, max: SW - 78 - 44 });
    if (r.badge) {
      roundRectPath(ctx, SW - 36, y + 33, 22, 18, 9);
      ctx.fillStyle = C.accent;
      ctx.fill();
      text(ctx, String(r.badge), SW - 25, y + 42.5, { weight: 600, size: 11, align: 'center' });
    }
    if (r.pin) drawIcon(ctx, 'pin', SW - 32, y + 34, 15, C.muted);
    if (i < rows.length - 1) {
      ctx.fillStyle = C.sep;
      ctx.fillRect(78, y + 62, SW - 78, 1);
    }
  });
  ctx.fillStyle = C.surf;
  ctx.fillRect(0, 522, SW, 58);
  ctx.fillStyle = C.sep;
  ctx.fillRect(0, 522, SW, 1);
  const tabs = [['chatsFill', 'Чаты', true], ['phoneTab', 'Звонки'], ['users', 'Контакты'], ['gear', 'Настройки']];
  tabs.forEach(([icon, label, on], i) => {
    const x = (SW / 4) * (i + 0.5);
    drawIcon(ctx, icon, x - 12, 530, 24, on ? C.accent : C.muted);
    text(ctx, label, x, 565, { weight: 500, size: 10, color: on ? C.accent : C.muted, align: 'center' });
  });
  return toTexture(c);
}

function paintCall(scale) {
  const [c, ctx] = frame(scale);
  font(ctx, 500, 12);
  const pw = ctx.measureText('Вы показываете экран').width + 48;
  const px0 = (SW - pw) / 2;
  roundRectPath(ctx, px0, 52, pw, 28, 14);
  ctx.fillStyle = 'rgba(123,99,255,0.18)';
  ctx.fill();
  drawIcon(ctx, 'screencast', px0 + 14, 58, 16, C.accent);
  text(ctx, 'Вы показываете экран', px0 + 36, 66.5, { weight: 500, size: 12, color: C.accent });
  avatar(ctx, SW / 2, 200, 58, 'А', AVATAR[3]);
  text(ctx, 'Алексей', SW / 2, 288, { weight: 600, size: 24, align: 'center' });
  ctx.font = `500 15px ui-monospace, monospace`;
  text(ctx, '04:12', SW / 2, 316, { size: 15, color: C.muted, align: 'center' });
  const btns = [['micOff', 'Микрофон'], ['videoFill', 'Камера'], ['screencast', 'Экран', true], ['speaker', 'Динамик']];
  btns.forEach(([icon, label, on], i) => {
    const x = 40 + i * 64;
    ctx.fillStyle = on ? C.accent : C.surf2;
    ctx.beginPath();
    ctx.arc(x, 426, 26, 0, Math.PI * 2);
    ctx.fill();
    drawIcon(ctx, icon, x - 12, 414, 24, '#fff');
    text(ctx, label, x, 466, { size: 11, color: C.muted, align: 'center' });
  });
  ctx.fillStyle = C.red;
  ctx.beginPath();
  ctx.arc(SW / 2, 524, 30, 0, Math.PI * 2);
  ctx.fill();
  drawIcon(ctx, 'hangup', SW / 2 - 14, 510, 28, '#fff');
  return toTexture(c);
}

function post(ctx, y, title, body, views, time) {
  font(ctx, 400, 13.5);
  const lines = wrap(ctx, body, 212);
  const h = 44 + lines.length * 18 + 22;
  roundRectPath(ctx, 12, y, SW - 24, h, [16, 16, 16, 5]);
  ctx.fillStyle = C.them;
  ctx.fill();
  text(ctx, title, 24, y + 22, { weight: 600, size: 14.5, max: SW - 48 });
  lines.forEach((l, i) => text(ctx, l, 24, y + 44 + i * 18, { size: 13.5, color: '#d8d8de' }));
  drawIcon(ctx, 'eye', SW - 104, y + h - 19, 14, C.muted);
  text(ctx, views, SW - 86, y + h - 12, { size: 11, color: C.muted });
  text(ctx, time, SW - 24, y + h - 12, { size: 11, color: C.muted, align: 'right' });
  return y + h + 10;
}

function paintChannel(scale) {
  const [c, ctx] = frame(scale);
  drawIcon(ctx, 'back', 8, 54, 24, C.accent);
  avatar(ctx, 54, 68, 17, 'ДК', AVATAR[4]);
  text(ctx, 'Дизайн и код', 80, 61, { weight: 600, size: 15 });
  text(ctx, '3 240 подписчиков', 80, 78, { size: 12, color: C.muted });
  drawIcon(ctx, 'dots', SW - 34, 58, 20, C.accent);
  ctx.fillStyle = C.sep;
  ctx.fillRect(0, 96, SW, 1);
  let y = 110;
  y = post(ctx, y, 'Сетка 8pt: зачем и как', 'Почему отступы, кратные восьми, упрощают вёрстку интерфейсов.', '1,2K', '10:24');
  y = post(ctx, y, 'Шрифты с кириллицей', 'Onest, Golos и Manrope — что выбрать для интерфейса.', '980', '12:05');
  const ph = 132;
  roundRectPath(ctx, 12, y, SW - 24, ph, [16, 16, 16, 5]);
  ctx.fillStyle = C.them;
  ctx.fill();
  text(ctx, 'Опрос: в чём вы рисуете?', 24, y + 22, { weight: 600, size: 14.5 });
  [['Figma', 0.64], ['Penpot', 0.21], ['Другое', 0.15]].forEach(([label, v], i) => {
    const by = y + 44 + i * 27;
    roundRectPath(ctx, 24, by, SW - 48, 20, 6);
    ctx.fillStyle = C.surf2;
    ctx.fill();
    roundRectPath(ctx, 24, by, (SW - 48) * v, 20, 6);
    ctx.fillStyle = i === 0 ? 'rgba(123,99,255,0.55)' : 'rgba(255,255,255,0.14)';
    ctx.fill();
    text(ctx, label, 32, by + 10.5, { weight: 500, size: 12 });
    text(ctx, `${Math.round(v * 100)}%`, SW - 32, by + 10.5, { weight: 600, size: 12, align: 'right' });
  });
  ctx.fillStyle = C.surf;
  ctx.fillRect(0, 524, SW, 56);
  ctx.fillStyle = C.sep;
  ctx.fillRect(0, 524, SW, 1);
  drawIcon(ctx, 'bellOff', SW / 2 - 70, 540, 18, C.accent);
  text(ctx, 'Выключить звук', SW / 2 + 10, 549.5, { weight: 500, size: 14, color: C.accent, align: 'center' });
  return toTexture(c);
}

function group(ctx, y, label, rows) {
  text(ctx, label, 28, y, { weight: 500, size: 11, color: C.muted });
  const top = y + 12;
  roundRectPath(ctx, 12, top, SW - 24, rows.length * 54, 12);
  ctx.fillStyle = C.surf;
  ctx.fill();
  rows.forEach((r, i) => {
    const ry = top + i * 54;
    ctx.fillStyle = r.tint || C.surf2;
    roundRectPath(ctx, 24, ry + 13, 28, 28, 8);
    ctx.fill();
    drawIcon(ctx, r.icon, 29, ry + 18, 18, '#fff');
    text(ctx, r.title, 64, r.sub ? ry + 20 : ry + 27.5, { weight: 500, size: r.toggle ? 13.5 : 14, max: r.toggle ? 128 : 170 });
    if (r.sub) {
      if (r.online) {
        ctx.fillStyle = C.green;
        ctx.beginPath();
        ctx.arc(67, ry + 38, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      text(ctx, r.sub, r.online ? 75 : 64, ry + 38, { size: 12, color: C.muted, max: 170 });
    }
    if (r.toggle) {
      roundRectPath(ctx, SW - 70, ry + 13, 46, 28, 14);
      ctx.fillStyle = C.green;
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(SW - 38, ry + 27, 12, 0, Math.PI * 2);
      ctx.fill();
    } else if (r.chevron) drawIcon(ctx, 'chevron', SW - 38, ry + 20, 14, C.muted);
    if (i < rows.length - 1) {
      ctx.fillStyle = C.sep;
      ctx.fillRect(64, ry + 54, SW - 76, 1);
    }
  });
  return top + rows.length * 54 + 26;
}

function paintDevices(scale) {
  const [c, ctx] = frame(scale);
  drawIcon(ctx, 'back', 8, 54, 24, C.accent);
  text(ctx, 'Устройства', SW / 2, 66, { weight: 600, size: 16, align: 'center' });
  let y = 116;
  y = group(ctx, y, 'ЭТО УСТРОЙСТВО', [{ icon: 'mobile', title: 'iPhone 18 Pro', sub: 'Москва · в сети', online: true, tint: C.accent }]);
  y = group(ctx, y, 'АКТИВНЫЕ СЕАНСЫ', [
    { icon: 'desktop', title: 'Windows · приложение', sub: 'Сегодня, 14:20', tint: '#3b82f6', chevron: true },
    { icon: 'android', title: 'Android · RuStore', sub: 'Вчера, 21:05', tint: '#22a35a', chevron: true },
    { icon: 'globe', title: 'Браузер · веб-версия', sub: '3 дня назад', tint: '#8e8f99', chevron: true },
  ]);
  group(ctx, y, 'БЕЗОПАСНОСТЬ', [
    { icon: 'lock', title: 'Код-пароль', toggle: true, tint: '#ff9f0a' },
    { icon: 'shield', title: 'Облачный пароль', toggle: true, tint: '#30b0c7' },
  ]);
  return toTexture(c);
}

export const SCREENS = [paintChats, (s) => paintChat(s, { bubbles: true }), paintCall, paintChannel, paintDevices];
