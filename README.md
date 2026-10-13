# lolshell

An alternative interface for the League of Legends client on Windows.

Riot's client is two programs: a backend (`LeagueClient.exe`) that holds all the logic, and a
Chromium-based interface (`LeagueClientUx.exe`) that talks to it over a local API. lolshell is a
different interface for the same backend. It never injects into, patches or modifies Riot's
processes or files: it only calls the local API the client already exposes to its own interface.

Riot's interface can be switched off from lolshell to free its memory, and is switched back on
automatically for everything lolshell does not cover yet.

## Features

- **Lobby**: party members, kick and promote, leave.
- **Mode picker**: one card per map, ordered by how often you play it, using the client's own
  artwork. Queue and roles are proposed from your last 50 matches.
- **Custom games**: create a custom lobby in any mode the client offers, then start it.
- **Queue**: one click to create the lobby, set roles and start searching. Timer and estimated
  wait while in queue.
- **Match found**: the window comes forward with a sound. An auto-accept switch accepts for you.
- **Friends**: the full list with presence, invites to your party, friend requests in and out.
- **Chat**: party chat and private conversations, with unread counts.
- **Window**: fixed 1280x720, frameless, with a tray icon.

Champion select, post-game, store, loot and TFT are not implemented: when a game reaches champion
select, lolshell brings Riot's interface back.

## Requirements

- Windows 10 or 11 with League of Legends installed and started from the Riot Client
- [Node.js](https://nodejs.org/) 22 or newer
- [Rust](https://rustup.rs/) (stable, MSVC toolchain) with the Visual Studio C++ build tools
- WebView2 runtime (included in Windows 11)

## Running

```bash
npm install
npm run tauri dev
```

Start League first, or at any time afterwards: lolshell finds the running client by itself and
reconnects when the client restarts.

To build an installer:

```bash
npm run tauri build
```

## How it works

```
lolshell window (Svelte)
        |  invoke("lcu") / "lcu" events / lcu:// images
Rust side (src-tauri)
        |  HTTPS + WebSocket on 127.0.0.1, credentials from the lockfile
LeagueClient.exe
```

- The install folder is read from `%PROGRAMDATA%\Riot Games\RiotClientInstalls.json`; the
  `lockfile` in that folder gives the API port and a password that change at every start.
- Requests from the interface go through a single Rust command. Images (splash art, icons) are
  served by the client itself through a custom `lcu://` scheme: nothing from Riot is bundled.
- One WebSocket subscription relays every client event to the window, so the interface mirrors
  the client's state instead of keeping its own copy.

The client's API is undocumented and can change with any patch. `api/help-full.json` is the
client's own description of it (patch 16.20), saved from the `/help` endpoint.

## Project layout

| Path | What it is |
| --- | --- |
| `src/App.svelte`, `src/app.css` | The whole interface |
| `src/lib/client.svelte.js` | Live client state and every action the interface can take |
| `src/lib/lcu.js` | Transport: Tauri inside the app, `bridge.mjs` in a browser |
| `src/lib/usage.js` | Turns match history into proposed queue and roles |
| `src/lib/win.js` | Window behaviour (tray, minimize, focus) and the match-found sound |
| `src-tauri/src/lib.rs` | Lockfile discovery, request proxy, image scheme, event relay, tray |
| `bridge.mjs` | Development-only stand-in for the Rust side |

## Developing in a browser

The interface can run in a normal browser, which is faster to iterate on than the desktop window.
`bridge.mjs` does what the Rust side does, and only accepts requests from the dev page.

```bash
npm run bridge
npm run dev
```

Then open <http://127.0.0.1:1420>. If League is not installed in `D:\Riot Games\League of Legends`,
set `LOL_LOCKFILE` to the full path of the lockfile before starting the bridge.

## Tests

```bash
npm test
cd src-tauri && cargo test
```

`cargo test -- --include-ignored` also runs a test against a running, logged-in client.

## Known limits

- TLS verification is disabled for the client's self-signed certificate. Every request goes to
  `127.0.0.1`; Riot's root certificate should be pinned before anything else is called.
- The match-found progress bar assumes a 10 second window: the client only reports elapsed time.
- Switching team and adding bots in custom games are not supported yet.
- The app icon is a placeholder.

## Disclaimer

lolshell is a personal project. It isn't endorsed by Riot Games and doesn't reflect the views or
opinions of Riot Games or anyone officially involved in producing or managing Riot Games
properties. Riot Games, and all associated properties are trademarks or registered trademarks of
Riot Games, Inc.

Riot's position on third-party interfaces and on automations such as auto-accept has not been
checked for this project. Use it at your own risk.
