-- Seed short how-to cues for common exercises (safe to re-run)
update public.exercises set howto_cues = 'Set feet shoulder-width; Brace core; Sit hips back and down; Drive through midfoot'
where name = 'Barbell Back Squat' and (howto_cues is null or howto_cues = '');

update public.exercises set howto_cues = 'Plant feet; Retract scapulae; Lower bar to mid-chest; Press to lockout'
where name = 'Bench Press' and (howto_cues is null or howto_cues = '');

update public.exercises set howto_cues = 'Hinge at hips; Keep spine neutral; Push floor away; Squeeze glutes at top'
where name = 'Deadlift' and (howto_cues is null or howto_cues = '');

update public.exercises set howto_cues = 'Brace core; Press bar from shoulders; Head through at top; Lower with control'
where name = 'Overhead Press' and (howto_cues is null or howto_cues = '');

update public.exercises set howto_cues = 'Dead hang; Pull elbows down; Chin over bar; Lower slowly'
where name = 'Pull-Up' and (howto_cues is null or howto_cues = '');

update public.exercises set howto_cues = 'Hinge torso; Pull bar to ribs; Squeeze shoulder blades; Control the eccentric'
where name = 'Barbell Row' and (howto_cues is null or howto_cues = '');

update public.exercises set howto_cues = 'Upper back on bench; Chin tucked; Drive through heels; Squeeze glutes hard'
where name = 'Hip Thrust' and (howto_cues is null or howto_cues = '');

update public.exercises set howto_cues = 'Elbows under shoulders; Body straight; Brace abs; Breathe steadily'
where name = 'Plank' and (howto_cues is null or howto_cues = '');

update public.exercises set howto_image_path = 'squat.png'
where name = 'Barbell Back Squat' and howto_image_path is null;

update public.exercises set howto_image_path = 'bench.png'
where name = 'Bench Press' and howto_image_path is null;

update public.exercises set howto_image_path = 'deadlift.png'
where name = 'Deadlift' and howto_image_path is null;

update public.exercises set howto_image_path = 'ohp.png'
where name = 'Overhead Press' and howto_image_path is null;

update public.exercises set howto_image_path = 'pullup.png'
where name = 'Pull-Up' and howto_image_path is null;

update public.exercises set howto_image_path = 'row.png'
where name = 'Barbell Row' and howto_image_path is null;