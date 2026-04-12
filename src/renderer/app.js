const state = {
  notes: [],
  filteredNotes: [],
  activeNoteId: null,
  saveTimer: null,
  activeMode: "split",
  syncSource: null,
  isDirty: false,
  pendingRemoteRefresh: false,
  syncLabel: "Local-only server",
  serverTone: "local",
  wordWrap: true,
  zoomLevel: 1,
  appStatus: null,
  config: null
};

const syncPadDesktop = window.syncPad || null;

const elements = {
  notesList: document.getElementById("notes-list"),
  searchInput: document.getElementById("search-input"),
  newNoteButton: document.getElementById("new-note-button"),
  settingsButton: document.getElementById("settings-button"),
  exportBackupButton: document.getElementById("export-backup-button"),
  importBackupButton: document.getElementById("import-backup-button"),
  importBackupInput: document.getElementById("import-backup-input"),
  duplicateNoteButton: document.getElementById("duplicate-note-button"),
  deleteNoteButton: document.getElementById("delete-note-button"),
  findInput: document.getElementById("find-input"),
  replaceInput: document.getElementById("replace-input"),
  findNextButton: document.getElementById("find-next-button"),
  replaceButton: document.getElementById("replace-button"),
  replaceAllButton: document.getElementById("replace-all-button"),
  wrapToggleButton: document.getElementById("wrap-toggle-button"),
  zoomOutButton: document.getElementById("zoom-out-button"),
  zoomResetButton: document.getElementById("zoom-reset-button"),
  zoomInButton: document.getElementById("zoom-in-button"),
  titleInput: document.getElementById("title-input"),
  contentInput: document.getElementById("content-input"),
  previewPanel: document.getElementById("preview-panel"),
  editorHeading: document.getElementById("editor-heading"),
  saveState: document.getElementById("save-state"),
  noteStats: document.getElementById("note-stats"),
  caretPosition: document.getElementById("caret-position"),
  zoomLabel: document.getElementById("zoom-label"),
  syncStatus: document.getElementById("sync-status"),
  runtimeShell: document.getElementById("runtime-shell"),
  runtimeMode: document.getElementById("runtime-mode"),
  runtimeAccess: document.getElementById("runtime-access"),
  runtimeStorage: document.getElementById("runtime-storage"),
  runtimeConfig: document.getElementById("runtime-config"),
  copyVerificationButton: document.getElementById("copy-verification-button"),
  editorShell: document.getElementById("editor-shell"),
  modeButtons: Array.from(document.querySelectorAll("[data-mode]")),
  settingsModal: document.getElementById("settings-modal"),
  settingsBackdrop: document.getElementById("settings-backdrop"),
  settingsCloseButton: document.getElementById("settings-close-button"),
  settingsMode: document.getElementById("settings-mode"),
  settingsHost: document.getElementById("settings-host"),
  settingsPort: document.getElementById("settings-port"),
  settingsRemoteOrigin: document.getElementById("settings-remote-origin"),
  settingsModeBadge: document.getElementById("settings-mode-badge"),
  settingsSummaryText: document.getElementById("settings-summary-text"),
  settingsConfigFile: document.getElementById("settings-config-file"),
  settingsAccessLabel: document.getElementById("settings-access-label"),
  settingsAccessUrl: document.getElementById("settings-access-url"),
  settingsWarning: document.getElementById("settings-warning"),
  settingsChecklist: document.getElementById("settings-checklist"),
  settingsCopyButton: document.getElementById("settings-copy-button"),
  settingsOpenButton: document.getElementById("settings-open-button"),
  settingsSaveButton: document.getElementById("settings-save-button"),
  onboardingModal: document.getElementById("onboarding-modal"),
  onboardingBackdrop: document.getElementById("onboarding-backdrop"),
  onboardingCloseButton: document.getElementById("onboarding-close-button"),
  onboardingHostButton: document.getElementById("onboarding-host-button"),
  onboardingClientButton: document.getElementById("onboarding-client-button"),
  onboardingOpenSettingsButton: document.getElementById("onboarding-open-settings-button"),
  onboardingHostLabel: document.getElementById("onboarding-host-label"),
  onboardingAdvice: document.getElementById("onboarding-advice"),
  onboardingHostAddress: document.getElementById("onboarding-host-address")
};

