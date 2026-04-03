# SyncPad

`SyncPad` is a local-first notes app that now works in two ways:

- a desktop Electron shell for your main Windows machine
- a private web app that can sync live across your own devices over Tailscale
- a Windows installer and portable app build for easier client setup

The goal is straightforward: something that feels as quick and lightweight as Notepad, but stays in sync across your own machines without pushing your notes onto the public web.

## Product Idea

- Local-first notes that stay fast even on one machine
- Private live sync when you choose to expose the app on your own tailnet
- A simple browser client that also works well on iPad
- Markdown-friendly writing with preview, not heavy document tooling
- Simple enough to leave open all day

## Intended User Experience

- Open the app and start typing immediately
- Notes autosave into a local JSON store
- The desktop app and the browser client talk to the same private note server
- Changes appear on connected devices almost immediately through live updates
- No account system or public cloud is required
- Host and client setup is saved in a local config file so you do not need to keep re-entering addresses

## First Version Scope

- Plain text and markdown notes
- Note list, search, duplicate, delete, and autosave
- Markdown preview with edit, split, and preview modes
- Find and replace inside the current note
- Word wrap and zoom controls
- Live sync status indicator
- Conflict-safe saves that keep your local edit as a conflict copy if another device changed the same note first

## Likely Technical Direction

The app now works as:

- Windows desktop app through Electron
- Standalone private web app through the built-in Node server
- Local JSON storage under `LOCALAPPDATA\MyData\SyncPad`
- Live update channel using Server-Sent Events
- Optional private access over a Tailscale IP instead of `127.0.0.1`

## Non-Goals For The First Version

- Public internet exposure
- Multi-user collaboration
- Rich document layout or office-style formatting
- Complex workspace/project management
- Feature bloat

## Current Status

- Desktop Electron shell is working
- Private web client is working
- Local note storage works through a JSON store under `LOCALAPPDATA\MyData\SyncPad`
- Note list, search, create, duplicate, delete, autosave, export, and import are implemented
- Markdown preview, find/replace, wrap toggle, zoom controls, and live word/character counts are implemented
- Private live sync works when the app is hosted on `127.0.0.1` for one machine or on your Tailscale IP for your own devices
- A saved host/client setup screen is built into the desktop app
- Windows packaging now produces an installer and a portable app build

## Next Steps

1. Add richer note history and recovery tools
2. Improve same-note conflict handling further if needed
3. Add optional pinned notes or tabs if the day-to-day workflow wants them
4. Add optional direct file import or export beyond JSON backup
5. Keep polishing the private-network hosting workflow

## Positioning

SyncPad is meant to be the simplest possible answer to:

"I want my notes to feel local and instant, but I also want them available on all my own machines."

## Current Sync Model

`SyncPad` is now live-sync, but it is not a Google Docs-style collaborative editor.

- One running SyncPad instance hosts the note store
- Other devices connect to that private server
- Changes refresh almost immediately
- If two devices change the same note at the same time, SyncPad keeps your local edit as a `conflict copy` instead of silently overwriting it

That keeps your work safe while staying lightweight.

## Private Network Use

For one machine only:

- run on `127.0.0.1`

For your own devices over Tailscale:

- run on your Tailscale IP such as `100.119.231.37`
- open `http://100.119.231.37:3210/` on the other device

No `0.0.0.0` setup is required.

## Host Machine Workflow

This always-on machine should stay in `Host` mode.

- The saved config lives at `LOCALAPPDATA\MyData\SyncPad\config.json`
- `start-host.cmd` starts the private host server using the saved config
- The desktop app now includes a `Settings` button and a simple app menu so you can switch between `Host this library` and `Connect to a host`
- The host address can be copied straight from the app

## Client Machine Workflow

The easiest client setup path now is:

1. Install the Windows build on the other machine
2. Open `Settings`
3. Choose `Connect to a host`
4. Use `http://100.119.231.37:3210/`
5. Save and reopen if needed

After that, the other machine behaves like a dedicated SyncPad client.

Fresh installs now default to `Client` mode, which is the safer setup for every machine except the always-on host.

## Repo Layout

- `src/main.js` - Electron main process and embedded private server bootstrap
- `src/server.js` - private note server and live update endpoints
- `src/preload.js` - safe renderer bridge
- `src/store.js` - local note storage
- `src/renderer/` - browser and desktop UI
- `scripts/smoke-store.js` - quick storage smoke test
- `scripts/smoke-server.js` - private server smoke test
- `start-tailscale.cmd` - starts SyncPad on your current Tailscale IP
- `start-host.cmd` - starts the SyncPad host server using the saved config
- `SETUP.md` - install and run notes
- `ARCHITECTURE.md` - storage and app shape
