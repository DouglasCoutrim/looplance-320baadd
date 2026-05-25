import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Simplified and robust Supabase client initialization
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[SUPABASE ERROR] Missing environment variables:', {
    url: !!supabaseUrl,
    key: !!supabaseAnonKey
  });
}

console.log('[SUPABASE INIT]', {
  url: supabaseUrl,
  hasKey: !!supabaseAnonKey,
  env: import.meta.env.MODE
});

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

// Debug helper to log session state
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('[SUPABASE AUTH EVENT]', event, session ? 'Session found' : 'No session');
  });
}


