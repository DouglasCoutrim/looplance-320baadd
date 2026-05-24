import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";

export type UserRole = 'super-admin' | 'arena-owner' | 'user';

export interface Profile {
  id: string;
  email: string | null;
  role: UserRole;
  full_name?: string | null;
  cpf?: string | null;
  birth_date?: string | null;
  is_super_admin: boolean | null;
  is_arena_owner: boolean | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isSuperAdmin: boolean;
  isArenaOwner: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  isSuperAdmin: false,
  isArenaOwner: false,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      console.log("AuthProvider: [START] Fetching profile for:", userId);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, role, is_super_admin, is_arena_owner, full_name, cpf, birth_date")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("AuthProvider: [ERROR] Failed to fetch profile:", error);
        return null;
      }

      console.log("AuthProvider: [SUCCESS] Profile loaded:", data);
      return data as Profile;
    } catch (err) {
      console.error("AuthProvider: [ERROR] Unexpected error fetching profile:", err);
      return null;
    }
  }, []);

  const refreshProfile = async () => {
    if (user) {
      const updatedProfile = await fetchProfile(user.id);
      setProfile(updatedProfile);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log("AuthProvider: [INIT] Initializing auth state...");
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (!mounted) return;

        if (initialSession) {
          console.log("AuthProvider: [INIT] Session found, fetching profile...");
          const userProfile = await fetchProfile(initialSession.user.id);
          if (mounted) {
            setSession(initialSession);
            setUser(initialSession.user);
            setProfile(userProfile);
          }
        } else {
          console.log("AuthProvider: [INIT] No initial session found.");
        }
      } catch (error) {
        console.error("AuthProvider: [ERROR] Initialization failed:", error);
      } finally {
        if (mounted) {
          setIsLoading(false);
          console.log("AuthProvider: [INIT] Completed.");
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log(`AuthProvider: [EVENT] ${event}`);
        
        if (!mounted) return;

        if (currentSession) {
          setSession(currentSession);
          setUser(currentSession.user);
          
          // Only fetch profile if it's a significant event or we don't have it
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || !profile) {
            const userProfile = await fetchProfile(currentSession.user.id);
            if (mounted) setProfile(userProfile);
          }
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
        
        setIsLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, profile]);

  const signOut = async () => {
    try {
      console.log("AuthProvider: [ACTION] Signing out...");
      await supabase.auth.signOut();
    } catch (error) {
      console.error("AuthProvider: [ERROR] Sign out failed:", error);
    } finally {
      setSession(null);
      setUser(null);
      setProfile(null);
    }
  };

  const isSuperAdmin = profile?.role === 'super-admin' || !!profile?.is_super_admin;
  const isArenaOwner = profile?.role === 'arena-owner' || !!profile?.is_arena_owner;

  return (
    <AuthContext.Provider value={{ 
      session, 
      user, 
      profile, 
      isLoading,
      isSuperAdmin,
      isArenaOwner,
      signOut, 
      refreshProfile 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
