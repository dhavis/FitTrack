---
name: qa-devices
description: Validates FitTrack layout and behavior across web breakpoints, portrait/landscape, and iOS/Android vs web (safe area, keyboard, tabs, charts). Use when the user asks for device QA, responsive QA, tablet, phone, orientation, Expo Go, iOS, Android, or cross-device validation.
model: gemini-3.7-flash-high
---

# FitTrack devices QA

Model: `gemini-3.7-flash-high` (execution). Pass this slug if you launch a Task subagent.

Execute layout and platform checks. Do **not** re-run the full feature suite — that is [qa-functionality](../qa-functionality/SKILL.md). If a control is broken on every size, log it once and keep going.

Do **not** change product code unless the user asks to fix findings.

## Setup

1. Read and follow `.cursor/skills/ensure-app-running/SKILL.md` so the web app is up in the Cursor browser.
2. Discover browser tools (`GetMcpTools` pattern `browser`). Prefer resize / emulate viewport if the tool supports it. Screenshot **every** matrix cell.
3. Stay signed in if possible so tab content is real. Ask for test credentials if logged out. Never print secrets.

## What to execute

Run the matrix in [matrix.md](matrix.md). For each cell, use the **smoke path** below (not the full functionality list).

### Smoke path

1. Auth or Dashboard (whatever is showing)
2. All six tabs: Dashboard, Weight, Workouts, Nutrition, Goals, Settings — each selected and visible
3. Weight: chart + log form
4. Workouts: home actions + open Exercise library (back)
5. Nutrition: home + open Add food (back)
6. Keyboard: focus a text field (login password or weight input); confirm the focused field and primary button stay reachable
7. Rotate or resize to the cell's orientation, then back

### Pass criteria (every cell)

- No horizontal page scroll unless a wide chart is the only overflow, and then the rest of the screen still works
- Six tabs remain tappable; labels/icons not clipped into each other
- Headers, buttons, and inputs are not under the status/notch or under the tab bar
- `ScreenContainer` uses safe area on top/left/right — content must not sit in the notch; bottom tab bar must stay above the home indicator
- Dark theme holds (`#0B0D10` background, orange primary); no white flashes / unreadable text
- Charts resize or remain usable after a width change (reload the page once if the chart stays stuck at the old width, then log it)

## Native (iOS / Android)

`app.json` sets `"orientation": "portrait"` and `ios.supportsTablet: true`. Android `predictiveBackGestureEnabled` is false.

This host is Windows: **no iOS Simulator**. Execute what this machine can:

1. **Web** matrix — always required.
2. **Android** — `adb devices`. If a device/emulator is connected, run `npx expo start --android` against **this repo's** Metro port from the ensure-app-running JSON. Walk the smoke path in portrait; confirm landscape is locked or still usable; check back gesture / software back does not exit mid-stack unexpectedly.
3. **iOS / Expo Go** — if the user has a phone on the LAN, they can scan the QR from the Expo terminal. Do not invent iOS results. Mark iOS **Blocked** on this host unless the user confirms they opened Expo Go; then ask them only for what you cannot see, or use screenshots they provide.

### Web vs native (log diffs, do not fail web for native-only behavior)

- `KeyboardAvoidingView` on Login/Sign Up is **iOS-only** (`Platform.OS === 'ios'`). On web/Android, keyboard overlap is a valid finding.
- Rest timer, How-to images, and USDA search must still work on web.
- Hover vs tap: buttons use `Pressable`; no control should require hover to be usable.
- Safe area: web has no notch; still check padding vs the Cursor browser chrome.

## Findings format

```markdown
# Devices QA

**URL:** [FitTrack](http://127.0.0.1:PORT)
**Native:** Android executed | Android skipped | iOS blocked on Windows | Expo Go confirmed

**Result:** N pass / N fail / N blocked

## Findings

### D-01 — short title
- **Severity:** Critical | High | Medium | Low
- **Surface:** Web phone | Web tablet | Web desktop | Web landscape | Android | iOS
- **Size:** e.g. 390×844 portrait
- **Expected:**
- **Actual:**
- **Steps:** 1. … 2. …

## Matrix results
| Cell | Result |
| --- | --- |
| … | Pass/Fail/Blocked |
```

**Severity:** Critical = cannot reach a tab or primary action on that device. High = content unusable (covered, off-screen, unreadable). Medium = awkward but usable. Low = polish.