const PREFERENCES_KEY = "syncpad:preferences";
const DEFAULT_LOCAL_HOST = "127.0.0.1";
const DEFAULT_PORT = 3210;
const EXAMPLE_TAILSCALE_HOST = "100.x.y.z";
const EXAMPLE_TAILSCALE_ORIGIN = `http://${EXAMPLE_TAILSCALE_HOST}:${DEFAULT_PORT}`;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function loadPreferences() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || "{}");
    state.wordWrap = parsed.wordWrap !== false;
    state.zoomLevel = clamp(Number(parsed.zoomLevel) || 1, 0.85, 1.7);
  } catch (_) {
    state.wordWrap = true;
    state.zoomLevel = 1;
  }
}

function savePreferences() {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify({
    wordWrap: state.wordWrap,
    zoomLevel: state.zoomLevel
  }));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatTimestamp(value) {
  if (!value) {
    return "No timestamp";
  }

  return new Date(value).toLocaleString();
}

function getActiveNote() {
  return state.notes.find((note) => note.id === state.activeNoteId) || null;
}

function buildOrigin(host, port) {
  return `http://${host}:${port}`;
}

function sanitizePort(value) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 65535) {
    return DEFAULT_PORT;
  }

  return numeric;
}

function isLoopbackHost(value) {
  const host = String(value || "").trim().toLowerCase();
  return host === "127.0.0.1" || host === "localhost" || host === "::1" || host === "[::1]";
}

function normalizeOriginInput(value, fallbackHost, fallbackPort) {
  const trimmed = String(value || "").trim();
  const candidate = trimmed
    ? (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`)
    : buildOrigin(fallbackHost, fallbackPort);

  try {
    const parsed = new URL(candidate);
    const port = parsed.port || String(fallbackPort);
    return `${parsed.protocol}//${parsed.hostname}${port ? `:${port}` : ""}`;
  } catch (_) {
    return candidate.replace(/\/+$/, "");
  }
}

function getHostFromOrigin(origin) {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch (_) {
    return "";
  }
}

function getEffectiveConfig() {
  const candidateHost = String(state.config?.host || state.appStatus?.bindHost || DEFAULT_LOCAL_HOST).trim();
  const host = candidateHost || DEFAULT_LOCAL_HOST;
  const port = sanitizePort(state.config?.port || state.appStatus?.bindPort || DEFAULT_PORT);
  const remoteOrigin = normalizeOriginInput(state.config?.remoteOrigin || state.appStatus?.remoteOrigin, host, port);

  return {
    host,
    port,
    remoteOrigin
  };
}

function getOnboardingAddress(config) {
  if (
    !state.config?.setupComplete &&
    config.host === DEFAULT_LOCAL_HOST &&
    config.remoteOrigin === buildOrigin(DEFAULT_LOCAL_HOST, config.port)
  ) {
    return `${EXAMPLE_TAILSCALE_ORIGIN}/`;
  }

  const trimmedOrigin = config.remoteOrigin.replace(/\/+$/, "");
  return `${trimmedOrigin}/`;
}

function getSettingsModel() {
  const mode = elements.settingsMode.value;
  const host = (elements.settingsHost.value || "").trim() || DEFAULT_LOCAL_HOST;
  const port = sanitizePort(elements.settingsPort.value || DEFAULT_PORT);
  const hostOrigin = buildOrigin(host, port);
  const remoteOrigin = normalizeOriginInput(elements.settingsRemoteOrigin.value, host, port);
  const remoteHost = getHostFromOrigin(remoteOrigin);
  const hostIsLoopback = isLoopbackHost(host);
  const remoteIsLoopback = isLoopbackHost(remoteHost);

  const checklist = mode === "host"
    ? [
        "Leave this machine running if other devices need the same live note library.",
        "Share the address below with your other Windows or Android devices over Tailscale.",
        "Only one machine should stay in Host mode for the same library."
      ]
    : [
        "Keep only the always-on machine in Host mode.",
        "Point this client at the host machine address you actually want to reach.",
        "If another device cannot connect, double-check that the host is running on its Tailscale IP."
      ];

  let warning = "";
  if (mode === "host" && hostIsLoopback) {
    warning = "127.0.0.1 only works on this machine. Switch the host bind IP to your Tailscale address if other devices need to connect.";
  } else if (mode === "client" && remoteIsLoopback) {
    warning = "This client address points to localhost. That only works if the host is running on the same machine.";
  }

  return {
    mode,
    host,
    port,
    remoteOrigin,
    accessUrl: mode === "host" ? hostOrigin : remoteOrigin,
    accessLabel: mode === "host" ? "Share this address with your other devices:" : "This machine will connect to:",
    modeBadge: mode === "host" ? "Host machine" : "Client machine",
    summaryText: mode === "host"
      ? "Host mode turns this machine into the always-on SyncPad library for your own devices."
      : "Client mode keeps this machine simple and only connects to the always-on host.",
    warning,
    checklist
  };
}

