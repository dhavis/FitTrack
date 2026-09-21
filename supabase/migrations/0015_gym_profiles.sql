-- FitTrack Migration 0015: Gym Profiles
-- 0014 is set techniques; do not reuse that number.

-- ---------------------------------------------------------------------------
-- 1. Gym profiles and exclusions
-- ---------------------------------------------------------------------------
create table public.gym_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  base_preset text not null check (
    base_preset in (
      'full_gym',
      'free_weights',
      'dumbbells',
      'bodyweight',
      'mixed'
    )
  ),
  kind text not null check (kind in ('permanent', 'temporary')),
  is_main boolean not null default false,
  expires_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (kind = 'permanent' and expires_at is null)
    or
    (kind = 'temporary' and expires_at is not null)
  ),
  check (
    not is_main
    or (kind = 'permanent' and archived_at is null)
  )
);

create unique index gym_profiles_one_main_per_user_idx
  on public.gym_profiles (user_id)
  where is_main and archived_at is null;

create index gym_profiles_user_active_idx
  on public.gym_profiles (user_id, archived_at, created_at desc);

create index gym_profiles_expiring_idx
  on public.gym_profiles (expires_at)
  where kind = 'temporary' and archived_at is null;

create table public.gym_profile_excluded_equipment (
  gym_profile_id uuid not null
    references public.gym_profiles(id) on delete cascade,
  equipment_type text not null check (
    equipment_type in (
      'barbell',
      'dumbbell',
      'kettlebell',
      'cable',
      'machine',
      'bodyweight',
      'band'
    )
  ),
  primary key (gym_profile_id, equipment_type)
);

create table public.gym_profile_excluded_exercises (
  gym_profile_id uuid not null
    references public.gym_profiles(id) on delete cascade,
  exercise_id uuid not null
    references public.exercises(id) on delete cascade,
  primary key (gym_profile_id, exercise_id)
);

-- ---------------------------------------------------------------------------
-- 2. Active profile and historical snapshots
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column active_gym_profile_id uuid
    references public.gym_profiles(id) on delete set null;

alter table public.training_programs
  add column gym_profile_id uuid
    references public.gym_profiles(id) on delete set null,
  add column gym_profile_snapshot jsonb
    check (
      gym_profile_snapshot is null
      or jsonb_typeof(gym_profile_snapshot) = 'object'
    );

alter table public.workouts
  add column gym_profile_id uuid
    references public.gym_profiles(id) on delete set null,
  add column gym_profile_snapshot jsonb
    check (
      gym_profile_snapshot is null
      or jsonb_typeof(gym_profile_snapshot) = 'object'
    );

alter table if exists public.coach_plans
  add column if not exists gym_profile_snapshot jsonb
    check (
      gym_profile_snapshot is null
      or jsonb_typeof(gym_profile_snapshot) = 'object'
    );

create index training_programs_gym_profile_idx
  on public.training_programs (gym_profile_id)
  where gym_profile_id is not null;

create index workouts_gym_profile_idx
  on public.workouts (gym_profile_id)
  where gym_profile_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.gym_profiles enable row level security;
alter table public.gym_profile_excluded_equipment enable row level security;
alter table public.gym_profile_excluded_exercises enable row level security;

create policy "Gym profiles are viewable by owner"
  on public.gym_profiles
  for select
  using (auth.uid() = user_id);

create policy "Gym profiles are insertable by owner"
  on public.gym_profiles
  for insert
  with check (auth.uid() = user_id);

create policy "Gym profiles are editable by owner"
  on public.gym_profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Gym profiles are deletable by owner"
  on public.gym_profiles
  for delete
  using (auth.uid() = user_id);

create policy "Gym equipment exclusions follow profile ownership"
  on public.gym_profile_excluded_equipment
  for all
  using (
    exists (
      select 1
      from public.gym_profiles gp
      where gp.id = gym_profile_id
        and gp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.gym_profiles gp
      where gp.id = gym_profile_id
        and gp.user_id = auth.uid()
    )
  );

