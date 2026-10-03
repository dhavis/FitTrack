import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ActiveGymSwitcher from '../components/ActiveGymSwitcher';
import ExercisePickerModal from '../components/ExercisePickerModal';
import HowToPanel from '../components/HowToPanel';
import SetRowList from '../components/SetRowList';
import UnitGear from '../components/UnitGear';
import { useTutorial } from '../components/TutorialProvider';
import { Button, Card, EmptyState, Label, ScreenContainer, SectionTitle, TextInput } from '../components/ui';
import { useActiveGymProfile } from '../hooks/useActiveGymProfile';
import { useAuth } from '../hooks/useAuth';
import { isExerciseAllowed } from '../lib/equipmentPolicy';
import { getTechniqueHelperText, getTechniqueLabel } from '../lib/liveWorkoutMachine';
import { supabase } from '../lib/supabase';
import { displayWeight, toStorageWeightKg } from '../lib/units';
import { fetchRoutineWithBlocks, RoutineBlockDraft, RoutineExerciseDraft, DraftSet } from '../lib/workoutPlan';
import { WorkoutsStackParamList } from '../navigation/types';
import { colors, radii, spacing, typography } from '../theme/theme';
import { BlockType, Exercise, WeightUnit } from '../types/db';

type Props = NativeStackScreenProps<WorkoutsStackParamList, 'RoutineBuilder'>;

