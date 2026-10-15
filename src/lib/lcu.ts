// One door to the League client's local API. Inside the desktop app it goes through the Rust
// side; in a plain browser (npm run dev) it goes through bridge.mjs.
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

const tauri = '__TAURI_INTERNALS__' in window;

type Reply = { status: number; body: string };

async function raw(method: string, path: string, body?: unknown): Promise<Reply> {
  if (tauri) return invoke<Reply>('lcu', { method, path, body: body === undefined ? null : JSON.stringify(body) });
  const r = await fetch('/lcu' + path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: await r.text() };
}

// The client's replies are untyped JSON: the one place `any` is allowed in, callers give it a shape.
export async function lcu(method: string, path: string, body?: unknown): Promise<any> {
  const r = await raw(method, path, body);
  let data: any = null;
  try { data = r.body ? JSON.parse(r.body) : null; } catch { /* not JSON */ }
  if (r.status >= 400) {
    throw Object.assign(new Error(data?.message || `Il client ha risposto ${r.status}`), { status: r.status });
  }
  return data;
}

// Images served by the client itself (splash art, profile icons): never downloaded or bundled.
export const asset = (path: string) => (tauri ? 'http://lcu.localhost' : '/lcu') + path;

export type LcuEvent = { uri: string; eventType: string; data: any };

export function onEvent(cb: (e: LcuEvent) => void) {
  if (tauri) return listen<LcuEvent>('lcu', (e) => cb(e.payload));
  new EventSource('/events').onmessage = (m) => cb(JSON.parse(m.data));
}
