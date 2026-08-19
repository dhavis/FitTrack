-- Food preferences + generated menu for nutrition plans

alter table public.nutrition_plans
  add column if not exists preferences jsonb not null default '{}'::jsonb,
  add column if not exists meal_menu jsonb;

comment on column public.nutrition_plans.preferences is
  'Interactive questionnaire answers: avoids, likes, meal-prep style, etc.';
comment on column public.nutrition_plans.meal_menu is
  'Generated flexible menu filtered by preferences.';