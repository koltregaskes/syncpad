# Setup

## Requirements

- Windows
- Node.js
- npm

## Install

```powershell
npm.cmd install
```

## Run The Desktop App

```powershell
npm.cmd start
```

This starts the Electron app using the saved SyncPad config.

If the app is in:

- `Host` mode, it starts the private server and the desktop app
- `Client` mode, it opens the desktop app and connects to the saved host

Fresh installs default to `Client` mode.

## Run The Private Web App Only

```powershell
npm.cmd run serve
```

That keeps SyncPad browser-based and uses the saved SyncPad config by default.

## Start The Always-On Host

```cmd
start-host.cmd
```

That starts the SyncPad host server using the saved config file, which is the simplest setup for your always-on host machine.

## Run Over Tailscale

To make SyncPad available on your own devices over Tailscale:

```powershell
$env:SYNC_PAD_HOST="100.119.231.37"
$env:SYNC_PAD_PORT="3210"
npm.cmd start
```

Or on Windows Command Prompt:

```cmd
start-tailscale.cmd
```

Then open:

`http://100.119.231.37:3210/`

from your other Windows machine or iPad while the app stays running.

## Build The Windows App

```powershell
npm.cmd run dist:win
```

This now produces:

- `dist\SyncPad-0.3.0-installer-x64.exe`
- `dist\SyncPad-0.3.0-portable-x64.exe`

## Verify

```powershell
npm.cmd run check
npm.cmd run smoke-store
npm.cmd run smoke-server
```

## Local Data

By default, SyncPad stores notes in:

`C:\Users\<you>\AppData\Local\MyData\SyncPad\notes.json`

You can override the base directory with:

`MYDATA_DIR`

## Hosting Rule

- `127.0.0.1` for one machine only
- `100.x.x.x` Tailscale IP for your own devices
- no `0.0.0.0` required
