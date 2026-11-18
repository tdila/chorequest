// ChoreQuest — Supabase client (Task 1)
// Configured with an expo-secure-store storage adapter so auth sessions persist
// securely across app launches. Uses ONLY the public anon key (RLS enforced
// server-side); never a service_role key.

import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars. Set EXPO_PUBLIC_SUPABASE_URL and ' +
      'EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.',
  );
}

// SecureStore is native-only and throws on web (the web target renders on the
// server). On web we fall back to localStorage when available, otherwise a
// no-op so module load never crashes during SSR / tsc.
const ExpoSecureStoreAdapter: SupportedStorage = {
  getItem: async (key) => {
    try {
      if (Platform.OS === 'web') {
        return globalThis.localStorage?.getItem(key) ?? null;
      }
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  setItem: async (key, value) => {
    try {
      if (Platform.OS === 'web') {
        globalThis.localStorage?.setItem(key, value);
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Swallow storage errors so auth still works in-memory this session.
    }
  },
  removeItem: async (key) => {
    try {
      if (Platform.OS === 'web') {
        globalThis.localStorage?.removeItem(key);
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Ignore.
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    // No URL-based session detection in a native app (not a browser redirect).
    detectSessionInUrl: false,
  },
});

// Keep the session token fresh only while the app is foregrounded. Supabase's
// recommended pattern for React Native. Web manages this on its own.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
