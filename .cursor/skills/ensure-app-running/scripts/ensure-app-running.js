#!/usr/bin/env node
/**
 * Check whether FitTrack's Expo/Metro server is running for THIS repo.
 * Start it if not. Never prints .env values.
 *
 * Usage:
 *   node ensure-app-running.js           # check, start if down
 *   node ensure-app-running.js --check   # check only
 */

const { execSync, spawn, spawnSync } = require("child_process");
const fs = require("fs");
const http = require("http");
const net = require("net");
const os = require("os");
const path = require("path");

const CHECK_ONLY = process.argv.includes("--check");
const PORTS = [8081, 8082, 8083, 19000];
const START_TIMEOUT_MS = 60000;
const POLL_MS = 2000;

function findProjectRoot(startDir) {
  let dir = startDir;
  for (let i = 0; i < 8; i++) {
    const pkg = path.join(dir, "package.json");
    if (fs.existsSync(pkg)) {
      try {
        const json = JSON.parse(fs.readFileSync(pkg, "utf8"));
        if (json.name === "fittrack") return dir;
      } catch {
        /* keep walking */
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Could not find FitTrack project root (package.json name: fittrack).");
}

const PROJECT_ROOT = findProjectRoot(path.resolve(__dirname));
const ENV_PATH = path.join(PROJECT_ROOT, ".env");
const LOG_PATH = path.join(os.tmpdir(), "fittrack-expo.log");

function parseEnvFile(filePath) {
  const keys = {};
  if (!fs.existsSync(filePath)) return { exists: false, keys };
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    keys[key] = value.length > 0;
  }
  return { exists: true, keys };
}

function normalizePath(p) {
  return path.resolve(p).replace(/\\/g, "/").toLowerCase();
}

function normalizeText(s) {
  return String(s).replace(/\\/g, "/").toLowerCase();
}

function commandIsThisProject(commandLine) {
  if (!commandLine) return false;
  const n = normalizeText(commandLine);
  const nodeModules = normalizePath(path.join(PROJECT_ROOT, "node_modules"));
  if (!n.includes(nodeModules)) return false;
  return n.includes("/expo") || n.includes("metro");
}

function localPortFromAddr(addr) {
  if (!addr) return NaN;
  if (addr.startsWith("[")) {
    const idx = addr.lastIndexOf("]:");
    return idx >= 0 ? Number(addr.slice(idx + 2)) : NaN;
  }
  const idx = addr.lastIndexOf(":");
  return idx >= 0 ? Number(addr.slice(idx + 1)) : NaN;
}

function pidsOnPort(port) {
  try {
    if (process.platform === "win32") {
      const out = execSync("netstat -ano -p tcp", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      const pids = new Set();
      for (const line of out.split(/\r?\n/)) {
        if (!/LISTENING/i.test(line)) continue;
        const parts = line.trim().split(/\s+/);
        if (parts.length < 4) continue;
        if (localPortFromAddr(parts[1]) !== port) continue;
        const pid = Number(parts[parts.length - 1]);
        if (Number.isInteger(pid) && pid > 0) pids.add(pid);
      }
      return [...pids];
    }
    const out = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return [...new Set(out.split(/\s+/).map(Number).filter((n) => n > 0))];
  } catch {
    return [];
  }
}

function commandLineForPid(pid) {
  try {
    if (process.platform === "win32") {
      const r = spawnSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `(Get-CimInstance Win32_Process -Filter 'ProcessId=${Number(pid)}').CommandLine`,
        ],
        { encoding: "utf8", windowsHide: true }
      );
      return (r.stdout || "").trim();
    }
    return execSync(`ps -p ${pid} -o args=`, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function metroStatus(port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const req = http.get({ hostname: "127.0.0.1", port, path: "/status", timeout: timeoutMs }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        resolve({ ok: res.statusCode === 200, body: body.trim() });
      });
    });
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, body: "" });
    });
    req.on("error", () => resolve({ ok: false, body: "" }));
  });
}

function portIsFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolve(true));
    });
  });
}

async function inspectPort(port) {
  const pids = pidsOnPort(port);
  const processes = pids.map((pid) => {
    const commandLine = commandLineForPid(pid);
    return { pid, commandLine, thisProject: commandIsThisProject(commandLine) };
  });
  const status = await metroStatus(port);
  const thisProject = processes.some((p) => p.thisProject);
  return { port, pids, processes, metro: status, thisProject };
}

async function findFitTrackServer() {
  for (const port of PORTS) {
    const info = await inspectPort(port);
    if (info.thisProject && info.metro.ok) return info;
  }
  for (const port of PORTS) {
    const info = await inspectPort(port);
    if (info.thisProject) return info;
  }
  return null;
}

