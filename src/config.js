const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const DEFAULT_CONFIG = {
  mode: "client",
  host: "100.119.231.37",
  port: 3210,
  remoteOrigin: "http://100.119.231.37:3210"
};

function getBaseDir() {
  if (process.env.MYDATA_DIR) {
    return process.env.MYDATA_DIR;
  }

  if (process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, "MyData");
  }

  return path.join(process.cwd(), ".data");
}

function getConfigDir() {
  return path.join(getBaseDir(), "SyncPad");
}

function getConfigFile() {
  return path.join(getConfigDir(), "config.json");
}

function normalizeMode(value) {
  return value === "client" ? "client" : "host";
}

function normalizePort(value) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 65535) {
    return DEFAULT_CONFIG.port;
  }

  return numeric;
}

function normalizeHost(value) {
  if (typeof value !== "string") {
    return DEFAULT_CONFIG.host;
  }

  const trimmed = value.trim();
  return trimmed || DEFAULT_CONFIG.host;
}

function normalizeOrigin(value, fallbackHost, fallbackPort) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return `http://${fallbackHost}:${fallbackPort}`;
}

async function ensureConfig() {
  const dir = getConfigDir();
  const file = getConfigFile();

  await fsp.mkdir(dir, { recursive: true });

  try {
    await fsp.access(file);
  } catch {
    await fsp.writeFile(file, JSON.stringify(DEFAULT_CONFIG, null, 2), "utf-8");
  }

  return file;
}

function ensureConfigSync() {
  const dir = getConfigDir();
  const file = getConfigFile();

  fs.mkdirSync(dir, { recursive: true });

  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(DEFAULT_CONFIG, null, 2), "utf-8");
  }

  return file;
}

async function readConfig() {
  const file = await ensureConfig();
  const raw = await fsp.readFile(file, "utf-8");
  const parsed = JSON.parse(raw);
  const host = normalizeHost(parsed.host);
  const port = normalizePort(parsed.port);

  return {
    mode: normalizeMode(parsed.mode),
    host,
    port,
    remoteOrigin: normalizeOrigin(parsed.remoteOrigin, host, port)
  };
}

async function writeConfig(nextConfig) {
  const file = await ensureConfig();
  const host = normalizeHost(nextConfig.host);
  const port = normalizePort(nextConfig.port);
  const config = {
    mode: normalizeMode(nextConfig.mode),
    host,
    port,
    remoteOrigin: normalizeOrigin(nextConfig.remoteOrigin, host, port)
  };

  await fsp.writeFile(file, JSON.stringify(config, null, 2), "utf-8");
  return config;
}

function readConfigSync() {
  const file = ensureConfigSync();
  const raw = fs.readFileSync(file, "utf-8");
  const parsed = JSON.parse(raw);
  const host = normalizeHost(parsed.host);
  const port = normalizePort(parsed.port);

  return {
    mode: normalizeMode(parsed.mode),
    host,
    port,
    remoteOrigin: normalizeOrigin(parsed.remoteOrigin, host, port)
  };
}

module.exports = {
  DEFAULT_CONFIG,
  getConfigFile,
  readConfig,
  readConfigSync,
  writeConfig
};
