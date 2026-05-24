import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Toaster, toast } from "sonner";
import { Sparkles, MapPin, Calendar as CalIcon, Play, LogIn, LogOut, Trophy, LayoutDashboard, User, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import logoUrl from "@/assets/looplance-logo.png";
import { ReplayCard } from "@/components/ReplayCard";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Looplance — Replays na palma da mão" },
      { name: "description", content: "Veja, baixe e compartilhe seus melhores lances em tempo real direto da quadra." },
    ],
  }),
});

interface Arena { id: string; nome: string }
interface Quadra { id: string; nome: string; arena_id: string }
interface Replay {
  id: string;
  video_url: string;
  created_at: string;
  quadra_id: string;
  quadras?: { nome: string; arenas?: { nome: string } | null } | null;
}

function Home() {
  const [featuredReplays, setFeaturedReplays] = useState<Replay[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [replays, setReplays] = useState<Replay[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingReplays, setLoadingReplays] = useState(false);
  const [arenaId, setArenaId] = useState<string>("");
  const [quadraId, setQuadraId] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [startHour, setStartHour] = useState<string>("");
  const [endHour, setEndHour] = useState<string>("");
  
  const [points, setPoints] = useState(0);
  const [xpPops, setXpPops] = useState<{ id: number }[]>([]);
  const { user, profile, signOut, isLoading: authLoading, isSuperAdmin } = useAuth();
  
  useEffect(() => {
    if (user && profile) {
      console.log("[ROLE]", profile.role);
      console.log("[ADMIN ACCESS]", isSuperAdmin);
      if (isSuperAdmin) {
        console.log("[ADMIN MENU] rendering");
      }
    }
  }, [user, profile, isSuperAdmin, authLoading]);
  
  const observerTarget = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Optimized fetchReplays with pagination
  const fetchReplays = useCallback(async (pageNum = 0) => {
    if (loadingReplays) return;
    setLoadingReplays(true);
    
    try {
      const { data, error } = await supabase
        .from("replays")
        .select("id, video_url, created_at, quadra_id, quadras(nome, arenas(nome))")
        .order("created_at", { ascending: false })
        .range(pageNum * 20, (pageNum + 1) * 20 - 1);
      
      if (error) throw error;

      if (data) {
        if (pageNum === 0) {
          setReplays(data as Replay[]);
        } else {
          setReplays(prev => [...prev, ...data as Replay[]]);
        }
        setHasMore(data.length === 20);
        setPage(pageNum);
      }
    } catch (err) {
      console.error("[AUTH ERROR] Error fetching replays:", err);
      toast.error("Erro ao carregar lances");
    } finally {
      setLoadingReplays(false);
    }
  }, [loadingReplays]);

  // Initial load
  useEffect(() => {
    supabase.from("arenas").select("*").order("nome").then(({ data }) => setArenas(data ?? []));
    fetchReplays(0);
    
    // Fetch featured
    supabase
      .from("replays")
      .select("id, video_url, created_at, quadra_id, quadras(nome, arenas(nome))")
      .order("created_at", { ascending: false })
      .limit(3)
      .then(({ data }) => setFeaturedReplays((data ?? []) as Replay[]));
  }, []);

  // Intersection Observer for Infinite Scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loadingReplays) {
          fetchReplays(page + 1);
        }
      },
      { threshold: 1.0 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loadingReplays, page, fetchReplays]);

  // Carousel logic
  useEffect(() => {
    if (featuredReplays.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % featuredReplays.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [featuredReplays]);

  // Filter quadras when arena changes
  useEffect(() => {
    if (!arenaId) { setQuadras([]); setQuadraId(""); return; }
    supabase.from("quadras").select("*").eq("arena_id", arenaId).order("nome")
      .then(({ data }) => setQuadras(data ?? []));
    setQuadraId("");
  }, [arenaId]);

  // Realtime subscription - optimized to be unique
  useEffect(() => {
    const ch = supabase
      .channel("replays-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "replays" }, () => {
        fetchReplays(0);
        toast("🔥 Novo lance na quadra!");
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchReplays]);

  const filtered = useMemo(() => {
    return replays.filter((r) => {
      if (quadraId && r.quadra_id !== quadraId) return false;
      if (arenaId && !quadraId) {
        const ok = quadras.some((q) => q.id === r.quadra_id);
        if (quadras.length && !ok) return false;
      }
      const d = new Date(r.created_at);
      if (date) {
        const ymd = d.toISOString().slice(0, 10);
        if (ymd !== date) return false;
      }
      if (startHour && d.getHours() < parseInt(startHour)) return false;
      if (endHour && d.getHours() >= parseInt(endHour)) return false;
      
      return true;
    });
  }, [replays, arenaId, quadraId, quadras, date, startHour, endHour]);

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
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#1C1B2F] shadow-xl h-14 sm:h-16">
        <div className="mx-auto flex h-full max-w-2xl items-center px-4">
          <div className="flex-1">
            <div className="inline-flex items-center gap-1 sm:gap-1.5 rounded-full border border-white/20 bg-white/10 px-2 py-0.5 sm:px-2.5 sm:py-1 backdrop-blur-md">
              <Trophy className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-brand-orange" />
              <span className="text-[9px] sm:text-[10px] font-bold text-white tracking-tight">{points} XP</span>
            </div>
          </div>

          <div className="flex-none relative flex justify-center items-center h-full">
            <img 
              src={logoUrl} 
              alt="Looplance" 
              className="h-24 sm:h-28 w-auto object-contain transition-transform hover:scale-105 z-50 animate-logo-float" 
            />
          </div>

          <div className="flex-1 flex justify-end items-center gap-3">
            {user ? (
              <button 
                onClick={() => signOut()}
                className="group flex flex-col items-center gap-0.5 rounded-xl border border-white/20 bg-white/10 p-1.5 sm:p-2 backdrop-blur-md transition hover:bg-white/20 hover:border-red-500/50"
              >
                <LogOut className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
                <span className="text-[8px] sm:text-[10px] font-black uppercase text-white/90 tracking-widest">Sair</span>
              </button>
            ) : (
              <Link 
                to="/login" 
                className="group flex flex-col items-center gap-0.5 rounded-xl border border-white/20 bg-white/10 p-1.5 sm:p-2 backdrop-blur-md transition hover:bg-white/20 hover:border-brand-orange/50"
              >
                <User className="h-4 w-4 sm:h-5 sm:w-5 text-brand-orange" />
                <span className="text-[8px] sm:text-[10px] font-black uppercase text-white/90 tracking-widest">Login</span>
              </Link>
            )}
            
            {isSuperAdmin && (
              <Link 
                to="/admin" 
                className="group flex flex-col items-center gap-0.5 rounded-xl border-2 border-brand-orange bg-brand-orange/10 p-1.5 sm:p-2 backdrop-blur-md transition hover:bg-brand-orange/20 shadow-lg shadow-brand-orange/20"
              >
                <LayoutDashboard className="h-4 w-4 sm:h-5 sm:w-5 text-brand-orange" />
                <span className="text-[8px] sm:text-[10px] font-black uppercase text-white tracking-widest">Admin Panel</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-8 px-6 pb-24 pt-10">
        {/* Hero Carousel */}
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
              <h1 className="text-4xl font-black text-white drop-shadow-lg">
                Seus lances <span className="brand-text">em loop.</span>
              </h1>
              <p className="mt-3 text-base text-white/80 font-medium max-w-[280px]">
                Selecione a arena, escolha a quadra e reviva cada jogada.
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

        {/* Selectors */}
        <section className="glass-card space-y-5 p-6 bg-white shadow-md border border-gray-200">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/80">
            <MapPin className="h-3.5 w-3.5" /> Localização
          </div>
          <div className="space-y-3">
            <Select value={arenaId} onChange={setArenaId} placeholder="Selecione a Arena">
              {arenas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </Select>
            <Select value={quadraId} onChange={setQuadraId} placeholder={arenaId ? "Selecione a Quadra" : "Escolha uma arena antes"} disabled={!arenaId}>
              {quadras.map((q) => <option key={q.id} value={q.id}>{q.nome}</option>)}
            </Select>
          </div>
        </section>

        {/* Filters */}
        <section className="glass-card space-y-5 p-6 bg-white shadow-md border border-gray-200">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/80">
            <CalIcon className="h-3.5 w-3.5" /> Filtros
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground outline-none transition focus:border-brand-orange focus:ring-1 focus:ring-brand-orange"
          />
          <div className="grid grid-cols-2 gap-4">
            <TimeInput label="De" value={startHour} onChange={setStartHour} />
            <TimeInput label="Até" value={endHour} onChange={setEndHour} />
          </div>
          {(date || startHour || endHour) && (
            <button
              onClick={() => { setDate(""); setStartHour(""); setEndHour(""); }}
              className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-brand-orange hover:underline"
            >
              Limpar filtros
            </button>
          )}
        </section>

        {/* Feed */}
        <section className="space-y-5">
          <div className="flex items-center justify-between px-1">
            <h2 className="flex items-center gap-2 text-xl font-black text-gray-900">
              <Sparkles className="h-5 w-5 text-brand-orange" />
              Feed de Lances
            </h2>
            <span className="text-sm font-medium text-muted-foreground">{filtered.length} lances</span>
          </div>

          {filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-8">
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                {filtered.map((r) => <ReplayCard key={r.id} replay={r} onReward={reward} />)}
              </div>
              
              {/* Observer Target for Infinite Scroll */}
              <div ref={observerTarget} className="h-10 flex justify-center items-center">
                {loadingReplays && <Loader2 className="h-6 w-6 animate-spin text-brand-orange" />}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Select({
  value, onChange, placeholder, disabled, children,
}: { value: string; onChange: (v: string) => void; placeholder: string; disabled?: boolean; children: React.ReactNode }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full appearance-none rounded-xl border border-border bg-muted px-4 py-3.5 pr-10 text-sm font-medium text-foreground outline-none transition focus:border-brand-orange focus:ring-1 focus:ring-brand-orange disabled:opacity-40"
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
      <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/60">▾</div>
    </div>
  );
}

function TimeInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="rounded-xl border border-border bg-muted px-4 py-2.5 transition-colors focus-within:border-brand-orange">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-transparent text-sm font-bold text-foreground outline-none"
      >
        <option value="">--:00</option>
        {Array.from({ length: 24 }).map((_, h) => (
          <option key={h} value={h}>{h.toString().padStart(2, "0")}:00</option>
        ))}
      </select>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center glass-card bg-white/50">
      <div className="mb-4 rounded-full bg-muted p-4">
        <Play className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-bold text-gray-900">Nenhum lance encontrado</h3>
      <p className="max-w-[260px] text-sm text-muted-foreground">Tente ajustar os filtros ou escolha outra quadra.</p>
    </div>
  );
}
