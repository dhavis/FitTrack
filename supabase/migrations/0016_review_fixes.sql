-- FitTrack Migration 0016: Review Fixes
-- 1. init_workout_plan: Apply approved adaptation event prescriptions as straight blocks
-- 2. save_routine_with_blocks: Transactional RPC for saving routines with blocks and drop steps

-- ---------------------------------------------------------------------------
-- 1. Update init_workout_plan RPC
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
  v_event public.adaptation_events%rowtype;
  v_block record;
  v_ex record;
  v_drop record;
  v_new_block_id uuid;
  v_new_plan_ex_id uuid;
  v_existing_count int;
  v_prescribed_exercises jsonb;
  v_item jsonb;
  v_idx int;
  v_exercise_id uuid;
  v_target_sets int;
  v_target_reps int;
  v_target_weight_kg numeric;
  v_rest_seconds int;
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

  -- 1. If adaptation_event_id is present, snapshot prescribed exercises as straight blocks
  if v_workout.adaptation_event_id is not null then
    select * into v_event
    from public.adaptation_events
    where id = v_workout.adaptation_event_id and user_id = v_user_id;

    if found and v_event.validated_prescription is not null and (v_event.validated_prescription ? 'exercises') then
      v_prescribed_exercises := v_event.validated_prescription->'exercises';
      if jsonb_typeof(v_prescribed_exercises) = 'array' and jsonb_array_length(v_prescribed_exercises) > 0 then
        v_idx := 0;
        for v_item in select * from jsonb_array_elements(v_prescribed_exercises) loop
          v_exercise_id := (v_item->>'exercise_id')::uuid;
          v_target_sets := coalesce((v_item->>'target_sets')::int, 3);
          v_target_reps := coalesce((v_item->>'target_reps')::int, 10);
          v_target_weight_kg := case when (v_item->>'target_weight_kg') is not null then (v_item->>'target_weight_kg')::numeric else null end;
          v_rest_seconds := coalesce((v_item->>'rest_seconds')::int, 90);

          -- Insert straight block
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
            null,
            'straight',
            'Straight sets',
            v_idx,
            v_target_sets,
            v_rest_seconds
          ) returning id into v_new_block_id;

          -- Insert single exercise for straight block
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
            null,
            v_exercise_id,
            0,
            v_target_sets,
            v_target_reps,
            v_target_weight_kg,
            null,
            v_rest_seconds
          );

          v_idx := v_idx + 1;
        end loop;
      end if;
    end if;
  elsif v_workout.routine_id is not null then
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
-- 2. Transactional save_routine_with_blocks RPC
-- ---------------------------------------------------------------------------
create or replace function public.save_routine_with_blocks(
  p_routine_id uuid,
  p_name text,
  p_description text,
  p_blocks jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_routine_id uuid;
  v_block_elem jsonb;
  v_ex_elem jsonb;
  v_drop_elem jsonb;
  v_block_id uuid;
  v_ex_id uuid;
  v_b_idx int := 0;
  v_e_idx int := 0;
  v_overall_idx int := 0;
  v_d_idx int := 0;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if p_routine_id is not null then
    -- Verify ownership
    select id into v_routine_id
    from public.routines
    where id = p_routine_id and user_id = v_user_id;

    if not found then
      raise exception 'Routine not found or not owned';
    end if;

    update public.routines
    set name = p_name,
        description = p_description
    where id = p_routine_id;
  else
    insert into public.routines (user_id, name, description)
    values (v_user_id, p_name, p_description)
    returning id into v_routine_id;
  end if;

  -- Delete existing blocks (cascades exercises & drop steps)
  delete from public.routine_blocks
  where routine_id = v_routine_id;

  -- Insert new blocks, exercises, drop steps
  if p_blocks is not null and jsonb_typeof(p_blocks) = 'array' then
    for v_block_elem in select * from jsonb_array_elements(p_blocks) loop
      insert into public.routine_blocks (
        routine_id,
        block_type,
        name,
        order_index,
        target_rounds,
        rest_seconds
      ) values (
        v_routine_id,
        v_block_elem->>'block_type',
        coalesce(v_block_elem->>'name', 'Block'),
        v_b_idx,
        coalesce((v_block_elem->>'target_rounds')::int, 3),
        coalesce((v_block_elem->>'rest_seconds')::int, 90)
      ) returning id into v_block_id;

      v_e_idx := 0;
      if v_block_elem ? 'exercises' and jsonb_typeof(v_block_elem->'exercises') = 'array' then
        for v_ex_elem in select * from jsonb_array_elements(v_block_elem->'exercises') loop
          insert into public.routine_exercises (
            routine_id,
            block_id,
            block_position,
            exercise_id,
            order_index,
            target_sets,
            target_reps,
            target_weight_kg,
            weight_unit,
            rest_seconds
          ) values (
            v_routine_id,
            v_block_id,
            v_e_idx,
            (v_ex_elem->>'exercise_id')::uuid,
            v_overall_idx,
            coalesce((v_block_elem->>'target_rounds')::int, 3),
            coalesce((v_ex_elem->>'target_reps')::int, 10),
            case when (v_ex_elem->>'target_weight_kg') is not null and (v_ex_elem->>'target_weight_kg') <> '' then (v_ex_elem->>'target_weight_kg')::numeric else null end,
            v_ex_elem->>'weight_unit',
            coalesce((v_block_elem->>'rest_seconds')::int, 90)
          ) returning id into v_ex_id;

          if v_ex_elem ? 'drop_steps' and jsonb_typeof(v_ex_elem->'drop_steps') = 'array' then
            v_d_idx := 1;
            for v_drop_elem in select * from jsonb_array_elements(v_ex_elem->'drop_steps') loop
              insert into public.routine_exercise_drop_steps (
                routine_exercise_id,
                drop_index,
                target_reps,
                target_weight_kg,
                weight_unit
              ) values (
                v_ex_id,
                v_d_idx,
                coalesce((v_drop_elem->>'target_reps')::int, 10),
                case when (v_drop_elem->>'target_weight_kg') is not null and (v_drop_elem->>'target_weight_kg') <> '' then (v_drop_elem->>'target_weight_kg')::numeric else null end,
                v_drop_elem->>'weight_unit'
              );
              v_d_idx := v_d_idx + 1;
            end loop;
          end if;

          v_e_idx := v_e_idx + 1;
          v_overall_idx := v_overall_idx + 1;
        end loop;
      end if;

      v_b_idx := v_b_idx + 1;
    end loop;
  end if;

  return v_routine_id;
end;
$$;

grant execute on function public.save_routine_with_blocks(uuid, text, text, jsonb) to authenticated;
