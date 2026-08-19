-- FitTrack training upgrade: howto fields, body measurements, programs, training profile, storage

-- ---------------------------------------------------------------------------
-- Exercises: how-to media
-- ---------------------------------------------------------------------------
alter table public.exercises
  add column if not exists howto_image_path text,
  add column if not exists howto_cues text;

-- ---------------------------------------------------------------------------
-- Goals: training profile + primary goal type
-- ---------------------------------------------------------------------------
alter table public.goals
  add column if not exists primary_goal_type text
    check (primary_goal_type is null or primary_goal_type in ('fat_loss', 'muscle_gain', 'recomp', 'strength', 'general')),
  add column if not exists experience text
    check (experience is null or experience in ('beginner', 'intermediate', 'advanced')),
  add column if not exists days_per_week int check (days_per_week is null or (days_per_week >= 1 and days_per_week <= 7)),
  add column if not exists equipment_pref text
    check (equipment_pref is null or equipment_pref in ('full_gym', 'dumbbells', 'bodyweight', 'mixed')),
  add column if not exists session_minutes int check (session_minutes is null or session_minutes > 0),
  add column if not exists injury_notes text;

-- ---------------------------------------------------------------------------
-- Training programs (multi-routine plans)
-- ---------------------------------------------------------------------------
create table if not exists public.training_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  goal_type text,
  generated_from jsonb,
  created_at timestamptz not null default now()
);

alter table public.training_programs enable row level security;

drop policy if exists "Training programs are owner-only" on public.training_programs;
create policy "Training programs are owner-only"
  on public.training_programs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.routines
  add column if not exists program_id uuid references public.training_programs(id) on delete set null;

create index if not exists routines_program_idx on public.routines (program_id);

-- ---------------------------------------------------------------------------
-- Body composition measurements (lengths stored in cm)
-- ---------------------------------------------------------------------------
create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_at date not null default current_date,
  body_fat_pct numeric(5,2),
  waist_cm numeric(6,2),
  chest_cm numeric(6,2),
  hips_cm numeric(6,2),
  arm_left_cm numeric(6,2),
  arm_right_cm numeric(6,2),
  thigh_left_cm numeric(6,2),
  thigh_right_cm numeric(6,2),
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, logged_at)
);

alter table public.body_measurements enable row level security;

drop policy if exists "Body measurements are owner-only" on public.body_measurements;
create policy "Body measurements are owner-only"
  on public.body_measurements for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists body_measurements_user_date_idx
  on public.body_measurements (user_id, logged_at desc);

-- ---------------------------------------------------------------------------
-- Storage bucket for exercise how-to illustrations
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('exercise-howto', 'exercise-howto', true)
on conflict (id) do update set public = true;

drop policy if exists "Exercise howto public read" on storage.objects;
create policy "Exercise howto public read"
  on storage.objects for select
  using (bucket_id = 'exercise-howto');

drop policy if exists "Exercise howto authenticated upload" on storage.objects;
create policy "Exercise howto authenticated upload"
  on storage.objects for insert
  with check (bucket_id = 'exercise-howto' and auth.role() = 'authenticated');

drop policy if exists "Exercise howto authenticated update" on storage.objects;
create policy "Exercise howto authenticated update"
  on storage.objects for update
  using (bucket_id = 'exercise-howto' and auth.role() = 'authenticated');