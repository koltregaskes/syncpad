const fs = require("fs");
const os = require("os");
const path = require("path");

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "syncpad-"));
process.env.MYDATA_DIR = tempRoot;

const store = require("../src/store");

async function main() {
  const first = await store.createNote("First note");
  await store.saveNote(first.id, {
    title: "First note",
    content: "Hello from SyncPad"
  });

  await store.saveNote(first.id, {
    title: "First note",
    content: "Hello again",
    expectedUpdatedAt: (await store.getNote(first.id)).updatedAt
  });

  const beforeRestore = await store.getNote(first.id);
  const previous = beforeRestore.history[0];

  if (!previous || previous.content !== "Hello from SyncPad") {
    throw new Error("Expected the previous save to be the newest history entry");
  }

  if (beforeRestore.history.length !== 2) {
    throw new Error(`Expected 2 history entries, got ${beforeRestore.history.length}`);
  }

  const restored = await store.restoreNoteRevision(first.id, previous.id, {
    expectedUpdatedAt: beforeRestore.updatedAt
  });

  if (restored.content !== "Hello from SyncPad") {
    throw new Error("Restore did not return the earlier text");
  }

  if (restored.history[0]?.content !== "Hello again") {
    throw new Error("Restore did not keep the replaced text in history");
  }

  let stale = false;
  try {
    await store.saveNote(first.id, {
      title: "First note",
      content: "Should conflict",
      expectedUpdatedAt: beforeRestore.updatedAt
    });
  } catch (error) {
    stale = error.code === "CONFLICT";
  }

  if (!stale) {
    throw new Error("A stale save should still create a conflict");
  }

  const notes = await store.listNotes();
  const loaded = await store.getNote(first.id);

  console.log(
    JSON.stringify(
      {
        noteCount: notes.length,
        firstTitle: loaded.title,
        firstContent: loaded.content,
        historyCount: loaded.history.length,
        newestHistory: loaded.history[0]?.content
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