export default function RoutineBuilderScreen({ route, navigation }: Props) {
  const { session, profile } = useAuth();
  const { openTutorial } = useTutorial();
  const { activeGym } = useActiveGymProfile();
  const defaultUnit: WeightUnit = profile?.weight_unit ?? 'kg';
  const [editorUnit, setEditorUnit] = useState<WeightUnit>(defaultUnit);
  const routineId = route.params?.routineId;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [blocks, setBlocks] = useState<RoutineBlockDraft[]>([]);
  const [selectedExIds, setSelectedExIds] = useState<string[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!routineId) return;
    (async () => {
      const result = await fetchRoutineWithBlocks(routineId, defaultUnit);
      if (result.routine) {
        setName(result.routine.name);
        setDescription(result.routine.description ?? '');
      }
      setBlocks(result.blocks);
    })();
  }, [routineId, defaultUnit]);

  const addExercise = (exercise: Exercise) => {
    const newExDraft: RoutineExerciseDraft = {
      tempId: `${exercise.id}-${Date.now()}`,
      exercise,
      target_sets: '3',
      target_reps: '10',
      target_weight: '',
      weight_unit: null,
      rest_seconds: '90',
      drop_steps: [],
      sets: [0, 1, 2].map((index) => ({
        key: `${exercise.id}-set-${index}-${Date.now()}`,
        kind: 'regular' as const,
        reps: '10',
        weight: '',
      })),
    };

    const newBlock: RoutineBlockDraft = {
      tempId: `block-${Date.now()}`,
      block_type: 'straight',
      name: 'Straight sets',
      target_rounds: '3',
      rest_seconds: '90',
      exercises: [newExDraft],
    };

    setBlocks((prev) => [...prev, newBlock]);
  };

  const toggleSelectExercise = (tempId: string) => {
    setSelectedExIds((prev) =>
      prev.includes(tempId) ? prev.filter((id) => id !== tempId) : [...prev, tempId]
    );
  };

  const createGroupBlock = (type: 'superset' | 'powerset') => {
    const count = selectedExIds.length;
    if (type === 'superset' && count !== 2) {
      setError('A superset requires exactly 2 exercises.');
      return;
    }
    if (type === 'powerset' && (count < 3 || count > 6)) {
      setError('A powerset requires 3 to 6 exercises.');
      return;
    }

    // Find all selected exercises in their current order
    const allExercises: RoutineExerciseDraft[] = [];
    blocks.forEach((b) => {
      b.exercises.forEach((ex) => {
        if (selectedExIds.includes(ex.tempId)) {
          allExercises.push(ex);
        }
      });
    });

    const newBlock: RoutineBlockDraft = {
      tempId: `group-${Date.now()}`,
      block_type: type,
      name: type === 'superset' ? 'Superset' : 'Powerset',
      target_rounds: '3',
      rest_seconds: '90',
      exercises: allExercises,
    };

    // Remove selected exercises from existing blocks
    const remainingBlocks: RoutineBlockDraft[] = [];
    let inserted = false;

    for (const b of blocks) {
      const keep = b.exercises.filter((ex) => !selectedExIds.includes(ex.tempId));
      if (!inserted && b.exercises.some((ex) => selectedExIds.includes(ex.tempId))) {
        remainingBlocks.push(newBlock);
        inserted = true;
      }
      if (keep.length > 0) {
        remainingBlocks.push({ ...b, exercises: keep });
      }
    }

    if (!inserted) {
      remainingBlocks.push(newBlock);
    }

    setBlocks(remainingBlocks);
    setSelectedExIds([]);
    setError(null);
  };

  const dissolveBlock = (blockTempId: string) => {
    const targetBlock = blocks.find((b) => b.tempId === blockTempId);
    if (!targetBlock || targetBlock.block_type === 'straight') return;

    const straightBlocks: RoutineBlockDraft[] = targetBlock.exercises.map((ex, idx) => ({
      tempId: `straight-${ex.tempId}-${Date.now()}-${idx}`,
      block_type: 'straight',
      name: 'Straight sets',
      target_rounds: targetBlock.target_rounds,
      rest_seconds: targetBlock.rest_seconds,
      exercises: [ex],
    }));

    const nextBlocks: RoutineBlockDraft[] = [];
    for (const b of blocks) {
      if (b.tempId === blockTempId) {
        nextBlocks.push(...straightBlocks);
      } else {
        nextBlocks.push(b);
      }
    }
    setBlocks(nextBlocks);
  };

  const updateBlockRounds = (blockTempId: string, rounds: string) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.tempId === blockTempId
          ? {
              ...b,
              target_rounds: rounds,
              exercises: b.exercises.map((e) => ({ ...e, target_sets: rounds })),
            }
          : b
      )
    );
  };

  const updateBlockRest = (blockTempId: string, rest: string) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.tempId === blockTempId
          ? {
              ...b,
              rest_seconds: rest,
              exercises: b.exercises.map((e) => ({ ...e, rest_seconds: rest })),
            }
          : b
      )
    );
  };

  const convertDisplayWeight = (value: string, from: WeightUnit, to: WeightUnit) => {
    const parsed = parseFloat(value);
    if (!value || Number.isNaN(parsed)) return value;
    return displayWeight(toStorageWeightKg(parsed, from), to).toFixed(1);
  };

  const changeEditorUnit = (next: WeightUnit) => {
    if (next === editorUnit) return;
    setBlocks((prev) =>
      prev.map((block) => ({
        ...block,
        exercises: block.exercises.map((exercise) => ({
          ...exercise,
          target_weight: convertDisplayWeight(exercise.target_weight, editorUnit, next),
          sets: (exercise.sets ?? []).map((set) => ({
            ...set,
            weight: convertDisplayWeight(set.weight, editorUnit, next),
          })),
          drop_steps: exercise.drop_steps.map((drop) => ({
            ...drop,
            target_weight: convertDisplayWeight(drop.target_weight, editorUnit, next),
          })),
        })),
      }))
    );
    setEditorUnit(next);
  };

  const updateExerciseSets = (blockTempId: string, exTempId: string, sets: DraftSet[]) => {
    const regular = sets.filter((set) => set.kind === 'regular');
    const drops = sets.filter((set) => set.kind === 'drop');
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.tempId !== blockTempId) return block;
        const exercises = block.exercises.map((exercise) => {
          if (exercise.tempId !== exTempId) return exercise;
          return {
            ...exercise,
            sets,
            target_sets: String(Math.max(regular.length, 1)),
            target_reps: regular[0]?.reps ?? exercise.target_reps,
            target_weight: regular[0]?.weight ?? '',
            drop_steps: drops.map((drop, index) => ({
              tempId: drop.key,
              drop_index: index + 1,
              target_reps: drop.reps,
              target_weight: drop.weight,
              weight_unit: null,
            })),
          };
        });
        return {
          ...block,
          exercises,
          target_rounds:
            block.block_type === 'straight' ? String(Math.max(regular.length, 1)) : block.target_rounds,
        };
      })
    );
  };

  const updateExercise = (
    blockTempId: string,
    exTempId: string,
    field: keyof RoutineExerciseDraft,
    value: any
  ) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.tempId !== blockTempId) return b;
        return {
          ...b,
          exercises: b.exercises.map((e) => (e.tempId === exTempId ? { ...e, [field]: value } : e)),
        };
      })
    );
  };

  const removeExercise = (blockTempId: string, exTempId: string) => {
    setBlocks((prev) => {
      const next = prev.map((block) => {
        if (block.tempId !== blockTempId) return block;
        return {
          ...block,
          exercises: block.exercises.filter((exercise) => exercise.tempId !== exTempId),
        };
      });
      return next.filter((block) => block.exercises.length > 0);
    });
    setSelectedExIds((prev) => prev.filter((id) => id !== exTempId));
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) return;
    const reordered = [...blocks];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    setBlocks(reordered);
  };

  const handleSave = async () => {
    if (!session) return;
    if (!name.trim()) {
      setError('Give your routine a name.');
      return;
    }
    const totalExercises = blocks.reduce((acc, b) => acc + b.exercises.length, 0);
    if (totalExercises === 0) {
      setError('Add at least one exercise to your routine.');
      return;
    }

    for (const b of blocks) {
      if (b.block_type === 'straight' && b.exercises.length !== 1) {
        setError('A straight sets block must have exactly 1 exercise.');
        return;
      }
      if (b.block_type === 'superset' && b.exercises.length !== 2) {
        setError('A superset requires exactly 2 exercises.');
        return;
      }
      if (b.block_type === 'powerset' && (b.exercises.length < 3 || b.exercises.length > 6)) {
        setError('A powerset requires 3 to 6 exercises.');
        return;
      }
    }

    setSaving(true);
    setError(null);

    let currentRoutineId = routineId;
    const isEditing = Boolean(currentRoutineId);
    const orderOffset = isEditing ? 1000 : 0;
    const createdBlockIds: string[] = [];

    if (currentRoutineId) {
      const { error: updateError } = await supabase
        .from('routines')
        .update({ name, description })
        .eq('id', currentRoutineId);
      if (updateError) {
        setSaving(false);
        setError(updateError.message);
        return;
      }
    } else {
      const { data, error: insertError } = await supabase
        .from('routines')
        .insert({ user_id: session.user.id, name, description })
        .select()
        .single();
      if (insertError || !data) {
        setSaving(false);
        setError(insertError?.message ?? 'Failed to create routine.');
        return;
      }
      currentRoutineId = data.id;
    }

    try {
      let overallExerciseIndex = 0;

      for (let bIndex = 0; bIndex < blocks.length; bIndex++) {
        const blockDraft = blocks[bIndex];
        const roundsVal =
          blockDraft.block_type === 'straight'
            ? Math.max(
                1,
                (blockDraft.exercises[0]?.sets ?? []).filter((set) => set.kind === 'regular').length ||
                  parseInt(blockDraft.target_rounds, 10) ||
                  3
              )
            : parseInt(blockDraft.target_rounds, 10) || 3;
        const restVal = parseInt(blockDraft.rest_seconds, 10) || 90;

        // 2. Insert new block with order_index = orderOffset + bIndex
        const { data: createdBlock, error: blockErr } = await supabase
          .from('routine_blocks')
          .insert({
            routine_id: currentRoutineId,
            block_type: blockDraft.block_type,
            name: blockDraft.name || getTechniqueLabel(blockDraft.block_type),
            order_index: orderOffset + bIndex,
            target_rounds: roundsVal,
            rest_seconds: restVal,
          })
          .select()
          .single();

        if (blockErr || !createdBlock) {
          throw new Error(blockErr?.message ?? 'Failed to create block');
        }
        createdBlockIds.push(createdBlock.id);

        // 3. For EACH block, insert ALL member routine_exercises in a SINGLE .insert([...])
        const exInserts = blockDraft.exercises.map((exDraft, eIndex) => {
          const regular = (exDraft.sets ?? []).filter((set) => set.kind === 'regular');
          const first = regular[0];
          const parsedWeight = parseFloat(first?.weight ?? exDraft.target_weight);
          const plannedSets = (exDraft.sets ?? []).map((set) => {
            const parsed = parseFloat(set.weight);
            return {
              kind: set.kind,
              reps: parseInt(set.reps, 10) || 10,
              weight_kg:
                Number.isNaN(parsed) || parsed <= 0 ? null : toStorageWeightKg(parsed, editorUnit),
            };
          });
          return {
            routine_id: currentRoutineId,
            block_id: createdBlock.id,
            block_position: eIndex,
            exercise_id: exDraft.exercise.id,
            order_index: overallExerciseIndex++,
            target_sets: roundsVal,
            target_reps: parseInt(first?.reps ?? exDraft.target_reps, 10) || 10,
            target_weight_kg:
              Number.isNaN(parsedWeight) || parsedWeight <= 0
                ? null
                : toStorageWeightKg(parsedWeight, editorUnit),
            weight_unit: null,
            rest_seconds: restVal,
            planned_sets: plannedSets,
          };
        });

        const { data: createdExercises, error: exErr } = await supabase
          .from('routine_exercises')
          .insert(exInserts)
          .select();

        if (exErr || !createdExercises) {
          throw new Error(exErr?.message ?? 'Failed to save exercises');
        }

        // 4. Insert drop steps after exercises exist
        const dropInserts: any[] = [];
        blockDraft.exercises.forEach((exDraft, eIndex) => {
          if (exDraft.drop_steps.length > 0) {
            const createdEx =
              createdExercises.find((ce) => ce.block_position === eIndex) ?? createdExercises[eIndex];
            exDraft.drop_steps.forEach((d, dIdx) => {
              const dParsedWeight = parseFloat(d.target_weight);
              dropInserts.push({
                routine_exercise_id: createdEx.id,
                drop_index: dIdx + 1,
                target_reps: parseInt(d.target_reps, 10) || 10,
                target_weight_kg:
                  Number.isNaN(dParsedWeight) || dParsedWeight <= 0
                    ? null
                    : toStorageWeightKg(dParsedWeight, editorUnit),
                weight_unit: null,
              });
            });
          }
        });

        if (dropInserts.length > 0) {
          const { error: dropErr } = await supabase
            .from('routine_exercise_drop_steps')
            .insert(dropInserts);

          if (dropErr) {
            throw new Error(dropErr.message);
          }
        }
      }

      // 5. Only then delete old blocks (order_index < 1000)
      if (isEditing) {
        const { error: delErr } = await supabase
          .from('routine_blocks')
          .delete()
          .eq('routine_id', currentRoutineId)
          .lt('order_index', 1000);
        if (delErr) {
          throw new Error(delErr.message);
        }

        // 6. Update new blocks order_index = order_index - 1000
        for (let bIndex = 0; bIndex < createdBlockIds.length; bIndex++) {
          const bId = createdBlockIds[bIndex];
          const { error: updateOrderErr } = await supabase
            .from('routine_blocks')
            .update({ order_index: bIndex })
            .eq('id', bId);
          if (updateOrderErr) {
            throw new Error(updateOrderErr.message);
          }
        }
      }

      setSaving(false);
      navigation.goBack();
    } catch (err: any) {
      if (isEditing && currentRoutineId) {
        try {
          const { count, error: countErr } = await supabase
            .from('routine_blocks')
            .select('id', { count: 'exact', head: true })
            .eq('routine_id', currentRoutineId)
            .lt('order_index', 1000);

          if (!countErr && typeof count === 'number' && count > 0) {
            // If old blocks (< 1000) still exist, delete staging (>= 1000)
            await supabase
              .from('routine_blocks')
              .delete()
              .eq('routine_id', currentRoutineId)
              .gte('order_index', 1000);
          } else {
            // Old blocks already deleted: do NOT delete staging.
            // Try to set each remaining staged block's order_index to 0..n-1 so data survives.
            const { data: stagedBlocks } = await supabase
              .from('routine_blocks')
              .select('id')
              .eq('routine_id', currentRoutineId)
              .gte('order_index', 1000)
              .order('order_index', { ascending: true });

            if (stagedBlocks && stagedBlocks.length > 0) {
              for (let i = 0; i < stagedBlocks.length; i++) {
                await supabase
                  .from('routine_blocks')
                  .update({ order_index: i })
                  .eq('id', stagedBlocks[i].id);
              }
            }
          }
        } catch {
          // Best effort recovery; keep original error to display to user
        }
      }
      setSaving(false);
      setError(err?.message ?? 'Failed to save routine.');
    }
  };

  const gymPolicy = activeGym
    ? {
        base_preset: activeGym.profile.base_preset,
        excluded_equipment: activeGym.excluded_equipment,
        excluded_exercise_ids: activeGym.excluded_exercise_ids,
      }
    : null;

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <Text style={typography.h1}>{routineId ? 'Edit routine' : 'New routine'}</Text>
          <UnitGear unit={editorUnit} onChange={changeEditorUnit} />
        </View>
        <View style={styles.field}>
          <Button title="How to build a routine" variant="secondary" onPress={openTutorial} />
        </View>
        <ActiveGymSwitcher
          compact
          onManageGyms={() => {
            navigation.getParent()?.navigate('Settings', { screen: 'GymProfiles' });
          }}
        />

        <View style={styles.field}>
          <Label>Name</Label>
          <TextInput value={name} onChangeText={setName} placeholder="e.g. Upper Push / Pull" />
        </View>
        <View style={styles.field}>
          <Label>Description (optional)</Label>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Notes about this routine"
          />
        </View>

        {selectedExIds.length > 0 && (
          <Card style={styles.groupActionBar}>
            <Text style={styles.selectedCountText}>
              {selectedExIds.length} {selectedExIds.length === 1 ? 'exercise' : 'exercises'} selected
            </Text>
            <View style={styles.groupActionsRow}>
              {selectedExIds.length === 2 && (
                <View style={styles.actionBtnWrap}>
                  <Button
                    title="Create Superset (2)"
                    onPress={() => createGroupBlock('superset')}
                  />
                </View>
              )}
              {selectedExIds.length >= 3 && selectedExIds.length <= 6 && (
                <View style={styles.actionBtnWrap}>
                  <Button
                    title={`Create Powerset (${selectedExIds.length})`}
                    onPress={() => createGroupBlock('powerset')}
                  />
                </View>
              )}
              <View style={styles.actionBtnWrap}>
                <Button
                  title="Cancel"
                  variant="ghost"
                  onPress={() => setSelectedExIds([])}
                />
              </View>
            </View>
          </Card>
        )}

        <SectionTitle>Workout Structure & Exercises</SectionTitle>
        {blocks.length === 0 && <EmptyState message="No exercises added yet. Add an exercise below." />}

        {blocks.map((block, bIndex) => {
          const isGroup = block.block_type === 'superset' || block.block_type === 'powerset';

          return (
            <Card key={block.tempId} style={[styles.blockCard, isGroup && styles.groupedBlockCard]}>
              <View style={styles.blockHeader}>
                <View style={styles.blockHeaderLeft}>
                  <View style={[styles.blockTypeBadge, isGroup && styles.groupedBadge]}>
                    <Text style={styles.blockTypeBadgeText}>
                      {getTechniqueLabel(block.block_type)}
                    </Text>
                  </View>
                  <Text style={styles.blockHelperText}>
                    {getTechniqueHelperText(block.block_type)}
                  </Text>
                </View>

                <View style={styles.blockControls}>
                  {bIndex > 0 && (
                    <Pressable
                      style={styles.reorderButton}
                      onPress={() => moveBlock(bIndex, 'up')}
                    >
                      <Text style={styles.reorderText}>↑</Text>
                    </Pressable>
                  )}
                  {bIndex < blocks.length - 1 && (
                    <Pressable
                      style={styles.reorderButton}
                      onPress={() => moveBlock(bIndex, 'down')}
                    >
                      <Text style={styles.reorderText}>↓</Text>
                    </Pressable>
                  )}
                  {isGroup && (
                    <Pressable
                      style={styles.dissolveButton}
                      onPress={() => dissolveBlock(block.tempId)}
                    >
                      <Text style={styles.dissolveText}>Dissolve</Text>
                    </Pressable>
                  )}
                </View>
              </View>

              <View style={styles.blockRoundsRow}>
                {isGroup && (
                  <View style={styles.smallInput}>
                    <Label>Rounds</Label>
                    <TextInput
                      keyboardType="number-pad"
                      value={block.target_rounds}
                      onChangeText={(v) => updateBlockRounds(block.tempId, v)}
                    />
                  </View>
                )}
                <View style={styles.smallInput}>
                  <Label>{isGroup ? 'Rest after round (s)' : 'Rest (s)'}</Label>
                  <TextInput
                    keyboardType="number-pad"
                    value={block.rest_seconds}
                    onChangeText={(v) => updateBlockRest(block.tempId, v)}
                  />
                </View>
              </View>

              {block.exercises.map((exDraft, eIndex) => {
                const isSelected = selectedExIds.includes(exDraft.tempId);
                const isAllowed = isExerciseAllowed(exDraft.exercise, gymPolicy);

                return (
                  <Card
                    key={exDraft.tempId}
                    style={[styles.exerciseCard, isSelected && styles.exerciseCardSelected]}
                  >
                    <View style={styles.exerciseHeader}>
                      <Pressable
                        style={styles.checkboxArea}
                        onPress={() => toggleSelectExercise(exDraft.tempId)}
                      >
                        <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                          {isSelected && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <View style={styles.titleWithBadge}>
                          <Text style={typography.h3}>
                            {isGroup ? `${eIndex + 1}. ` : ''}
                            {exDraft.exercise.name}
                          </Text>
                          {!isAllowed && (
                            <View style={styles.unavailableBadge}>
                              <Text style={styles.unavailableBadgeText}>Unavailable at gym</Text>
                            </View>
                          )}
                        </View>
                      </Pressable>

                      <Text
                        style={styles.remove}
                        onPress={() => removeExercise(block.tempId, exDraft.tempId)}
                      >
                        Remove
                      </Text>
                    </View>

                    <HowToPanel exercise={exDraft.exercise} />

                    <SetRowList
                      unit={editorUnit}
                      rows={(exDraft.sets ?? []).map((set) => {
                        const regularBefore =
                          (exDraft.sets ?? [])
                            .filter((item) => item.kind === 'regular')
                            .findIndex((item) => item.key === set.key) + 1;
                        const dropBefore =
                          (exDraft.sets ?? [])
                            .filter((item) => item.kind === 'drop')
                            .findIndex((item) => item.key === set.key) + 1;
                        const regularCount = (exDraft.sets ?? []).filter((item) => item.kind === 'regular').length;
                        return {
                          key: set.key,
                          label: set.kind === 'drop' ? `Drop ${dropBefore}` : `Set ${regularBefore}`,
                          detail: set.weight ? `${set.weight} × ${set.reps}` : `${set.reps} reps`,
                          reps: set.reps,
                          weight: set.weight,
                          canRemove: set.kind === 'drop' || regularCount > 1,
                        };
                      })}
                      onAdd={() => {
                        const sets = exDraft.sets ?? [];
                        const regular = sets.filter((set) => set.kind === 'regular');
                        const last = regular[regular.length - 1];
                        updateExerciseSets(block.tempId, exDraft.tempId, [
                          ...sets,
                          {
                            key: `set-${Date.now()}`,
                            kind: 'regular',
                            reps: last?.reps ?? '10',
                            weight: last?.weight ?? '',
                          },
                        ]);
                      }}
                      onCommit={(key, reps, weight) => {
                        updateExerciseSets(
                          block.tempId,
                          exDraft.tempId,
                          (exDraft.sets ?? []).map((set) => (set.key === key ? { ...set, reps, weight } : set))
                        );
                      }}
                      onRemove={(key) => {
                        updateExerciseSets(
                          block.tempId,
                          exDraft.tempId,
                          (exDraft.sets ?? []).filter((set) => set.key !== key)
                        );
                      }}
                    />
                    {(exDraft.sets ?? []).filter((set) => set.kind === 'drop').length < 3 && (
                      <Pressable
                        style={styles.addDropLink}
                        onPress={() => {
                          const sets = exDraft.sets ?? [];
                          const last = [...sets].reverse().find((set) => set.kind === 'regular');
                          updateExerciseSets(block.tempId, exDraft.tempId, [
                            ...sets,
                            {
                              key: `drop-${Date.now()}`,
                              kind: 'drop',
                              reps: last?.reps ?? '10',
                              weight: last?.weight ?? '',
                            },
                          ]);
                        }}
                      >
                        <Text style={styles.addDropLinkText}>Add drop</Text>
                      </Pressable>
                    )}
                  </Card>
                );
              })}
            </Card>
          );
        })}

        <View style={styles.field}>
          <Button title="+ Add exercise" variant="secondary" onPress={() => setPickerVisible(true)} />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
        <Button title="Save routine" onPress={handleSave} loading={saving} />
      </ScrollView>

      <ExercisePickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={addExercise}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  addDropLink: { marginTop: spacing.xs, alignSelf: 'flex-start' },
  addDropLinkText: { ...typography.caption, color: colors.primary },
  content: { paddingBottom: spacing.xl },
  field: { marginTop: spacing.md },
  groupActionBar: {
    marginTop: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.accent,
    borderWidth: 1,
    padding: spacing.sm,
  },
  selectedCountText: { ...typography.caption, color: colors.accent, fontWeight: '700' },
  groupActionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs, alignItems: 'center', flexWrap: 'wrap' },
  actionBtnWrap: { flexGrow: 1 },
  addDropBtn: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  addDropBtnText: { ...typography.caption, color: colors.warning, fontWeight: '700' },
  blockCard: { marginTop: spacing.md, borderWidth: 1, borderColor: colors.border },
  groupedBlockCard: { borderColor: colors.primary, backgroundColor: colors.surface },
  blockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  blockHeaderLeft: { flex: 1, marginRight: spacing.sm },
  blockTypeBadge: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    alignSelf: 'flex-start',
  },
  groupedBadge: {
    backgroundColor: colors.primaryMuted,
  },
  blockTypeBadgeText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  blockHelperText: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  blockControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reorderButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.sm,
  },
  reorderText: { color: colors.text, fontWeight: '700' },
  dissolveButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.sm,
  },
  dissolveText: { ...typography.caption, color: colors.warning, fontWeight: '600' },
  blockRoundsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  exerciseCard: {
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
  },
  exerciseCardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.surface,
  },
  exerciseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  checkboxArea: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  checkboxActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkmark: { color: colors.background, fontWeight: '800', fontSize: 13 },
  remove: { color: colors.danger, fontWeight: '600', padding: 4 },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  smallInput: { flex: 1 },
  unitSelectorContainer: { marginTop: spacing.xs },
  unitChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  unitChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  unitChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  unitChipText: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  unitChipTextActive: { color: colors.background, fontWeight: '700' },
  dropSetsSection: {
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dropSetsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  dropSetsTitle: { ...typography.caption, color: colors.warning, fontWeight: '700' },
  dropSetsHelper: { ...typography.caption, color: colors.textMuted, fontSize: 11 },
  dropStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  dropStepBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dropStepBadgeText: { ...typography.caption, color: colors.warning, fontWeight: '700' },
  dropInput: { flex: 1 },
  dropRemoveBtn: { padding: 4 },
  titleWithBadge: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  unavailableBadge: {
    backgroundColor: '#331F21',
    borderColor: colors.danger,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  unavailableBadgeText: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '700',
    fontSize: 9,
  },
  error: { color: colors.danger, marginTop: spacing.sm, marginBottom: spacing.sm },
});
