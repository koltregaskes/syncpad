const state = {
  notes: [],
  filteredNotes: [],
  activeNoteId: null,
  saveTimer: null,
  lastStatus: null
};

const elements = {
  notesList: document.getElementById("notes-list"),
  searchInput: document.getElementById("search-input"),
  newNoteButton: document.getElementById("new-note-button"),
  duplicateNoteButton: document.getElementById("duplicate-note-button"),
  deleteNoteButton: document.getElementById("delete-note-button"),
  titleInput: document.getElementById("title-input"),
  contentInput: document.getElementById("content-input"),
  editorHeading: document.getElementById("editor-heading"),
  saveState: document.getElementById("save-state"),
  syncStatus: document.getElementById("sync-status"),
  storagePath: document.getElementById("storage-path")
};

function formatTimestamp(value) {
  if (!value) {
    return "No timestamp";
  }

  return new Date(value).toLocaleString();
}

function getActiveNote() {
  return state.notes.find((note) => note.id === state.activeNoteId) || null;
}

function setEditorEnabled(enabled) {
  elements.titleInput.disabled = !enabled;
  elements.contentInput.disabled = !enabled;
  elements.duplicateNoteButton.disabled = !enabled;
  elements.deleteNoteButton.disabled = !enabled;
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
      selectNote(button.dataset.noteId);
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
    return;
  }

  setEditorEnabled(true);
  elements.editorHeading.textContent = note.title || "Untitled note";
  elements.titleInput.value = note.title || "";
  elements.contentInput.value = note.content || "";
  elements.saveState.textContent = `Last saved ${formatTimestamp(note.updatedAt)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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
  state.notes = await window.syncPad.listNotes();

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
  renderNotes();
  renderEditor();
}

async function createNote() {
  const note = await window.syncPad.createNote("Untitled note");
  await refreshNotes(note.id);
  elements.titleInput.focus();
  elements.titleInput.select();
}

async function duplicateActiveNote() {
  const note = getActiveNote();
  if (!note) {
    return;
  }

  const duplicate = await window.syncPad.duplicateNote(note.id);
  await refreshNotes(duplicate.id);
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

  await window.syncPad.deleteNote(note.id);
  await refreshNotes();
}

async function saveActiveNote() {
  const note = getActiveNote();
  if (!note) {
    return;
  }

  const updated = await window.syncPad.saveNote(note.id, {
    title: elements.titleInput.value.trim() || "Untitled note",
    content: elements.contentInput.value
  });

  state.activeNoteId = updated.id;
  await refreshNotes(updated.id);
  elements.saveState.textContent = `Saved ${formatTimestamp(updated.updatedAt)}`;
}

function queueSave() {
  elements.saveState.textContent = "Saving soon...";
  window.clearTimeout(state.saveTimer);
  state.saveTimer = window.setTimeout(() => {
    saveActiveNote().catch((error) => {
      console.error(error);
      elements.saveState.textContent = "Save failed";
    });
  }, 400);
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
  }
}

async function bootstrap() {
  const status = await window.syncPad.getStatus();
  state.lastStatus = status;
  elements.syncStatus.textContent = status.sync;
  elements.storagePath.textContent = status.storageFile;

  elements.searchInput.addEventListener("input", applySearch);
  elements.newNoteButton.addEventListener("click", () => {
    createNote().catch(console.error);
  });
  elements.duplicateNoteButton.addEventListener("click", () => {
    duplicateActiveNote().catch(console.error);
  });
  elements.deleteNoteButton.addEventListener("click", () => {
    deleteActiveNote().catch(console.error);
  });
  elements.titleInput.addEventListener("input", queueSave);
  elements.contentInput.addEventListener("input", queueSave);
  window.addEventListener("keydown", handleKeyboardShortcuts);

  await refreshNotes(status.lastOpenNoteId);

  if (!state.activeNoteId) {
    await createNote();
  }
}

bootstrap().catch((error) => {
  console.error(error);
  elements.notesList.innerHTML = '<div class="empty-state">Failed to load notes.</div>';
  elements.saveState.textContent = "Load failed";
});
