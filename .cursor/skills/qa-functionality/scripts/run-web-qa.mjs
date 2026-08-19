#!/usr/bin/env node
/**
 * Live FitTrack web QA via Chrome DevTools Protocol (no extra npm packages).
 * Usage: node run-web-qa.mjs [url]
 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";

const TARGET = process.argv[2] || "http://127.0.0.1:8082";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9333;
const USER_DATA = join(tmpdir(), "fittrack-qa-chrome-profile");

const VIEWPORTS = [
  { id: "W-PHONE", width: 390, height: 844 },
  { id: "W-PHONE-LAND", width: 844, height: 390 },
  { id: "W-ANDROID", width: 412, height: 915 },
  { id: "W-TABLET", width: 768, height: 1024 },
  { id: "W-TABLET-LAND", width: 1024, height: 768 },
  { id: "W-DESKTOP", width: 1280, height: 800 },
];

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
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.text || "eval failed");
    }
    return r.result.value;
  }
}

async function waitChrome(retries = 25) {
  for (let i = 0; i < retries; i++) {
    try {
      const targets = await getJson(`http://127.0.0.1:${PORT}/json/list`);
      const page = (targets || []).find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      /* retry */
    }
    await sleep(200);
  }
  throw new Error("Chrome page target did not start");
}

const chrome = spawn(
  CHROME,
  [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA}`,
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "about:blank",
  ],
  { stdio: "ignore" }
);

const findings = [];
const flows = {};
const matrix = [];

function fail(id, area, severity, title, expected, actual, steps) {
  findings.push({ id, area, severity, title, expected, actual, steps });
}

try {
  const target = await waitChrome();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", () => reject(new Error("CDP websocket failed")));
  });
  const cdp = new Cdp(ws);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  async function goto(url, width, height) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width <= 500,
    });
    await cdp.send("Page.navigate", { url });
    const deadline = Date.now() + 40000;
    while (Date.now() < deadline) {
      const t = await cdp.eval(`document.body ? document.body.innerText : ''`);
      if (
        t.includes("FitTrack") ||
        t.includes("Dashboard") ||
        t.includes("Log In") ||
        t.includes("Setup required")
      ) {
        await sleep(1200);
        return t;
      }
      await sleep(400);
    }
    return cdp.eval(`document.body ? document.body.innerText : ''`);
  }

  async function clickExact(label) {
    return cdp.eval(`(() => {
      const nodes = Array.from(document.querySelectorAll('div,span,button,a,p'));
      const el = nodes.find((n) => (n.textContent || '').trim() === ${JSON.stringify(label)});
      if (!el) return false;
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return true;
    })()`);
  }

  let text = await goto(TARGET, 1280, 800);
  const setupRequired = text.includes("Setup required");
  const onLogin = /Log In/i.test(text) && /Create an account/i.test(text);
  const onSignedIn =
    text.includes("Dashboard") &&
    text.includes("Workouts") &&
    text.includes("Nutrition") &&
    text.includes("Settings");

  flows.webLoad = text.trim().length > 0 ? "Pass" : "Fail";
  if (flows.webLoad === "Fail") {
    fail("T-01", "Runtime", "Critical", "Blank web app", "Rendered FitTrack UI", "Empty body", ["Open " + TARGET]);
  }

  if (setupRequired) {
    flows.auth = "Blocked";
    fail("F-00", "Auth", "Critical", "Setup required screen", "Configured app", "Setup required", ["Load " + TARGET]);
  } else if (onLogin) {
    const uiOk = text.includes("FitTrack") && /email/i.test(text) && /password/i.test(text);
    flows.authUi = uiOk ? "Pass" : "Fail";
    if (!uiOk) {
      fail("F-01", "Auth", "High", "Login screen missing copy", "FitTrack, email, password, Log In", text.slice(0, 400), ["Load logged-out app"]);
    }

    await clickExact("Log In");
    await sleep(1500);
    text = await cdp.eval(`document.body.innerText`);
    const showedError = /invalid|error|required|enter|missing|credentials|password|fill/i.test(text);
    const stillLogin = /Log In/i.test(text);
    flows.authEmptySubmit = stillLogin ? (showedError ? "Pass" : "Fail") : "Fail";
    if (flows.authEmptySubmit === "Fail") {
      fail(
        "F-02",
        "Auth",
        "Medium",
        "Empty login does not show an error",
        "Visible error after empty Log In",
        stillLogin ? "No error copy" : "Left login",
        ["Tap Log In with empty fields"]
      );
    }

    const clicked = await clickExact("Create an account");
    await sleep(1000);
    text = await cdp.eval(`document.body.innerText`);
    const onSignup = /Sign Up/i.test(text) && /Back to log in/i.test(text);
    flows.authSignupNav = clicked && onSignup ? "Pass" : "Fail";
    if (flows.authSignupNav === "Fail") {
      fail("F-03", "Auth", "High", "Create an account did not open Sign Up", "Sign Up screen", text.slice(0, 400), ["Tap Create an account"]);
    } else {
      await clickExact("Back to log in");
      await sleep(800);
      text = await cdp.eval(`document.body.innerText`);
      flows.authBackToLogin = /Log In/i.test(text) ? "Pass" : "Fail";
    }

    flows.authValidLogin = "Blocked";
    flows.dashboard = "Blocked";
    flows.weight = "Blocked";
    flows.workouts = "Blocked";
    flows.nutrition = "Blocked";
    flows.goals = "Blocked";
    flows.settings = "Blocked";
  } else if (onSignedIn) {
    flows.authUi = "Pass";
    flows.authValidLogin = "Pass";
    flows.dashboard = "Pass";
    flows.weight = "Blocked";
    flows.workouts = "Blocked";
    flows.nutrition = "Blocked";
    flows.goals = "Blocked";
    flows.settings = "Blocked";
  } else {
    flows.authUi = "Fail";
    fail("F-05", "Auth", "Critical", "Unknown first screen", "Login or tabs", text.slice(0, 500), ["Load " + TARGET]);
  }

  for (const vp of VIEWPORTS) {
    const t = await goto(TARGET, vp.width, vp.height);
    const metrics = await cdp.eval(`({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      textLen: (document.body.innerText || '').length
    })`);
    const hOverflow = metrics.scrollWidth > metrics.clientWidth + 12;
    const usable =
      /FitTrack|Dashboard|Log In|Setup required/i.test(t) && metrics.textLen > 20;
    const sixTabs =
      t.includes("Dashboard") &&
      t.includes("Weight") &&
      t.includes("Workouts") &&
      t.includes("Nutrition") &&
      t.includes("Goals") &&
      t.includes("Settings");
    let result = "Pass";
    if (!usable) result = "Fail";
    else if (hOverflow) result = "Fail";
    if (result === "Fail") {
      fail(
        "D-" + vp.id,
        "Devices",
        vp.width <= 412 ? "High" : "Medium",
        vp.id + " layout problem",
        "Usable UI without horizontal overflow",
        `usable=${usable} overflow=${hOverflow} ${metrics.scrollWidth}>${metrics.clientWidth}`,
        [`Viewport ${vp.width}x${vp.height}`]
      );
    }
    matrix.push({
      id: vp.id,
      width: vp.width,
      height: vp.height,
      result,
      hOverflow,
      sixTabs,
      login: /Log In/i.test(t),
    });
  }

  const report = {
    url: TARGET,
    screen: setupRequired ? "setup" : onLogin ? "login" : onSignedIn ? "tabs" : "unknown",
    flows,
    matrix,
    findings,
  };
  console.log(JSON.stringify(report, null, 2));
} finally {
  chrome.kill();
}
