-- Expand the global exercise library.
-- Safe to re-run: skips names that already exist.

insert into public.exercises (name, muscle_group, equipment, instructions)
select * from (values
  -- Chest
  ('Flat Dumbbell Press', 'Chest', 'Dumbbell', 'Press dumbbells from chest to lockout on a flat bench.'),
  ('Decline Bench Press', 'Chest', 'Barbell', 'Press bar from lower chest on a decline bench.'),
  ('Cable Chest Fly', 'Chest', 'Cable', 'Bring handles together in front of chest with slight elbow bend.'),
  ('Pec Deck Fly', 'Chest', 'Machine', 'Bring arms together in an arc, squeeze chest at the middle.'),
  ('Push-Up', 'Chest', 'Bodyweight', 'Lower chest toward floor, press up while keeping body straight.'),
  ('Diamond Push-Up', 'Chest', 'Bodyweight', 'Hands close together under chest, emphasize triceps and inner chest.'),
  ('Chest Dips', 'Chest', 'Bodyweight', 'Lean slightly forward on parallel bars, lower and press up.'),
  ('Landmine Press', 'Chest', 'Barbell', 'Press the free end of a landmine bar up and forward.'),
  ('Svend Press', 'Chest', 'Plate', 'Squeeze a plate between palms and press forward.'),
  ('Machine Chest Press', 'Chest', 'Machine', 'Press handles forward to lockout, control the return.'),

  -- Back
  ('Chin-Up', 'Back', 'Bodyweight', 'Underhand grip pull-up, chin over bar, control the descent.'),
  ('Seated Cable Row', 'Back', 'Cable', 'Pull handle to torso, squeeze shoulder blades, control return.'),
  ('T-Bar Row', 'Back', 'Barbell', 'Row the T-bar toward chest, keep torso braced.'),
  ('Single-Arm Dumbbell Row', 'Back', 'Dumbbell', 'Row dumbbell to hip while braced on a bench.'),
  ('Face Pull', 'Back', 'Cable', 'Pull rope to face with high elbows, externally rotate shoulders.'),
  ('Straight-Arm Pulldown', 'Back', 'Cable', 'Keep arms nearly straight, pull bar down toward thighs.'),
  ('Chest-Supported Row', 'Back', 'Dumbbell', 'Lie face-down on incline bench and row dumbbells.'),
  ('Inverted Row', 'Back', 'Bodyweight', 'Hang under a bar, pull chest to bar with straight body.'),
  ('Meadows Row', 'Back', 'Barbell', 'Landmine single-arm row with staggered stance.'),
  ('Good Morning', 'Back', 'Barbell', 'Hinge at hips with bar on back, keep spine neutral.'),
  ('Hyperextension', 'Back', 'Bodyweight', 'Raise torso on back-extension bench until hips are straight.'),
  ('Wide-Grip Pull-Up', 'Back', 'Bodyweight', 'Pull-up with hands wider than shoulders.'),

  -- Shoulders
  ('Lateral Raise', 'Shoulders', 'Dumbbell', 'Raise arms out to sides to shoulder height, soft elbows.'),
  ('Front Raise', 'Shoulders', 'Dumbbell', 'Raise arms in front to shoulder height.'),
  ('Rear Delt Fly', 'Shoulders', 'Dumbbell', 'Hinge forward and raise arms out to the sides.'),
  ('Arnold Press', 'Shoulders', 'Dumbbell', 'Rotate palms from facing you to forward while pressing up.'),
  ('Upright Row', 'Shoulders', 'Barbell', 'Pull bar to chest height with elbows leading.'),
  ('Cable Lateral Raise', 'Shoulders', 'Cable', 'Raise cable handle out to the side to shoulder height.'),
  ('Machine Shoulder Press', 'Shoulders', 'Machine', 'Press handles overhead to lockout.'),
  ('Push Press', 'Shoulders', 'Barbell', 'Dip and drive with legs to help press bar overhead.'),
  ('Cuban Press', 'Shoulders', 'Dumbbell', 'External rotate then press for rotator cuff and delts.'),
  ('Shrugs', 'Shoulders', 'Dumbbell', 'Elevate shoulders toward ears, pause, lower with control.'),

  -- Arms
  ('Hammer Curl', 'Arms', 'Dumbbell', 'Curl with neutral grip, elbows tucked.'),
  ('Barbell Curl', 'Arms', 'Barbell', 'Curl bar to shoulders without swinging.'),
  ('Preacher Curl', 'Arms', 'Dumbbell', 'Curl on preacher bench for strict biceps isolation.'),
  ('Concentration Curl', 'Arms', 'Dumbbell', 'Seated curl with elbow braced against inner thigh.'),
  ('Cable Bicep Curl', 'Arms', 'Cable', 'Curl cable handle to shoulders, control the descent.'),
  ('Skull Crusher', 'Arms', 'Barbell', 'Lower bar to forehead by bending elbows, extend up.'),
  ('Overhead Tricep Extension', 'Arms', 'Dumbbell', 'Extend dumbbell overhead by straightening elbows.'),
  ('Close-Grip Bench Press', 'Arms', 'Barbell', 'Bench press with hands closer than shoulder-width.'),
  ('Tricep Kickback', 'Arms', 'Dumbbell', 'Extend forearm behind you while hinged forward.'),
  ('Dips (Tricep Focus)', 'Arms', 'Bodyweight', 'Upright dips on parallel bars emphasizing triceps.'),
  ('Wrist Curl', 'Arms', 'Dumbbell', 'Curl wrists upward for forearm flexors.'),
  ('Reverse Curl', 'Arms', 'Barbell', 'Curl with overhand grip to hit brachialis and forearms.'),

  -- Legs
  ('Front Squat', 'Legs', 'Barbell', 'Squat with bar racked on front of shoulders.'),
  ('Goblet Squat', 'Legs', 'Dumbbell', 'Hold dumbbell at chest and squat deep.'),
  ('Bulgarian Split Squat', 'Legs', 'Dumbbell', 'Rear foot elevated split squat.'),
  ('Walking Lunge', 'Legs', 'Dumbbell', 'Step forward into lunges alternating legs.'),
  ('Reverse Lunge', 'Legs', 'Dumbbell', 'Step backward into a lunge and return.'),
  ('Hack Squat', 'Legs', 'Machine', 'Squat on hack squat machine with controlled depth.'),
  ('Leg Extension', 'Legs', 'Machine', 'Extend knees against pad, squeeze quads at top.'),
  ('Lying Leg Curl', 'Legs', 'Machine', 'Curl heels toward glutes on lying curl machine.'),
  ('Seated Leg Curl', 'Legs', 'Machine', 'Curl lower legs under seated pad.'),
  ('Calf Raise', 'Legs', 'Machine', 'Rise onto toes, pause, lower heels below platform.'),
  ('Seated Calf Raise', 'Legs', 'Machine', 'Press through balls of feet from seated position.'),
  ('Step-Up', 'Legs', 'Dumbbell', 'Step onto a box and drive through the front heel.'),
  ('Sumo Deadlift', 'Legs', 'Barbell', 'Wide-stance deadlift emphasizing inner thighs and glutes.'),
  ('Box Squat', 'Legs', 'Barbell', 'Squat to a box, pause briefly, then stand.'),
  ('Sissy Squat', 'Legs', 'Bodyweight', 'Lean back while bending knees to load quads.'),

  -- Glutes
  ('Hip Thrust', 'Glutes', 'Barbell', 'Drive hips up with upper back on bench, squeeze glutes.'),
  ('Glute Bridge', 'Glutes', 'Bodyweight', 'Lie on back and lift hips by squeezing glutes.'),
  ('Cable Kickback', 'Glutes', 'Cable', 'Kick leg back against cable while braced.'),
  ('Frog Pump', 'Glutes', 'Bodyweight', 'Lie on back with soles together, pulse hips up.'),
  ('Donkey Kick', 'Glutes', 'Bodyweight', 'On all fours, kick one heel toward ceiling.'),
  ('Fire Hydrant', 'Glutes', 'Bodyweight', 'On all fours, lift knee out to the side.'),
  ('Cable Pull-Through', 'Glutes', 'Cable', 'Hinge and pull cable between legs by driving hips forward.'),
  ('Smith Machine Hip Thrust', 'Glutes', 'Machine', 'Hip thrust using Smith bar for stability.'),

  -- Core
  ('Crunch', 'Core', 'Bodyweight', 'Curl shoulders off floor using abs, not neck.'),
  ('Sit-Up', 'Core', 'Bodyweight', 'Sit up from lying position with controlled tempo.'),
  ('Hanging Knee Raise', 'Core', 'Bodyweight', 'Hang from bar and raise knees toward chest.'),
  ('Hanging Leg Raise', 'Core', 'Bodyweight', 'Hang from bar and raise straight legs.'),
  ('Ab Wheel Rollout', 'Core', 'Other', 'Roll wheel forward while keeping core braced, return.'),
  ('Russian Twist', 'Core', 'Bodyweight', 'Rotate torso side to side while seated and leaning back.'),
  ('Dead Bug', 'Core', 'Bodyweight', 'Extend opposite arm and leg while keeping low back flat.'),
  ('Bird Dog', 'Core', 'Bodyweight', 'Extend opposite arm and leg from all-fours position.'),
  ('Side Plank', 'Core', 'Bodyweight', 'Hold body in a straight line on one forearm.'),
  ('Cable Woodchop', 'Core', 'Cable', 'Rotate torso while pulling cable from high to low.'),
  ('Pallof Press', 'Core', 'Cable', 'Press cable handle forward and resist rotation.'),
  ('Mountain Climber', 'Core', 'Bodyweight', 'In plank, drive knees toward chest alternately.'),
  ('V-Up', 'Core', 'Bodyweight', 'Raise arms and legs together into a V shape.'),
  ('Toe Touch', 'Core', 'Bodyweight', 'Lie on back and reach hands toward toes.'),

  -- Cardio
  ('Cycling (stationary)', 'Cardio', 'Machine', 'Steady-state or interval cycling.'),
  ('Rowing Machine', 'Cardio', 'Machine', 'Full-body rowing intervals or endurance.'),
  ('Elliptical', 'Cardio', 'Machine', 'Low-impact cardio on elliptical trainer.'),
  ('Jump Rope', 'Cardio', 'Other', 'Continuous or interval jump rope work.'),
  ('Burpee', 'Cardio', 'Bodyweight', 'Squat, kick back to plank, return, and jump.'),
  ('Battle Ropes', 'Cardio', 'Other', 'Alternate or double-arm rope waves.'),
  ('Stair Climber', 'Cardio', 'Machine', 'Climb stairs at a steady or interval pace.'),
  ('Assault Bike', 'Cardio', 'Machine', 'High-intensity air bike intervals.'),
  ('Jumping Jack', 'Cardio', 'Bodyweight', 'Jump feet out while raising arms overhead.'),
  ('High Knees', 'Cardio', 'Bodyweight', 'Run in place driving knees up quickly.')
) as v(name, muscle_group, equipment, instructions)
where not exists (
  select 1 from public.exercises e where e.name = v.name and e.user_id is null
);
