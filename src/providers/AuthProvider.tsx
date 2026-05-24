import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";

interface Profile {
  id: string;
  email: string | null;
  is_super_admin: boolean | null;
  is_arena_owner: boolean | null;
  full_name?: string | null;
  cpf?: string | null;
  birth_date?: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isProfileLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  isProfileLoading: false,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  const fetchProfile = async (userId: string) => {
    // Avoid double fetching if already loading
    if (isProfileLoading) return;
    
    setIsProfileLoading(true);
    try {
      console.log("AuthProvider: Buscando perfil para:", userId);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, is_super_admin, is_arena_owner, full_name, cpf, birth_date")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("AuthProvider: Erro ao buscar perfil:", error);
      } else {
        console.log("AuthProvider: Dados do Perfil recebidos:", data);
        setProfile(data as Profile);
      }
    } catch (err) {
      console.error("AuthProvider: Erro inesperado ao buscar perfil:", err);
    } finally {
      setIsProfileLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    let mounted = true;

    // Initial session check
    const initAuth = async () => {
      try {
        console.log("AuthProvider: Iniciando verificação de auth...");
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!mounted) return;

        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Iniciar busca do perfil mas não necessariamente bloquear a interface principal
          // a menos que estejamos em uma rota que dependa estritamente dele.
          fetchProfile(session.user.id);
        }
      } catch (error) {
        console.error("AuthProvider: Erro na inicialização do auth:", error);
      } finally {
        if (mounted) {
          console.log("AuthProvider: Inicialização concluída.");
          setIsLoading(false);
        }
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("AuthProvider: Evento de mudança de auth:", event);
        
        if (!mounted) return;

        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
            fetchProfile(session.user.id);
          }
        } else {
          setProfile(null);
        }
        
        setIsLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("AuthProvider: Erro ao sair:", error);
    } finally {
      setSession(null);
      setUser(null);
      setProfile(null);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      session, 
      user, 
      profile, 
      isLoading,
      isProfileLoading,
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
