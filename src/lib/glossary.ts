export type GlossaryKey =
  | 'fat_loss'
  | 'muscle_gain'
  | 'recomp'
  | 'strength'
  | 'general'
  | 'hypertrophy'
  | 'deficit'
  | 'surplus'
  | 'maintenance'
  | 'protein'
  | 'sets_reps'
  | 'calorie_estimate'
  | 'straight_sets'
  | 'superset'
  | 'powerset'
  | 'drop_set';

export interface GlossaryEntry {
  title: string;
  body: string;
}

export const GLOSSARY: Record<GlossaryKey, GlossaryEntry> = {
  fat_loss: {
    title: 'Fat loss',
    body: 'Eating slightly fewer calories than your body burns so it uses stored fat for energy while training to preserve muscle.',
  },
  muscle_gain: {
    title: 'Muscle gain',
    body: 'Eating a small calorie surplus with sufficient protein and progressive resistance workouts to build muscle tissue.',
  },
  recomp: {
    title: 'Body recomposition',
    body: 'Building or maintaining muscle while losing fat at the same time by eating near maintenance calories and lifting consistently.',
  },
  strength: {
    title: 'Strength focus',
    body: 'Training with heavier weights, lower repetitions, and longer rest periods to maximize the force your muscles can produce.',
  },
  general: {
    title: 'General fitness',
    body: 'A balanced mix of strength training and conditioning to improve overall health, energy, stamina, and consistency.',
  },
  hypertrophy: {
    title: 'Hypertrophy',
    body: 'Muscle growth stimulated through challenging resistance exercises, moderate repetitions, and adequate recovery.',
  },
  deficit: {
    title: 'Calorie deficit',
    body: 'Consuming fewer calories than you burn in a day. This is the primary driver of body fat loss.',
  },
  surplus: {
    title: 'Calorie surplus',
    body: 'Consuming slightly more calories than you burn in a day to support muscle recovery, growth, and performance.',
  },
  maintenance: {
    title: 'Maintenance calories',
    body: 'The total calories your body burns in a day. Eating at maintenance keeps your body weight steady.',
  },
  protein: {
    title: 'Protein target',
    body: 'The daily amount of dietary protein needed to repair and build muscle, support recovery, and keep you full.',
  },
  sets_reps: {
    title: 'Sets and reps',
    body: 'Reps (repetitions) are how many times you perform an exercise movement. Sets are how many rounds of those reps you complete.',
  },
  calorie_estimate: {
    title: 'Daily calorie estimate',
    body: 'Calculated using the Mifflin–St Jeor formula (BMR) and your activity level to estimate the energy your body uses each day.',
  },
  straight_sets: {
    title: 'Straight sets',
    body: 'Standard sets performed for one exercise with rest in between each set before moving on to the next exercise.',
  },
  superset: {
    title: 'Superset',
    body: 'Exactly 2 adjacent exercises performed back-to-back with no rest between them, resting only after completing each round.',
  },
  powerset: {
    title: 'Powerset',
    body: 'A circuit of 3 to 6 exercises performed back-to-back without rest between exercises, taking a rest only after the full round is complete.',
  },
  drop_set: {
    title: 'Drop set',
    body: 'Performing 1 to 3 lighter weight steps immediately after your final regular set of an exercise to push past muscular fatigue.',
  },
};

export function getGlossaryEntry(key: GlossaryKey): GlossaryEntry {
  return GLOSSARY[key] ?? { title: key, body: '' };
}