function updateOnboardingSummary() {
  const effectiveConfig = getEffectiveConfig();
  const accessAddress = getOnboardingAddress(effectiveConfig);
  const showSuggestedAddress = !state.config?.setupComplete && isLoopbackHost(effectiveConfig.host);

  elements.onboardingHostLabel.textContent = showSuggestedAddress
    ? "Suggested shared address once your host uses Tailscale:"
    : "Current host address:";
  elements.onboardingHostAddress.textContent = accessAddress;
  elements.onboardingAdvice.textContent = showSuggestedAddress
    ? "Right now SyncPad is still local-only. Pick Host mode only on the always-on machine, then open Settings and replace the bind IP with your Tailscale address if other devices should connect."
    : "You can change the address and other details later in Settings. This step just gives each machine a clean starting point.";
}

async function copyText(value) {
  if (syncPadDesktop?.copyText) {
    await syncPadDesktop.copyText(value);
    return;
  }

  const text = String(value || "");

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (_) {
      // Fall back to the classic selection-based copy path for browsers that
      // block clipboard permissions on private local pages.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "readonly");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error("Clipboard access was blocked by the browser.");
  }
}

async function openExternal(url) {
  if (syncPadDesktop?.openExternal) {
    await syncPadDesktop.openExternal(url);
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

async function apiFetch(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: response.statusText }));
    const error = new Error(payload.error || response.statusText || "Request failed");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function setEditorEnabled(enabled) {
  elements.titleInput.disabled = !enabled;
  elements.contentInput.disabled = !enabled;
  elements.duplicateNoteButton.disabled = !enabled;
  elements.deleteNoteButton.disabled = !enabled;
  elements.findInput.disabled = !enabled;
  elements.replaceInput.disabled = !enabled;
  elements.findNextButton.disabled = !enabled;
  elements.replaceButton.disabled = !enabled;
  elements.replaceAllButton.disabled = !enabled;
}

function updateSyncStatus(message, tone = "") {
  elements.syncStatus.textContent = message;
  elements.syncStatus.dataset.tone = tone;
}

function buildVerificationSnapshot() {
  const config = state.config || {};
  const appStatus = state.appStatus || {};
  const hostMode = config.mode === "host";
  const runtimeLabel = syncPadDesktop ? "Electron desktop shell" : "Browser client";
  const accessOrigin = syncPadDesktop
    ? (appStatus.origin || buildOrigin(config.host || DEFAULT_LOCAL_HOST, config.port || DEFAULT_PORT))
    : (appStatus.origin || config.remoteOrigin || "");
  const storageFile = appStatus.storageFile || "No storage path available";
  const configFile = config.configFile || appStatus.configFile || "No config file available";
  const setupState = appStatus.setupComplete === false ? "Setup incomplete" : "Setup complete";

  return {
    runtimeLabel,
    modeLabel: hostMode ? "Host mode" : "Client mode",
    accessLabel: accessOrigin || "No access address available",
    storageLabel: storageFile,
    configLabel: configFile,
    setupLabel: setupState
  };
}

function renderVerificationSnapshot() {
  if (!elements.runtimeShell) {
    return;
  }

  const snapshot = buildVerificationSnapshot();
  elements.runtimeShell.textContent = snapshot.runtimeLabel;
  elements.runtimeMode.textContent = snapshot.modeLabel;
  elements.runtimeAccess.textContent = snapshot.accessLabel;
  elements.runtimeStorage.textContent = snapshot.storageLabel;
  elements.runtimeConfig.textContent = snapshot.configLabel;
}

async function copyVerificationSnapshot() {
  const snapshot = buildVerificationSnapshot();
  const lines = [
    `Runtime: ${snapshot.runtimeLabel}`,
    `Mode: ${snapshot.modeLabel}`,
    `Access: ${snapshot.accessLabel}`,
    `Storage: ${snapshot.storageLabel}`,
    `Config: ${snapshot.configLabel}`,
    `State: ${snapshot.setupLabel}`
  ];

  await copyText(lines.join("\n"));
  if (elements.copyVerificationButton) {
    const originalLabel = elements.copyVerificationButton.textContent;
    elements.copyVerificationButton.textContent = "Copied";
    window.setTimeout(() => {
      elements.copyVerificationButton.textContent = originalLabel || "Copy verification";
    }, 1200);
  }
}

function updateNoteStats(content) {
  const trimmed = content.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const characters = content.length;
  elements.noteStats.textContent = `${words} word${words === 1 ? "" : "s"} | ${characters} character${characters === 1 ? "" : "s"}`;
}

