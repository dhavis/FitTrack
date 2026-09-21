-- 0011_daily_readiness_adaptation.sql
-- Daily readiness check-in and session adaptation schema

create table public.daily_check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  check_in_date date not null,
  timezone text check (timezone is null or char_length(timezone) between 1 and 100),
  overall_soreness int not null check (overall_soreness between 0 and 4),
  soreness_by_muscle jsonb not null default '{}'::jsonb check (jsonb_typeof(soreness_by_muscle) = 'object'),
  tiredness int not null check (tiredness between 1 and 5),
  energy int not null check (energy between 1 and 5),
  available_minutes int not null check (available_minutes between 10 and 180),
  pain_or_new_injury boolean not null default false,
  sleep_hours numeric(4,2) check (sleep_hours is null or sleep_hours between 0 and 24),
  recovery_note text check (recovery_note is null or char_length(recovery_note) <= 280),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, check_in_date)
);

create index daily_check_ins_user_date_idx on public.daily_check_ins (user_id, check_in_date desc);
alter table public.daily_check_ins enable row level security;

create policy "Daily check-ins are viewable by owner" on public.daily_check_ins for select using (auth.uid() = user_id);
create policy "Daily check-ins are insertable by owner" on public.daily_check_ins for insert with check (auth.uid() = user_id);
create policy "Daily check-ins are editable by owner" on public.daily_check_ins for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.set_daily_check_in_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger set_daily_check_in_updated_at before update on public.daily_check_ins for each row execute procedure public.set_daily_check_in_updated_at();

create table public.adaptation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  check_in_id uuid not null references public.daily_check_ins(id) on delete cascade,
  source_routine_id uuid references public.routines(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired','safety_hold')),
  check_in_snapshot jsonb not null check (jsonb_typeof(check_in_snapshot) = 'object'),
  source_routine_snapshot jsonb not null check (jsonb_typeof(source_routine_snapshot) = 'object'),
  context_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(context_snapshot) = 'object'),
  model_proposal jsonb check (model_proposal is null or jsonb_typeof(model_proposal) = 'object'),
  validated_prescription jsonb check (validated_prescription is null or jsonb_typeof(validated_prescription) = 'object'),
  generation_source text not null check (generation_source in ('model','deterministic_fallback','safety_rules')),
  provider text,
  model text,
  prompt_version text not null,
  schema_version text not null,
  validator_version text not null,
  validation_reason text check (validation_reason is null or char_length(validation_reason) <= 1000),
  disclaimer_version text not null default 'rec-v1',
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  check ((status = 'pending' and decided_at is null) or status <> 'pending'),
  check (status <> 'approved' or (validated_prescription is not null and decided_at is not null)),
  check (status <> 'rejected' or decided_at is not null),
  check (status <> 'safety_hold' or generation_source = 'safety_rules')
);

create index adaptation_events_user_created_idx on public.adaptation_events (user_id, created_at desc);
create index adaptation_events_check_in_idx on public.adaptation_events (check_in_id);
create index adaptation_events_source_routine_idx on public.adaptation_events (source_routine_id);
create index adaptation_events_user_pending_idx on public.adaptation_events (user_id, created_at desc) where status = 'pending';
alter table public.adaptation_events enable row level security;

create policy "Adaptation events are viewable by owner" on public.adaptation_events for select using (auth.uid() = user_id);

create policy "Owners can create pending or safety-hold adaptations" on public.adaptation_events for insert with check (
  auth.uid() = user_id and decided_at is null
  and exists (select 1 from public.daily_check_ins d where d.id = check_in_id and d.user_id = auth.uid()
    and check_in_snapshot @> jsonb_build_object('pain_or_new_injury', d.pain_or_new_injury)
    and ((status = 'pending' and d.pain_or_new_injury = false) or (status = 'safety_hold' and d.pain_or_new_injury = true and generation_source = 'safety_rules')))
  and exists (select 1 from public.routines r where r.id = source_routine_id and r.user_id = auth.uid())
);

create policy "Owners can update pending adaptation contents" on public.adaptation_events for update
  using (auth.uid() = user_id and status = 'pending')
  with check (auth.uid() = user_id and status = 'pending' and decided_at is null);

create or replace function public.protect_adaptation_event_snapshots()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.user_id is distinct from old.user_id or new.check_in_id is distinct from old.check_in_id
    or new.check_in_snapshot is distinct from old.check_in_snapshot
    or new.source_routine_snapshot is distinct from old.source_routine_snapshot
    or new.context_snapshot is distinct from old.context_snapshot
    or new.created_at is distinct from old.created_at
    or new.disclaimer_version is distinct from old.disclaimer_version
  then raise exception 'Adaptation event audit fields are immutable';
  end if;
  return new;
end;
$$;

create trigger protect_adaptation_event_snapshots before update on public.adaptation_events for each row execute procedure public.protect_adaptation_event_snapshots();

alter table public.workouts add column if not exists adaptation_event_id uuid references public.adaptation_events(id) on delete set null;
create unique index if not exists workouts_adaptation_event_unique_idx on public.workouts (adaptation_event_id) where adaptation_event_id is not null;

create or replace function public.approve_adaptation_event(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_event public.adaptation_events%rowtype;
  v_workout_id uuid;
  v_routine_name text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select * into v_event
  from public.adaptation_events
  where id = p_event_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Adaptation event not found';
  end if;

  if v_event.status <> 'pending' then
    raise exception 'Adaptation event is not pending';
  end if;

  if v_event.validated_prescription is null then
    raise exception 'Cannot approve adaptation event without validated prescription';
  end if;

  update public.adaptation_events
  set status = 'approved',
      decided_at = now()
  where id = p_event_id;

  v_routine_name := coalesce(v_event.source_routine_snapshot->>'name', 'Adapted Workout');

  insert into public.workouts (
    user_id,
    routine_id,
    name,
    adaptation_event_id,
    started_at
  ) values (
    v_user_id,
    v_event.source_routine_id,
    v_routine_name,
    p_event_id,
    now()
  ) returning id into v_workout_id;

  return v_workout_id;
end;
$$;

create or replace function public.reject_adaptation_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_event public.adaptation_events%rowtype;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select * into v_event
  from public.adaptation_events
  where id = p_event_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Adaptation event not found';
  end if;

  if v_event.status <> 'pending' then
    raise exception 'Adaptation event is not pending';
  end if;

  update public.adaptation_events
  set status = 'rejected',
      decided_at = now()
  where id = p_event_id;
end;
$$;

grant execute on function public.approve_adaptation_event(uuid) to authenticated;
grant execute on function public.reject_adaptation_event(uuid) to authenticated;
