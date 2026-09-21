import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import {
  fetchUserGymProfiles,
  resolveActiveGymProfile,
  setActiveGymProfile,
} from '../lib/gymProfiles';
import { GymProfile, ResolvedGymProfile } from '../types/db';

export interface UseActiveGymProfileResult {
  activeGym: ResolvedGymProfile | null;
  userGyms: GymProfile[];
  mainGym: GymProfile | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<ResolvedGymProfile | null>;
  switchActiveGym: (profileId: string) => Promise<void>;
}

export function useActiveGymProfile(): UseActiveGymProfileResult {
  const { session } = useAuth();
  const [activeGym, setActiveGym] = useState<ResolvedGymProfile | null>(null);
  const [userGyms, setUserGyms] = useState<GymProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<ResolvedGymProfile | null> => {
    if (!session?.user?.id) {
      setActiveGym(null);
      setUserGyms([]);
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const [resolved, allGyms] = await Promise.all([
        resolveActiveGymProfile(),
        fetchUserGymProfiles(false),
      ]);
      setActiveGym(resolved);
      setUserGyms(allGyms);
      return resolved;
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load active gym profile');
      return null;
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (session?.user?.id) {
      refresh();
    } else {
      setActiveGym(null);
      setUserGyms([]);
    }
  }, [session?.user?.id, refresh]);

  const switchActiveGym = useCallback(
    async (profileId: string) => {
      setLoading(true);
      setError(null);
      try {
        await setActiveGymProfile(profileId);
        await refresh();
      } catch (err: any) {
        setError(err?.message ?? 'Failed to switch active gym profile');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [refresh]
  );

  const mainGym = userGyms.find((g) => g.is_main) ?? null;

  return {
    activeGym,
    userGyms,
    mainGym,
    loading,
    error,
    refresh,
    switchActiveGym,
  };
}
