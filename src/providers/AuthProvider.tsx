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
        return null;
      }

      if (data) {
        console.log("[ROLE DETECTED]", data.role);
        console.log("[isSuperAdmin]", data.role === 'super-admin');
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
        console.log("[AUTH INIT] Initializing...");
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("[AUTH ERROR] getSession error:", sessionError);
        }

        if (!mounted) return;

        if (initialSession) {
          console.log("[SESSION LOADED] User ID:", initialSession.user.id, "Email:", initialSession.user.email);
          setSession(initialSession);
          setUser(initialSession.user);
          
          // Fetch profile before setting initialized to true
          console.log("[AUTH INIT] Fetching profile for:", initialSession.user.id);
          const userProfile = await fetchProfile(initialSession.user.id);
          
          if (mounted) {
            console.log("[AUTH INIT] Profile set:", userProfile?.role || "no-role");
            setProfile(userProfile);
          }
        } else {
          console.log("[AUTH INIT] No session found.");
        }
      } catch (error) {
        console.error("[AUTH ERROR] Initialization failed:", error);
      } finally {
        if (mounted) {
          console.log("[AUTH INIT] Setting initialized=true, isLoading=false");
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
          
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
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