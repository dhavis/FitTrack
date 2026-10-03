import { PlannedSet, regularPlannedSets } from './plannedSets';
import { WarmupStep } from './warmup';
import { WorkoutSet } from '../types/db';

export interface SessionSetRow {
  key: string;
  label: string;
  kind: 'warmup' | 'regular' | 'drop';
  reps: number;
  weightKg: number | null;
  loggedId: string | null;
  canRemove: boolean;
  /** Planned rows the live round counter will not reach are recorded when edited. */
  recordsOnSave: boolean;
}

function isWorkingLogged(set: WorkoutSet): boolean {
  return set.set_type !== 'warmup' && set.set_type !== 'drop' && (set.drop_index == null || set.drop_index === 0);
}

export function buildSessionSetRows(params: {
  exerciseId: string;
  planned: PlannedSet[];
  logged: WorkoutSet[];
  warmups: WarmupStep[];
  hiddenWarmupKeys: string[];
  pairedRounds: number;
}): SessionSetRow[] {
  const mine = params.logged.filter((set) => set.exercise_id === params.exerciseId);
  const loggedWarmups = mine.filter((set) => set.set_type === 'warmup');
  const loggedRegular = mine.filter(isWorkingLogged);
  const machineRegular = loggedRegular.filter((set) => set.round_index == null || set.round_index >= 0);
  const extraRegular = loggedRegular.filter((set) => set.round_index != null && set.round_index < 0);
  const loggedDrops = mine.filter((set) => set.set_type === 'drop' || (set.drop_index != null && set.drop_index > 0));

  const rows: SessionSetRow[] = [];
  const warmupCount = Math.max(params.warmups.length, loggedWarmups.length);
  for (let index = 0; index < warmupCount; index += 1) {
    const key = `${params.exerciseId}:warmup:${index}`;
    const logged = loggedWarmups[index];
    if (!logged && params.hiddenWarmupKeys.includes(key)) continue;
    const suggestion = params.warmups[index];
    rows.push({
      key,
      label: 'Warm-up',
      kind: 'warmup',
      reps: logged?.reps ?? suggestion?.reps ?? 5,
      weightKg: logged?.weight_kg ?? suggestion?.weightKg ?? null,
      loggedId: logged?.id ?? null,
      canRemove: true,
      recordsOnSave: !logged,
    });
  }

  const plannedRegular = regularPlannedSets(params.planned);
  const regularCount = Math.max(plannedRegular.length, machineRegular.length);
  for (let index = 0; index < regularCount; index += 1) {
    const logged = machineRegular[index];
    const planned = plannedRegular[index];
    rows.push({
      key: logged ? `logged:${logged.id}` : `${params.exerciseId}:regular:${index}`,
      label: `Set ${index + 1}`,
      kind: 'regular',
      reps: logged?.reps ?? planned?.reps ?? 10,
      weightKg: logged?.weight_kg ?? planned?.weight_kg ?? null,
      loggedId: logged?.id ?? null,
      canRemove: true,
      recordsOnSave: !logged && index + 1 > params.pairedRounds,
    });
  }

  extraRegular.forEach((logged, index) => {
    rows.push({
      key: `logged:${logged.id}`,
      label: `Set ${regularCount + index + 1}`,
      kind: 'regular',
      reps: logged.reps ?? 10,
      weightKg: logged.weight_kg,
      loggedId: logged.id,
      canRemove: true,
      recordsOnSave: false,
    });
  });

  const plannedDrops = params.planned.filter((set) => set.kind === 'drop');
  const dropCount = Math.max(plannedDrops.length, loggedDrops.length);
  for (let index = 0; index < dropCount; index += 1) {
    const logged = loggedDrops[index];
    const planned = plannedDrops[index];
    rows.push({
      key: logged ? `logged:${logged.id}` : `${params.exerciseId}:drop:${index}`,
      label: `Drop ${index + 1}`,
      kind: 'drop',
      reps: logged?.reps ?? planned?.reps ?? 10,
      weightKg: logged?.weight_kg ?? planned?.weight_kg ?? null,
      loggedId: logged?.id ?? null,
      canRemove: true,
      recordsOnSave: false,
    });
  }

  const regularRows = rows.filter((row) => row.kind === 'regular');
  if (regularRows.length === 1) regularRows[0].canRemove = false;
  return rows;
}
