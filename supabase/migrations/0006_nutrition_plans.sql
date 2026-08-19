-- Supporting nutrition plan (1:1 with user), fully editable parameters

create table if not exists public.nutrition_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_calorie_target numeric(7,2),
  daily_protein_g numeric(6,2),
  daily_carbs_g numeric(6,2),
  daily_fat_g numeric(6,2),
  daily_fiber_g numeric(6,2),
  water_ml numeric(7,2),
  meals_per_day int not null default 4 check (meals_per_day >= 1 and meals_per_day <= 8),
  breakfast_kcal numeric(7,2),
  lunch_kcal numeric(7,2),
  dinner_kcal numeric(7,2),
  snack_kcal numeric(7,2),
  protein_g_per_kg numeric(4,2),
  calorie_adjustment_pct numeric(5,2),
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.nutrition_plans enable row level security;

drop policy if exists "Nutrition plans are owner-only" on public.nutrition_plans;
create policy "Nutrition plans are owner-only"
  on public.nutrition_plans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);