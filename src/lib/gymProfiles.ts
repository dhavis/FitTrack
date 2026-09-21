import { supabase } from './supabase';
import {
  EquipmentPref,
  EquipmentType,
  GymProfile,
  GymProfileKind,
  GymProfileSnapshot,
  ResolvedGymProfile,
} from '../types/db';

export async function resolveActiveGymProfile(): Promise<ResolvedGymProfile> {
  const { data, error } = await supabase.rpc('resolve_active_gym_profile');
  if (error) {
    throw new Error(error.message ?? 'Failed to resolve active gym profile');
  }
  return data as ResolvedGymProfile;
}

export async function fetchUserGymProfiles(includeArchived = false): Promise<GymProfile[]> {
  let query = supabase
    .from('gym_profiles')
    .select('*')
    .order('is_main', { ascending: false })
    .order('created_at', { ascending: false });

  if (!includeArchived) {
    query = query.is('archived_at', null);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message ?? 'Failed to fetch gym profiles');
  }
  return (data as GymProfile[]) ?? [];
}

export async function fetchGymProfileDetails(
  profileId: string
): Promise<ResolvedGymProfile> {
  const [{ data: profile, error: pErr }, { data: exEq, error: eqErr }, { data: exEx, error: exErr }] =
    await Promise.all([
      supabase.from('gym_profiles').select('*').eq('id', profileId).single(),
      supabase
        .from('gym_profile_excluded_equipment')
        .select('equipment_type')
        .eq('gym_profile_id', profileId),
      supabase
        .from('gym_profile_excluded_exercises')
        .select('exercise_id')
        .eq('gym_profile_id', profileId),
    ]);

  if (pErr || !profile) {
    throw new Error(pErr?.message ?? 'Gym profile not found');
  }
  if (eqErr) throw new Error(eqErr.message);
  if (exErr) throw new Error(exErr.message);

  return {
    profile: profile as GymProfile,
    excluded_equipment: (exEq ?? []).map((r: any) => r.equipment_type as EquipmentType),
    excluded_exercise_ids: (exEx ?? []).map((r: any) => r.exercise_id as string),
  };
}

export interface SaveGymProfileParams {
  profileId?: string | null;
  name: string;
  basePreset: EquipmentPref;
  kind?: GymProfileKind;
  expiresAt?: string | null;
  excludedEquipment?: EquipmentType[];
  excludedExerciseIds?: string[];
}

export async function saveGymProfile(
  params: SaveGymProfileParams
): Promise<ResolvedGymProfile> {
  const { data, error } = await supabase.rpc('save_gym_profile', {
    p_profile_id: params.profileId || null,
    p_name: params.name,
    p_base_preset: params.basePreset,
    p_kind: params.kind ?? 'permanent',
    p_expires_at: params.expiresAt || null,
    p_excluded_equipment: params.excludedEquipment ?? null,
    p_excluded_exercise_ids: params.excludedExerciseIds ?? null,
  });

  if (error) {
    throw new Error(error.message ?? 'Failed to save gym profile');
  }
  return data as ResolvedGymProfile;
}

export async function setMainGymProfile(profileId: string): Promise<GymProfile> {
  const { data, error } = await supabase.rpc('set_main_gym_profile', {
    p_profile_id: profileId,
  });
  if (error) {
    throw new Error(error.message ?? 'Failed to set main gym profile');
  }
  return data as GymProfile;
}

export async function setActiveGymProfile(profileId: string): Promise<GymProfile> {
  const { data, error } = await supabase.rpc('set_active_gym_profile', {
    p_profile_id: profileId,
  });
  if (error) {
    throw new Error(error.message ?? 'Failed to set active gym profile');
  }
  return data as GymProfile;
}

export async function endTemporaryGymProfile(
  profileId: string
): Promise<ResolvedGymProfile> {
  const { data, error } = await supabase.rpc('end_temporary_gym_profile', {
    p_profile_id: profileId,
  });
  if (error) {
    throw new Error(error.message ?? 'Failed to end temporary gym profile');
  }
  return data as ResolvedGymProfile;
}

export async function convertGymProfileToPermanent(
  profileId: string
): Promise<GymProfile> {
  const { data, error } = await supabase.rpc('convert_gym_profile_to_permanent', {
    p_profile_id: profileId,
  });
  if (error) {
    throw new Error(error.message ?? 'Failed to convert gym profile to permanent');
  }
  return data as GymProfile;
}

export async function archiveGymProfile(
  profileId: string
): Promise<ResolvedGymProfile> {
  const { data, error } = await supabase.rpc('archive_gym_profile', {
    p_profile_id: profileId,
  });
  if (error) {
    throw new Error(error.message ?? 'Failed to archive gym profile');
  }
  return data as ResolvedGymProfile;
}

export function makeGymProfileSnapshot(resolved: ResolvedGymProfile): GymProfileSnapshot {
  return {
    id: resolved.profile.id,
    name: resolved.profile.name,
    base_preset: resolved.profile.base_preset,
    kind: resolved.profile.kind,
    is_main: resolved.profile.is_main,
    excluded_equipment: resolved.excluded_equipment,
    excluded_exercise_ids: resolved.excluded_exercise_ids,
  };
}