async function pickStartPort() {
  const preferred = 8081;
  const occupied = await inspectPort(preferred);
  if (occupied.thisProject) return preferred;
  if (occupied.pids.length === 0 && (await portIsFree(preferred))) return preferred;
  for (const port of [8082, 8083, 8084, 8085]) {
    const info = await inspectPort(port);
    if (info.thisProject) return port;
    if (info.pids.length === 0 && (await portIsFree(port))) return port;
  }
  throw new Error("No free Expo port in 8081-8085.");
}

function startExpo(port) {
  const args = ["expo", "start", "--web", "--lan", "--port", String(port)];
  const log = fs.openSync(LOG_PATH, "a");
  const child = spawn("npx", args, {
    cwd: PROJECT_ROOT,
    detached: true,
    shell: process.platform === "win32",
    stdio: ["ignore", log, log],
    windowsHide: true,
    env: { ...process.env, CI: "1" },
  });
  child.unref();
  return child.pid;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function webUrl(port) {
  return `http://127.0.0.1:${port}`;
}

function emit(payload) {
  console.log(JSON.stringify(payload, null, 2));
}

async function main() {
  const env = parseEnvFile(ENV_PATH);
  const prereqs = {
    nodeModules: fs.existsSync(path.join(PROJECT_ROOT, "node_modules", "expo")),
    envFile: env.exists,
    supabaseUrl: Boolean(env.keys.EXPO_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: Boolean(env.keys.EXPO_PUBLIC_SUPABASE_ANON_KEY),
    usdaKey: Boolean(env.keys.EXPO_PUBLIC_USDA_API_KEY),
  };

  const blockers = [];
  if (!prereqs.nodeModules) blockers.push("node_modules/expo missing — run npm install");
  if (!prereqs.envFile) blockers.push(".env missing — copy .env.example and add Supabase keys");
  if (!prereqs.supabaseUrl || !prereqs.supabaseAnonKey) {
    blockers.push("EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY is empty — app will show Setup required");
  }

  const existing = await findFitTrackServer();
  if (existing && existing.metro.ok) {
    emit({
      running: true,
      action: "already_running",
      port: existing.port,
      url: webUrl(existing.port),
      openInCursorBrowser: !CHECK_ONLY,
      metroStatus: existing.metro.body || "ok",
      pids: existing.pids,
      prereqs,
      warnings: blockers,
      logPath: LOG_PATH,
      message: `FitTrack Expo is already running on port ${existing.port}.`,
    });
    return;
  }

  const foreign8081 = await inspectPort(8081);
  const foreignMetro = foreign8081.pids.length > 0 && !foreign8081.thisProject;

  if (CHECK_ONLY) {
    emit({
      running: false,
      action: "not_running",
      port: existing ? existing.port : null,
      openInCursorBrowser: false,
      foreignMetroOn8081: foreignMetro,
      foreignPids: foreignMetro ? foreign8081.pids : [],
      prereqs,
      blockers,
      logPath: LOG_PATH,
      message: "FitTrack Expo is not running.",
    });
    process.exitCode = 1;
    return;
  }

  if (!prereqs.nodeModules) {
    emit({
      running: false,
      action: "blocked",
      openInCursorBrowser: false,
      prereqs,
      blockers,
      message: "Cannot start: install dependencies first (npm install).",
    });
    process.exitCode = 2;
    return;
  }

  const port = await pickStartPort();
  const pid = startExpo(port);
  const deadline = Date.now() + START_TIMEOUT_MS;
  let ready = null;
  while (Date.now() < deadline) {
    await sleep(POLL_MS);
    ready = await inspectPort(port);
    if (ready.metro.ok) break;
  }

  if (ready && ready.metro.ok) {
    emit({
      running: true,
      action: "started",
      port,
      url: webUrl(port),
      openInCursorBrowser: true,
      metroStatus: ready.metro.body || "ok",
      starterPid: pid,
      pids: ready.pids,
      prereqs,
      warnings: blockers,
      foreignMetroOn8081: foreignMetro,
      logPath: LOG_PATH,
      message:
        port === 8081
          ? `Started FitTrack Expo on port ${port}.`
          : `Started FitTrack Expo on port ${port} because 8081 is in use by another process.`,
    });
    return;
  }

  emit({
    running: false,
    action: "start_failed",
    port,
    openInCursorBrowser: false,
    starterPid: pid,
    prereqs,
    blockers,
    foreignMetroOn8081: foreignMetro,
    logPath: LOG_PATH,
    message: `Started Expo (pid ${pid}) but Metro did not become ready on port ${port} within ${START_TIMEOUT_MS / 1000}s. Check ${LOG_PATH}.`,
  });
  process.exitCode = 3;
}

main().catch((err) => {
  emit({ running: false, action: "error", message: String(err && err.message ? err.message : err) });
  process.exitCode = 1;
});
