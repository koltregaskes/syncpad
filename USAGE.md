# Usage

## First Run

1. Start the app.
2. Open `Settings` if you want to switch between `Host this library` and `Connect to a host`.
3. Create a new note from the sidebar.
4. Type straight into the editor.
5. Watch autosave finish in the footer.
6. If you are using Tailscale hosting, open the same URL on another device and you should see the same note list update.
7. In `Settings`, use the highlighted share address for other devices. If it still shows `127.0.0.1`, that address is local-only.

## Main Actions

- Create notes
- Rename notes by editing the first line or note title
- Search notes from the sidebar
- Duplicate the current note when you want a quick variation
- Restore an earlier version from Earlier versions. The text you replace stays in that list
- Delete notes you no longer need
- Use `Find`, `Replace`, and `Replace all` inside the current note
- Switch between `Edit`, `Split`, and `Preview`
- Toggle word wrap on and off
- Zoom the editor text in and out
- Export a backup from the sidebar when you want a portable copy
- Import a backup to merge notes back into this machine
- Keep working locally even if no other device is connected
- Share the same live note space across your own machines by hosting SyncPad on your Tailscale IP
- Use the desktop app menu to copy the host address or reopen the settings panel

## Shortcuts

- `Ctrl/Cmd + N` creates a new note
- `Ctrl/Cmd + D` duplicates the current note
- `Ctrl/Cmd + S` saves immediately
- `Ctrl/Cmd + F` jumps to the find box
- `Ctrl/Cmd + -` zooms out
- `Ctrl/Cmd + 0` resets zoom

## Sync Notes Across Devices

1. Run SyncPad on the host machine with your Tailscale IP.
2. Leave that host running.
3. Open `http://YOUR-TAILSCALE-IP:3210/` on the other device.
4. Edit on one device and the others will refresh almost immediately.

## Install On Another Windows Machine

1. Use the installer or portable app built from `dist`.
2. Open SyncPad.
3. It should already open in `Connect to a host` mode by default.
4. If needed, go to `Settings`.
5. Confirm the host address is your real SyncPad host URL, for example `http://YOUR-TAILSCALE-IP:3210/`.
6. Save and start using the shared note library.

`Settings` now warns if a client machine is still pointing at `localhost`, which helps avoid thinking another PC can connect when the address is actually local-only.

## Current Limitations

- Sync is private live hosting, not peer-to-peer magic
- One device must host the note server
- Same-note simultaneous editing is protected with conflict copies, not character-by-character collaborative merging
- History keeps the last 20 saves of a note. Restore still refuses to overwrite a copy that changed on another device
- Markdown is previewed cleanly, but this is still a writing tool rather than a rich page layout app
