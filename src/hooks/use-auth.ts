import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

export interface Profile {
  id: string;
  is_super_admin: boolean | null;
  email: string | null;
  full_name: string | null;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[AUTH HOOK] Initializing...');
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[AUTH HOOK] Initial session:', session ? 'Found' : 'Not found');
      if (session) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[AUTH HOOK] Auth event:', _event, session ? 'Session found' : 'No session');
      if (session) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    console.log('[AUTH HOOK] Fetching profile for:', userId);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[AUTH HOOK] Profile fetch error:', error);
      } else {
        console.log('[AUTH HOOK] Profile loaded:', data);
        setProfile(data);
      }
    } catch (err) {
      console.error('[AUTH HOOK] Fatal profile error:', err);
    } finally {
      setLoading(false);
    }
  };

  return { user, profile, loading, isAuthenticated: !!user, isSuperAdmin: !!profile?.is_super_admin };
}
