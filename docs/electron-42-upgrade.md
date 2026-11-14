# Electron 42 upgrade validation

Tracks rooms-os-hub#427/#1541. PR #17 supersedes closed Dependabot PR #14.
Read Electron 40/41/42 breaking changes:
https://www.electronjs.org/docs/latest/breaking-changes

No affected app API found: clipboard already stays in main through IPC; the app
does not use PDF guest WebContents, offscreen painting or storage quotas.
Electron 42 downloads binaries on first use rather than npm postinstall.
Declared its Node >=22.12 floor. Kept the original isolated preload and renderer
nodeIntegration:false. No product code change required beyond current main.

Gaming-Laptop, Node 26.13.1, 14 November 2026:
- npm ci and syntax check pass.
- Store/history/restore and HTTP server smoke tests pass on synthetic data.
- electron-builder --dir produces dist/win-unpacked/SyncPad.exe.
- Real Electron 42.11.16 hidden-window smoke: IPC create/save/reload persists,
  contextIsolation true, nodeIntegration false, zero page errors.
- Smoke test uses a temporary MYDATA_DIR and Electron profile. No user notes,
  installed SyncPad profile or external network sync touched.

Node 22 Windows CI repeats checks, runtime smoke and unpacked packaging.
No installer was installed or signed; independent review remains required.

Runtime smoke terminates its own test process after assertions; graceful app
shutdown is not covered (Playwright app.close did not settle in this host).
