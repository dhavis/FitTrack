---
name: qa-functionality
description: Walks FitTrack user flows in the running app and reports functional bugs (auth, dashboard, weight, workouts, nutrition, goals, settings). Use when the user asks for functionality QA, feature QA, smoke test, regression test, or to test if the app works.
---

# FitTrack functionality QA

Execute a live walkthrough of product behavior. Do **not** test viewports, rotation, or iOS/Android chrome here — that is [qa-devices](../qa-devices/SKILL.md).

Do **not** change product code unless the user asks to fix findings.

## Setup

1. Read and follow `.cursor/skills/ensure-app-running/SKILL.md` so the web app is up in the Cursor browser.
2. Discover browser tools (`GetMcpTools` pattern `browser`) and drive the UI with them. Screenshot after each flow.
3. If the session is logged out, ask for a **test** email/password. Do not create a new account unless the user says to. Never print secrets.
4. Use clearly fake QA values (e.g. weight `77.7`) and note anything you persist. Do not delete history you did not just create.

## Walkthrough

Run every flow in [flows.md](flows.md) in order. Mark each **Pass**, **Fail**, or **Blocked**.

While walking:

- Confirm the control does what its label says
- Confirm empty, validation, loading, and error states
- Confirm data shows up on Dashboard / the matching list after save
- Confirm unit labels follow Settings (`kg`/`lb`, `cm`/`in`)
- Log console/network failures you can see

Stop a flow if a **Critical** bug blocks it; continue the rest.

## Findings format

Lead the user-facing reply with a count, then findings. Use this shape:

```markdown
# Functionality QA

**URL:** [FitTrack](http://127.0.0.1:PORT)
**Account:** signed in | signed out
**Result:** N pass / N fail / N blocked

## Findings

### F-01 — short title
- **Severity:** Critical | High | Medium | Low
- **Area:** Auth | Dashboard | Weight | Workouts | Nutrition | Goals | Settings
- **Expected:**
- **Actual:**
- **Steps:** 1. … 2. …

## Flow results
- Auth: Pass/Fail/Blocked
- …
```

**Severity:** Critical = cannot use a core flow (sign in, log weight, start workout, log food). High = wrong data saved or shown. Medium = recoverable UI/error. Low = copy/polish.

If there are no failures, say so and still list flow results.
