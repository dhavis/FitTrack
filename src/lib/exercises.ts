import { ImageSourcePropType } from 'react-native';
import { supabase } from './supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

const LOCAL_HOWTO: Record<string, ImageSourcePropType> = {
  'squat.png': require('../../assets/howto/squat.png'),
  'bench.png': require('../../assets/howto/bench.png'),
  'deadlift.png': require('../../assets/howto/deadlift.png'),
  'ohp.png': require('../../assets/howto/ohp.png'),
  'pullup.png': require('../../assets/howto/pullup.png'),
  'row.png': require('../../assets/howto/row.png'),
};

export function resolveHowtoImageSource(path: string | null | undefined): ImageSourcePropType | null {
  if (!path) return null;
  const key = path.replace(/^\//, '');
  if (LOCAL_HOWTO[key]) return LOCAL_HOWTO[key];
  if (path.startsWith('http://') || path.startsWith('https://')) return { uri: path };
  if (!supabaseUrl) return null;
  return { uri: `${supabaseUrl}/storage/v1/object/public/exercise-howto/${key}` };
}

export function resolveHowtoImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (!supabaseUrl) return null;
  return `${supabaseUrl}/storage/v1/object/public/exercise-howto/${path.replace(/^\//, '')}`;
}

export function parseHowtoCues(cues: string | null | undefined): string[] {
  if (!cues?.trim()) return [];
  return cues
    .split(/\n|•|;/)
    .map((c) => c.trim())
    .filter(Boolean);
}

export async function fetchExercisesByMuscle(muscleGroups: string[], limitPerGroup = 6) {
  const results: Record<string, { id: string; name: string; muscle_group: string | null; equipment: string | null }[]> = {};
  await Promise.all(
    muscleGroups.map(async (group) => {
      const { data } = await supabase
        .from('exercises')
        .select('id, name, muscle_group, equipment')
        .eq('muscle_group', group)
        .is('user_id', null)
        .order('name')
        .limit(limitPerGroup);
      results[group] = data ?? [];
    })
  );
  return results;
}