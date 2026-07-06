import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import { Sparkles, Play, Trophy, LayoutDashboard, User as UserIcon, Radio, Tv, Flame } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import logoUrl from "@/assets/looplance-logo.png";
import { ReplayCard } from "@/components/ReplayCard";


export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Looplance — Replays na palma da mão" },
      { name: "description", content: "Veja, baixe e compartilhe seus melhores lances em tempo real direto da quadra." },
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
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [featuredReplays, setFeaturedReplays] = useState<Replay[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [replays, setReplays] = useState<Replay[]>([]);
  const [sponsors, setSponsors] = useState<string[]>([]);
  const [liveList, setLiveList] = useState<Array<{ quadra_id: string; quadra_nome: string; arena_id: string; arena_nome: string }>>([]);
  const [points, setPoints] = useState(0);
  const [xpPops, setXpPops] = useState<{ id: number }[]>([]);
  const [aspects, setAspects] = useState<Record<string, number>>({});



  // Gate: require auth to see feed; ensure profile is complete
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        navigate({ to: "/auth" });
        return;
      }
      const uid = data.session.user.id;
      const { data: prof } = await supabase
        .from("profiles")
        .select("cpf, birth_date, gender, city")
        .eq("id", uid)
        .maybeSingle();
      const missing = !prof || !prof.cpf || !prof.birth_date || !prof.gender || !prof.city;
      if (missing) {
        navigate({ to: "/complete-profile" });
        return;
      }
      setUserEmail(data.session.user.email ?? null);
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate({ to: "/auth" });
    });
    return () => { sub.subscription.unsubscribe(); };
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.rpc("log_user_action", { p_action: "logout", p_metadata: {} });
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  // Initial load
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
    // Dedup por quadra
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
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % featuredReplays.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [featuredReplays]);

  const fetchReplays = async () => {
    const { data } = await supabase
      .from("replays")
      .select("id, video_url, created_at, quadra_id, quadras(nome, arenas(nome))")
      .order("created_at", { ascending: false })
      .limit(100);
    setReplays((data ?? []) as Replay[]);
  };

  // Realtime
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

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <Toaster theme="light" position="top-center" />

      {/* XP pop overlay */}
      <div className="pointer-events-none fixed right-6 top-24 z-50">
        {xpPops.map((p) => (
          <div key={p.id} className="animate-xp-pop brand-text text-2xl font-black drop-shadow-sm">
            +10 XP
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black shadow-xl h-16 sm:h-20">
        <div className="mx-auto flex h-full max-w-2xl items-center px-4 sm:px-6">
          <div className="flex-1">
            <div className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 sm:px-3 sm:py-1.5 backdrop-blur-md">
              <Trophy className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-brand-orange" />
              <span className="text-[10px] sm:text-xs font-bold text-white tracking-tight">{points} XP</span>
            </div>
          </div>

          <div className="flex-none relative flex justify-center items-center h-full">
            <img
              src={logoUrl}
              alt="Looplance"
              className="h-28 sm:h-36 w-auto object-contain transition-transform hover:scale-105 z-50"
              style={{ marginTop: '4px' }}
            />
          </div>

          <div className="flex-1 flex justify-end gap-1.5">
            <Link
              to="/admin"
              className="group flex flex-col items-center gap-0.5 rounded-xl border border-white/20 bg-white/10 p-1.5 sm:p-2 backdrop-blur-md transition hover:bg-white/20 hover:border-brand-orange/50"
              title="Admin"
            >
              <LayoutDashboard className="h-4 w-4 sm:h-5 sm:w-5 text-brand-orange transition-transform group-hover:scale-110" />
              <span className="text-[8px] sm:text-[10px] font-black uppercase text-white/90 tracking-widest">Admin</span>
            </Link>
            <button
              onClick={handleLogout}
              className="group flex flex-col items-center gap-0.5 rounded-xl border border-white/20 bg-white/10 p-1.5 sm:p-2 backdrop-blur-md transition hover:bg-white/20 hover:border-red-400/50"
              title={userEmail ?? "Sair"}
            >
              <UserIcon className="h-4 w-4 sm:h-5 sm:w-5 text-white transition-transform group-hover:scale-110" />
              <span className="text-[8px] sm:text-[10px] font-black uppercase text-white/90 tracking-widest">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {!authChecked ? (
        <div className="flex items-center justify-center py-32 text-gray-500 text-sm">Carregando...</div>
      ) : (

      <main className="mx-auto max-w-2xl space-y-8 px-6 pb-24 pt-10">
        {/* Hero player — auto-adapts to video aspect (16:9 or 9:16) */}
        <section className="relative mx-auto overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/10"
          style={{
            aspectRatio: (aspects[featuredReplays[currentSlide]?.id ?? ""] ?? 16 / 9),
            maxHeight: "70vh",
            width: (aspects[featuredReplays[currentSlide]?.id ?? ""] ?? 16 / 9) < 1 ? "min(100%, 56vh)" : "100%",
          }}
        >
          <div className="absolute inset-0">
            {featuredReplays.length > 0 ? (
              featuredReplays.map((replay, idx) => (
                <div
                  key={replay.id}
                  className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${idx === currentSlide ? "opacity-100" : "opacity-0"}`}
                >
                  <video
                    src={`${replay.video_url}#t=3.0`}
                    autoPlay
                    muted
                    loop
                    playsInline
                    onLoadedMetadata={(e) => {
                      const v = e.currentTarget;
                      if (v.videoWidth && v.videoHeight) {
                        setAspects((prev) =>
                          prev[replay.id] ? prev : { ...prev, [replay.id]: v.videoWidth / v.videoHeight }
                        );
                      }
                    }}
                    className="h-full w-full object-contain bg-black"
                  />
                </div>
              ))
            ) : (
              <div className="absolute inset-0 brand-gradient opacity-20" />
            )}

            <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/70 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />

            <div className="absolute inset-x-0 bottom-0 flex flex-col px-5 pb-6">
              <h1 className="text-xl sm:text-2xl font-black leading-tight tracking-tight text-white drop-shadow">
                Seus lances <span className="brand-text">em loop.</span>
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-white/80 font-medium">
                Reviva cada jogada, compartilhe cada vitória.
              </p>
            </div>

            {featuredReplays.length > 1 && (
              <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
                {featuredReplays.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-1 transition-all duration-300 rounded-full ${idx === currentSlide ? "w-5 bg-brand-orange" : "w-1 bg-white/30"}`}
                  />
                ))}
              </div>
            )}
          </div>
        </section>


        {/* Live now — horizontal scroll */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
              <Tv className="h-4 w-4 text-brand-orange" />
              Assista Ao Vivo
            </h2>
            {liveList.length > 0 && (
              <span className="text-xs font-medium text-zinc-500">{liveList.length} ao vivo</span>
            )}
          </div>

          {liveList.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/60 px-4 py-6 text-center">
              <p className="text-xs font-medium text-zinc-400">
                Nenhuma transmissão ao vivo agora. Volte em breve!
              </p>
            </div>

          ) : (
            <div className="-mx-6 overflow-x-auto px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex gap-3 w-max">
                {liveList.map((l) => (
                  <Link
                    key={l.quadra_id}
                    to="/arena/$id"
                    params={{ id: l.arena_id }}
                    search={{ live: l.quadra_id }}
                    className="group relative flex min-w-[200px] max-w-[220px] flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-black p-3 shadow-lg ring-1 ring-black/5 transition hover:border-brand-orange/60 hover:shadow-[0_0_25px_-8px_var(--brand-orange)]"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-orange/10 via-transparent to-transparent opacity-70" />
                    <div className="relative flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
                        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                        AO VIVO
                      </span>
                      <Radio className="h-4 w-4 text-brand-orange" />
                    </div>
                    <div className="relative mt-6">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                        {l.arena_nome}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-black text-white">{l.quadra_nome}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>



        {/* Sponsors Carousel */}
        {sponsors.length > 0 && (
          <section className="overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-900 p-6">
            <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-zinc-500">
              <Sparkles className="h-3.5 w-3.5 text-brand-orange" /> Patrocinadores
            </div>

            <div className="relative overflow-hidden">
              <div
                className="flex gap-10 animate-marquee items-center"
                style={{ width: "max-content" }}
              >
                {[...sponsors, ...sponsors].map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt="Patrocinador"
                    className="h-16 w-auto object-contain grayscale hover:grayscale-0 transition"
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Feed */}
        <section className="space-y-5">
          <div className="flex items-center justify-between px-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
              <Flame className="h-4 w-4 text-brand-orange" />
              Feed de Lances
            </h2>
            <span className="text-xs font-medium text-zinc-500">{replays.length} lances</span>
          </div>

          {replays.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {replays.map((r) => <ReplayCard key={r.id} replay={r} onReward={reward} />)}
            </div>
          )}
        </section>

      </main>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-6 rounded-2xl border border-zinc-800/60 bg-zinc-900 px-6 py-16 text-center">
      <div className="brand-gradient grid h-20 w-20 place-items-center rounded-full brand-glow shadow-lg transition-transform hover:scale-105">
        <Play className="h-9 w-9 fill-white text-white" />
      </div>
      <div className="max-w-[280px] space-y-2">
        <h3 className="text-lg font-bold tracking-tight text-white">Aguardando o lance...</h3>
        <p className="text-sm font-medium text-zinc-400 leading-relaxed">
          Aperte o botão na quadra e o seu replay aparecerá aqui em poucos segundos!
        </p>
      </div>

    </div>
  );
}
