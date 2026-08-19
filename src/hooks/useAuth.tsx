import { Session } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getAuthRedirectUrl, isNetworkAuthError, stripAuthParamsFromUrl, supabase } from '../lib/supabase';
import { Profile } from '../types/db';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  passwordRecovery: boolean;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  clearPasswordRecovery: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function toAuthError(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : fallback;
  if (isNetworkAuthError(message)) {
    return 'Cannot reach the FitTrack server. The Supabase project may be paused or deleted, or the URL in .env is wrong.';
  }
  return message || fallback;
}

function isRecoveryRedirect(): boolean {
  if (typeof window === 'undefined') return false;
  const combined = `${window.location.search ?? ''}${window.location.hash ?? ''}`;
  return /type=recovery/i.test(combined);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  const loadProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    setProfile(data ?? null);
  };

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        if (isRecoveryRedirect()) setPasswordRecovery(true);
      })
      .catch(() => {
        setSession(null);
      })
      .finally(() => {
        setSessionReady(true);
      });

    // Do not call other Supabase APIs in this callback — it holds an auth lock
    // and deadlocks login on web (sign-in never navigates to the app).
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && isRecoveryRedirect())) {
        setPasswordRecovery(true);
      }
      if (event === 'SIGNED_OUT') {
        setPasswordRecovery(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    const userId = session?.user.id;
    if (!userId) {
      setProfile(null);
      setProfileReady(true);
      return;
    }
    setProfileReady(false);
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (!cancelled) {
        setProfile(data ?? null);
        setProfileReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user.id, sessionReady]);

  const loading = !sessionReady || Boolean(session?.user.id && !profileReady);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      passwordRecovery,
      refreshProfile: async () => {
        if (session) await loadProfile(session.user.id);
      },
      signIn: async (email, password) => {
        try {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          return { error: error ? toAuthError(error.message, 'Sign in failed.') : null };
        } catch (err) {
          return { error: toAuthError(err, 'Sign in failed.') };
        }
      },
      signUp: async (email, password) => {
        try {
          const { data, error } = await supabase.auth.signUp({ email, password });
          if (error) return { error: toAuthError(error.message, 'Sign up failed.') };
          if (data.user && !data.session && (data.user.identities?.length ?? 1) === 0) {
            return { error: 'An account with this email already exists. Try logging in.' };
          }
          return { error: null };
        } catch (err) {
          return { error: toAuthError(err, 'Sign up failed.') };
        }
      },
      requestPasswordReset: async (email) => {
        try {
          const redirectTo = getAuthRedirectUrl();
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            ...(redirectTo ? { redirectTo } : {}),
          });
          return { error: error ? toAuthError(error.message, 'Could not send reset email.') : null };
        } catch (err) {
          return { error: toAuthError(err, 'Could not send reset email.') };
        }
      },
      updatePassword: async (password) => {
        try {
          const { error } = await supabase.auth.updateUser({ password });
          if (error) return { error: toAuthError(error.message, 'Could not update password.') };
          setPasswordRecovery(false);
          stripAuthParamsFromUrl();
          return { error: null };
        } catch (err) {
          return { error: toAuthError(err, 'Could not update password.') };
        }
      },
      clearPasswordRecovery: () => {
        setPasswordRecovery(false);
        stripAuthParamsFromUrl();
      },
      signOut: async () => {
        setPasswordRecovery(false);
        await supabase.auth.signOut();
      },
    }),
    [session, profile, loading, passwordRecovery]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
