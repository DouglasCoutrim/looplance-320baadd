import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LandingPage } from "@/components/LandingPage";
import { ReplayFeed } from "@/components/ReplayFeed";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Looplance Edge v1.0.1" },
      { name: "description", content: "Gerenciamento de câmeras e streaming Looplance Edge." },
    ],
  }),
});

function Home() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Capture redirect_quadra from URL
    const params = new URLSearchParams(window.location.search);
    const redirectQuadra = params.get("redirect_quadra");
    if (redirectQuadra) {
      localStorage.setItem("looplance_target_quadra", redirectQuadra);
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 text-brand-orange animate-spin mx-auto" />
          <p className="text-white/40 font-black uppercase tracking-widest text-[10px]">Carregando Looplance Edge v1.0.1...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <LandingPage />;
  }

  return <ReplayFeed />;
}
