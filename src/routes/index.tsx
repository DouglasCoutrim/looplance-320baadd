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
    <div className="relative min-h-screen text-foreground">
      <Toaster theme="dark" position="top-center" toastOptions={{
        style: { background: "oklch(0.14 0.02 30)", border: "1px solid oklch(1 0 0 / 10%)", color: "white" }
      }} />

      {/* XP pop overlay */}
      <div className="pointer-events-none fixed right-6 top-24 z-50">
        {xpPops.map((p) => (
          <div key={p.id} className="animate-xp-pop brand-text text-2xl font-black drop-shadow">
            +10 XP
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-black/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
            <Trophy className="h-4 w-4 text-[oklch(0.86_0.18_90)]" />
            <span className="text-sm font-bold brand-text">{points} XP</span>
          </div>
          <div className="w-[40px]" /> {/* Spacer to keep balance */}
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 pb-24 pt-5">
        {/* Hero / Check-in */}
        <section className="glass-card relative flex flex-col items-center overflow-hidden p-8 text-center">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[oklch(0.72_0.21_45)] opacity-20 blur-3xl" />
          
          <img 
            src={logoUrl} 
            alt="Looplance" 
            className="relative mb-6 h-24 w-auto drop-shadow-[0_0_15px_rgba(255,165,0,0.3)]" 
          />

          <h1 className="relative text-3xl font-black leading-tight">
            Seus lances <span className="brand-text">em loop.</span>
          </h1>
          <p className="relative mt-2 text-sm text-muted-foreground">
            Selecione a arena, escolha a quadra e reviva cada jogada.
          </p>
          <button
            onClick={toggleCheckIn}
            className={`mt-4 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-bold transition ${
              checkInAt
                ? "border border-white/10 bg-white/5 text-foreground"
                : "brand-gradient brand-glow animate-pulse-glow text-black"
            }`}
          >
            {checkInAt ? <><LogOut className="h-4 w-4" /> Sair da quadra</> : <><LogIn className="h-4 w-4" /> Entrar em quadra</>}
          </button>
        </section>

        {/* Location selectors */}
        <section className="glass-card space-y-3 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> Localização
          </div>
          <Select value={arenaId} onChange={setArenaId} placeholder="Selecione a Arena">
            {arenas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </Select>
          <Select value={quadraId} onChange={setQuadraId} placeholder={arenaId ? "Selecione a Quadra" : "Escolha uma arena antes"} disabled={!arenaId}>
            {quadras.map((q) => <option key={q.id} value={q.id}>{q.nome}</option>)}
          </Select>
        </section>

        {/* Filters */}
        <section className="glass-card space-y-3 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <CalIcon className="h-3.5 w-3.5" /> Filtros
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-foreground outline-none transition focus:border-[oklch(0.72_0.21_45)]"
          />
          <div className="grid grid-cols-2 gap-3">
            <TimeInput label="De" value={startHour} onChange={setStartHour} />
            <TimeInput label="Até" value={endHour} onChange={setEndHour} />
          </div>
          {(date || startHour || endHour || checkInAt) && (
            <button
              onClick={() => { setDate(""); setStartHour(""); setEndHour(""); setCheckInAt(null); }}
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Limpar filtros
            </button>
          )}
        </section>

        {/* Feed */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Sparkles className="h-4 w-4 text-[oklch(0.86_0.18_90)]" />
              Feed de Lances
            </h2>
            <span className="text-xs text-muted-foreground">{filtered.length} lances</span>
          </div>

          {filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-4">
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
        className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-10 text-sm text-foreground outline-none transition focus:border-[oklch(0.72_0.21_45)] disabled:opacity-40"
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
      <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">▾</div>
    </div>
  );
}

function TimeInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-transparent text-sm font-semibold text-foreground outline-none"
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
    <div className="glass-card flex flex-col items-center gap-4 px-6 py-12 text-center">
      <div className="brand-gradient grid h-16 w-16 place-items-center rounded-full brand-glow">
        <Play className="h-7 w-7 fill-black text-black" />
      </div>
      <div>
        <h3 className="text-base font-bold">Aguardando o próximo grande lance...</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Aperte o botão na quadra e o replay aparece aqui na hora!
        </p>
      </div>
    </div>
  );
}
