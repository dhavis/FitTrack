# FitTrack

Personal weight management, workout, and nutrition tracking app built with React Native, Expo, TypeScript, and Supabase.

## Features

- Daily weight logs with trend charts
- Workout routines, set logging, and rest timer
- Built-in and custom exercise library
- USDA food search and calorie/macro logging
- Weight, workout, and nutrition goals
- Metric and imperial units
- Email/password authentication and cloud sync

## Prerequisites

- Node.js 18 or newer
- Expo Go on an iOS or Android phone
- A free Supabase project
- Optional: a free USDA FoodData Central API key

## Supabase setup

1. Create a project at https://supabase.com.
2. Open the Supabase SQL Editor.
3. Run `supabase/migrations/0001_init.sql`.
4. Open Project Settings, then API.
5. Copy the project URL and public anon key.

For easier personal testing, you may disable email confirmation under Authentication, Providers, Email. Otherwise, confirm your email after signing up.

## Environment setup

Copy `.env.example` to `.env`, then enter your credentials:

```text
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_USDA_API_KEY=your-usda-key
```

Get a USDA key at https://fdc.nal.usda.gov/api-key-signup.html. Without one, food search uses the rate-limited `DEMO_KEY`.

## Run the app

```bash
npm install
npm start
```

Scan the QR code using Expo Go. Other commands:

```bash
npm run android
npm run ios
npm run web
```

After editing `.env`, fully restart the Expo development server.

## Project structure

```text
App.tsx
src/
  components/        Shared UI components
  hooks/             Authentication context
  lib/               Supabase, unit, and nutrition helpers
  navigation/        App navigators
  screens/           Application screens
  theme/             Colors, spacing, and typography
  types/             Database types
supabase/
  migrations/        Database schema and security policies
```

All user-owned database tables use Supabase Row Level Security so each account can access only its own data.

## Troubleshooting

- `Setup required`: add valid Supabase values to `.env` and restart Expo.
- Food search errors: configure your own USDA API key.
- Environment changes are ignored: stop Expo and run `npm start` again.

## Training upgrade migrations

After pulling these changes, run these SQL files in the Supabase SQL Editor (in order):

1. `supabase/migrations/0004_training_upgrade.sql` — body measurements, programs, howto columns, storage bucket
2. `supabase/migrations/0005_howto_cues_seed.sql` — how-to cues + image path seeds
3. `supabase/migrations/0006_nutrition_plans.sql` — editable nutrition plans linked to goals
4. `supabase/migrations/0007_nutrition_preferences.sql` — food preferences + generated menu
5. `supabase/migrations/0008_profile_age_gender.sql` — age, gender, height on profiles
6. `supabase/migrations/0009_coach_plans.sql` — hybrid coach plan history

## Hybrid coach (Edge Function)

1. Run migration `0009_coach_plans.sql`.
2. Deploy: `supabase functions deploy coach-generate`
3. Optional AI coaching notes: `supabase secrets set OPENAI_API_KEY=sk-...`
4. Without the secret, the function still returns deterministic training + nutrition + fallback coaching copy.
5. App calls the function from **Workouts → Generate plan**; falls back to on-device generators if the function is unavailable.

### Upload how-to illustrations (optional)

Local starter illustrations live in `assets/howto/`. To serve them from Supabase Storage:

1. Open Storage → `exercise-howto` bucket
2. Upload `squat.png`, `bench.png`, `deadlift.png`, `ohp.png`, `pullup.png`, `row.png`
3. Paths already match `howto_image_path` values seeded in migration 0005

The app also falls back to the bundled local assets for those filenames.