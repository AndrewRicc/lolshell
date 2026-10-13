// One door to the League client's local API. Inside the desktop app it goes through the Rust
// side; in a plain browser (npm run dev) it goes through bridge.mjs.
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

const tauri = '__TAURI_INTERNALS__' in window;

async function raw(method, path, body) {
  if (tauri) return invoke('lcu', { method, path, body: body === undefined ? null : JSON.stringify(body) });
  const r = await fetch('/lcu' + path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: await r.text() };
}

export async function lcu(method, path, body) {
  const r = await raw(method, path, body);
  let data = null;
  try { data = r.body ? JSON.parse(r.body) : null; } catch { /* not JSON */ }
  if (r.status >= 400) {
    throw Object.assign(new Error(data?.message || `Il client ha risposto ${r.status}`), { status: r.status });
  }
  return data;
}

// Images served by the client itself (splash art, profile icons): never downloaded or bundled.
export const asset = (path) => (tauri ? 'http://lcu.localhost' : '/lcu') + path;

export function onEvent(cb) {
  if (tauri) return listen('lcu', (e) => cb(e.payload));
  new EventSource('/events').onmessage = (m) => cb(JSON.parse(m.data));
}
