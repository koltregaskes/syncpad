const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const { URL } = require("url");

const store = require("./store");
const { readConfigSync } = require("./config");

const CLIENT_ROOT = path.join(__dirname, "renderer");
const savedConfig = readConfigSync();
const DEFAULT_HOST = process.env.SYNC_PAD_HOST || savedConfig.host || "127.0.0.1";
const DEFAULT_PORT = Number(process.env.SYNC_PAD_PORT || savedConfig.port || 3210);

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8"
};

function getClientOrigin(host, port) {
  return `http://${host}:${port}`;
}

async function readRequestBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return null;
  }

  return Buffer.concat(chunks).toString("utf-8");
}

async function readJsonBody(request) {
  const raw = await readRequestBody(request);
  return raw ? JSON.parse(raw) : {};
}

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload, null, 2));
}

function writeNoContent(response) {
  response.writeHead(204, {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store"
  });
  response.end();
}

function writeError(response, statusCode, message, extra = {}) {
  writeJson(response, statusCode, { error: message, ...extra });
}

function splitPathname(pathname) {
  return pathname.split("/").filter(Boolean);
}

async function serveStatic(response, pathname) {
  const safePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const resolved = path.join(CLIENT_ROOT, safePath);
  const normalisedRoot = path.normalize(CLIENT_ROOT + path.sep);
  const normalisedResolved = path.normalize(resolved);

  if (!normalisedResolved.startsWith(normalisedRoot)) {
    writeError(response, 403, "Forbidden");
    return;
  }

  try {
    const stat = await fs.stat(normalisedResolved);
    const target = stat.isDirectory()
      ? path.join(normalisedResolved, "index.html")
      : normalisedResolved;
    const ext = path.extname(target).toLowerCase();
    const content = await fs.readFile(target);

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": CONTENT_TYPES[ext] || "application/octet-stream"
    });
    response.end(content);
  } catch {
    writeError(response, 404, "Not found");
  }
}

function createSyncPadServer({ host = DEFAULT_HOST, port = DEFAULT_PORT } = {}) {
  const clients = new Set();

  function broadcast(event, payload) {
    const body = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;

    for (const response of clients) {
      try {
        response.write(body);
      } catch (_) {
        clients.delete(response);
      }
    }
  }

  async function handleApi(request, response, pathname) {
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      });
      response.end();
      return;
    }

    if (pathname === "/api/health") {
      writeJson(response, 200, { ok: true });
      return;
    }

    if (pathname === "/api/status") {
      const status = await store.getStatus();
      writeJson(response, 200, {
        ...status,
        host,
        port,
        origin: getClientOrigin(host, port),
        sync: host === "127.0.0.1" ? "Local-only server" : "Private live sync server"
      });
      return;
    }

    if (pathname === "/api/events") {
      response.writeHead(200, {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream; charset=utf-8"
      });
      response.write("retry: 2000\n\n");
      clients.add(response);

      request.on("close", () => {
        clients.delete(response);
      });
      return;
    }

    if (pathname === "/api/notes" && request.method === "GET") {
      const notes = await store.listNotes();
      writeJson(response, 200, { notes });
      return;
    }

    if (pathname === "/api/notes" && request.method === "POST") {
      const payload = await readJsonBody(request);
      const note = await store.createNote(payload.title || "Untitled note");

      if (typeof payload.content === "string" && payload.content) {
        await store.saveNote(note.id, {
          title: note.title,
          content: payload.content
        });
      }

      const created = await store.getNote(note.id);
      broadcast("notes-changed", { type: "created", noteId: created.id });
      writeJson(response, 201, { note: created });
      return;
    }

    if (pathname === "/api/backup" && request.method === "GET") {
      const backup = await store.exportBackup();
      writeJson(response, 200, backup);
      return;
    }

    if (pathname === "/api/backup/import" && request.method === "POST") {
      const payload = await readJsonBody(request);
      const result = await store.importBackup(payload);
      broadcast("notes-changed", { type: "imported", lastOpenNoteId: result.lastOpenNoteId });
      writeJson(response, 200, result);
      return;
    }

    const segments = splitPathname(pathname);

    if (segments[0] === "api" && segments[1] === "notes" && segments[2]) {
      const noteId = segments[2];
      const action = segments[3] || "";

      if (!action && request.method === "GET") {
        const note = await store.getNote(noteId);
        if (!note) {
          writeError(response, 404, "Note not found");
          return;
        }

        writeJson(response, 200, { note });
        return;
      }

      if (!action && request.method === "PUT") {
        try {
          const payload = await readJsonBody(request);
          const note = await store.saveNote(noteId, payload);
          broadcast("notes-changed", { type: "updated", noteId: note.id, updatedAt: note.updatedAt });
          writeJson(response, 200, { note });
        } catch (error) {
          if (error.code === "CONFLICT") {
            writeError(response, 409, error.message, { latestNote: error.latestNote });
            return;
          }

          throw error;
        }
        return;
      }

      if (!action && request.method === "DELETE") {
        const deleted = await store.deleteNote(noteId);
        if (!deleted) {
          writeError(response, 404, "Note not found");
          return;
        }

        broadcast("notes-changed", { type: "deleted", noteId });
        writeNoContent(response);
        return;
      }

      if (action === "duplicate" && request.method === "POST") {
        const note = await store.duplicateNote(noteId);
        broadcast("notes-changed", { type: "duplicated", noteId: note.id });
        writeJson(response, 201, { note });
        return;
      }

      if (action === "focus" && request.method === "POST") {
        await store.setLastOpenNote(noteId);
        broadcast("notes-changed", { type: "focused", noteId });
        writeJson(response, 200, { noteId });
        return;
      }

      if (action === "history" && segments[5] === "restore" && request.method === "POST") {
        const revisionId = segments[4];

        if (!revisionId) {
          writeError(response, 404, "Revision not found");
          return;
        }

        try {
          const payload = await readJsonBody(request);
          const note = await store.restoreNoteRevision(noteId, revisionId, payload);
          broadcast("notes-changed", {
            type: "restored",
            noteId: note.id,
            updatedAt: note.updatedAt
          });
          writeJson(response, 200, { note });
        } catch (error) {
          if (error.code === "CONFLICT") {
            writeError(response, 409, error.message, { latestNote: error.latestNote });
            return;
          }

          if (error.code === "NOT_FOUND") {
            writeError(response, 404, error.message);
            return;
          }

          throw error;
        }
        return;
      }
    }

    writeError(response, 404, "Not found");
  }

  const server = http.createServer(async (request, response) => {
    try {
      const parsedUrl = new URL(request.url, "http://localhost");
      const pathname = parsedUrl.pathname;

      if (pathname.startsWith("/api/")) {
        await handleApi(request, response, pathname);
        return;
      }

      await serveStatic(response, pathname);
    } catch (error) {
      writeError(response, 500, error.message || "Unexpected server error");
    }
  });

  function start() {
    return new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, host, () => {
        server.off("error", reject);
        resolve({
          host,
          port,
          origin: getClientOrigin(host, port),
          stop
        });
      });
    });
  }

  function stop() {
    return new Promise((resolve, reject) => {
      for (const response of clients) {
        try {
          response.end();
        } catch (_) {
          // ignore
        }
      }
      clients.clear();
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  return {
    start,
    stop,
    server
  };
}

if (require.main === module) {
  createSyncPadServer()
    .start()
    .then(({ origin }) => {
      console.log(`SyncPad server running at ${origin}`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

module.exports = {
  createSyncPadServer,
  getClientOrigin
};
