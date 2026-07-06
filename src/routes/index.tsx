import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import { Play, Search, Flame, Radio, Tv, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ReplayCard } from "@/components/ReplayCard";
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

function Home() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [featuredReplays, setFeaturedReplays] = useState<Replay[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [replays, setReplays] = useState<Replay[]>([]);
  const [sponsors, setSponsors] = useState<string[]>([]);
  const [liveList, setLiveList] = useState<
    Array<{ quadra_id: string; quadra_nome: string; arena_id: string; arena_nome: string }>
  >([]);
  const [search, setSearch] = useState("");
  const [points, setPoints] = useState(0);
  const [xpPops, setXpPops] = useState<{ id: number }[]>([]);
  const [aspects, setAspects] = useState<Record<string, number>>({});

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
    fetchFeatured();
    fetchSponsors();
    fetchLive();
    const iv = setInterval(fetchLive, 30000);
    return () => clearInterval(iv);
  }, [authChecked]);

  const fetchLive = async () => {
    const { data } = await supabase
      .from("cameras")
      .select("quadra_id, streaming_status, quadras(id, nome, arena_id, arenas(id, nome))")
      .in("streaming_status", ["online", "streaming", "live"]);
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

  const fetchFeatured = async () => {
    const { data } = await supabase
      .from("replays")
      .select("id, video_url, created_at, quadra_id, quadras(nome, arenas(nome))")
      .order("created_at", { ascending: false })
      .limit(3);
    setFeaturedReplays((data ?? []) as Replay[]);
  };

  const fetchSponsors = async () => {
    const { data } = await supabase
      .from("arenas")
      .select("sponsor_logo_left, sponsor_logo_center, sponsor_logo_right");
    const logos = (data ?? [])
      .flatMap((a: any) => [a.sponsor_logo_left, a.sponsor_logo_center, a.sponsor_logo_right])
      .filter((u): u is string => !!u);
    setSponsors(Array.from(new Set(logos)));
  };

  useEffect(() => {
    if (featuredReplays.length <= 1) return;
    const t = setInterval(() => setCurrentSlide((p) => (p + 1) % featuredReplays.length), 5000);
    return () => clearInterval(t);
  }, [featuredReplays]);

  const fetchReplays = async () => {
    const { data } = await supabase
      .from("replays")
      .select("id, video_url, created_at, quadra_id, quadras(nome, arenas(nome))")
      .order("created_at", { ascending: false })
      .limit(100);
    setReplays((data ?? []) as Replay[]);
  };

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

  const reward = () => {
    setPoints((p) => p + 10);
    const id = Date.now() + Math.random();
    setXpPops((arr) => [...arr, { id }]);
    setTimeout(() => setXpPops((arr) => arr.filter((p) => p.id !== id)), 1300);
  };

  const filteredReplays = search
    ? replays.filter((r) =>
        (r.quadras?.nome || "").toLowerCase().includes(search.toLowerCase()) ||
        (r.quadras?.arenas?.nome || "").toLowerCase().includes(search.toLowerCase())
      )
    : replays;

  return (
    <SocialShell active="feed">
      <Toaster theme="dark" position="top-center" />

      {/* XP pop */}
      <div className="pointer-events-none fixed right-6 top-24 z-50">
        {xpPops.map((p) => (
          <div key={p.id} className="animate-xp-pop brand-text text-2xl font-black">+10 XP</div>
        ))}
      </div>

      {!authChecked ? (
        <div className="flex items-center justify-center py-32 text-muted-foreground text-sm">Carregando...</div>
      ) : (
        <div className="space-y-6">
          {/* Points chip */}
          <div className="flex items-center justify-between">
            <div>
              <h1
                className="text-3xl font-black uppercase tracking-wide"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                Feed
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
              placeholder="Buscar arenas, quadras, lances..."
              className="w-full bg-secondary border border-border rounded-2xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-primary/60 transition"
            />
          </div>

          {/* Hero featured player */}
          {featuredReplays.length > 0 && (
            <section
              className="relative mx-auto overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/10"
              style={{
                aspectRatio: aspects[featuredReplays[currentSlide]?.id ?? ""] ?? 16 / 9,
                maxHeight: "60vh",
              }}
            >
              {featuredReplays.map((replay, idx) => (
                <div
                  key={replay.id}
                  className={`absolute inset-0 transition-opacity duration-1000 ${idx === currentSlide ? "opacity-100" : "opacity-0"}`}
                >
                  <video
                    src={`${replay.video_url}#t=3.0`}
                    autoPlay
                    muted
                    loop
                    playsInline
                    onLoadedMetadata={(e) => {
                      const v = e.currentTarget;
                      if (v.videoWidth && v.videoHeight)
                        setAspects((prev) => (prev[replay.id] ? prev : { ...prev, [replay.id]: v.videoWidth / v.videoHeight }));
                    }}
                    className="h-full w-full object-contain bg-black"
                  />
                </div>
              ))}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex flex-col px-5 pb-6">
                <h2
                  className="text-2xl font-black uppercase tracking-tight text-white drop-shadow"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  Seus lances <span className="brand-text">em loop.</span>
                </h2>
                <p className="mt-1 text-xs text-white/80 font-medium">Reviva cada jogada, compartilhe cada vitória.</p>
              </div>
              {featuredReplays.length > 1 && (
                <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
                  {featuredReplays.map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-1 rounded-full transition-all ${idx === currentSlide ? "w-5 brand-gradient" : "w-1 bg-white/30"}`}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Live now */}
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2
                className="flex items-center gap-2 text-lg font-black uppercase tracking-wide"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                <Tv className="h-4 w-4 text-brand-orange" />
                Ao Vivo
              </h2>
              {liveList.length > 0 && (
                <span className="text-xs font-medium text-muted-foreground">{liveList.length} ao vivo</span>
              )}
            </div>

            {liveList.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-6 text-center">
                <p className="text-xs font-medium text-muted-foreground">
                  Nenhuma transmissão ao vivo agora. Volte em breve!
                </p>
              </div>
            ) : (
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
          </section>

          {/* Sponsors */}
          {sponsors.length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-brand-orange" /> Patrocinadores
              </div>
              <div className="relative overflow-hidden">
                <div className="flex gap-10 animate-marquee items-center" style={{ width: "max-content" }}>
                  {[...sponsors, ...sponsors].map((url, i) => (
                    <img key={i} src={url} alt="" className="h-12 w-auto object-contain grayscale hover:grayscale-0 transition" />
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Feed */}
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2
                className="flex items-center gap-2 text-lg font-black uppercase tracking-wide"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                <Flame className="h-4 w-4 text-brand-orange" />
                Feed de Lances
              </h2>
              <span
                className="text-xs font-bold text-muted-foreground"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {filteredReplays.length}
              </span>
            </div>

            {filteredReplays.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {filteredReplays.map((r) => (
                  <ReplayCard key={r.id} replay={r} onReward={reward} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </SocialShell>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-6 rounded-2xl border border-border bg-card px-6 py-16 text-center">
      <div className="brand-gradient grid h-20 w-20 place-items-center rounded-full shadow-lg">
        <Play className="h-9 w-9 fill-black text-black" />
      </div>
      <div className="max-w-[280px] space-y-2">
        <h3
          className="text-lg font-black uppercase tracking-wide"
          style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
        >
          Aguardando o lance...
        </h3>
        <p className="text-sm font-medium text-muted-foreground leading-relaxed">
          Aperte o botão na quadra e o seu replay aparecerá aqui em poucos segundos!
        </p>
      </div>
    </div>
  );
}
