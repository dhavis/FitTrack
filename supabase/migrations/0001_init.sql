-- FitTrack initial schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- All user-owned tables use Row Level Security so this is safe for multi-user from day one.

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  weight_unit text not null default 'kg' check (weight_unit in ('kg', 'lb')),
  length_unit text not null default 'cm' check (length_unit in ('cm', 'in')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by owner"
  on public.profiles for select using (auth.uid() = id);
create policy "Profiles are editable by owner"
  on public.profiles for update using (auth.uid() = id);
create policy "Profiles are insertable by owner"
  on public.profiles for insert with check (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Weight logs
-- ---------------------------------------------------------------------------
create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weight_kg numeric(6,2) not null,
  logged_at date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, logged_at)
);

alter table public.weight_logs enable row level security;

create policy "Weight logs are owner-only"
  on public.weight_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists weight_logs_user_date_idx on public.weight_logs (user_id, logged_at desc);

-- ---------------------------------------------------------------------------
-- Exercise library (public/global rows have user_id = null; custom rows are owned)
-- ---------------------------------------------------------------------------
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  muscle_group text,
  equipment text,
  instructions text,
  created_at timestamptz not null default now()
);

alter table public.exercises enable row level security;

create policy "Exercises are viewable by everyone"
  on public.exercises for select
  using (user_id is null or auth.uid() = user_id);
create policy "Custom exercises are insertable by owner"
  on public.exercises for insert with check (auth.uid() = user_id);
create policy "Custom exercises are editable by owner"
  on public.exercises for update using (auth.uid() = user_id);
create policy "Custom exercises are deletable by owner"
  on public.exercises for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Routines (workout plans) & their exercises
-- ---------------------------------------------------------------------------
create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

alter table public.routines enable row level security;

create policy "Routines are owner-only"
  on public.routines for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.routine_exercises (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  order_index int not null default 0,
  target_sets int not null default 3,
  target_reps int not null default 10,
  target_weight_kg numeric(6,2),
  rest_seconds int not null default 90
);

alter table public.routine_exercises enable row level security;

create policy "Routine exercises follow parent routine ownership"
  on public.routine_exercises for all
  using (exists (select 1 from public.routines r where r.id = routine_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.routines r where r.id = routine_id and r.user_id = auth.uid()));

create index if not exists routine_exercises_routine_idx on public.routine_exercises (routine_id, order_index);

-- ---------------------------------------------------------------------------
-- Workouts (a logged session) & sets performed
-- ---------------------------------------------------------------------------
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_id uuid references public.routines(id) on delete set null,
  name text not null default 'Workout',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text
);

alter table public.workouts enable row level security;

create policy "Workouts are owner-only"
  on public.workouts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists workouts_user_started_idx on public.workouts (user_id, started_at desc);

create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id),
  set_index int not null default 1,
  reps int,
  weight_kg numeric(6,2),
  rpe numeric(3,1),
  completed_at timestamptz default now()
);

alter table public.workout_sets enable row level security;

create policy "Workout sets follow parent workout ownership"
  on public.workout_sets for all
  using (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()))
  with check (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()));

create index if not exists workout_sets_workout_idx on public.workout_sets (workout_id, set_index);

-- ---------------------------------------------------------------------------
-- Nutrition logs (denormalized snapshot of food data at log time)
-- ---------------------------------------------------------------------------
create table if not exists public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_at date not null default current_date,
  meal_type text not null default 'snack' check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  food_name text not null,
  brand text,
  serving_qty numeric(8,2) not null default 1,
  serving_unit text not null default 'serving',
  calories numeric(7,2) not null default 0,
  protein_g numeric(7,2) not null default 0,
  carbs_g numeric(7,2) not null default 0,
  fat_g numeric(7,2) not null default 0,
  source text default 'usda',
  external_id text,
  created_at timestamptz not null default now()
);

alter table public.food_logs enable row level security;

create policy "Food logs are owner-only"
  on public.food_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists food_logs_user_date_idx on public.food_logs (user_id, logged_at desc);

-- ---------------------------------------------------------------------------
-- Goals (single row per user, upserted)
-- ---------------------------------------------------------------------------
create table if not exists public.goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  target_weight_kg numeric(6,2),
  weekly_workout_target int not null default 3,
  daily_calorie_target numeric(7,2),
  daily_protein_target_g numeric(6,2),
  daily_carbs_target_g numeric(6,2),
  daily_fat_target_g numeric(6,2),
  updated_at timestamptz not null default now()
);

alter table public.goals enable row level security;

create policy "Goals are owner-only"
  on public.goals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Seed a small global exercise library (visible to everyone, user_id = null)
-- ---------------------------------------------------------------------------
insert into public.exercises (name, muscle_group, equipment, instructions) values
  ('Barbell Back Squat', 'Legs', 'Barbell', 'Bar on upper back, feet shoulder-width, squat until hips below knees, drive up.'),
  ('Bench Press', 'Chest', 'Barbell', 'Lie on bench, lower bar to chest, press up to lockout.'),
  ('Deadlift', 'Back', 'Barbell', 'Hinge at hips, grip bar, drive through heels to stand tall, keep back neutral.'),
  ('Overhead Press', 'Shoulders', 'Barbell', 'Press bar from shoulders to overhead lockout, brace core.'),
  ('Pull-Up', 'Back', 'Bodyweight', 'Hang from bar, pull chin above bar, lower with control.'),
  ('Barbell Row', 'Back', 'Barbell', 'Hinge forward, row bar to lower ribs, squeeze shoulder blades.'),
  ('Dumbbell Shoulder Press', 'Shoulders', 'Dumbbell', 'Press dumbbells overhead from shoulder height.'),
  ('Dumbbell Bicep Curl', 'Arms', 'Dumbbell', 'Curl dumbbells to shoulders, control the descent.'),
  ('Tricep Pushdown', 'Arms', 'Cable', 'Push cable attachment down, extend elbows fully.'),
  ('Leg Press', 'Legs', 'Machine', 'Push platform away, control on the way back, avoid locking knees hard.'),
  ('Lat Pulldown', 'Back', 'Cable', 'Pull bar to upper chest, squeeze lats, control the return.'),
  ('Plank', 'Core', 'Bodyweight', 'Hold straight-body position on forearms and toes.'),
  ('Running (treadmill)', 'Cardio', 'Machine', 'Steady-state or interval running.'),
  ('Incline Dumbbell Press', 'Chest', 'Dumbbell', 'Press dumbbells up on an inclined bench.'),
  ('Romanian Deadlift', 'Legs', 'Barbell', 'Hinge at hips with slight knee bend, lower bar along legs, feel hamstring stretch.')
on conflict do nothing;
