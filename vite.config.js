import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const PHOSPHOR = {
  windows: ['fill', 'windows-logo'],
  android: ['fill', 'android-logo'],
  apple: ['fill', 'apple-logo'],
  telegram: ['fill', 'telegram-logo'],
  github: ['fill', 'github-logo'],
  globe: ['regular', 'globe'],
  download: ['bold', 'download-simple'],
  external: ['bold', 'arrow-up-right'],
  chevron: ['bold', 'caret-down'],
  clock: ['regular', 'clock'],
  sun: ['regular', 'sun'],
  moon: ['regular', 'moon'],
  chats: ['regular', 'chats-circle'],
  mic: ['regular', 'microphone'],
  call: ['regular', 'phone-call'],
  megaphone: ['regular', 'megaphone'],
  devices: ['regular', 'devices'],
  arrow: ['bold', 'arrow-right'],
  hand: ['regular', 'hand-swipe-right'],
};
const SIMPLE = { huawei: 'huawei', vk: 'vk' };

const pkg = (p) => fileURLToPath(new URL(`./node_modules/${p}`, import.meta.url));

function symbol(id, svg) {
  const viewBox = svg.match(/viewBox="([^"]+)"/)[1];
  const inner = svg
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/<title>[\s\S]*?<\/title>/g, '')
    .replace(/<rect[^>]*fill="none"[^>]*\/>/g, '');
  return `<symbol id="i-${id}" viewBox="${viewBox}">${inner}</symbol>`;
}

function iconSprite() {
  const out = [];
  for (const [id, [weight, name]] of Object.entries(PHOSPHOR)) {
    const file = weight === 'regular' ? `${name}.svg` : `${name}-${weight}.svg`;
    out.push(symbol(id, readFileSync(pkg(`@phosphor-icons/core/assets/${weight}/${file}`), 'utf8')));
  }
  for (const [id, name] of Object.entries(SIMPLE)) {
    out.push(symbol(id, readFileSync(pkg(`simple-icons/icons/${name}.svg`), 'utf8')));
  }
  return out.join('');
}

export default defineConfig({
  plugins: [{
    name: 'icon-sprite',
    transformIndexHtml(html) {
      return html.replace('<svg id="sprite"></svg>', `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">${iconSprite()}</svg>`);
    },
  }],
  build: {
    chunkSizeWarningLimit: 700,
    assetsInlineLimit: 0,
  },
});
