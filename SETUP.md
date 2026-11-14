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
The in-app setup now highlights the shareable address and warns if the machine is still local-only on `127.0.0.1`.

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
$env:SYNC_PAD_HOST="YOUR-TAILSCALE-IP"
$env:SYNC_PAD_PORT="3210"
npm.cmd start
```

Or on Windows Command Prompt:

```cmd
start-tailscale.cmd
```

Then open:

`http://YOUR-TAILSCALE-IP:3210/`

from your other Windows machine or iPad while the app stays running.

## Build The Windows App

```powershell
npm.cmd run dist:win
```

This now produces:

- `dist\SyncPad-0.3.1-installer-x64.exe`
- `dist\SyncPad-0.3.1-portable-x64.exe`

If Windows leaves `win-unpacked` locked after packaging, run:

```cmd
scripts\cleanup-packaging-lock-on-reboot.cmd
```

Then reboot and sign in once to let Windows clear the folder automatically.

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

Inside `Settings`, the share address is the one to copy to your other devices. If it still shows `127.0.0.1`, you are still in one-machine-only mode.
