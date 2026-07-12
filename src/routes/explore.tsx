import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SocialShell } from "@/components/SocialShell";
import { ReplayCard } from "@/components/ReplayCard";

export const Route = createFileRoute("/explore")({
  component: ExplorePage,
  head: () => ({
    meta: [
      { title: "Explorar — Loop Lance" },
      { name: "description", content: "Descubra os melhores lances da comunidade." },
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

const FILTERS = ["Todos", "Basquete", "Futebol", "Tênis", "Vôlei"];

function ExplorePage() {
  const [replays, setReplays] = useState<Replay[]>([]);
  const [filter, setFilter] = useState("Todos");

  useEffect(() => {
    supabase
      .from("replays")
      .select("id, video_url, created_at, quadra_id, quadras(nome, arenas(nome))")
      .order("created_at", { ascending: false })
      .limit(60)
      .then(({ data }) => setReplays((data ?? []) as Replay[]));
  }, []);

  return (
    <SocialShell active="explore">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h1
          className="text-3xl font-black uppercase tracking-wide"
          style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
        >
          Explorar
        </h1>
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition shrink-0 ${
                filter === f
                  ? "text-black brand-gradient"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {replays.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-16 text-center">
          <div className="brand-gradient grid h-14 w-14 place-items-center rounded-full">
            <Play className="h-6 w-6 fill-black text-black" />
          </div>
          <p className="text-sm text-muted-foreground">Nenhum lance disponível ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {replays.map((r) => (
            <ReplayCard key={r.id} replay={r} onReward={() => {}} />
          ))}
        </div>
      )}
    </SocialShell>
  );
}
