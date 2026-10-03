-- FitTrack Migration 0018: Custom Meals
-- Date-scoped named meals. Food rows stay; removal moves them to Snacks.

create table public.custom_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_date date not null,
  name text not null,
  creation_order bigint generated always as identity,
  created_at timestamptz not null default now(),
  constraint custom_meals_name_trimmed_check
    check (name = btrim(name)),
  constraint custom_meals_name_length_check
    check (char_length(name) between 1 and 40),
  constraint custom_meals_id_user_date_key
    unique (id, user_id, meal_date)
);

create index custom_meals_user_date_order_idx
  on public.custom_meals (user_id, meal_date, creation_order);

alter table public.custom_meals enable row level security;

create policy "Custom meals are viewable by owner"
  on public.custom_meals for select
  using (auth.uid() = user_id);

create policy "Custom meals are insertable by owner"
  on public.custom_meals for insert
  with check (auth.uid() = user_id);

create policy "Custom meals are editable by owner"
  on public.custom_meals for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Custom meals are deletable by owner"
  on public.custom_meals for delete
  using (auth.uid() = user_id);

alter table public.food_logs
  add column custom_meal_id uuid;

alter table public.food_logs
  add constraint food_logs_custom_meal_owner_date_fkey
  foreign key (custom_meal_id, user_id, logged_at)
  references public.custom_meals (id, user_id, meal_date);

alter table public.food_logs
  add constraint food_logs_custom_meal_snack_check
  check (custom_meal_id is null or meal_type = 'snack');

create or replace function public.remove_custom_meal(p_meal_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_reassigned_count integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  perform 1
  from public.custom_meals
  where id = p_meal_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Custom meal not found or not owned';
  end if;

  update public.food_logs
  set custom_meal_id = null,
      meal_type = 'snack'
  where custom_meal_id = p_meal_id
    and user_id = v_user_id;

  get diagnostics v_reassigned_count = row_count;

  delete from public.custom_meals
  where id = p_meal_id
    and user_id = v_user_id;

  return v_reassigned_count;
end;
$$;

revoke execute on function public.remove_custom_meal(uuid) from public;
revoke execute on function public.remove_custom_meal(uuid) from anon;
grant execute on function public.remove_custom_meal(uuid) to authenticated;
