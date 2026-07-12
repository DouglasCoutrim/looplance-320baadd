import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronRight, Eye, Heart, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SocialShell } from "@/components/SocialShell";
import { ReplayCard } from "@/components/ReplayCard";

export const Route = createFileRoute("/replays")({
  component: ReplaysPage,
  head: () => ({
    meta: [
      { title: "Meus Replays — Loop Lance" },
      { name: "description", content: "Todos os seus melhores lances em um só lugar." },
    ],
  }),
});

interface Replay {
  id: string;
  video_url: string;
  created_at: string;
  quadra_id: string;
  quadras?: { nome: string; arenas?: { nome: string } | null } | null;
}

const COLLECTIONS = [
  { label: "Em Destaque", icon: "🔥", desc: "Seus melhores momentos" },
  { label: "Mais Curtidos", icon: "❤️", desc: "Os fãs aprovaram" },
  { label: "Salvos", icon: "🔖", desc: "Replays para assistir depois" },
  { label: "Compartilhados", icon: "📤", desc: "Espalhados pela plataforma" },
  { label: "Conquistas", icon: "🏆", desc: "Marcos da sua carreira" },
];

function ReplaysPage() {
  const navigate = useNavigate();
  const [replays, setReplays] = useState<Replay[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return navigate({ to: "/auth" });
      supabase
        .from("replays")
        .select("id, video_url, created_at, quadra_id, quadras(nome, arenas(nome))")
        .eq("status", "ready")
        .order("created_at", { ascending: false })
        .limit(50)
        .then(({ data }) => setReplays((data ?? []) as Replay[]));
    });
  }, [navigate]);

  return (
    <SocialShell active="replays">
      <h1
        className="text-3xl font-black uppercase tracking-wide mb-1"
        style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
      >
        Meus Replays
      </h1>
      <p className="text-sm text-muted-foreground mb-6">{replays.length} replays disponíveis</p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Visualizações", value: replays.length * 12, Icon: Eye },
          { label: "Curtidas", value: replays.length * 3, Icon: Heart },
          { label: "Compart.", value: replays.length, Icon: Share2 },
        ].map((s) => (
          <div key={s.label} className="text-center p-4 bg-card rounded-xl border border-border">
            <s.Icon className="w-4 h-4 mx-auto mb-1 text-brand-orange" />
            <p className="text-lg font-black brand-text" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {s.value.toLocaleString("pt-BR")}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2 mb-8">
        {COLLECTIONS.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-orange-500/40 cursor-pointer transition-all group"
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-secondary shrink-0">
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold">{item.label}</p>
              <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-orange-400 group-hover:translate-x-0.5 transition-all" />
          </div>
        ))}
      </div>

      {replays.length > 0 && (
        <>
          <h3
            className="font-black text-lg uppercase tracking-wide mb-3"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            Todos os Replays
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {replays.map((r) => (
              <ReplayCard key={r.id} replay={r} onReward={() => {}} />
            ))}
          </div>
        </>
      )}
    </SocialShell>
  );
}
