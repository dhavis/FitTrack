export type Gender = 'male' | 'female' | 'other';
export type PrimaryGoalType = 'fat_loss' | 'muscle_gain' | 'recomp' | 'strength' | 'general';

export interface Demographics {
  age?: number | null;
  gender?: Gender | null;
  heightCm?: number | null;
  weightKg?: number | null;
  daysPerWeek?: number | null;
}

export function estimateBmr(d: Demographics): number | null {
  const weight = d.weightKg;
  if (weight == null || weight <= 0) return null;
  const age = d.age != null && d.age > 0 ? d.age : null;
  const gender = d.gender ?? null;
  const height =
    d.heightCm != null && d.heightCm > 0
      ? d.heightCm
      : gender === 'female'
        ? 162
        : gender === 'male'
          ? 175
          : 168;
  if (age == null || gender == null) return Math.round(weight * 22);
  const base = 10 * weight + 6.25 * height - 5 * age;
  if (gender === 'male') return Math.round(base + 5);
  if (gender === 'female') return Math.round(base - 161);
  return Math.round(base - 78);
}

export function activityMultiplier(daysPerWeek?: number | null): number {
  const d = daysPerWeek ?? 3;
  if (d <= 1) return 1.2;
  if (d <= 3) return 1.375;
  if (d <= 5) return 1.55;
  return 1.725;
}

export function estimateMaintenance(d: Demographics): number | null {
  const bmr = estimateBmr(d);
  if (bmr == null) return null;
  return Math.round(bmr * activityMultiplier(d.daysPerWeek));
}

export function goalCalorieAdjustment(goalType: PrimaryGoalType, age?: number | null): number {
  const soft = age != null && age >= 50;
  switch (goalType) {
    case 'fat_loss':
      return soft ? -12 : -15;
    case 'muscle_gain':
      return soft ? 8 : 10;
    case 'strength':
      return soft ? 3 : 5;
    default:
      return 0;
  }
}

export function proteinPerKgForGoal(goalType: PrimaryGoalType, gender?: Gender | null): number {
  let p = 1.8;
  if (goalType === 'fat_loss' || goalType === 'muscle_gain' || goalType === 'recomp') p = 2.0;
  if (gender === 'female' && goalType === 'fat_loss') p = 2.1;
  return p;
}

export function demographicsLabel(d: Demographics): string {
  const bits: string[] = [];
  if (d.gender) bits.push(d.gender);
  if (d.age != null) bits.push(`${d.age}y`);
  if (d.heightCm != null) bits.push(`${Math.round(d.heightCm)}cm`);
  return bits.length ? bits.join(' · ') : 'age/gender not set';
}