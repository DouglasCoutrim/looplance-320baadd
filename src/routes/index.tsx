import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Toaster, toast } from "sonner";
import { Sparkles, MapPin, Calendar as CalIcon, Play, LogIn, LogOut, Trophy } from "lucide-react";
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
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [replays, setReplays] = useState<Replay[]>([]);
  const [arenaId, setArenaId] = useState<string>("");
  const [quadraId, setQuadraId] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [startHour, setStartHour] = useState<string>("");
  const [endHour, setEndHour] = useState<string>("");
  const [checkInAt, setCheckInAt] = useState<Date | null>(null);
  const [points, setPoints] = useState(0);
  const [xpPops, setXpPops] = useState<{ id: number }[]>([]);

  // Initial load
  useEffect(() => {
    supabase.from("arenas").select("*").order("nome").then(({ data }) => setArenas(data ?? []));
    fetchReplays();
  }, []);

  // Filter quadras when arena changes
  useEffect(() => {
    if (!arenaId) { setQuadras([]); setQuadraId(""); return; }
    supabase.from("quadras").select("*").eq("arena_id", arenaId).order("nome")
      .then(({ data }) => setQuadras(data ?? []));
    setQuadraId("");
  }, [arenaId]);

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
      if (checkInAt && d < checkInAt) return false;
      return true;
    });
  }, [replays, arenaId, quadraId, quadras, date, startHour, endHour, checkInAt]);

  const reward = () => {
    setPoints((p) => p + 10);
    const id = Date.now() + Math.random();
    setXpPops((arr) => [...arr, { id }]);
    setTimeout(() => setXpPops((arr) => arr.filter((p) => p.id !== id)), 1300);
  };

  const toggleCheckIn = () => {
    if (!quadraId) {
      toast.error("Selecione uma quadra primeiro");
      return;
    }
    if (checkInAt) {
      setCheckInAt(null);
      toast("Check-out realizado");
    } else {
      setCheckInAt(new Date());
      toast.success("Check-in! Mostrando apenas lances a partir de agora");
    }
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
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center px-4 py-2">
          {/* Left: XP Badge */}
          <div className="flex-1">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1">
              <Trophy className="h-3.5 w-3.5 text-brand-orange" />
              <span className="text-xs font-bold text-[#222222]">{points} XP</span>
            </div>
          </div>

          {/* Center: Logo */}
          <div className="flex-none">
            <img src={logoUrl} alt="Looplance" className="h-7 w-auto" />
          </div>

          {/* Right: Spacer to maintain centering */}
          <div className="flex-1" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 pb-24 pt-8">
        {/* Hero / Check-in */}
        <section className="glass-card relative flex flex-col items-center overflow-hidden p-10 text-center">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-orange opacity-5 blur-3xl" />
          
          <img 
            src={logoUrl} 
            alt="Looplance" 
            className="relative mb-8 w-full max-w-[200px] h-auto" 
          />

          <h1 className="relative text-3xl font-black leading-tight tracking-tight text-[#222222]">
            Seus lances <span className="brand-text">em loop.</span>
          </h1>
          <p className="relative mt-3 text-base text-muted-foreground leading-relaxed">
            Selecione a arena, escolha a quadra e reviva cada jogada.
          </p>
          <button
            onClick={toggleCheckIn}
            className={`mt-6 flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-sm font-bold transition shadow-sm ${
              checkInAt
                ? "border border-border bg-muted text-foreground hover:bg-muted/80"
                : "brand-gradient brand-glow animate-pulse-glow text-white hover:scale-[1.02]"
            }`}
          >
            {checkInAt ? <><LogOut className="h-4 w-4" /> Sair da quadra</> : <><LogIn className="h-4 w-4" /> Entrar em quadra</>}
          </button>
        </section>

        {/* Location selectors */}
        <section className="glass-card space-y-4 p-6">
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
        <section className="glass-card space-y-4 p-6">
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
          {(date || startHour || endHour || checkInAt) && (
            <button
              onClick={() => { setDate(""); setStartHour(""); setEndHour(""); setCheckInAt(null); }}
              className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-brand-orange hover:underline"
            >
              Limpar filtros
            </button>
          )}
        </section>

        {/* Feed */}
        <section className="space-y-5">
          <div className="flex items-center justify-between px-1">
            <h2 className="flex items-center gap-2 text-xl font-black text-[#222222]">
              <Sparkles className="h-5 w-5 text-brand-orange" />
              Feed de Lances
            </h2>
            <span className="text-sm font-medium text-muted-foreground">{filtered.length} lances</span>
          </div>

          {filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {filtered.map((r) => <ReplayCard key={r.id} replay={r} onReward={reward} />)}
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
          <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
        ))}
      </select>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="glass-card flex flex-col items-center gap-6 px-6 py-16 text-center">
      <div className="brand-gradient grid h-20 w-20 place-items-center rounded-full brand-glow shadow-lg transition-transform hover:scale-105">
        <Play className="h-9 w-9 fill-white text-white" />
      </div>
      <div className="max-w-[280px] space-y-2">
        <h3 className="text-lg font-black text-[#222222]">Aguardando o lance...</h3>
        <p className="text-sm font-medium text-muted-foreground leading-relaxed">
          Aperte o botão na quadra e o seu replay aparecerá aqui em poucos segundos!
        </p>
      </div>
    </div>
  );
}
