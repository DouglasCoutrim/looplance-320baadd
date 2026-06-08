import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import logoUrl from "@/assets/looplance-logo.png";
import { LoginForm } from "./LoginForm";
import { 
  Play, 
  Smartphone, 
  Zap,
  Bell,
  Search,
  Star
} from "lucide-react";

export function LandingPage() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-black flex items-center justify-center">
      <Zap className="h-8 w-8 text-[#F97316] animate-pulse" />
    </div>;
  }

  if (!session) {
    return <LoginForm />;
  }

  const replays = [
    { id: 1, title: "Pateo Beach - Quadra 02", location: "SP, Adamantina", time: "07/06 20:19", img: "https://images.unsplash.com/photo-1544919982-b61976f0ba43?q=80&w=400&auto=format&fit=crop" },
    { id: 2, title: "Arena Beach Sports - Quadra 01", location: "SP, Adamantina", time: "07/06 20:19", img: "https://images.unsplash.com/photo-1593766788306-28561086694e?q=80&w=400&auto=format&fit=crop" },
    { id: 3, title: "Arena Babaçu - UFNT", location: "TO, Tocantinópolis", time: "07/06 20:19", img: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=400&auto=format&fit=crop" },
    { id: 4, title: "Flamboyant Sport Arena - Quadra 01", location: "GO, Cristalina", time: "07/06 19:48", img: "https://images.unsplash.com/photo-1519766304817-4f37bdeac0a2?q=80&w=400&auto=format&fit=crop" },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white selection:bg-[#F97316] selection:text-white overflow-x-hidden pb-28">
      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 bg-[#0A0A0A]/80 backdrop-blur-md px-5 py-4 flex items-center justify-between">
        <img src={logoUrl} alt="Looplance" className="h-8 w-auto" />
        <div className="flex items-center gap-4">
          <button className="h-10 w-10 flex items-center justify-center rounded-full bg-[#111] border border-[#222]">
            <Search className="h-5 w-5 text-white" />
          </button>
          <button className="h-10 w-10 flex items-center justify-center rounded-full bg-[#111] border border-[#F97316]/50">
            <Bell className="h-5 w-5 text-[#F97316]" />
          </button>
        </div>
      </nav>

      <main className="px-5 space-y-8 mt-4">
        {/* CARROSSEL DE REPLAYS RECENTES */}
        <section>
          <div className="flex overflow-x-auto gap-4 pb-4 hide-scrollbar snap-x">
            {replays.slice(0, 3).map((replay) => (
              <div key={replay.id} className="min-w-[85%] snap-center bg-[#111] rounded-[24px] overflow-hidden border border-[#222]">
                <div className="relative aspect-video">
                  <img src={replay.img} alt={replay.title} className="w-full h-full object-cover opacity-60" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-12 w-12 rounded-full bg-[#F97316] flex items-center justify-center pl-1 shadow-[0_0_20px_rgba(249,115,22,0.4)]">
                      <Play className="h-6 w-6 text-black fill-black" />
                    </div>
                  </div>
                  <div className="absolute top-4 left-4">
                     <span className="bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded-sm uppercase tracking-wider flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                        Ao Vivo
                     </span>
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-base mb-1">{replay.title}</h3>
                  <p className="text-xs text-[#888]">{replay.location}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* PROMO CARD (Instagram) */}
        <section className="bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] p-[1px] rounded-[24px]">
          <div className="bg-[#111] rounded-[23px] p-5 flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
               <div className="h-8 w-8 rounded-lg border-2 border-white flex items-center justify-center">
                  <div className="h-4 w-4 rounded-full border-2 border-white" />
               </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                <span className="text-[10px] font-black bg-white text-black px-1.5 py-0.5 rounded-sm uppercase">Novo</span>
              </div>
              <p className="text-sm font-bold leading-tight mb-1">Siga no Instagram para ver as novidades da ...</p>
              <p className="text-[10px] text-white/60">@smashliveoficial →</p>
            </div>
          </div>
        </section>

        {/* LISTA DE REPLAYS */}
        <section className="space-y-6">
          <h2 className="text-xl font-bold text-[#F97316]">Replays Recentes</h2>
          <div className="grid grid-cols-2 gap-4">
            {replays.map((replay) => (
              <div key={replay.id} className="flex flex-col gap-3">
                <div className="relative aspect-[4/3] bg-[#111] rounded-[20px] overflow-hidden border border-[#222]">
                  <img src={replay.img} alt={replay.title} className="w-full h-full object-cover opacity-50" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Play className="h-5 w-5 text-[#F97316] fill-[#F97316]" />
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold leading-tight">{replay.title}</h4>
                  <div className="flex items-center justify-between mt-1 opacity-40">
                    <span className="text-[9px]">{replay.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* TAB BAR */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0A0A0A]/95 backdrop-blur-md border-t border-white/5 px-6 pt-3 pb-8 flex items-center justify-between">
        <div className="flex flex-col items-center gap-1">
          <Zap className="h-6 w-6 text-[#F97316] fill-[#F97316]/10" />
          <span className="text-[10px] text-[#F97316] font-medium">Início</span>
        </div>
        <div className="flex flex-col items-center gap-1 opacity-40">
          <Play className="h-6 w-6 text-white" />
          <span className="text-[10px] text-white font-medium">Ao Vivo</span>
        </div>
        <div className="flex flex-col items-center gap-1 opacity-40">
          <Star className="h-6 w-6 text-white" />
          <span className="text-[10px] text-white font-medium">Replays</span>
        </div>
        <div className="flex flex-col items-center gap-1 opacity-40">
          <Smartphone className="h-6 w-6 text-white" />
          <span className="text-[10px] text-white font-medium">Arena</span>
        </div>
        <div className="flex flex-col items-center gap-1 opacity-40">
          <div className="h-6 w-6 rounded-full border border-white/20 flex items-center justify-center text-[10px] font-bold">U</div>
          <span className="text-[10px] text-white font-medium">Perfil</span>
        </div>
      </nav>
    </div>
  );
}
