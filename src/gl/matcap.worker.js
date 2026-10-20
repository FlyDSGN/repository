import { renderMatcap } from './matcap-core.js';

self.onmessage = (e) => {
  const { id, jobs } = e.data;
  const result = jobs.map((j) => ({ name: j.name, size: j.size, data: renderMatcap(j) }));
  self.postMessage({ id, result }, result.map((r) => r.data.buffer));
};
