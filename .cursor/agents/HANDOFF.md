# FitTrack agent handoff

Use this when you finish your lane or need another specialist.

## How to call the next agent

Launch **Task** (do not only mention them):

- `subagent_type`: exact name below
- `model`: `claude-sonnet-5-5-high` for planning specialists (`usage-rights` and `red-team` included), `gemini-3.8-flash-high` for `ui-ux-designer` / `executor` / `qa-engineer` / `devops`
- Never `inherit`. Never Grok or Composer unless the user named that model
- `run_in_background`: `false` unless two specialists are independent and can run in parallel
- `prompt`: user request + your output so far + the specific question for that agent

If you cannot launch Task, end with the **Handoff** block so the main chat will launch them.

## Names

| Name | Model | Lane |
| --- | --- | --- |
| `product-manager` | `claude-sonnet-5-5-high` | what to build |
| `ui-ux-designer` | `gemini-3.8-flash-high` | flows, copy, layout, theme, visual polish (`ui-expert` is an alias) |
| `usage-rights` | `claude-sonnet-5-5-high` | copyright and whether suggested icons, images, fonts, or copied programs can be used |
| `software-architect` | `claude-sonnet-5-5-high` | client / SQL / Edge Function |
| `dba` | `claude-sonnet-5-5-high` | schema, RLS, migration SQL |
| `ai-expert` | `claude-sonnet-5-5-high` | coach LLM vs numbers |
| `executor` | `gemini-3.8-flash-high` | code |
| `qa-engineer` | `gemini-3.8-flash-high` | live app QA |
| `red-team` | `claude-sonnet-5-5-high` | break the change against FitTrack safety rules before release |
| `devops` | `gemini-3.8-flash-high` | Expo, Supabase CLI, GitHub, secrets |

## Who to call next

| After | Call | When |
| --- | --- | --- |
| `product-manager` | `ui-ux-designer` | new or changed screens/copy |
| `product-manager` | `software-architect` | new behavior, data, or auth |
| `product-manager` | `ai-expert` | coach, prompts, generated copy |
| `ui-ux-designer` | `usage-rights` | suggestion includes icons, images, fonts, external copy, a traced layout, or a named program |
| `ui-ux-designer` | `software-architect` | UX needs new screens/state, and rights are already clear |
| `ui-ux-designer` | `executor` | remaining work is data/logic, not presentation, and rights are already clear |
| `ui-ux-designer` | `qa-engineer` | a user-visible screen changed, and rights are already clear |
| `product-manager` | `usage-rights` | story copies a named program, exercise pack, or external asset |
| `ai-expert` | `usage-rights` | coach or menu copy may echo a named source |
| `usage-rights` | `ui-ux-designer` | icons, images, or layout blocked; send the replacement |
| `usage-rights` | `product-manager` | copied program or feature blocked |
| `usage-rights` | `ai-expert` | copied coach or nutrition wording blocked |
| `usage-rights` | next build agent | verdict is `clear`, or `clear-with-attribution` the user already accepted |
| `software-architect` | `dba` | new/changed tables, columns, RLS |
| `software-architect` | `ai-expert` | coach-generate / model I/O |
| `software-architect` | `devops` | deploy, env, redirects, functions |
| `software-architect` | `executor` | plan is implementable |
| `dba` | `devops` or `executor` | apply `db push` |
| `ai-expert` | `devops` | secrets / function deploy |
| `ai-expert` | `executor` | wire client or function code |
| `executor` | `red-team` | diff touches auth, workouts, sets, units, routines, nutrition logs, RLS, or a migration |
| `executor` | `qa-engineer` | feature is in the app, and red team is not required or already clear |
| `executor` | `devops` | migration/function/env needed to run it, and red team is already clear |
| `red-team` | `executor` | user asked to fix findings |
| `red-team` | `none` | report is the release gate |
| `qa-engineer` | `executor` | bugs to fix (only if the user asked to fix) |
| `qa-engineer` | `devops` | app down, env, Metro |
| `devops` | `red-team` | a release, push, or deploy has no red-team report yet |
| `devops` | `qa-engineer` | app/function should now be verifiable, and red team is already clear |

Do not call every agent. Call only the next lane that is actually needed. `none` if your output is the last step.

## Required footer

```markdown
### Handoff
- Next: `<subagent_type>` or `none`
- Why:
- Brief:
```