function updateCaretPosition() {
  const value = elements.contentInput.value;
  const index = elements.contentInput.selectionStart || 0;
  const lines = value.slice(0, index).split("\n");
  const line = lines.length;
  const column = (lines[lines.length - 1] || "").length + 1;
  elements.caretPosition.textContent = `Ln ${line}, Col ${column}`;
}

function applyEditorPreferences() {
  elements.contentInput.wrap = state.wordWrap ? "soft" : "off";
  elements.contentInput.classList.toggle("is-nowrap", !state.wordWrap);
  elements.wrapToggleButton.textContent = state.wordWrap ? "Wrap on" : "Wrap off";
  elements.editorShell.style.setProperty("--editor-scale", String(state.zoomLevel));
  elements.zoomLabel.textContent = `${Math.round(state.zoomLevel * 100)}%`;
  elements.zoomResetButton.textContent = `${Math.round(state.zoomLevel * 100)}%`;
}

function renderMarkdown(content) {
  const source = String(content || "");
  const lines = source.split(/\r?\n/);
  const html = [];
  let inList = false;
  let inCodeBlock = false;

  const closeListIfNeeded = () => {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  };

  const inline = (value) => escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith("```")) {
      closeListIfNeeded();
      if (!inCodeBlock) {
        html.push("<pre><code>");
        inCodeBlock = true;
      } else {
        html.push("</code></pre>");
        inCodeBlock = false;
      }
      continue;
    }

    if (inCodeBlock) {
      html.push(`${escapeHtml(rawLine)}\n`);
      continue;
    }

    const trimmed = line.trim();

    if (!trimmed) {
      closeListIfNeeded();
      html.push("");
      continue;
    }

    if (/^#{1,6}\s/.test(trimmed)) {
      closeListIfNeeded();
      const level = trimmed.match(/^#+/)[0].length;
      html.push(`<h${level}>${inline(trimmed.slice(level).trim())}</h${level}>`);
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }

      const item = trimmed.replace(/^[-*]\s+/, "");
      const checkbox = item.match(/^\[( |x)\]\s+/i);
      if (checkbox) {
        const checked = checkbox[1].toLowerCase() === "x";
        const text = item.replace(/^\[( |x)\]\s+/i, "");
        html.push(`<li class="markdown-check"><span>${checked ? "&#9745;" : "&#9744;"}</span><span>${inline(text)}</span></li>`);
      } else {
        html.push(`<li>${inline(item)}</li>`);
      }
      continue;
    }

    closeListIfNeeded();

    if (trimmed.startsWith(">")) {
      html.push(`<blockquote>${inline(trimmed.replace(/^>\s?/, ""))}</blockquote>`);
      continue;
    }

    html.push(`<p>${inline(trimmed)}</p>`);
  }

  closeListIfNeeded();

  if (inCodeBlock) {
    html.push("</code></pre>");
  }

  return html.join("\n") || "<p class=\"preview-empty\">Nothing to preview yet.</p>";
}

function renderPreview() {
  const note = getActiveNote();
  const content = note ? elements.contentInput.value : "";
  elements.previewPanel.innerHTML = renderMarkdown(content);
}

