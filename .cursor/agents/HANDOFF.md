# FitTrack agent handoff

Use this when you finish your lane or need another specialist.

## How to call the next agent

Launch **Task** (do not only mention them):

- `subagent_type`: exact name below
- `model`: `gpt-5.6-sol-medium` for planning specialists, `gemini-3.7-flash-high` for `executor` / `qa-engineer` / `devops`
- Never `inherit`. Never Grok / Composer / Claude unless the user named that model
- `run_in_background`: `false` unless two specialists are independent and can run in parallel
- `prompt`: user request + your output so far + the specific question for that agent

If you cannot launch Task, end with the **Handoff** block so the main chat will launch them.

## Names

| Name | Model | Lane |
| --- | --- | --- |
| `product-manager` | `gpt-5.6-sol-medium` | what to build |
| `ui-ux-designer` | `gpt-5.6-sol-medium` | flows, copy, layout |
| `software-architect` | `gpt-5.6-sol-medium` | client / SQL / Edge Function |
| `dba` | `gpt-5.6-sol-medium` | schema, RLS, migration SQL |
| `ai-expert` | `gpt-5.6-sol-medium` | coach LLM vs numbers |
| `executor` | `gemini-3.7-flash-high` | code |
| `qa-engineer` | `gemini-3.7-flash-high` | live app QA |
| `devops` | `gemini-3.7-flash-high` | Expo, Supabase CLI, GitHub, secrets |

## Who to call next

| After | Call | When |
| --- | --- | --- |
| `product-manager` | `ui-ux-designer` | new or changed screens/copy |
| `product-manager` | `software-architect` | new behavior, data, or auth |
| `product-manager` | `ai-expert` | coach, prompts, generated copy |
| `ui-ux-designer` | `software-architect` | UX needs new screens/state |
| `ui-ux-designer` | `executor` | visual/copy change only, structure already clear |
| `software-architect` | `dba` | new/changed tables, columns, RLS |
| `software-architect` | `ai-expert` | coach-generate / model I/O |
| `software-architect` | `devops` | deploy, env, redirects, functions |
| `software-architect` | `executor` | plan is implementable |
| `dba` | `devops` or `executor` | apply `db push` |
| `ai-expert` | `devops` | secrets / function deploy |
| `ai-expert` | `executor` | wire client or function code |
| `executor` | `qa-engineer` | feature is in the app |
| `executor` | `devops` | migration/function/env needed to run it |
| `qa-engineer` | `executor` | bugs to fix (only if the user asked to fix) |
| `qa-engineer` | `devops` | app down, env, Metro |
| `devops` | `qa-engineer` | app/function should now be verifiable |

Do not call every agent. Call only the next lane that is actually needed. `none` if your output is the last step.

## Required footer

```markdown
### Handoff
- Next: `<subagent_type>` or `none`
- Why:
- Brief:
```
