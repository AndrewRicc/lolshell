import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const DEV = 'http://127.0.0.1:1420';
const BRIDGE = 'http://127.0.0.1:5757';

// Browser-only development: without Tauri the UI reaches the client through bridge.mjs.
// The bridge accepts only its own origin, so our own page's Origin is rewritten and any
// other site's is passed through untouched (and refused there).
const toBridge = {
  target: BRIDGE,
  changeOrigin: true,
  configure: (proxy) => proxy.on('proxyReq', (out, req) => {
    if (req.headers.origin === DEV) out.setHeader('origin', BRIDGE);
  }),
};

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    host: '127.0.0.1', port: 1420, strictPort: true,
    proxy: { '/lcu': toBridge, '/events': toBridge },
    watch: { ignored: ['**/src-tauri/**'] }, // Rust build output is locked while the app runs
  },
});