create policy "Gym exercise exclusions follow profile ownership"
  on public.gym_profile_excluded_exercises
  for all
  using (
    exists (
      select 1
      from public.gym_profiles gp
      where gp.id = gym_profile_id
        and gp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.gym_profiles gp
      where gp.id = gym_profile_id
        and gp.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Backfill
-- ---------------------------------------------------------------------------

insert into public.profiles (id, display_name)
select g.user_id, null
from public.goals g
where not exists (
  select 1
  from public.profiles p
  where p.id = g.user_id
);

insert into public.gym_profiles (
  user_id,
  name,
  base_preset,
  kind,
  is_main
)
select
  users.user_id,
  'Main gym',
  coalesce(g.equipment_pref, 'full_gym'),
  'permanent',
  true
from (
  select id as user_id from public.profiles
  union
  select user_id from public.goals
) users
left join public.goals g
  on g.user_id = users.user_id
where not exists (
  select 1
  from public.gym_profiles gp
  where gp.user_id = users.user_id
    and gp.is_main
    and gp.archived_at is null
);

update public.profiles p
set active_gym_profile_id = gp.id
from public.gym_profiles gp
where gp.user_id = p.id
  and gp.is_main
  and gp.archived_at is null
  and p.active_gym_profile_id is null;

-- ---------------------------------------------------------------------------
-- 5. Integrity and synchronization triggers
-- ---------------------------------------------------------------------------
create or replace function public.set_gym_profile_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger set_gym_profile_updated_at
  before update on public.gym_profiles
  for each row
  execute procedure public.set_gym_profile_updated_at();

create or replace function public.validate_active_gym_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.active_gym_profile_id is not null
     and not exists (
       select 1
       from public.gym_profiles gp
       where gp.id = new.active_gym_profile_id
         and gp.user_id = new.id
         and gp.archived_at is null
         and (
           gp.kind = 'permanent'
           or gp.expires_at > now()
         )
     )
  then
    raise exception 'Active gym profile must be an available profile owned by the user';
  end if;

  return new;
end;
$$;

create trigger validate_active_gym_profile
  before insert or update of active_gym_profile_id
  on public.profiles
  for each row
  execute procedure public.validate_active_gym_profile();

create or replace function public.sync_main_gym_profile_equipment_pref()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_main and new.archived_at is null then
    insert into public.goals (user_id, equipment_pref)
    values (new.user_id, new.base_preset)
    on conflict (user_id) do update
      set equipment_pref = excluded.equipment_pref,
          updated_at = now();
  end if;

  return new;
end;
$$;

create trigger sync_main_gym_profile_equipment_pref
  after insert or update of is_main, archived_at, base_preset
  on public.gym_profiles
  for each row
  execute procedure public.sync_main_gym_profile_equipment_pref();

create or replace function public.enforce_one_main_gym_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_main_count integer;
  v_in_domain boolean;
begin
  v_user_id := case
    when tg_op = 'DELETE' then old.user_id
    else new.user_id
  end;

  if not exists (
    select 1
    from auth.users u
    where u.id = v_user_id
  ) then
    return null;
  end if;

  select (
    exists (
      select 1 from public.profiles p where p.id = v_user_id
    )
    or exists (
      select 1 from public.goals g where g.user_id = v_user_id
    )
    or exists (
      select 1
      from public.gym_profiles gp
      where gp.user_id = v_user_id
    )
  )
  into v_in_domain;

  if not v_in_domain then
    return null;
  end if;

  select count(*)
  into v_main_count
  from public.gym_profiles gp
  where gp.user_id = v_user_id
    and gp.is_main
    and gp.archived_at is null;

  if v_main_count <> 1 then
    raise exception
      'User % must have exactly one unarchived Main gym profile; found %',
      v_user_id,
      v_main_count;
  end if;

  return null;
end;
$$;

create constraint trigger enforce_one_main_gym_profile
  after insert or update or delete
  on public.gym_profiles
  deferrable initially deferred
  for each row
  execute procedure public.enforce_one_main_gym_profile();

create or replace function public.protect_gym_profile_snapshots()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (to_jsonb(new) -> 'gym_profile_snapshot')
       is distinct from
     (to_jsonb(old) -> 'gym_profile_snapshot')
  then
    raise exception 'Gym profile snapshot is immutable after insert';
  end if;

  if tg_table_name in ('training_programs', 'workouts')
     and (to_jsonb(new) -> 'gym_profile_id')
          is distinct from
         (to_jsonb(old) -> 'gym_profile_id')
  then
    raise exception 'Gym profile association is immutable after insert';
  end if;

  return new;
end;
$$;

create trigger protect_training_program_gym_snapshot
  before update on public.training_programs
  for each row
  execute procedure public.protect_gym_profile_snapshots();

create trigger protect_workout_gym_snapshot
  before update on public.workouts
  for each row
  execute procedure public.protect_gym_profile_snapshots();

do $$
begin
  if to_regclass('public.coach_plans') is not null then
    execute '
      create trigger protect_coach_plan_gym_snapshot
      before update on public.coach_plans
      for each row
      execute procedure public.protect_gym_profile_snapshots()
    ';
  end if;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gym_profile_id uuid;
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));

  insert into public.gym_profiles (
    user_id,
    name,
    base_preset,
    kind,
    is_main
  )
  values (
    new.id,
    'Main gym',
    'full_gym',
    'permanent',
    true
  )
  returning id into v_gym_profile_id;

  update public.profiles
  set active_gym_profile_id = v_gym_profile_id
  where id = new.id;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. RPC: resolve Active, archive expired temporary profiles, fallback to Main
