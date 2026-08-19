# Functionality flows

Tabs: Dashboard, Weight, Workouts, Nutrition, Goals, Settings.

## Auth

- Login screen shows FitTrack, email, password, Log In, Create an account
- Empty submit or bad credentials show an error (not a blank hang)
- Create an account opens Sign Up; Back to log in returns
- Valid login (if credentials provided) reaches Dashboard with six tabs
- If already signed in, skip login and note that

## Dashboard

- Greeting and latest weight, weekly workouts, today's calories render or show empty-safe values
- Body measurement snippet appears only when a measurement exists
- Coach plan snippet appears only when an active plan exists
- No crash on refresh / tab re-focus

## Weight

- Log today's weight: invalid input shows "Enter a valid weight."
- Valid save clears the form, appears in History, updates the chart
- Saving again today updates the same day (upsert), does not duplicate
- Body composition: save at least one field; it appears in History
- Dashboard latest weight matches what you just saved

## Workouts

- Workouts home: Start empty workout, Generate coach plan, New routine, Exercise library
- Exercise library lists exercises; muscle filter works; custom add appears in the list
- New routine: add an exercise, set sets/reps, save; it shows under Your routines
- Start that routine: Active Workout, How-to panel if present, Log set, rest timer counts down, Skip clears timer
- Finish workout: returns home; Recent workouts includes it
- Generate coach plan: Generate coach plan → Coach plan screen with This week / Training / Nutrition / disclaimer (or a clear error if the edge function is down)

## Nutrition

- Home shows today calories/macros vs targets (or empty)
- Add food for a meal: search, pick, Log it; item appears; totals update
- Remove the food you just logged; totals drop
- Nutrition plan: Generate from goals and/or Save nutrition plan; values persist on revisit
- Food preferences: step Next/Back, Save & build menu (or skip if already complete)
- Menu: days with breakfast/lunch/dinner/snack, or a prompt to start the questionnaire

## Goals

- Primary goal and training profile chips select
- Save goals shows a saved confirmation and persists on revisit
- Suggest targets fills fields from metrics (or a sensible empty state)
- Open nutrition plan navigates to Nutrition plan

## Settings

- Save profile (display name) shows saved copy
- Toggle kg/lb and cm/in; Weight and measurements labels follow
- Sign out returns to Login (only if the user allowed signing out; otherwise skip and mark Blocked)
