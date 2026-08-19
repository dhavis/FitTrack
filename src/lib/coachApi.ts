import { EquipmentPref, ExperienceLevel, PrimaryGoalType } from '../types/db';
import { supabase } from './supabase';

export type CoachMode = 'full' | 'nutrition_only' | 'training_only';

export interface CoachGenerateRequest {
  mode?: CoachMode;
  goalType?: PrimaryGoalType;
  experience?: ExperienceLevel;
  daysPerWeek?: number;
  equipment?: EquipmentPref;
  sessionMinutes?: number;
  injuryNotes?: string | null;
}

export interface CoachingCopy {
  weekly_coaching: string;
  training_tips: string[];
  nutrition_tips: string[];
  disclaimer: string;
}

export interface CoachGenerateResponse {
  ok: boolean;
  coach_plan?: {
    id: string;
    generated_at: string;
    coaching_copy: CoachingCopy;
    training_summary: Record<string, unknown> | null;
    nutrition_summary: Record<string, unknown> | null;
    model: string | null;
  };
  training?: Record<string, unknown> | null;
  nutrition?: Record<string, unknown> | null;
  coaching?: CoachingCopy;
  used_llm?: boolean;
  error?: string;
  retry_after_seconds?: number;
}

export async function invokeCoachGenerate(
  body: CoachGenerateRequest = {}
): Promise<CoachGenerateResponse> {
  const { data, error } = await supabase.functions.invoke('coach-generate', {
    body,
  });

  if (error) {
    throw new Error(error.message ?? 'Coach generate failed');
  }

  const payload = data as CoachGenerateResponse;
  if (!payload?.ok) {
    throw new Error(payload?.error ?? 'Coach generate failed');
  }
  return payload;
}

export async function fetchActiveCoachPlan() {
  const { data, error } = await supabase
    .from('coach_plans')
    .select('*')
    .eq('is_active', true)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}