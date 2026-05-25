import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jurwopyuxmhvtwzjxynm.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1cndvcHl1eG1odnR3emp4eW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NzYzMzcsImV4cCI6MjA5NTA1MjMzN30.WUOOJTsA0L_BCDygaYtNkU63lIYhn5C-GLvSSHMYDdo';

console.log('[SUPABASE URL]', supabaseUrl);
console.log('[SUPABASE KEY EXISTS]', !!supabaseAnonKey);

if (!supabaseUrl || !supabaseAnonKey) {
  const missing = [
    ...(!supabaseUrl ? ['SUPABASE_URL'] : []),
    ...(!supabaseAnonKey ? ['SUPABASE_ANON_KEY'] : []),
  ];
  const message = `Missing Supabase environment variable(s): ${missing.join(', ')}. Connect Supabase in Lovable Cloud.`;
  console.error(`[Supabase] ${message}`);
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});


