# FitTrack review gates

Apply these on every `sync-to-github` run. They are easy to miss in a generic review.

## Must not ship

- **Auth lock:** `onAuthStateChange` may only `setSession` (and local flags like password recovery). Profile loads, `resetPasswordForEmail`, and other Supabase calls belong in a separate `useEffect` or user handler.
- **Secrets:** no service-role key, OpenAI key, or DB password in Expo/`EXPO_PUBLIC_*`/client source. `.env` is never committed; `.env.example` has empty placeholders only.
- **RLS:** new tables that store user data must enable RLS and owner-only policies. Do not weaken existing policies.
- **Units:** persist weight as kg and length as cm. Convert only at the UI via `src/lib/units.ts`.
- **Temp/CLI junk:** do not commit `supabase/.temp/`, `.expo/`, or local CLI dumps.

## Check

- Password recovery: `detectSessionInUrl` on web only; recovery session must not dump the user into MainTabs before they set a new password.
- New signups with `onboarding_completed_at` null should see the wizard; existing rows should already be backfilled.
- Signup/login: empty credentials validated; `try/finally` so loading cannot stick; duplicate email (`identities.length === 0`) handled.
- Coach LLM stays in the Edge Function, not the Expo client.
- Do not add a new test framework unless the user asked; this repo has no Jest/Detox/Playwright suite.

## Expo

`package.json` pins Expo ~54. Match existing Expo 54 APIs in this repo. `AGENTS.md` points at Expo v57 docs — do not upgrade Expo as part of a sync.
