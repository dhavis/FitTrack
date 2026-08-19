---
name: sync-to-github
description: Reviews FitTrack code changes, then commits and pushes to GitHub. Use when the user says sync-to-github, sync to GitHub, push to GitHub, ship to GitHub, or asks to code-review and push.
---

# Sync to GitHub

Review the current FitTrack changes, then commit and push to GitHub. Invoking this skill **is** permission to commit and push. Do not wait for a second "please commit" or "please push".

Do **not** force-push. Do **not** skip hooks. Do **not** change git config. Do **not** commit secrets.

## Workflow

Copy and track:

```
Sync:
- [ ] Inspect git state
- [ ] Code review
- [ ] Gate on critical findings
- [ ] Commit (if needed)
- [ ] Ensure GitHub remote
- [ ] Push
```

### 1. Inspect git state

From the repo root, run in parallel:

```bash
git status
git diff
git diff --staged
git log -8 --oneline
git remote -v
git branch -vv
```

If there is nothing to commit and the branch is already pushed, stop. Tell the user the repo is already in sync.

### 2. Code review

Launch **both** review subagents in the same turn, `run_in_background: false`:

- `subagent_type: "bugbot"`, `description: "Bugbot"`, prompt:

  ```text
  Full Repository Path: <absolute repository path>
  Diff: uncommitted changes
  ```

- `subagent_type: "security-review"`, `description: "Security Review"`, prompt:

  ```text
  Full Repository Path: <absolute repository path>
  Diff: uncommitted changes
  ```

If there are no uncommitted changes but the branch is ahead of origin, use `Diff: branch changes` instead.

Also read [STANDARDS.md](STANDARDS.md) and apply those FitTrack gates yourself (auth deadlock, secrets in Expo env, RLS, units). Merge your gates with subagent findings.

If a subagent fails because of a bad prompt, retry once. If it still fails, continue with an inline review using STANDARDS.md — do not block the sync on a subagent outage unless you already found a critical issue.

### 3. Gate on critical findings

Treat as **critical** (must not push):

- Auth deadlock (`onAuthStateChange` calling other Supabase APIs)
- Secrets in the client (`.env`, `EXPO_PUBLIC_*` API keys for OpenAI, service-role keys)
- Auth/RLS bypass or user A reading user B
- Data-loss or corrupt writes (wrong unit conversion, wiping profile columns)
- Commit would include `.env`, keys, or `supabase/.temp/`

If any critical finding exists:

1. Show the review table (below).
2. **Stop.** Do not commit. Do not push.
3. Ask whether to fix first or push anyway.

Suggestions and nits: include them in the summary and **continue**.

### 4. Commit

If there are uncommitted changes:

1. Stage only product/source files. Never stage:

   - `.env`, `.env.*` (`.env.example` is OK)
   - `supabase/.temp/`
   - credentials, pem, jks, p8, p12, mobileprovision
   - `node_modules/`, `.expo/`, `dist/`

2. Prefer path-by-path `git add`. Do not use `git add -A` or `git add .` if untracked secrets or `.temp` files are present.

3. Commit with a 1–2 sentence message focused on **why**. Portable form (works in PowerShell):

   ```bash
   git commit -m "Subject line" -m "Optional body sentence."
   ```

4. If the commit is rejected by a hook, fix and make a **new** commit. Do not `--amend` unless the user asked and the amend rules in the git commit user rule are met.

5. `git status` after the commit.

### 5. Ensure GitHub remote

If `origin` is missing or is not GitHub:

1. `gh auth status` (do not print tokens).
2. Create a **private** repo and set origin. From the repo root:

   ```bash
   gh repo create FitTrack --private --source=. --remote=origin
   ```

   If `FitTrack` is taken, use `FitTrack-app` or ask the user.
3. If `gh` is not logged in, stop and tell the user to run `gh auth login`. Do not invent a remote URL.

If `origin` already points at GitHub, leave it.

### 6. Push

```bash
git push -u origin HEAD
```

- Never `--force` / `--force-with-lease` unless the user explicitly asked, and **never** force-push `main` or `master`.
- Do not `--no-verify`.
- After a successful push, run `git status -sb` and give the user the GitHub repo URL (`gh repo view --web` or `gh repo view --json url`).

If the current branch is not `main`/`master` and no PR exists, create one with `gh pr create` (summary + test plan). If already on `main`/`master`, a push is enough.

## User-facing reply

Lead with the outcome (pushed / blocked / already in sync). Then the review, then the GitHub URL.

```markdown
# Sync to GitHub

**Status:** Pushed to `<branch>` / Blocked on critical review / Already in sync
**Remote:** https://github.com/<owner>/FitTrack

## Review

| Severity | Location | Finding |
| --- | --- | --- |
| Critical / Suggestion / Nit | `file:line` | short finding |

## Git

- Commit: `<sha>` `<message>`
- Pushed: `<n>` commit(s) to `origin/<branch>`
```

If Bugbot/Security Review returned a table, merge into one table, highest severity first. If both found nothing and STANDARDS.md is clean, write **Review: no blocking issues**.
