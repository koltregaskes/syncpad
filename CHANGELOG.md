# Changelog

## 0.1.0

- Created the first Electron desktop scaffold
- Added a local JSON-backed notes store
- Added note list, search, create, delete, and autosave
- Added setup and architecture docs

## 0.2.0

- Added note duplication and last-open-note restore
- Added desktop shortcuts for new, duplicate, and save
- Added backup export and import inside the app
- Added live word and character counts in the editor footer
- Disabled hardware acceleration to avoid Electron GPU launch crashes on this Windows setup

## 0.3.0

- Added a private HTTP server and browser client for live SyncPad access
- Added live note refresh over Server-Sent Events
- Added markdown preview with edit, split, and preview modes
- Added find and replace tools
- Added word wrap and zoom controls
- Added Tailscale-friendly hosting support
- Added conflict-safe saves that preserve local edits as conflict copies
- Added server smoke testing and a Tailscale launch helper
- Added saved host/client app configuration
- Added a settings panel and desktop app menu for setup
- Added Windows installer and portable build output

## 0.3.1

- Added a first-run setup guide so each machine can quickly choose host or client mode
- Added a reusable quick setup entry in the desktop app menu
- Saved a `setupComplete` flag in local app config so new installs behave more clearly
- Updated the docs to reflect the guided setup flow
