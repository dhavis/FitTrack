-- Track whether a user has finished the first-run wizard.
-- Existing accounts skip it so they are not sent through setup again.

alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.profiles.onboarding_completed_at is
  'Set when the first-run profile/goals wizard is finished or skipped';

update public.profiles
  set onboarding_completed_at = created_at
  where onboarding_completed_at is null;
