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
- **Champion select**: both teams, bans, turn timer, searchable champion grid, lock in, summoner
  spells, rune pages (pick one, edit it or build a new one, starting from the client's recommended
  pages); in ARAM the bench, rerolls and champion swaps with teammates.
- **Friends**: the full list with presence, invites to your party, friend requests in and out.
- **Chat**: party chat and private conversations, with unread counts.
- **Motion**: short animations (pick and ban moments, match found, queue, panels) built on
  [anime.js](https://animejs.com); with reduced motion requested in the system they are all off.
- **Window**: fixed 1280x720, frameless, with a tray icon.

Skins, post-game, store, loot and TFT are not implemented: Riot's interface covers them.
Champion select has been through custom draft games (ban, pick, lock in, quit); ARAM bench,
rerolls, swaps and rune saving have only been exercised against simulated sessions so far.

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
lolshell window (React + TypeScript)
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
- Connections to the client trust only Riot's root certificate (`src-tauri/riotgames.pem`), in the
  app and in `bridge.mjs`; the host name is not checked, since only `127.0.0.1` is ever dialled.

The client's API is undocumented and can change with any patch. `api/help-full.json` is the
client's own description of it (patch 16.20), saved from the `/help` endpoint.

## Project layout

| Path | What it is |
| --- | --- |
| `src/App.tsx` | The frame: which parts are on screen at each stage (styles in `src/shell.css`) |
| `src/components/` | One `.tsx` per part, with its own `.css` whose rules all start from the part's root: `Account`, `Status`, `Party`, `ModePicker`, `Friends`, `Chat`, `Bar`, and for champion select `Select`, `Team`, `ChampGrid`, `Spells`; `Backdrop` is the crossfading background and `Badge` the unread count |
| `src/app.css` | Design tokens, element defaults and the few styles several parts share; the rest lives in each component |
| `src/lib/client.ts` | Live client state and every action the interface can take; the state is a [valtio](https://valtio.dev) proxy, mutated in place by client events and read by components through a hook |
| `src/lib/view.ts` | What several parts need to know, worked out once (stage, party, seats) |
| `src/lib/motion.ts` | The animation helpers on top of anime.js; each one does nothing when reduced motion is on |
| `src/lib/moments.ts` | Spots picks, bans and lock-ins by comparing two champion select sessions, so the interface can animate them |
| `src/lib/lcu.ts` | Transport: Tauri inside the app, `bridge.mjs` in a browser |
| `src/lib/usage.ts` | Turns match history into proposed queue and roles |
| `src/lib/win.ts` | Window behaviour (tray, minimize, focus) and the match-found sound |
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
