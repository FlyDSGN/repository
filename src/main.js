import '@fontsource-variable/onest';
import '@fontsource-variable/unbounded';
import './style.css';
import { initUI } from './ui.js';

initUI();

// 3D грузим после первой отрисовки, чтобы страница была интерактивной сразу.
function start3D() {
  const saveData = navigator.connection && navigator.connection.saveData;
  if (saveData || new URLSearchParams(location.search).has('no3d')) return;
  import('./gl/index.js')
    .then((m) => m.boot())
    .catch((err) => console.warn('[3d] disabled:', err && err.message));
}

function whenIdle(fn) {
  if ('requestIdleCallback' in window) requestIdleCallback(fn, { timeout: 1200 });
  else setTimeout(fn, 200);
}

if (document.readyState === 'complete') whenIdle(start3D);
else addEventListener('load', () => whenIdle(start3D), { once: true });
