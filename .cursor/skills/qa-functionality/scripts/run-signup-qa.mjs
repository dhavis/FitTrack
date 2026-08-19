#!/usr/bin/env node
/**
 * Probe FitTrack signup (API + live web form). Prints errors only — never env secrets.
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..", "..", "..");
const TARGET = process.argv[2] || "http://127.0.0.1:8082";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 9334;
const USER_DATA = join(tmpdir(), "fittrack-signup-qa-chrome");

function parseEnv(file) {
  const keys = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    keys[t.slice(0, i).trim()] = v;
  }
  return keys;
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const r = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || "eval failed");
    return r.result.value;
  }
}

async function signupApi(url, anonKey, email, password) {
  const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/signup`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  return {
    http: res.status,
    error: body.error_description || body.msg || body.error || body.message || null,
    code: body.error_code || body.code || null,
    hasUser: Boolean(body.id || body.user?.id),
    hasSession: Boolean(body.access_token || body.session?.access_token),
    identities: body.identities?.length ?? body.user?.identities?.length ?? null,
  };
}

const env = parseEnv(join(ROOT, ".env"));
const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !anonKey) {
  console.log(JSON.stringify({ ok: false, error: "Missing Supabase env" }, null, 2));
  process.exit(1);
}

const stamp = Date.now();
const uniqueEmail = `fittrack.qa.${stamp}@gmail.com`;
const cases = [];

cases.push({ name: "empty email", ...(await signupApi(supabaseUrl, anonKey, "", "TestPass123!")) });
cases.push({ name: "invalid email", ...(await signupApi(supabaseUrl, anonKey, "not-an-email", "TestPass123!")) });
cases.push({ name: "short password", ...(await signupApi(supabaseUrl, anonKey, `short.${stamp}@gmail.com`, "ab")) });
cases.push({ name: "new user", email: uniqueEmail, ...(await signupApi(supabaseUrl, anonKey, uniqueEmail, "TestPass123!")) });
if (cases.at(-1).hasUser || cases.at(-1).http === 200) {
  cases.push({
    name: "duplicate email",
    ...(await signupApi(supabaseUrl, anonKey, uniqueEmail, "TestPass123!")),
  });
}

let ui = null;
const chrome = spawn(
  CHROME,
  [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${USER_DATA}`,
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--disable-extensions",
    "about:blank",
  ],
  { stdio: "ignore" }
);

try {
  let page = null;
  for (let i = 0; i < 25; i++) {
    try {
      const targets = await getJson(`http://127.0.0.1:${CDP_PORT}/json/list`);
      page = (targets || []).find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (page) break;
    } catch {
      /* retry */
    }
    await sleep(200);
  }
  if (!page) throw new Error("Chrome page target missing");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", () => reject(new Error("CDP failed")));
  });
  const cdp = new Cdp(ws);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Page.navigate", { url: TARGET });
  const deadline = Date.now() + 40000;
  while (Date.now() < deadline) {
    const t = await cdp.eval(`document.body ? document.body.innerText : ''`);
    if (t.includes("Log In") || t.includes("FitTrack") || t.includes("Dashboard")) break;
    await sleep(400);
  }
  await cdp.eval(`(() => {
    const nodes = Array.from(document.querySelectorAll('div,span,button,a,p'));
    const el = nodes.find((n) => (n.textContent || '').trim() === 'Create an account');
    if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return Boolean(el);
  })()`);
  await sleep(1000);

  const uiEmail = `fittrack.ui.${stamp}@gmail.com`;
  ui = await cdp.eval(`(async () => {
    const inputs = Array.from(document.querySelectorAll('input'));
    const nativeSet = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    function fill(el, value) {
      nativeSet.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (inputs.length < 3) {
      return { ok: false, inputCount: inputs.length, text: document.body.innerText.slice(0, 800) };
    }
    fill(inputs[0], ${JSON.stringify(uiEmail)});
    fill(inputs[1], 'TestPass123!');
    fill(inputs[2], 'TestPass123!');
    const nodes = Array.from(document.querySelectorAll('div,span,button,a,p'));
    const btn = nodes.find((n) => (n.textContent || '').trim() === 'Sign Up');
    if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    await new Promise((r) => setTimeout(r, 4000));
    return {
      ok: true,
      inputCount: inputs.length,
      text: document.body.innerText.slice(0, 1200),
    };
  })()`);
} catch (err) {
  ui = { ok: false, error: String(err && err.message ? err.message : err) };
} finally {
  chrome.kill();
}

console.log(
  JSON.stringify(
    {
      supabaseHost: (() => {
        try {
          return new URL(supabaseUrl).host;
        } catch {
          return "invalid-url";
        }
      })(),
      api: cases,
      ui,
    },
    null,
    2
  )
);
