import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Create a .env file (see .env.example) and restart the Expo dev server.'
  );
}

// Fall back to a syntactically valid placeholder so createClient doesn't throw
// before the app can render the "setup required" screen.
export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder-anon-key', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Web recovery emails land with ?code= / #access_token= on this origin.
    // Native has no page URL, so leave detection off there.
    detectSessionInUrl: Platform.OS === 'web',
    flowType: 'pkce',
  },
});

function getWebBasePath(): string {
  const envPath = process.env.EXPO_PUBLIC_WEB_BASE_PATH?.trim();
  if (envPath) {
    const withLeading = envPath.startsWith('/') ? envPath : `/${envPath}`;
    return withLeading.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.pathname?.startsWith('/FitTrack')) {
    return '/FitTrack';
  }
  return '';
}

/** Origin + basePath (web) or undefined so GoTrue falls back to the project Site URL. */
export function getAuthRedirectUrl(): string | undefined {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${getWebBasePath()}`;
  }
  return undefined;
}

export function stripAuthParamsFromUrl() {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  const clean = `${window.location.origin}${window.location.pathname}`;
  window.history.replaceState({}, document.title, clean);
}

export function isNetworkAuthError(message: string | undefined | null): boolean {
  if (!message) return false;
  return /fetch failed|Failed to fetch|Network request failed|ENOTFOUND|NetworkError|Load failed/i.test(
    message
  );
}

export async function checkSupabaseReachable(): Promise<boolean> {
  if (!isSupabaseConfigured || !supabaseUrl || !supabaseAnonKey) return false;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/health`, {
      signal: ctrl.signal,
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}