-- ---------------------------------------------------------------------------
create or replace function public.resolve_active_gym_profile()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_profile public.gym_profiles%rowtype;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  perform 1
  from public.profiles p
  where p.id = v_user_id
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;

  update public.gym_profiles
  set archived_at = now()
  where user_id = v_user_id
    and kind = 'temporary'
    and archived_at is null
    and expires_at <= now();

  select gp.*
  into v_profile
  from public.profiles p
  join public.gym_profiles gp
    on gp.id = p.active_gym_profile_id
  where p.id = v_user_id
    and gp.user_id = v_user_id
    and gp.archived_at is null
    and (
      gp.kind = 'permanent'
      or gp.expires_at > now()
    );

  if not found then
    select gp.*
    into v_profile
    from public.gym_profiles gp
    where gp.user_id = v_user_id
      and gp.is_main
      and gp.archived_at is null;

    if not found then
      raise exception 'Main gym profile not found';
    end if;

    update public.profiles
    set active_gym_profile_id = v_profile.id
    where id = v_user_id;
  end if;

  return jsonb_build_object(
    'profile', to_jsonb(v_profile),
    'excluded_equipment', coalesce(
      (
        select jsonb_agg(e.equipment_type order by e.equipment_type)
        from public.gym_profile_excluded_equipment e
        where e.gym_profile_id = v_profile.id
      ),
      '[]'::jsonb
    ),
    'excluded_exercise_ids', coalesce(
      (
        select jsonb_agg(e.exercise_id order by e.exercise_id)
        from public.gym_profile_excluded_exercises e
        where e.gym_profile_id = v_profile.id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. RPC: set Main without changing Active
-- ---------------------------------------------------------------------------
create or replace function public.set_main_gym_profile(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_profile public.gym_profiles%rowtype;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  perform 1
  from public.profiles
  where id = v_user_id
  for update;

  select *
  into v_profile
  from public.gym_profiles
  where id = p_profile_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Gym profile not found';
  end if;

  if v_profile.kind <> 'permanent' then
    raise exception 'A temporary gym profile cannot be Main';
  end if;

  if v_profile.archived_at is not null then
    raise exception 'An archived gym profile cannot be Main';
  end if;

  update public.gym_profiles
  set is_main = false
  where user_id = v_user_id
    and is_main
    and id <> p_profile_id;

  update public.gym_profiles
  set is_main = true
  where id = p_profile_id
  returning * into v_profile;

  return to_jsonb(v_profile);
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. RPC: set Active
-- ---------------------------------------------------------------------------
create or replace function public.set_active_gym_profile(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_profile public.gym_profiles%rowtype;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  perform 1
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;

  select *
  into v_profile
  from public.gym_profiles
  where id = p_profile_id
    and user_id = v_user_id
    and archived_at is null
    and (
      kind = 'permanent'
      or expires_at > now()
    )
  for update;

  if not found then
    raise exception 'Gym profile is unavailable or not owned';
  end if;

  update public.profiles
  set active_gym_profile_id = p_profile_id
  where id = v_user_id;

  return to_jsonb(v_profile);
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. RPC: save profile and replace optional exclusions
-- ---------------------------------------------------------------------------
create or replace function public.save_gym_profile(
  p_profile_id uuid default null,
  p_name text default null,
  p_base_preset text default null,
  p_kind text default 'permanent',
  p_expires_at timestamptz default null,
  p_excluded_equipment text[] default null,
  p_excluded_exercise_ids uuid[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_profile public.gym_profiles%rowtype;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  perform 1
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;

  if p_kind not in ('permanent', 'temporary') then
    raise exception 'Invalid gym profile kind';
  end if;

  if p_kind = 'temporary' and p_expires_at is null then
    raise exception 'Temporary gym profiles require an expiration time';
  end if;

  if p_kind = 'permanent' and p_expires_at is not null then
    raise exception 'Permanent gym profiles cannot have an expiration time';
  end if;

  if p_excluded_exercise_ids is not null
     and exists (
       select 1
       from unnest(p_excluded_exercise_ids) requested(exercise_id)
       left join public.exercises e
         on e.id = requested.exercise_id
       where e.id is null
          or (e.user_id is not null and e.user_id <> v_user_id)
     )
  then
    raise exception 'Excluded exercise is unavailable or not owned';
  end if;

  if p_profile_id is null then
    insert into public.gym_profiles (
      user_id,
      name,
      base_preset,
      kind,
      expires_at
    )
    values (
      v_user_id,
      btrim(p_name),
      coalesce(p_base_preset, 'full_gym'),
      p_kind,
      p_expires_at
    )
    returning * into v_profile;
  else
    select *
    into v_profile
    from public.gym_profiles
    where id = p_profile_id
      and user_id = v_user_id
    for update;

    if not found then
      raise exception 'Gym profile not found';
    end if;

    if v_profile.archived_at is not null then
      raise exception 'Archived gym profiles cannot be edited';
    end if;

    if v_profile.is_main and p_kind <> 'permanent' then
      raise exception 'Main gym profile must remain permanent';
    end if;

    update public.gym_profiles
    set name = coalesce(btrim(p_name), name),
        base_preset = coalesce(p_base_preset, base_preset),
        kind = p_kind,
        expires_at = case
          when p_kind = 'temporary' then p_expires_at
          else null
        end
    where id = p_profile_id
    returning * into v_profile;
  end if;

  if p_excluded_equipment is not null then
    delete from public.gym_profile_excluded_equipment
    where gym_profile_id = v_profile.id;

    insert into public.gym_profile_excluded_equipment (
      gym_profile_id,
      equipment_type
    )
    select v_profile.id, equipment_type
    from unnest(p_excluded_equipment) equipment(equipment_type)
    on conflict do nothing;
  end if;

  if p_excluded_exercise_ids is not null then
    delete from public.gym_profile_excluded_exercises
    where gym_profile_id = v_profile.id;

    insert into public.gym_profile_excluded_exercises (
      gym_profile_id,
      exercise_id
    )
    select v_profile.id, exercise_id
    from unnest(p_excluded_exercise_ids) requested(exercise_id)
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'profile', to_jsonb(v_profile),
    'excluded_equipment', coalesce(
      (
        select jsonb_agg(e.equipment_type order by e.equipment_type)
        from public.gym_profile_excluded_equipment e
        where e.gym_profile_id = v_profile.id
      ),
      '[]'::jsonb
    ),
    'excluded_exercise_ids', coalesce(
      (
        select jsonb_agg(e.exercise_id order by e.exercise_id)
        from public.gym_profile_excluded_exercises e
        where e.gym_profile_id = v_profile.id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. RPC: end temporary profile
-- ---------------------------------------------------------------------------
create or replace function public.end_temporary_gym_profile(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_profile public.gym_profiles%rowtype;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select *
  into v_profile
  from public.gym_profiles
  where id = p_profile_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Gym profile not found';
  end if;

  if v_profile.kind <> 'temporary' then
    raise exception 'Gym profile is not temporary';
  end if;

  update public.gym_profiles
  set archived_at = coalesce(archived_at, now())
  where id = p_profile_id;

  return public.resolve_active_gym_profile();
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. RPC: convert temporary profile to permanent
-- ---------------------------------------------------------------------------
create or replace function public.convert_gym_profile_to_permanent(
  p_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_profile public.gym_profiles%rowtype;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select *
  into v_profile
  from public.gym_profiles
  where id = p_profile_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Gym profile not found';
  end if;

  if v_profile.archived_at is not null then
    raise exception 'Archived gym profiles cannot be converted';
  end if;

  if v_profile.kind <> 'temporary' then
    raise exception 'Gym profile is already permanent';
  end if;

  update public.gym_profiles
  set kind = 'permanent',
      expires_at = null
  where id = p_profile_id
  returning * into v_profile;

  return to_jsonb(v_profile);
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. RPC: archive a non-Main profile
-- ---------------------------------------------------------------------------
create or replace function public.archive_gym_profile(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_profile public.gym_profiles%rowtype;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select *
  into v_profile
  from public.gym_profiles
  where id = p_profile_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Gym profile not found';
  end if;

  if v_profile.is_main then
    raise exception 'Main gym profile cannot be archived';
  end if;

  update public.gym_profiles
  set archived_at = coalesce(archived_at, now())
  where id = p_profile_id;

  return public.resolve_active_gym_profile();
end;
$$;

-- ---------------------------------------------------------------------------
-- 13. RPC permissions
-- ---------------------------------------------------------------------------
revoke all on function public.resolve_active_gym_profile() from public;
revoke all on function public.set_main_gym_profile(uuid) from public;
revoke all on function public.set_active_gym_profile(uuid) from public;
revoke all on function public.save_gym_profile(
  uuid,
  text,
  text,
  text,
  timestamptz,
  text[],
  uuid[]
) from public;
revoke all on function public.end_temporary_gym_profile(uuid) from public;
revoke all on function public.convert_gym_profile_to_permanent(uuid) from public;
revoke all on function public.archive_gym_profile(uuid) from public;

grant execute on function public.resolve_active_gym_profile()
  to authenticated;
grant execute on function public.set_main_gym_profile(uuid)
  to authenticated;
grant execute on function public.set_active_gym_profile(uuid)
  to authenticated;
grant execute on function public.save_gym_profile(
  uuid,
  text,
  text,
  text,
  timestamptz,
  text[],
  uuid[]
) to authenticated;
grant execute on function public.end_temporary_gym_profile(uuid)
  to authenticated;
grant execute on function public.convert_gym_profile_to_permanent(uuid)
  to authenticated;
grant execute on function public.archive_gym_profile(uuid)
  to authenticated;
