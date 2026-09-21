-- FitTrack Migration 0014: Set Techniques (Supersets, Powersets, Drop Sets)
-- Note: 0011 approve_adaptation_event creates workouts from adapted events.
-- Adapted prescriptions remain straight sets format for safety and do not alter routine blocks.

-- ---------------------------------------------------------------------------
-- 1. Routine Blocks
-- ---------------------------------------------------------------------------
create table if not exists public.routine_blocks (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines(id) on delete cascade,
  block_type text not null check (block_type in ('straight', 'superset', 'powerset')),
  name text not null,
  order_index int not null,
  target_rounds int not null default 3 check (target_rounds >= 1),
  rest_seconds int not null default 90 check (rest_seconds >= 0),
  created_at timestamptz not null default now(),
  unique (routine_id, order_index)
);

create index if not exists routine_blocks_routine_idx on public.routine_blocks (routine_id, order_index);

alter table public.routine_blocks enable row level security;

create policy "Routine blocks follow parent routine ownership"
  on public.routine_blocks for all
  using (exists (select 1 from public.routines r where r.id = routine_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.routines r where r.id = routine_id and r.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 2. Alter Routine Exercises: Add block_id and block_position
-- ---------------------------------------------------------------------------
alter table public.routine_exercises
  add column if not exists block_id uuid references public.routine_blocks(id) on delete cascade,
  add column if not exists block_position int not null default 0;

-- Backfill: for each existing routine_exercise without a block_id, insert a straight block
do $$
declare
  re record;
  new_block_id uuid;
begin
  for re in (select * from public.routine_exercises where block_id is null order by routine_id, order_index) loop
    insert into public.routine_blocks (
      routine_id,
      block_type,
      name,
      order_index,
      target_rounds,
      rest_seconds
    ) values (
      re.routine_id,
      'straight',
      'Straight sets',
      re.order_index,
      re.target_sets,
      re.rest_seconds
    ) returning id into new_block_id;

    update public.routine_exercises
    set block_id = new_block_id,
        block_position = 0
    where id = re.id;
  end loop;
end;
$$;

-- Enforce NOT NULL and unique constraint on block_id & block_position
alter table public.routine_exercises
  alter column block_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'routine_exercises_block_pos_unique'
  ) then
    alter table public.routine_exercises
      add constraint routine_exercises_block_pos_unique unique (block_id, block_position);
  end if;
end;
$$;

create index if not exists routine_exercises_block_idx on public.routine_exercises (block_id, block_position);

-- ---------------------------------------------------------------------------
-- 3. Triggers for Routine Blocks & Exercises sync and cardinality
-- ---------------------------------------------------------------------------
create or replace function public.sync_routine_block_to_exercises()
returns trigger language plpgsql set search_path = public as $$
begin
  -- Keep routine_exercises.target_sets and rest_seconds synchronized with the block
  update public.routine_exercises
  set target_sets = new.target_rounds,
      rest_seconds = new.rest_seconds
  where block_id = new.id;
  return new;
end;
$$;

drop trigger if exists trg_sync_routine_block_to_exercises on public.routine_blocks;
create trigger trg_sync_routine_block_to_exercises
  after update of target_rounds, rest_seconds on public.routine_blocks
  for each row execute procedure public.sync_routine_block_to_exercises();

create or replace function public.sync_routine_exercise_from_block()
returns trigger language plpgsql set search_path = public as $$
declare
  v_block public.routine_blocks%rowtype;
begin
  if new.block_id is not null then
    select * into v_block from public.routine_blocks where id = new.block_id;
    if found then
      new.target_sets := v_block.target_rounds;
      new.rest_seconds := v_block.rest_seconds;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_routine_exercise_from_block on public.routine_exercises;
create trigger trg_sync_routine_exercise_from_block
  before insert or update of block_id on public.routine_exercises
  for each row execute procedure public.sync_routine_exercise_from_block();

-- Cardinality enforcement trigger (deferrable so builder can insert rows in transaction)
create or replace function public.check_routine_block_cardinality()
returns trigger language plpgsql set search_path = public as $$
declare
  v_block record;
  v_block_id uuid;
begin
  if TG_TABLE_NAME = 'routine_exercises' then
    for v_block_id in select distinct unnest(array[coalesce(new.block_id, old.block_id)]) loop
      if v_block_id is not null then
        select rb.id, rb.block_type, count(re.id) as ex_count
        into v_block
        from public.routine_blocks rb
        left join public.routine_exercises re on re.block_id = rb.id
        where rb.id = v_block_id
        group by rb.id, rb.block_type;

        if found then
          if v_block.block_type = 'straight' and v_block.ex_count <> 1 then
            raise exception 'Straight block must contain exactly 1 exercise, found %', v_block.ex_count;
          elsif v_block.block_type = 'superset' and v_block.ex_count <> 2 then
            raise exception 'Superset block must contain exactly 2 exercises, found %', v_block.ex_count;
          elsif v_block.block_type = 'powerset' and (v_block.ex_count < 3 or v_block.ex_count > 6) then
            raise exception 'Powerset block must contain 3 to 6 exercises, found %', v_block.ex_count;
          end if;
        end if;
      end if;
    end loop;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_check_routine_block_cardinality_re on public.routine_exercises;
create constraint trigger trg_check_routine_block_cardinality_re
  after insert or update or delete on public.routine_exercises
  deferrable initially deferred
  for each row execute procedure public.check_routine_block_cardinality();

-- ---------------------------------------------------------------------------
-- 4. Routine Exercise Drop Steps
-- ---------------------------------------------------------------------------
create table if not exists public.routine_exercise_drop_steps (
  id uuid primary key default gen_random_uuid(),
  routine_exercise_id uuid not null references public.routine_exercises(id) on delete cascade,
  drop_index int not null check (drop_index between 1 and 3),
  target_reps int not null check (target_reps > 0),
  target_weight_kg numeric(6,2) check (target_weight_kg is null or target_weight_kg >= 0),
  weight_unit text check (weight_unit is null or weight_unit in ('kg', 'lb')),
  created_at timestamptz not null default now(),
  unique (routine_exercise_id, drop_index)
);

create index if not exists routine_exercise_drop_steps_re_idx
  on public.routine_exercise_drop_steps (routine_exercise_id, drop_index);

alter table public.routine_exercise_drop_steps enable row level security;

create policy "Routine exercise drop steps follow parent routine ownership"
  on public.routine_exercise_drop_steps for all
  using (exists (
    select 1 from public.routine_exercises re
    join public.routines r on r.id = re.routine_id
    where re.id = routine_exercise_id and r.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.routine_exercises re
    join public.routines r on r.id = re.routine_id
    where re.id = routine_exercise_id and r.user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- 5. Workout Plan Snapshots (workout_plan_blocks, exercises, drop steps)
-- ---------------------------------------------------------------------------
create table if not exists public.workout_plan_blocks (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  source_block_id uuid references public.routine_blocks(id) on delete set null,
  block_type text not null check (block_type in ('straight', 'superset', 'powerset')),
  name text not null,
  order_index int not null,
  target_rounds int not null default 3 check (target_rounds >= 1),
  rest_seconds int not null default 90 check (rest_seconds >= 0),
  created_at timestamptz not null default now(),
  unique (workout_id, order_index)
);

create index if not exists workout_plan_blocks_workout_idx
  on public.workout_plan_blocks (workout_id, order_index);

alter table public.workout_plan_blocks enable row level security;

create policy "Workout plan blocks follow parent workout ownership"
  on public.workout_plan_blocks for all
  using (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()))
  with check (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()));

create table if not exists public.workout_plan_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  plan_block_id uuid not null references public.workout_plan_blocks(id) on delete cascade,
  source_routine_exercise_id uuid references public.routine_exercises(id) on delete set null,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  block_position int not null default 0,
  target_sets int not null default 3 check (target_sets >= 1),
  target_reps int not null default 10 check (target_reps >= 1),
  target_weight_kg numeric(6,2),
  weight_unit text check (weight_unit is null or weight_unit in ('kg', 'lb')),
  rest_seconds int not null default 90 check (rest_seconds >= 0),
  created_at timestamptz not null default now(),
  unique (plan_block_id, block_position)
);

