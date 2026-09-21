alter table public.routine_exercises
  add column if not exists weight_unit text
    check (weight_unit is null or weight_unit in ('kg', 'lb'));

comment on column public.routine_exercises.weight_unit is
  'NULL means inherit profiles.weight_unit';
