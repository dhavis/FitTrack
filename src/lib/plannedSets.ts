export interface PlannedSet {
  kind: 'regular' | 'drop';
  reps: number;
  weight_kg: number | null;
}

export function parsePlannedSets(value: unknown): PlannedSet[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const sets: PlannedSet[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const kind = (item as { kind?: string }).kind;
    if (kind !== 'regular' && kind !== 'drop') return null;
    const reps = Number((item as { reps?: number }).reps);
    const rawWeight = (item as { weight_kg?: number | null }).weight_kg;
    sets.push({
      kind,
      reps: Number.isFinite(reps) && reps > 0 ? Math.round(reps) : 10,
      weight_kg: rawWeight == null || Number.isNaN(Number(rawWeight)) ? null : Number(rawWeight),
    });
  }
  return sets.some((set) => set.kind === 'regular') ? sets : null;
}

export function legacyPlannedSets(
  targetSets: number,
  targetReps: number,
  targetWeightKg: number | null,
  drops: { target_reps: number; target_weight_kg: number | null }[] = []
): PlannedSet[] {
  const count = Math.max(1, targetSets || 1);
  const sets: PlannedSet[] = Array.from({ length: count }, () => ({
    kind: 'regular' as const,
    reps: targetReps || 10,
    weight_kg: targetWeightKg,
  }));
  drops.forEach((drop) => {
    sets.push({
      kind: 'drop',
      reps: drop.target_reps || 10,
      weight_kg: drop.target_weight_kg,
    });
  });
  return sets;
}

export function regularPlannedSets(sets: PlannedSet[]): PlannedSet[] {
  return sets.filter((set) => set.kind === 'regular');
}

/** The planned row the live logger should write for this round or drop. */
export function plannedStepForCursor(
  planned: PlannedSet[],
  phase: 'regular' | 'drop' | 'rest' | 'complete',
  round: number,
  dropIndex: number | null
): PlannedSet | null {
  if (phase === 'drop' && dropIndex != null) {
    return planned.filter((set) => set.kind === 'drop')[dropIndex - 1] ?? null;
  }
  if (phase !== 'regular') return null;
  return planned.filter((set) => set.kind === 'regular')[Math.max(0, round - 1)] ?? null;
}