create index if not exists workout_plan_exercises_block_idx
  on public.workout_plan_exercises (plan_block_id, block_position);

create index if not exists workout_plan_exercises_workout_idx
  on public.workout_plan_exercises (workout_id);

alter table public.workout_plan_exercises enable row level security;

create policy "Workout plan exercises follow parent workout ownership"
  on public.workout_plan_exercises for all
  using (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()))
  with check (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()));

create table if not exists public.workout_plan_drop_steps (
  id uuid primary key default gen_random_uuid(),
  workout_plan_exercise_id uuid not null references public.workout_plan_exercises(id) on delete cascade,
  drop_index int not null check (drop_index between 1 and 3),
  target_reps int not null check (target_reps > 0),
  target_weight_kg numeric(6,2) check (target_weight_kg is null or target_weight_kg >= 0),
  weight_unit text check (weight_unit is null or weight_unit in ('kg', 'lb')),
  created_at timestamptz not null default now(),
  unique (workout_plan_exercise_id, drop_index)
);

create index if not exists workout_plan_drop_steps_ex_idx
  on public.workout_plan_drop_steps (workout_plan_exercise_id, drop_index);

alter table public.workout_plan_drop_steps enable row level security;

create policy "Workout plan drop steps follow parent workout ownership"
  on public.workout_plan_drop_steps for all
  using (exists (
    select 1 from public.workout_plan_exercises wpe
    join public.workouts w on w.id = wpe.workout_id
    where wpe.id = workout_plan_exercise_id and w.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.workout_plan_exercises wpe
    join public.workouts w on w.id = wpe.workout_id
    where wpe.id = workout_plan_exercise_id and w.user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- 6. Workout Live State
-- ---------------------------------------------------------------------------
create table if not exists public.workout_live_state (
  workout_id uuid primary key references public.workouts(id) on delete cascade,
  phase text not null default 'regular' check (phase in ('regular', 'drop', 'rest', 'complete')),
  current_block_order int not null default 0,
  current_round int not null default 1,
  current_exercise_position int not null default 0,
  current_drop_index int check (current_drop_index is null or (current_drop_index between 1 and 3)),
  rest_started_at timestamptz,
  rest_ends_at timestamptz,
  version int not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.workout_live_state enable row level security;

create policy "Workout live state follows parent workout ownership"
  on public.workout_live_state for all
  using (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()))
  with check (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 7. Alter Workout Sets: Support technique references, types, drops, and rounds
-- ---------------------------------------------------------------------------
alter table public.workout_sets
  add column if not exists workout_plan_exercise_id uuid references public.workout_plan_exercises(id) on delete set null,
  add column if not exists set_type text not null default 'regular' check (set_type in ('regular', 'drop')),
  add column if not exists drop_index int,
  add column if not exists round_index int;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workout_sets_drop_type_check'
  ) then
    alter table public.workout_sets
      add constraint workout_sets_drop_type_check
      check ((set_type = 'regular' and drop_index is null) or (set_type = 'drop' and drop_index between 1 and 3));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. RPC: init_workout_plan
-- ---------------------------------------------------------------------------
create or replace function public.init_workout_plan(p_workout_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_workout public.workouts%rowtype;
  v_block record;
  v_ex record;
  v_drop record;
  v_new_block_id uuid;
  v_new_plan_ex_id uuid;
  v_existing_count int;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select * into v_workout
  from public.workouts
  where id = p_workout_id and user_id = v_user_id;

  if not found then
    raise exception 'Workout not found or not owned';
  end if;

  select count(*) into v_existing_count
  from public.workout_plan_blocks
  where workout_id = p_workout_id;

  if v_existing_count > 0 then
    -- Plan already initialized
    return jsonb_build_object('status', 'already_initialized', 'workout_id', p_workout_id);
  end if;

  if v_workout.routine_id is not null then
    -- Copy routine_blocks -> workout_plan_blocks
    for v_block in (
      select * from public.routine_blocks
      where routine_id = v_workout.routine_id
      order by order_index
    ) loop
      insert into public.workout_plan_blocks (
        workout_id,
        source_block_id,
        block_type,
        name,
        order_index,
        target_rounds,
        rest_seconds
      ) values (
        p_workout_id,
        v_block.id,
        v_block.block_type,
        v_block.name,
        v_block.order_index,
        v_block.target_rounds,
        v_block.rest_seconds
      ) returning id into v_new_block_id;

      -- Copy routine_exercises for this block
      for v_ex in (
        select * from public.routine_exercises
        where routine_id = v_workout.routine_id and block_id = v_block.id
        order by block_position
      ) loop
        insert into public.workout_plan_exercises (
          workout_id,
          plan_block_id,
          source_routine_exercise_id,
          exercise_id,
          block_position,
          target_sets,
          target_reps,
          target_weight_kg,
          weight_unit,
          rest_seconds
        ) values (
          p_workout_id,
          v_new_block_id,
          v_ex.id,
          v_ex.exercise_id,
          v_ex.block_position,
          v_ex.target_sets,
          v_ex.target_reps,
          v_ex.target_weight_kg,
          v_ex.weight_unit,
          v_ex.rest_seconds
        ) returning id into v_new_plan_ex_id;

        -- Copy drop steps
        for v_drop in (
          select * from public.routine_exercise_drop_steps
          where routine_exercise_id = v_ex.id
          order by drop_index
        ) loop
          insert into public.workout_plan_drop_steps (
            workout_plan_exercise_id,
            drop_index,
            target_reps,
            target_weight_kg,
            weight_unit
          ) values (
            v_new_plan_ex_id,
            v_drop.drop_index,
            v_drop.target_reps,
            v_drop.target_weight_kg,
            v_drop.weight_unit
          );
        end loop;
      end loop;
    end loop;
  end if;

  -- Ensure workout_live_state row exists
  insert into public.workout_live_state (
    workout_id,
    phase,
    current_block_order,
    current_round,
    current_exercise_position,
    current_drop_index,
    version
  ) values (
    p_workout_id,
    'regular',
    0,
    1,
    0,
    null,
    1
  ) on conflict (workout_id) do nothing;

  return jsonb_build_object('status', 'initialized', 'workout_id', p_workout_id);
end;
$$;

grant execute on function public.init_workout_plan(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. RPC: log_workout_set_and_advance
-- ---------------------------------------------------------------------------
/*
 * RPC: log_workout_set_and_advance
 * Inserts a workout_set and advances the workout_live_state with optimistic version checking.
 *
 * Parameters:
 *   p_workout_id: UUID of active workout (must belong to auth.uid())
 *   p_exercise_id: UUID of exercise performed
 *   p_plan_exercise_id: UUID of workout_plan_exercises row (optional)
 *   p_set_index: Sequence index of set in workout
 *   p_reps: Number of reps completed
 *   p_weight_kg: Weight logged in kg
 *   p_set_type: 'regular' or 'drop'
 *   p_drop_index: 1..3 if drop, null if regular
 *   p_round_index: Round number within block
 *   p_next_phase: 'regular' | 'drop' | 'rest' | 'complete'
 *   p_next_block_order: Next block order index
 *   p_next_round: Next round index
 *   p_next_exercise_position: Next exercise position in block
 *   p_next_drop_index: Next drop index or null
 *   p_rest_seconds: Optional rest countdown in seconds
 *   p_expected_version: Expected live state version for optimistic concurrency
 */
create or replace function public.log_workout_set_and_advance(
  p_workout_id uuid,
  p_exercise_id uuid,
  p_plan_exercise_id uuid,
  p_set_index int,
  p_reps int,
  p_weight_kg numeric,
  p_set_type text,
  p_drop_index int,
  p_round_index int,
  p_next_phase text,
  p_next_block_order int,
  p_next_round int,
  p_next_exercise_position int,
  p_next_drop_index int,
  p_rest_seconds int,
  p_expected_version int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_workout public.workouts%rowtype;
  v_new_set public.workout_sets%rowtype;
  v_rest_ends timestamptz;
  v_updated_rows int;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select * into v_workout
  from public.workouts
  where id = p_workout_id and user_id = v_user_id;

  if not found then
    raise exception 'Workout not found or not owned';
  end if;

  -- Insert set
  insert into public.workout_sets (
    workout_id,
    exercise_id,
    workout_plan_exercise_id,
    set_index,
    reps,
    weight_kg,
    set_type,
    drop_index,
    round_index,
    completed_at
  ) values (
    p_workout_id,
    p_exercise_id,
    p_plan_exercise_id,
    p_set_index,
    p_reps,
    p_weight_kg,
    coalesce(p_set_type, 'regular'),
    p_drop_index,
    p_round_index,
    now()
  ) returning * into v_new_set;

  if p_rest_seconds is not null and p_rest_seconds > 0 and p_next_phase = 'rest' then
    v_rest_ends := now() + (p_rest_seconds || ' seconds')::interval;
  else
    v_rest_ends := null;
  end if;

  -- Advance live state
  update public.workout_live_state
  set phase = p_next_phase,
      current_block_order = p_next_block_order,
      current_round = p_next_round,
      current_exercise_position = p_next_exercise_position,
      current_drop_index = p_next_drop_index,
      rest_started_at = case when p_next_phase = 'rest' then now() else null end,
      rest_ends_at = v_rest_ends,
      version = version + 1,
      updated_at = now()
  where workout_id = p_workout_id and version = p_expected_version;

  get diagnostics v_updated_rows = row_count;
  if v_updated_rows = 0 then
    -- Concurrency conflict or row missing; upsert to keep live
    insert into public.workout_live_state (
      workout_id,
      phase,
      current_block_order,
      current_round,
      current_exercise_position,
      current_drop_index,
      rest_started_at,
      rest_ends_at,
      version
    ) values (
      p_workout_id,
      p_next_phase,
      p_next_block_order,
      p_next_round,
      p_next_exercise_position,
      p_next_drop_index,
      case when p_next_phase = 'rest' then now() else null end,
      v_rest_ends,
      p_expected_version + 1
    )
    on conflict (workout_id) do update
      set phase = excluded.phase,
          current_block_order = excluded.current_block_order,
          current_round = excluded.current_round,
          current_exercise_position = excluded.current_exercise_position,
          current_drop_index = excluded.current_drop_index,
          rest_started_at = excluded.rest_started_at,
          rest_ends_at = excluded.rest_ends_at,
          version = workout_live_state.version + 1,
          updated_at = now();
  end if;

  return jsonb_build_object(
    'set_id', v_new_set.id,
    'workout_id', p_workout_id,
    'phase', p_next_phase,
    'version', p_expected_version + 1
  );
end;
$$;

grant execute on function public.log_workout_set_and_advance(
  uuid, uuid, uuid, int, int, numeric, text, int, int, text, int, int, int, int, int, int
) to authenticated;
