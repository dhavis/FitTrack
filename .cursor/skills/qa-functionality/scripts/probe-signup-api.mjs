#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..", "..", "..");
const env = {};
for (const line of readFileSync(join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 1) continue;
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}
const url = env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const email = `fittrack.qa.${Date.now()}@gmail.com`;
const res = await fetch(`${url}/auth/v1/signup`, {
  method: "POST",
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ email, password: "TestPass123!" }),
});
const body = await res.json().catch(() => ({}));
console.log(
  JSON.stringify(
    {
      http: res.status,
      host: new URL(url).host,
      error: body.error_description || body.msg || body.error || body.message || null,
      hasUser: Boolean(body.id || body.user?.id),
      hasSession: Boolean(body.access_token || body.session?.access_token),
    },
    null,
    2
  )
);
