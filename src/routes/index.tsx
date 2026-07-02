import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import { Sparkles, Play, Trophy, LayoutDashboard, User as UserIcon } from "lucide-react";
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
  const [points, setPoints] = useState(0);
  const [xpPops, setXpPops] = useState<{ id: number }[]>([]);

  // Gate: require auth to see feed
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate({ to: "/auth" });
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
  }, [authChecked]);

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
        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl bg-black shadow-2xl ring-1 ring-white/10">
          <div className="aspect-[9/16] w-full overflow-hidden relative">
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
                    className="h-full w-full object-cover"
                  />
                </div>
              ))
            ) : (
              <div className="absolute inset-0 brand-gradient opacity-20" />
            )}

            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-black/80" />

            <div className="absolute inset-0 flex flex-col items-center justify-end p-8 text-center pb-12">
              <h1 className="text-4xl font-black leading-tight tracking-tight text-white drop-shadow-lg">
                Seus lances <span className="brand-text">em loop.</span>
              </h1>
              <p className="mt-3 text-base text-white/80 leading-relaxed font-medium max-w-[280px]">
                Reviva cada jogada, compartilhe cada vitória.
              </p>
            </div>

            {featuredReplays.length > 1 && (
              <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
                {featuredReplays.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-1.5 transition-all duration-300 rounded-full ${idx === currentSlide ? "w-6 bg-brand-orange" : "w-1.5 bg-white/30"}`}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Sponsors Carousel */}
        {sponsors.length > 0 && (
          <section className="glass-card overflow-hidden p-6 bg-white shadow-md border border-gray-200">
            <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/80">
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
            <h2 className="flex items-center gap-2 text-xl font-black text-gray-900">
              <Sparkles className="h-5 w-5 text-brand-orange" />
              Feed de Lances
            </h2>
            <span className="text-sm font-medium text-muted-foreground">{replays.length} lances</span>
          </div>

          {replays.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
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
    <div className="glass-card flex flex-col items-center gap-6 px-6 py-16 text-center bg-white shadow-md border border-gray-200">
      <div className="brand-gradient grid h-20 w-20 place-items-center rounded-full brand-glow shadow-lg transition-transform hover:scale-105">
        <Play className="h-9 w-9 fill-white text-white" />
      </div>
      <div className="max-w-[280px] space-y-2">
        <h3 className="text-lg font-black text-gray-900">Aguardando o lance...</h3>
        <p className="text-sm font-medium text-muted-foreground leading-relaxed">
          Aperte o botão na quadra e o seu replay aparecerá aqui em poucos segundos!
        </p>
      </div>
    </div>
  );
}
