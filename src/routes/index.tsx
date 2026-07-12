import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import {
  Search, Sparkles, Plus, Play, Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, Radio,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SocialShell } from "@/components/SocialShell";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Loop Lance — Seus lances em loop" },
      { name: "description", content: "Reviva cada jogada, compartilhe cada vitória. A rede social do esporte." },
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

interface StoryProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return `${Math.floor(diff / 86400)} d`;
}

function Home() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [replays, setReplays] = useState<Replay[]>([]);
  const [stories, setStories] = useState<StoryProfile[]>([]);
  const [liveList, setLiveList] = useState<
    Array<{ quadra_id: string; quadra_nome: string; arena_id: string; arena_nome: string }>
  >([]);
  const [search, setSearch] = useState("");
  const [points, setPoints] = useState(0);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return navigate({ to: "/auth" });
      const uid = data.session.user.id;
      const { data: prof } = await supabase
        .from("profiles")
        .select("cpf, birth_date, gender, city")
        .eq("id", uid)
        .maybeSingle();
      const missing = !prof || !prof.cpf || !prof.birth_date || !prof.gender || !prof.city;
      if (missing) return navigate({ to: "/complete-profile" });
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate({ to: "/auth" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!authChecked) return;
    fetchReplays();
    fetchStories();
    fetchLive();
    const iv = setInterval(fetchLive, 30000);
    return () => clearInterval(iv);
  }, [authChecked]);

  useEffect(() => {
    const ch = supabase
      .channel("replays-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "replays" }, () => {
        fetchReplays();
        toast("🔥 Novo lance na quadra!");
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const fetchReplays = async () => {
    const { data } = await supabase
      .from("replays")
      .select("id, video_url, created_at, quadra_id, quadras(nome, arenas(nome))")
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(30);
    setReplays((data ?? []) as Replay[]);
  };

  const fetchStories = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .not("avatar_url", "is", null)
      .limit(10);
    setStories((data ?? []) as StoryProfile[]);
  };

  const fetchLive = async () => {
    const { data } = await supabase
      .from("cameras")
      .select("quadra_id, streaming_status, active, quadras(id, nome, arena_id, arenas(id, nome))")
      .or("streaming_status.in.(online,streaming,live),and(streaming_status.is.null,active.eq.true)");
    const list = (data ?? [])
      .map((c: any) => {
        const q = c.quadras;
        const a = q?.arenas;
        if (!q || !a) return null;
        return { quadra_id: q.id, quadra_nome: q.nome, arena_id: a.id, arena_nome: a.nome };
      })
      .filter(Boolean) as Array<{ quadra_id: string; quadra_nome: string; arena_id: string; arena_nome: string }>;
    const seen = new Set<string>();
    setLiveList(list.filter((x) => (seen.has(x.quadra_id) ? false : seen.add(x.quadra_id))));
  };

  const toggleLike = (id: string) => {
    setLiked((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
    setPoints((p) => p + 5);
  };
  const toggleSave = (id: string) =>
    setSaved((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const filtered = search
    ? replays.filter((r) =>
        (r.quadras?.nome || "").toLowerCase().includes(search.toLowerCase()) ||
        (r.quadras?.arenas?.nome || "").toLowerCase().includes(search.toLowerCase())
      )
    : replays;

  return (
    <SocialShell active="feed">
      <Toaster theme="dark" position="top-center" />

      {!authChecked ? (
        <div className="flex items-center justify-center py-32 text-muted-foreground text-sm">Carregando...</div>
      ) : (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1
                className="text-3xl font-black uppercase tracking-wide"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                Início
              </h1>
              <p className="text-xs text-muted-foreground mt-1">Os melhores lances da quadra, em tempo real.</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5">
              <Sparkles className="w-3.5 h-3.5 text-brand-orange" />
              <span
                className="text-xs font-black text-foreground"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {points} XP
              </span>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar atletas, esportes, arenas..."
              className="w-full bg-secondary border border-border rounded-2xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-primary/60 transition"
            />
          </div>

          {/* Stories row (com "seu story" no início) */}
          <div className="flex gap-3.5 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group">
              <div className="p-[2.5px] rounded-full bg-secondary">
                <div className="w-14 h-14 rounded-full overflow-hidden bg-card border-2 border-background flex items-center justify-center">
                  <Plus className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
              <span className="text-[11px] text-muted-foreground text-center w-16 truncate">Seu Story</span>
            </div>
            {stories.map((s) => (
              <Link
                key={s.id}
                to="/profile/$id"
                params={{ id: s.id }}
                className="flex flex-col items-center gap-1.5 shrink-0 group"
              >
                <div className="p-[2.5px] rounded-full brand-gradient transition-transform group-hover:scale-105">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-card border-2 border-background">
                    {s.avatar_url ? (
                      <img src={s.avatar_url} alt={s.full_name || ""} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-xs font-bold text-muted-foreground">
                        {(s.full_name || "?").slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-[11px] text-muted-foreground text-center w-16 truncate">
                  {(s.full_name || "Atleta").split(" ")[0]}
                </span>
              </Link>
            ))}
          </div>

          {/* Live now strip */}
          {liveList.length > 0 && (
            <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex gap-3 w-max">
                {liveList.map((l) => (
                  <Link
                    key={l.quadra_id}
                    to="/arena/$id"
                    params={{ id: l.arena_id }}
                    search={{ live: l.quadra_id }}
                    className="group relative flex min-w-[220px] aspect-video flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-3 transition hover:border-primary/60"
                  >
                    <div className="absolute inset-0 opacity-70" style={{ background: "var(--gradient-brand-soft)" }} />
                    <div className="relative flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
                        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                        AO VIVO
                      </span>
                      <Radio className="h-4 w-4 text-brand-orange" />
                    </div>
                    <div className="relative">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {l.arena_nome}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-black text-foreground">{l.quadra_nome}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Posts */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card px-6 py-16 text-center">
              <div className="brand-gradient grid h-16 w-16 place-items-center rounded-full shadow-lg">
                <Play className="h-7 w-7 fill-black text-black" />
              </div>
              <h3
                className="text-lg font-black uppercase tracking-wide"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                Aguardando o lance...
              </h3>
              <p className="text-sm text-muted-foreground max-w-[280px]">
                Aperte o botão na quadra e o seu replay aparecerá aqui em segundos!
              </p>
            </div>
          ) : (
            filtered.map((post) => {
              const isLiked = liked.has(post.id);
              const isSaved = saved.has(post.id);
              const isPlaying = playing === post.id;
              return (
                <article
                  key={post.id}
                  className="bg-card rounded-2xl overflow-hidden border border-border hover:border-white/10 transition-colors"
                >
                  {/* Header */}
                  <div className="flex items-center gap-3 p-4">
                    <div className="w-11 h-11 rounded-full overflow-hidden shrink-0 p-[2px] brand-gradient">
                      <div className="w-full h-full rounded-full overflow-hidden bg-background grid place-items-center text-xs font-black">
                        {(post.quadras?.arenas?.nome || post.quadras?.nome || "L").slice(0, 1)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm truncate">{post.quadras?.nome || "Quadra"}</span>
                        <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black text-black shrink-0 brand-gradient">
                          ✓
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        <span>🏟️ {post.quadras?.arenas?.nome || "Arena"}</span>
                        <span>·</span>
                        <span>{timeAgo(post.created_at)}</span>
                      </div>
                    </div>
                    <button className="text-muted-foreground hover:text-foreground transition p-1">
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Video */}
                  <div
                    className="relative aspect-video bg-secondary group cursor-pointer"
                    onClick={() => setPlaying(isPlaying ? null : post.id)}
                  >
                    <video
                      key={isPlaying ? `${post.id}-play` : post.id}
                      src={isPlaying ? post.video_url : `${post.video_url}#t=3.0`}
                      autoPlay={isPlaying}
                      controls={isPlaying}
                      muted={!isPlaying}
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-cover bg-black"
                    />
                    {!isPlaying && (
                      <>
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors pointer-events-none" />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-16 h-16 rounded-full flex items-center justify-center backdrop-blur-sm shadow-2xl transition-transform group-hover:scale-110 brand-gradient">
                            <Play className="w-7 h-7 text-black fill-black ml-1" />
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="px-4 py-3.5">
                    <div className="flex items-center gap-5 mb-3">
                      <button
                        onClick={() => toggleLike(post.id)}
                        className={`flex items-center gap-1.5 text-sm font-semibold transition-all ${
                          isLiked ? "text-orange-400" : "text-muted-foreground hover:text-orange-400"
                        }`}
                      >
                        <Heart className={`w-5 h-5 ${isLiked ? "fill-current scale-110" : ""}`} />
                        <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          {isLiked ? 1 : 0}
                        </span>
                      </button>
                      <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
                        <MessageCircle className="w-5 h-5" />
                        <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>0</span>
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            if (navigator.share) {
                              await navigator.share({ title: "Looplance", url: post.video_url });
                            } else {
                              await navigator.clipboard.writeText(post.video_url);
                              toast.success("Link copiado!");
                            }
                          } catch {}
                        }}
                        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
                      >
                        <Share2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => toggleSave(post.id)}
                        className={`ml-auto transition-all ${
                          isSaved ? "text-yellow-400" : "text-muted-foreground hover:text-yellow-400"
                        }`}
                      >
                        <Bookmark className={`w-5 h-5 ${isSaved ? "fill-current" : ""}`} />
                      </button>
                    </div>
                    <p className="text-sm leading-relaxed text-foreground/90">
                      Novo lance capturado na{" "}
                      <span className="font-bold">{post.quadras?.nome || "quadra"}</span>. Reviva e compartilhe!
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {["#LoopLance", "#Replay", `#${(post.quadras?.arenas?.nome || "Arena").replace(/\s+/g, "")}`].map(
                        (tag) => (
                          <span
                            key={tag}
                            className="text-xs font-semibold px-2.5 py-1 rounded-full bg-secondary cursor-pointer hover:bg-orange-400/10 transition-colors"
                            style={{ color: "#ff9500" }}
                          >
                            {tag}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}
    </SocialShell>
  );
}
