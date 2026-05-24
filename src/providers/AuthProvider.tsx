import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from "react";
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
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  initialized: boolean;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isArenaOwner: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const fetchingRef = useRef<string | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    if (fetchingRef.current === userId) {
      console.log("[PROFILE LOADED] Already fetching for:", userId);
      return null;
    }

    try {
      fetchingRef.current = userId;
      console.log("[PROFILE LOADED] Start for:", userId);
      
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, role, full_name, cpf, birth_date")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("[AUTH ERROR] Failed to fetch profile:", error);
        // Important: throw error so initializeAuth can catch it if needed, or handle it here
        return null;
      }

      console.log("[ROLE DETECTED] Raw data:", data);
      
      if (data) {
        console.log("[ROLE DETECTED]", data.role);
        console.log("[ADMIN ACCESS]", data.role === 'super-admin');
        // Add to window for easier debugging in console
        (window as any).lastProfile = data;
      } else {
        console.warn("[AUTH WARNING] No profile found for user:", userId);
        console.log("[ADMIN ACCESS] false (no profile)");
      }
      
      return data as Profile;
    } catch (err) {
      console.error("[AUTH ERROR] Unexpected error fetching profile:", err);
      return null;
    } finally {
      fetchingRef.current = null;
    }
  }, []);

  const refreshProfile = async () => {
    if (user) {
      const updatedProfile = await fetchProfile(user.id);
      if (updatedProfile) setProfile(updatedProfile);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log("[AUTH INIT] Getting session...");
        
        let initialSession = null;
        try {
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) console.error("[AUTH ERROR] getSession error:", sessionError);
          initialSession = session;
        } catch (err) {
          console.error("[AUTH ERROR] getSession catch:", err);
        }

        if (!mounted) return;

        if (initialSession) {
          console.log("[SESSION LOADED] User ID:", initialSession.user.id);
          setSession(initialSession);
          setUser(initialSession.user);
          
          // Fetch profile
          const userProfile = await fetchProfile(initialSession.user.id);
          if (mounted && userProfile) {
            console.log("[AUTH INIT] Profile set:", userProfile.role);
            setProfile(userProfile);
          }
        } else {
          console.log("[AUTH INIT] No initial session found.");
        }
      } catch (error) {
        console.error("[AUTH ERROR] Initialization critical failure:", error);
      } finally {
        if (mounted) {
          console.log("[AUTH INIT] Setting initialized=true");
          setInitialized(true);
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log(`[AUTH EVENT] ${event}`);
        
        if (!mounted) return;

        if (currentSession) {
          setSession(currentSession);
          setUser(currentSession.user);
          
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
            const userProfile = await fetchProfile(currentSession.user.id);
            if (mounted && userProfile) setProfile(userProfile);
          }
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
        
        if (mounted) {
          setInitialized(true);
          setIsLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signOut = async () => {
    try {
      console.log("[AUTH ACTION] Signing out...");
      await supabase.auth.signOut();
    } catch (error) {
      console.error("[AUTH ERROR] Sign out failed:", error);
    } finally {
      setSession(null);
      setUser(null);
      setProfile(null);
    }
  };

  useEffect(() => {
    // Safety timer to prevent being stuck on loader
    const safetyTimer = setTimeout(() => {
      if (!initialized) {
        console.warn("[AUTH] Initialization taking too long, forcing state...");
        setInitialized(true);
        setIsLoading(false);
      }
    }, 6000);

    return () => {
      clearTimeout(safetyTimer);
    };
  }, [initialized]);

  const contextValue = useMemo(() => ({
    session,
    user,
    profile,
    isLoading,
    initialized,
    isAuthenticated: !!user,
    isSuperAdmin: profile?.role === 'super-admin',
    isArenaOwner: profile?.role === 'arena-owner',
    signOut,
    refreshProfile
  }), [session, user, profile, isLoading, initialized]);

  return (
    <AuthContext.Provider value={contextValue}>
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