---
name: ensure-app-running
description: Validates whether the FitTrack Expo/Metro app is running for this repo, starts it if not, and opens it in the Cursor browser. Use when the user asks if the app is up, running, started, wants to launch/start Expo or FitTrack, or wants a preview in the Cursor browser / Simple Browser / Browser Tab.
model: gemini-3.7-flash-high
---

# Ensure FitTrack is running

Model: `gemini-3.7-flash-high` (execution). Pass this slug if you launch a Task subagent.

Confirm **this repo's** Expo/Metro server is up. Start it if it is not. Then open the web app in the **Cursor browser** (Browser Tab), not the system browser.

Do not treat some other project's Metro on port 8081 as FitTrack.

## Quick start

From the FitTrack repo root, run:

```bash
node .cursor/skills/ensure-app-running/scripts/ensure-app-running.js
```

Check only (do not start, do not open the browser):

```bash
node .cursor/skills/ensure-app-running/scripts/ensure-app-running.js --check
```

The script prints JSON. Report that summary to the user. Never print `.env` values, anon keys, or command lines that might contain secrets.

## Rules

1. Run the script. Do not reinvent port/process checks in ad-hoc shell unless the script fails to run.
2. **This project only.** Another process on 8081 is not FitTrack. The script will start FitTrack on 8082+ in that case. Never kill the other process unless the user asks.
3. If `action` is `blocked` because `node_modules` is missing, run `npm install` in the repo root, then re-run the script.
4. If Supabase URL/anon key are missing, say the app can still start but will show the **Setup required** screen until `.env` is filled. Do not write secrets into `.env`.
5. After `started` or `already_running`, **immediately open the Cursor browser** using the steps below. The JSON `url` is the page to load (`http://127.0.0.1:<port>`).
6. If `action` is `start_failed`, read `logPath` (do not dump the whole file) and report the likely error. Do not open the browser.

## Open in Cursor browser

Required whenever JSON has `openInCursorBrowser: true` (or `running: true` after a start/ensure run). Do this in the same turn — do not wait for the user.

1. Discover tools: `GetMcpTools` with pattern `browser`.
2. Call the navigate tool (`browser_navigate` or equivalent) with:
   - `url`: the script's `url` (always `http://127.0.0.1:<port>`, not `localhost`, no trailing path)
   - `position`: `active` so the Browser Tab is shown
   - `newTab`: `true` if the tool supports it
3. In the **main chat body** (not reproduction-steps), include this markdown link so Cursor can attach the Browser Tab:

```markdown
[FitTrack](http://127.0.0.1:PORT)
```

Replace `PORT` with the script's `port`.

**Do not**

- Open Chrome / Edge / the system browser (`Start-Process`, `start http://...`, `xdg-open`, `open`)
- Use scheme-less URLs (`localhost:8081`) or relative paths
- Put the preview link only inside reproduction-steps blocks (those often open an external browser)
- Skip the browser open because Metro was already running

If browser MCP tools are missing, still emit the markdown link above as the first line of the user-facing reply.

## What "up" means

FitTrack is up when Metro for **this repo** answers `GET http://127.0.0.1:<port>/status` with `packager-status:running` (ports 8081–8083 or 19000). New starts use `expo start --web` so the same URL loads in the Cursor browser.

## User-facing summary

- **Already running:** FitTrack is up on port N, and the Cursor browser should be showing it.
- **Started:** FitTrack was down; started on port N (mention if 8081 belonged to another app); Cursor browser opened.
- **Not running / blocked / failed:** what is missing and the next command to fix it.
