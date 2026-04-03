const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");

function getBaseDir() {
  if (process.env.MYDATA_DIR) {
    return process.env.MYDATA_DIR;
  }

  if (process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, "MyData");
  }

  return path.join(process.cwd(), ".data");
}

function getStoreDir() {
  return path.join(getBaseDir(), "SyncPad");
}

function getStoreFile() {
  return path.join(getStoreDir(), "notes.json");
}

async function ensureStore() {
  const dir = getStoreDir();
  const file = getStoreFile();

  await fs.mkdir(dir, { recursive: true });

  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(
      file,
      JSON.stringify({ notes: [], lastOpenNoteId: null }, null, 2),
      "utf-8"
    );
  }

  return file;
}

async function loadState() {
  const file = await ensureStore();
  const raw = await fs.readFile(file, "utf-8");
  const parsed = JSON.parse(raw);

  return {
    notes: Array.isArray(parsed.notes) ? parsed.notes : [],
    lastOpenNoteId: parsed.lastOpenNoteId || null
  };
}

async function saveState(state) {
  const file = await ensureStore();
  await fs.writeFile(file, JSON.stringify(state, null, 2), "utf-8");
}

function sortNotes(notes) {
  return [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function listNotes() {
  const state = await loadState();
  return sortNotes(state.notes);
}

async function getStatus() {
  const state = await loadState();
  return {
    noteCount: state.notes.length,
    lastOpenNoteId: state.lastOpenNoteId || null,
    storageFile: getStoreFile()
  };
}

async function getNote(noteId) {
  const state = await loadState();
  return state.notes.find((note) => note.id === noteId) || null;
}

async function createNote(title = "Untitled note") {
  const state = await loadState();
  const now = new Date().toISOString();
  const note = {
    id: randomUUID(),
    title,
    content: "",
    createdAt: now,
    updatedAt: now
  };

  state.notes.push(note);
  state.lastOpenNoteId = note.id;
  await saveState(state);

  return note;
}

async function duplicateNote(noteId) {
  const state = await loadState();
  const source = state.notes.find((item) => item.id === noteId);

  if (!source) {
    throw new Error("Note not found");
  }

  const now = new Date().toISOString();
  const note = {
    id: randomUUID(),
    title: `${source.title || "Untitled note"} copy`,
    content: source.content || "",
    createdAt: now,
    updatedAt: now
  };

  state.notes.push(note);
  state.lastOpenNoteId = note.id;
  await saveState(state);

  return note;
}

async function saveNote(noteId, updates) {
  const state = await loadState();
  const note = state.notes.find((item) => item.id === noteId);

  if (!note) {
    throw new Error("Note not found");
  }

  note.title = (updates.title || note.title || "Untitled note").trim() || "Untitled note";
  note.content = updates.content ?? note.content;
  note.updatedAt = new Date().toISOString();
  state.lastOpenNoteId = note.id;

  await saveState(state);
  return note;
}

async function deleteNote(noteId) {
  const state = await loadState();
  const filtered = state.notes.filter((note) => note.id !== noteId);

  if (filtered.length === state.notes.length) {
    return false;
  }

  state.notes = filtered;
  if (state.lastOpenNoteId === noteId) {
    state.lastOpenNoteId = filtered[0]?.id || null;
  }

  await saveState(state);
  return true;
}

module.exports = {
  createNote,
  deleteNote,
  duplicateNote,
  getNote,
  getStatus,
  getStoreFile,
  listNotes,
  loadState,
  saveNote
};
