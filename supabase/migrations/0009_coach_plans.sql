-- Hybrid coach plans: combined training + nutrition generations

create table if not exists public.coach_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  generated_at timestamptz not null default now(),
  is_active boolean not null default true,
  goal_snapshot jsonb not null default '{}'::jsonb,
  context_snapshot jsonb not null default '{}'::jsonb,
  training_summary jsonb,
  nutrition_summary jsonb,
  coaching_copy jsonb,
  model text,
  prompt_version text,
  created_at timestamptz not null default now()
);

create index if not exists coach_plans_user_generated_idx
  on public.coach_plans (user_id, generated_at desc);

create index if not exists coach_plans_user_active_idx
  on public.coach_plans (user_id)
  where is_active = true;

alter table public.coach_plans enable row level security;

drop policy if exists "Coach plans are owner-only" on public.coach_plans;
create policy "Coach plans are owner-only"
  on public.coach_plans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);