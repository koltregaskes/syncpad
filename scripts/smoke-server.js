const fs = require("fs");
const os = require("os");
const path = require("path");

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "syncpad-server-"));
process.env.MYDATA_DIR = tempRoot;
process.env.SYNC_PAD_HOST = "127.0.0.1";
process.env.SYNC_PAD_PORT = "3222";

const { createSyncPadServer } = require("../src/server");

async function main() {
  const server = await createSyncPadServer({
    host: "127.0.0.1",
    port: 3222
  }).start();

  try {
    const createdResponse = await fetch(`${server.origin}/api/notes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: "Server note",
        content: "# Hello\n\nThis is a synced note."
      })
    });
    const created = await createdResponse.json();

    await fetch(`${server.origin}/api/notes/${created.note.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: "Server note",
        content: "# Hello\n\nThis is a synced note.\n\nUpdated."
      })
    });

    const listResponse = await fetch(`${server.origin}/api/notes`);
    const listPayload = await listResponse.json();
    const saved = listPayload.notes[0];
    const revision = saved?.history?.[0];

    if (!revision) {
      throw new Error("Expected the server save to keep an earlier version");
    }

    const restoreResponse = await fetch(
      `${server.origin}/api/notes/${saved.id}/history/${revision.id}/restore`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expectedUpdatedAt: saved.updatedAt
        })
      }
    );
    const restored = await restoreResponse.json();

    if (!restoreResponse.ok || !restored.note?.content?.includes("This is a synced note.")) {
      throw new Error("Restore did not return the earlier server note");
    }

    if (!restored.note.content.endsWith("Updated.") && restored.note.history[0]?.content?.includes("Updated.")) {
      console.log(JSON.stringify({
        noteCount: listPayload.notes.length,
        firstTitle: restored.note.title,
        restoredContent: restored.note.content,
        replacedKept: restored.note.history[0]?.content?.includes("Updated."),
        origin: server.origin
      }, null, 2));
      return;
    }

    throw new Error("Restore did not keep the replaced server text in history");
  } finally {
    await server.stop();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