function setMode(mode) {
  state.activeMode = mode;
  elements.editorShell.dataset.mode = mode;

  for (const button of elements.modeButtons) {
    const isActive = button.dataset.mode === mode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
}

function renderNotes() {
  if (state.filteredNotes.length === 0) {
    elements.notesList.innerHTML = '<div class="empty-state">No matching notes yet.</div>';
    return;
  }

  elements.notesList.innerHTML = state.filteredNotes
    .map((note) => {
      const preview = (note.content || "Empty note").trim().slice(0, 90);
      const activeClass = note.id === state.activeNoteId ? " active" : "";

      return `
        <button class="note-item${activeClass}" data-note-id="${note.id}">
          <h3>${escapeHtml(note.title || "Untitled note")}</h3>
          <p>${escapeHtml(preview || "Empty note")}</p>
          <div class="note-meta">Updated ${escapeHtml(formatTimestamp(note.updatedAt))}</div>
        </button>
      `;
    })
    .join("");

  for (const button of elements.notesList.querySelectorAll("[data-note-id]")) {
    button.addEventListener("click", () => {
      selectNote(button.dataset.noteId).catch(console.error);
    });
  }
}

function renderEditor() {
  const note = getActiveNote();

  if (!note) {
    setEditorEnabled(false);
    elements.editorHeading.textContent = "Select or create a note";
    elements.titleInput.value = "";
    elements.contentInput.value = "";
    elements.saveState.textContent = "No note selected";
    updateNoteStats("");
    updateCaretPosition();
    renderPreview();
    return;
  }

  setEditorEnabled(true);
  elements.editorHeading.textContent = note.title || "Untitled note";
  elements.titleInput.value = note.title || "";
  elements.contentInput.value = note.content || "";
  elements.saveState.textContent = `Last saved ${formatTimestamp(note.updatedAt)}`;
  updateNoteStats(note.content || "");
  updateCaretPosition();
  renderPreview();
}

function applySearch() {
  const query = elements.searchInput.value.trim().toLowerCase();

  state.filteredNotes = state.notes.filter((note) => {
    if (!query) {
      return true;
    }

    return (
      note.title.toLowerCase().includes(query) ||
      note.content.toLowerCase().includes(query)
    );
  });

  renderNotes();
}

async function refreshNotes(preferredNoteId) {
  const payload = await apiFetch("/api/notes");
  state.notes = payload.notes || [];

  if (preferredNoteId && state.notes.some((note) => note.id === preferredNoteId)) {
    state.activeNoteId = preferredNoteId;
  } else if (!state.notes.some((note) => note.id === state.activeNoteId)) {
    state.activeNoteId = state.notes[0]?.id || null;
  }

  applySearch();
  renderEditor();
}

async function selectNote(noteId) {
  state.activeNoteId = noteId;
  state.isDirty = false;
  await apiFetch(`/api/notes/${noteId}/focus`, { method: "POST" });
  renderNotes();
  renderEditor();
}

async function createNote() {
  const payload = await apiFetch("/api/notes", {
    method: "POST",
    body: JSON.stringify({
      title: "Untitled note",
      content: ""
    })
  });
  state.isDirty = false;
  await refreshNotes(payload.note.id);
  elements.titleInput.focus();
  elements.titleInput.select();
}

async function duplicateActiveNote() {
  const note = getActiveNote();
  if (!note) {
    return;
  }

  const payload = await apiFetch(`/api/notes/${note.id}/duplicate`, {
    method: "POST"
  });
  state.isDirty = false;
  await refreshNotes(payload.note.id);
  elements.titleInput.focus();
  elements.titleInput.select();
}

async function deleteActiveNote() {
  const note = getActiveNote();
  if (!note) {
    return;
  }

  const confirmed = window.confirm(`Delete "${note.title}"?`);
  if (!confirmed) {
    return;
  }

  await apiFetch(`/api/notes/${note.id}`, {
    method: "DELETE"
  });
  state.isDirty = false;
  await refreshNotes();
}

async function saveActiveNote() {
  const note = getActiveNote();
  if (!note) {
    return;
  }

  const draft = {
    title: elements.titleInput.value.trim() || "Untitled note",
    content: elements.contentInput.value
  };

  let payload;

  try {
    payload = await apiFetch(`/api/notes/${note.id}`, {
      method: "PUT",
      body: JSON.stringify({
        ...draft,
        expectedUpdatedAt: note.updatedAt
      })
    });
  } catch (error) {
    if (error.status === 409 && error.payload?.latestNote) {
      const conflictCopy = await apiFetch("/api/notes", {
        method: "POST",
        body: JSON.stringify({
          title: `${draft.title} conflict copy`,
          content: draft.content
        })
      });
      state.isDirty = false;
      state.pendingRemoteRefresh = false;
      await refreshNotes(conflictCopy.note.id);
      elements.saveState.textContent = "Another device changed this note. Your edits were kept as a conflict copy.";
      updateSyncStatus("Remote edit detected. Conflict copy created.", "warning");
      return;
    }

    throw error;
  }

  state.activeNoteId = payload.note.id;
  state.isDirty = false;
  await refreshNotes(payload.note.id);
  elements.saveState.textContent = `Saved ${formatTimestamp(payload.note.updatedAt)}`;

  if (state.pendingRemoteRefresh) {
    state.pendingRemoteRefresh = false;
    await refreshNotes(payload.note.id);
  }
}

function queueSave() {
  state.isDirty = true;
  elements.saveState.textContent = "Saving soon...";
  updateNoteStats(elements.contentInput.value);
  updateCaretPosition();
  renderPreview();
  window.clearTimeout(state.saveTimer);
  state.saveTimer = window.setTimeout(() => {
    saveActiveNote().catch((error) => {
      console.error(error);
      elements.saveState.textContent = "Save failed";
      updateSyncStatus("Sync error", "error");
    });
  }, 400);
}

async function exportBackup() {
  const backup = await apiFetch("/api/backup");
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `syncpad-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  elements.saveState.textContent = `Backup exported (${backup.noteCount} notes)`;
}

async function importBackup(file) {
  const raw = await file.text();
  const payload = JSON.parse(raw);
  const result = await apiFetch("/api/backup/import", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  state.isDirty = false;
  await refreshNotes(result.lastOpenNoteId);
  elements.saveState.textContent = `Imported ${result.imported} notes`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findNextMatch() {
  const query = elements.findInput.value.trim();
  const content = elements.contentInput.value;

  if (!query || !content) {
    return false;
  }

  const haystack = content.toLowerCase();
  const needle = query.toLowerCase();
  const selectionStart = elements.contentInput.selectionStart || 0;
  const selectionEnd = elements.contentInput.selectionEnd || 0;
  const anchor = selectionEnd > selectionStart ? selectionEnd : selectionStart + 1;
  let index = haystack.indexOf(needle, Math.min(anchor, haystack.length));

  if (index === -1) {
    index = haystack.indexOf(needle, 0);
  }

  if (index === -1) {
    updateSyncStatus("No match found in this note", "warning");
    return false;
  }

  elements.contentInput.focus();
  elements.contentInput.setSelectionRange(index, index + query.length);
  updateCaretPosition();
  updateSyncStatus(state.syncLabel, state.serverTone);
  return true;
}

function replaceCurrentMatch() {
  const query = elements.findInput.value.trim();
  if (!query) {
    return false;
  }

  const selection = elements.contentInput.value.slice(
    elements.contentInput.selectionStart,
    elements.contentInput.selectionEnd
  );

  if (selection.toLowerCase() !== query.toLowerCase()) {
    return findNextMatch();
  }

  elements.contentInput.setRangeText(
    elements.replaceInput.value,
    elements.contentInput.selectionStart,
    elements.contentInput.selectionEnd,
    "end"
  );
  queueSave();
  return true;
}

function replaceAllMatches() {
  const query = elements.findInput.value.trim();
  if (!query) {
    return 0;
  }

  const matcher = new RegExp(escapeRegExp(query), "gi");
  const current = elements.contentInput.value;
  const matches = current.match(matcher);

  if (!matches?.length) {
    updateSyncStatus("No match found in this note", "warning");
    return 0;
  }

  elements.contentInput.value = current.replace(matcher, elements.replaceInput.value);
  queueSave();
  return matches.length;
}

function setZoom(nextZoom) {
  state.zoomLevel = clamp(nextZoom, 0.85, 1.7);
  applyEditorPreferences();
  savePreferences();
}

function toggleWordWrap() {
  state.wordWrap = !state.wordWrap;
  applyEditorPreferences();
  savePreferences();
}

function openSettingsModal() {
  if (!syncPadDesktop) {
    return;
  }

  hydrateSettingsForm();
  elements.settingsModal.hidden = false;
}

function closeSettingsModal() {
  elements.settingsModal.hidden = true;
}

function openOnboardingModal() {
  if (!syncPadDesktop) {
    return;
  }

  updateOnboardingSummary();
  elements.onboardingModal.hidden = false;
}

function closeOnboardingModal() {
  elements.onboardingModal.hidden = true;
}

function hydrateSettingsForm() {
  const config = state.config;
  if (!config) {
    return;
  }

  elements.settingsMode.value = config.mode;
  elements.settingsHost.value = config.host;
  elements.settingsPort.value = String(config.port);
  elements.settingsRemoteOrigin.value = config.remoteOrigin;
  elements.settingsConfigFile.textContent = config.configFile || "";
  updateSettingsSummary();
}

function updateSettingsSummary() {
  const model = getSettingsModel();
  elements.settingsModeBadge.textContent = model.modeBadge;
  elements.settingsAccessLabel.textContent = model.accessLabel;
  elements.settingsAccessUrl.textContent = model.accessUrl;
  elements.settingsSummaryText.textContent = model.summaryText;
  elements.settingsWarning.hidden = !model.warning;
  elements.settingsWarning.textContent = model.warning;
  elements.settingsChecklist.innerHTML = model.checklist
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  elements.settingsHost.disabled = model.mode !== "host";
  elements.settingsPort.disabled = model.mode !== "host";
  elements.settingsPort.value = String(model.port);
  elements.settingsRemoteOrigin.placeholder = model.mode === "host"
    ? model.accessUrl
    : EXAMPLE_TAILSCALE_ORIGIN;
  elements.settingsCopyButton.textContent = model.mode === "host" ? "Copy share address" : "Copy host address";
}

async function saveSettings() {
  if (!syncPadDesktop) {
    return;
  }

  const model = getSettingsModel();
  const updates = {
    mode: model.mode,
    host: model.host,
    port: model.port,
    remoteOrigin: model.mode === "host" ? buildOrigin(model.host, model.port) : model.remoteOrigin,
    setupComplete: true
  };

  const saved = await syncPadDesktop.saveConfig(updates);
  state.config = saved;
  state.syncLabel = saved.mode === "host" ? "Private Tailscale sync app" : "Remote SyncPad client";
  state.serverTone = saved.mode === "host" ? "connected" : "local";
  renderVerificationSnapshot();
  closeSettingsModal();
  closeOnboardingModal();
}

async function completeOnboarding(mode) {
  if (!syncPadDesktop) {
    return;
  }

  const effectiveConfig = getEffectiveConfig();
  const nextConfig = {
    mode,
    host: effectiveConfig.host,
    port: effectiveConfig.port,
    remoteOrigin: mode === "host"
      ? buildOrigin(effectiveConfig.host, effectiveConfig.port)
      : effectiveConfig.remoteOrigin,
    setupComplete: true
  };

  const saved = await syncPadDesktop.saveConfig(nextConfig);
  state.config = saved;
  state.syncLabel = saved.mode === "host" ? "Private Tailscale sync app" : "Remote SyncPad client";
  state.serverTone = saved.mode === "host" ? "connected" : "local";
  renderVerificationSnapshot();
  closeOnboardingModal();
}

function handleKeyboardShortcuts(event) {
  const modifierPressed = event.ctrlKey || event.metaKey;
  if (!modifierPressed) {
    return;
  }

  const key = event.key.toLowerCase();

  if (key === "n") {
    event.preventDefault();
    createNote().catch(console.error);
    return;
  }

  if (key === "d") {
    const note = getActiveNote();
    if (!note) {
      return;
    }

    event.preventDefault();
    duplicateActiveNote().catch(console.error);
    return;
  }

  if (key === "s") {
    const note = getActiveNote();
    if (!note) {
      return;
    }

    event.preventDefault();
    window.clearTimeout(state.saveTimer);
    saveActiveNote().catch((error) => {
      console.error(error);
      elements.saveState.textContent = "Save failed";
    });
    return;
  }

  if (key === "f") {
    event.preventDefault();
    elements.findInput.focus();
    elements.findInput.select();
    return;
  }

  if (event.key === "+" || event.key === "=") {
    event.preventDefault();
    setZoom(state.zoomLevel + 0.1);
    return;
  }

  if (event.key === "-") {
    event.preventDefault();
    setZoom(state.zoomLevel - 0.1);
    return;
  }

  if (key === "0") {
    event.preventDefault();
    setZoom(1);
  }
}

function setupLiveSync() {
  if (state.syncSource) {
    state.syncSource.close();
  }

  const source = new EventSource("/api/events");
  state.syncSource = source;

  source.addEventListener("open", () => {
    updateSyncStatus(state.syncLabel, state.serverTone);
  });

  source.addEventListener("notes-changed", async (event) => {
    const payload = JSON.parse(event.data);

    if (state.isDirty) {
      state.pendingRemoteRefresh = true;
      updateSyncStatus("Remote change waiting for your local save", "warning");
      return;
    }

    await refreshNotes(payload.noteId || state.activeNoteId);
    updateSyncStatus(state.syncLabel, state.serverTone);
  });

  source.addEventListener("error", () => {
    updateSyncStatus("Live sync reconnecting", "warning");
  });
}

async function bootstrapDesktopSettings() {
  if (!syncPadDesktop) {
    elements.settingsButton.hidden = true;
    renderVerificationSnapshot();
    return;
  }

  state.config = await syncPadDesktop.getConfig();
  renderVerificationSnapshot();
  syncPadDesktop.onOpenSettings(() => {
    openSettingsModal();
  });
  syncPadDesktop.onShowOnboarding(() => {
    openOnboardingModal();
  });
}

async function bootstrap() {
  loadPreferences();
  await bootstrapDesktopSettings();

  const status = await apiFetch("/api/status");
  state.appStatus = status;
  state.syncLabel = status.sync;
  state.serverTone = status.host === "127.0.0.1" ? "local" : "connected";
  updateSyncStatus(state.syncLabel, state.serverTone);
  renderVerificationSnapshot();
  applyEditorPreferences();

  elements.searchInput.addEventListener("input", applySearch);
  elements.newNoteButton.addEventListener("click", () => {
    createNote().catch(console.error);
  });
  elements.settingsButton.addEventListener("click", () => {
    openSettingsModal();
  });
  elements.exportBackupButton.addEventListener("click", () => {
    exportBackup().catch(console.error);
  });
  elements.importBackupButton.addEventListener("click", () => {
    elements.importBackupInput.click();
  });
  elements.importBackupInput.addEventListener("change", () => {
    const [file] = elements.importBackupInput.files || [];
    if (!file) {
      return;
    }

    importBackup(file)
      .catch(console.error)
      .finally(() => {
        elements.importBackupInput.value = "";
      });
  });
  elements.duplicateNoteButton.addEventListener("click", () => {
    duplicateActiveNote().catch(console.error);
  });
  elements.deleteNoteButton.addEventListener("click", () => {
    deleteActiveNote().catch(console.error);
  });
  elements.titleInput.addEventListener("input", queueSave);
  elements.contentInput.addEventListener("input", queueSave);
  elements.contentInput.addEventListener("click", updateCaretPosition);
  elements.contentInput.addEventListener("keyup", updateCaretPosition);
  elements.contentInput.addEventListener("select", updateCaretPosition);
  elements.findNextButton.addEventListener("click", () => {
    findNextMatch();
  });
  elements.replaceButton.addEventListener("click", () => {
    if (!replaceCurrentMatch()) {
      updateSyncStatus("No active match selected", "warning");
    }
  });
  elements.replaceAllButton.addEventListener("click", () => {
    const count = replaceAllMatches();
    if (count) {
      elements.saveState.textContent = `Replaced ${count} match${count === 1 ? "" : "es"}`;
      updateSyncStatus(state.syncLabel, state.serverTone);
    }
  });
  elements.wrapToggleButton.addEventListener("click", () => {
    toggleWordWrap();
  });
  elements.zoomOutButton.addEventListener("click", () => {
    setZoom(state.zoomLevel - 0.1);
  });
  elements.zoomResetButton.addEventListener("click", () => {
    setZoom(1);
  });
  elements.zoomInButton.addEventListener("click", () => {
    setZoom(state.zoomLevel + 0.1);
  });
  elements.settingsBackdrop.addEventListener("click", closeSettingsModal);
  elements.settingsCloseButton.addEventListener("click", closeSettingsModal);
  elements.settingsMode.addEventListener("change", updateSettingsSummary);
  elements.settingsHost.addEventListener("input", updateSettingsSummary);
  elements.settingsPort.addEventListener("input", updateSettingsSummary);
  elements.settingsRemoteOrigin.addEventListener("input", updateSettingsSummary);
  elements.settingsCopyButton.addEventListener("click", () => {
    copyText(elements.settingsAccessUrl.textContent).catch(console.error);
  });
  elements.copyVerificationButton?.addEventListener("click", () => {
    copyVerificationSnapshot().catch((error) => {
      console.error(error);
      updateSyncStatus("Verification copy failed", "error");
    });
  });
  elements.settingsOpenButton.addEventListener("click", () => {
    openExternal(elements.settingsAccessUrl.textContent).catch(console.error);
  });
  elements.settingsSaveButton.addEventListener("click", () => {
    saveSettings().catch((error) => {
      console.error(error);
      updateSyncStatus("Settings save failed", "error");
    });
  });
  elements.onboardingBackdrop.addEventListener("click", closeOnboardingModal);
  elements.onboardingCloseButton.addEventListener("click", closeOnboardingModal);
  elements.onboardingHostButton.addEventListener("click", () => {
    completeOnboarding("host").catch((error) => {
      console.error(error);
      updateSyncStatus("Host setup failed", "error");
    });
  });
  elements.onboardingClientButton.addEventListener("click", () => {
    completeOnboarding("client").catch((error) => {
      console.error(error);
      updateSyncStatus("Client setup failed", "error");
    });
  });
  elements.onboardingOpenSettingsButton.addEventListener("click", () => {
    closeOnboardingModal();
    openSettingsModal();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.onboardingModal.hidden) {
      closeOnboardingModal();
      return;
    }
    if (event.key === "Escape" && !elements.settingsModal.hidden) {
      closeSettingsModal();
      return;
    }
    handleKeyboardShortcuts(event);
  });

  for (const button of elements.modeButtons) {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  }

  setMode(state.activeMode);
  await refreshNotes(status.lastOpenNoteId);

  if (!state.activeNoteId) {
    await createNote();
  }

  setupLiveSync();

  if (syncPadDesktop && state.config?.setupComplete !== true) {
    openOnboardingModal();
  }
}

bootstrap().catch((error) => {
  console.error(error);
  elements.notesList.innerHTML = '<div class="empty-state">Failed to load notes.</div>';
  elements.saveState.textContent = "Load failed";
  updateSyncStatus("Server unavailable", "error");
});
