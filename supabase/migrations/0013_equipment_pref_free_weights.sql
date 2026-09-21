alter table public.goals
  drop constraint goals_equipment_pref_check,
  add constraint goals_equipment_pref_check
    check (
      equipment_pref is null
      or equipment_pref in (
        'full_gym',
        'dumbbells',
        'free_weights',
        'bodyweight',
        'mixed'
      )
    );
