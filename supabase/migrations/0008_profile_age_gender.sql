-- Age, gender, and height for energy / nutrition estimates

alter table public.profiles
  add column if not exists age int check (age is null or (age >= 13 and age <= 100)),
  add column if not exists gender text check (gender is null or gender in ('male', 'female', 'other')),
  add column if not exists height_cm numeric(5,2) check (height_cm is null or (height_cm >= 100 and height_cm <= 250));

comment on column public.profiles.age is 'Age in years for BMR/TDEE estimates';
comment on column public.profiles.gender is 'male | female | other — used for Mifflin-St Jeor BMR';
comment on column public.profiles.height_cm is 'Height in cm for BMR estimates';