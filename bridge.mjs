// Development-only bridge: lets the UI run in a plain browser (npm run dev) without Tauri.
// The desktop app does the same job in src-tauri/src/lib.rs.
// Reads the lockfile, proxies /lcu/* to the client's local API and relays its events as SSE.
import http from 'node:http';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

// shortcut: TLS check off process-wide because the client uses a self-signed cert and we only
// ever call 127.0.0.1; pin Riot's root cert before adding any other outbound request.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const LOCKFILE = process.env.LOL_LOCKFILE ?? 'D:/Riot Games/League of Legends/lockfile';
const PORT = 5757;
const SELF = `127.0.0.1:${PORT}`;

// Re-read on every use: port and password change each time the client restarts.
function lcu() {
  const [, , port, pass] = readFileSync(LOCKFILE, 'utf8').split(':');
  return { port, auth: 'Basic ' + Buffer.from(`riot:${pass}`).toString('base64') };
}

// The bridge gives full control of the account's client, and any web page open in a browser
// can send requests to localhost: accept only our own page.
const allowed = (host, origin) => host === SELF && (!origin || origin === `http://${SELF}`);

if (process.argv.includes('--selftest')) {
  assert(allowed(SELF, undefined) && allowed(SELF, `http://${SELF}`));
  assert(!allowed(SELF, 'https://evil.example') && !allowed('evil.example', undefined));
  console.log('ok');
  process.exit(0);
}

// The client stops accepting connections after a couple of hundred: a champion grid asks for every
// icon at once, so requests wait for one of a few slots, as in src-tauri/src/lib.rs.
let free = 6;
const waiting = [];
const slot = () => (free > 0 ? (free--, Promise.resolve()) : new Promise((r) => waiting.push(r)));
const release = () => (waiting.length ? waiting.shift()() : free++);

const clients = new Set();
const emit = (ev) => { for (const c of clients) c.write(`data: ${JSON.stringify(ev)}\n\n`); };

function connect() {
  let ws;
  try {
    const { port, auth } = lcu();
    ws = new WebSocket(`wss://127.0.0.1:${port}/`, { protocols: 'wamp', headers: { Authorization: auth } });
  } catch {
    return setTimeout(connect, 2000); // client not running yet
  }
  ws.onopen = () => { ws.send('[5,"OnJsonApiEvent"]'); emit({ uri: '/bridge', data: 'connected' }); };
  ws.onmessage = (e) => { if (e.data) emit(JSON.parse(e.data)[2]); };
  ws.onclose = () => { emit({ uri: '/bridge', data: 'disconnected' }); setTimeout(connect, 2000); };
}
connect();

http.createServer(async (req, res) => {
  if (!allowed(req.headers.host, req.headers.origin)) return res.writeHead(403).end();

  if (req.url === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    clients.add(res);
    return req.on('close', () => clients.delete(res));
  }
  if (req.url.startsWith('/lcu/')) {
    await slot();
    try {
      const { port, auth } = lcu();
      const body = ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(await req.toArray());
      const r = await fetch(`https://127.0.0.1:${port}${req.url.slice(4)}`, {
        method: req.method, body, headers: { Authorization: auth, 'Content-Type': 'application/json' },
      });
      return res.writeHead(r.status, { 'Content-Type': r.headers.get('content-type') ?? 'application/json' })
        .end(Buffer.from(await r.arrayBuffer()));
    } catch (e) {
      return res.writeHead(502, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: String(e.cause?.code ?? e.code ?? e.message) }));
    } finally {
      release();
    }
  }
  res.writeHead(404).end();
}).listen(PORT, '127.0.0.1', () => console.log(`http://${SELF}`));
