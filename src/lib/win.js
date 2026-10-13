// Window behaviour of the desktop app. Every call is a no-op in a plain browser.
import { getCurrentWindow } from '@tauri-apps/api/window';

const tauri = '__TAURI_INTERNALS__' in window;

const safe = (fn) => async () => {
  if (!tauri) return;
  try { await fn(getCurrentWindow()); } catch (e) { console.warn(e); }
};

export const summon = safe(async (w) => {
  await w.show();
  await w.unminimize();
  await w.setFocus();
});

export const hide = safe((w) => w.hide());
export const minimize = safe((w) => w.minimize());
export const close = safe((w) => w.close());
export const desktop = tauri;

export function chime() {
  try {
    const a = new AudioContext();
    [660, 880].forEach((f, i) => {
      const o = a.createOscillator(), g = a.createGain();
      const t = a.currentTime + i * 0.18;
      o.frequency.value = f;
      o.connect(g).connect(a.destination);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      o.start(t);
      o.stop(t + 0.45);
    });
  } catch { /* no audio device or autoplay blocked: the window still comes forward */ }
}
