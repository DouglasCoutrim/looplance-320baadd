import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { MapPin, Radio, Sparkles, ArrowLeft, X, PlayCircle, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ReplayCard } from "@/components/ReplayCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import * as Dialog from "@radix-ui/react-dialog";
import { Toaster, toast } from "sonner";

export const Route = createFileRoute("/arena/$id")({
  component: ArenaView,
  validateSearch: (s: Record<string, unknown>) => ({
    live: typeof s.live === "string" ? (s.live as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Arena — Looplance" },
      { name: "description", content: "Replays e transmissão ao vivo da sua arena." },
    ],
  }),
});


interface Arena {
  id: string;
  nome: string;
  cidade: string | null;
  endereco: string | null;
  foto_url: string | null;
}

interface Quadra {
  id: string;
  nome: string;
  arena_id: string;
}

interface Replay {
  id: string;
  video_url: string;
  created_at: string;
  quadra_id: string;
  quadras?: { nome: string; arenas?: { nome: string } | null } | null;
}

interface CameraStatus {
  quadra_id: string;
  streaming_status: string | null;
}

function ArenaView() {
  const { id: arenaId } = Route.useParams();
  const { live: liveParam } = Route.useSearch();
  const [authChecked, setAuthChecked] = useState(false);
  const [arena, setArena] = useState<Arena | null>(null);
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [replays, setReplays] = useState<Replay[]>([]);
  const [cameras, setCameras] = useState<CameraStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveQuadra, setLiveQuadra] = useState<Quadra | null>(null);
  const [defaultTab, setDefaultTab] = useState<string>(liveParam ? "live" : "replays");


  // Auth gate
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        window.location.href = `/auth?redirect=${encodeURIComponent(`/arena/${arenaId}`)}`;
        return;
      }
      setAuthChecked(true);
    });
  }, [arenaId]);

  // Fetch arena data
  useEffect(() => {
    if (!authChecked) return;
    (async () => {
      const [arenaRes, quadrasRes, replaysRes, camerasRes] = await Promise.all([
        supabase.from("arenas").select("id, nome, cidade, endereco, foto_url").eq("id", arenaId).maybeSingle(),
        supabase.from("quadras").select("id, nome, arena_id").eq("arena_id", arenaId).order("nome"),
        supabase.from("replays").select("id, video_url, created_at, quadra_id, quadras(nome, arenas(nome))").eq("arena_id", arenaId).order("created_at", { ascending: false }).limit(60),
        supabase.from("cameras").select("quadra_id, streaming_status"),
      ]);
      setArena((arenaRes.data as Arena) ?? null);
      setQuadras((quadrasRes.data as Quadra[]) ?? []);
      setReplays((replaysRes.data as Replay[]) ?? []);
      setCameras((camerasRes.data as CameraStatus[]) ?? []);
      setLoading(false);
    })();
  }, [authChecked, arenaId]);

  // Auto-open live dialog when ?live=<quadraId>
  useEffect(() => {
    if (!liveParam || !quadras.length) return;
    const q = quadras.find((x) => x.id === liveParam);
    if (q) {
      setDefaultTab("live");
      setLiveQuadra(q);
    }
  }, [liveParam, quadras]);



  // Realtime: new replays for this arena
  useEffect(() => {
    if (!authChecked) return;
    const ch = supabase
      .channel(`arena-${arenaId}-replays`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "replays", filter: `arena_id=eq.${arenaId}` },
        async (payload) => {
          const { data } = await supabase
            .from("replays")
            .select("id, video_url, created_at, quadra_id, quadras(nome, arenas(nome))")
            .eq("id", (payload.new as any).id)
            .maybeSingle();
          if (data) {
            setReplays((prev) => [data as Replay, ...prev]);
            toast("🔥 Novo lance na arena!");
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [authChecked, arenaId]);

  const statusFor = (quadraId: string) => {
    const cam = cameras.find((c) => c.quadra_id === quadraId);
    return cam?.streaming_status ?? "offline";
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Toaster theme="dark" position="top-center" />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4">
          <Link
            to="/"
            className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/5 transition hover:bg-white/10"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            {loading ? (
              <Skeleton className="h-5 w-40 bg-white/10" />
            ) : (
              <>
                <h1 className="truncate text-lg font-black tracking-tight">{arena?.nome ?? "Arena"}</h1>
                {arena?.cidade && (
                  <p className="flex items-center gap-1 text-xs text-white/60">
                    <MapPin className="h-3 w-3" /> {arena.cidade}
                  </p>
                )}
              </>
            )}
          </div>
          {arena?.foto_url && (
            <img
              src={arena.foto_url}
              alt={arena.nome}
              className="h-12 w-12 rounded-2xl object-cover ring-1 ring-white/15"
            />
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {/* Hero banner */}
        <section className="relative mb-6 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-6 shadow-2xl">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-orange/20 blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-brand-orange/40 bg-brand-orange/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-orange">
              <Sparkles className="h-3 w-3" /> Arena
            </div>
            <h2 className="mt-3 text-2xl font-black leading-tight">
              {loading ? <Skeleton className="h-8 w-56 bg-white/10" /> : arena?.nome}
            </h2>
            {arena?.endereco && <p className="mt-1 text-sm text-white/60">{arena.endereco}</p>}
          </div>
        </section>

        {/* Tabs */}
        <Tabs value={defaultTab} onValueChange={setDefaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-2xl border border-white/10 bg-white/5 p-1 backdrop-blur">
            <TabsTrigger
              value="replays"
              className="rounded-xl text-sm font-bold data-[state=active]:bg-brand-orange data-[state=active]:text-black"
            >
              ✨ Últimos Replays
            </TabsTrigger>
            <TabsTrigger
              value="live"
              className="rounded-xl text-sm font-bold data-[state=active]:bg-brand-orange data-[state=active]:text-black"
            >
              🎥 Quadras Ao Vivo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="replays" className="mt-6">
            {loading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[9/16] w-full rounded-2xl bg-white/5" />
                ))}
              </div>
            ) : replays.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center">
                <p className="text-sm text-white/70">Nenhum replay por enquanto. Volte em breve!</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {replays.map((r) => (
                  <ReplayCard key={r.id} replay={r} onReward={() => {}} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="live" className="mt-6">
            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full rounded-2xl bg-white/5" />
                ))}
              </div>
            ) : quadras.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center">
                <p className="text-sm text-white/70">Nenhuma quadra cadastrada nesta arena.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {quadras.map((q) => {
                  const status = statusFor(q.id);
                  const online = status === "online" || status === "streaming" || status === "live";
                  return (
                    <button
                      key={q.id}
                      onClick={() => setLiveQuadra(q)}
                      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.02] p-5 text-left transition hover:border-brand-orange/50 hover:shadow-[0_0_30px_-8px_var(--brand-orange)]"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Quadra</p>
                          <h3 className="mt-1 text-xl font-black">{q.nome}</h3>
                        </div>
                        <div className="grid h-14 w-14 place-items-center rounded-full border border-white/10 bg-black/40 transition group-hover:scale-110">
                          {online ? (
                            <PlayCircle className="h-7 w-7 text-brand-orange" />
                          ) : (
                            <WifiOff className="h-6 w-6 text-white/40" />
                          )}
                        </div>
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        {online ? (
                          <Badge className="border-none bg-red-500/90 text-white">
                            <Radio className="mr-1 h-3 w-3 animate-pulse" /> AO VIVO
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-white/10 text-white/60">
                            Offline
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Live player dialog */}
      <LivePlayerDialog
        arenaId={arenaId}
        quadra={liveQuadra}
        status={liveQuadra ? statusFor(liveQuadra.id) : "offline"}
        onClose={() => setLiveQuadra(null)}
      />
    </div>
  );
}

function LivePlayerDialog({
  arenaId,
  quadra,
  status,
  onClose,
}: {
  arenaId: string;
  quadra: Quadra | null;
  status: string;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const dbOnline = status === "online" || status === "streaming" || status === "live";

  // Always attempt to load the HLS playlist when the dialog opens — the R2
  // playlist is the ground truth, not the DB status (which can lag). If it
  // fails we surface a friendly message, but we never gate mount on `online`.
  useEffect(() => {
    if (!quadra) return;
    const video = videoRef.current;
    if (!video) return;

    setStreamError(null);
    const base = `https://live.izyia.com.br/live/${arenaId}/${quadra.id}/index.m3u8`;
    const src = `${base}?t=${Date.now()}`;

    let hls: Hls | null = null;
    if (Hls.isSupported()) {
      hls = new Hls({
        lowLatencyMode: true,
        enableWorker: true,
        liveSyncDurationCount: 3,
        // Disable hls.js internal caching of the playlist — the m3u8 is a
        // sliding window that must be refreshed each cycle. R2 already
        // returns `cache-control: no-store` for the playlist, and segments
        // have unique names, so no custom headers are needed. We intentionally
        // do NOT set Cache-Control / Pragma via xhrSetup because those are
        // non-simple headers and would trigger a CORS preflight that R2
        // (with its wildcard CORS) does not support.
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          setStreamError("Transmissão indisponível no momento.");
        }
      });
      hlsRef.current = hls;
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.addEventListener("error", () => setStreamError("Transmissão indisponível no momento."));
    }


    // Try to play — some browsers block autoplay without a gesture; that's OK.
    video.play().catch(() => {});

    return () => {
      hls?.destroy();
      hlsRef.current = null;
    };
  }, [quadra, arenaId]);

  return (
    <Dialog.Root open={!!quadra} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md animate-in fade-in duration-300" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-[95vw] -translate-x-1/2 -translate-y-1/2 outline-none sm:max-w-2xl animate-in zoom-in-95 duration-300"
        >
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-orange">Ao vivo</p>
                <Dialog.Title className="text-lg font-black text-white">
                  {quadra?.nome ?? "Transmissão ao vivo"}
                </Dialog.Title>
              </div>
              <Dialog.Close className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20">
                <X className="h-5 w-5" />
              </Dialog.Close>
            </div>

            <div className="relative aspect-video w-full bg-black">
              <video
                ref={videoRef}
                controls
                autoPlay
                playsInline
                muted
                className="h-full w-full object-contain"
              />
              {streamError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 p-8 text-center">
                  <div className="grid h-16 w-16 place-items-center rounded-full bg-white/5">
                    <WifiOff className="h-8 w-8 text-white/60" />
                  </div>
                  <p className="text-base font-bold text-white">{streamError}</p>
                  <p className="text-sm text-white/60">
                    {dbOnline ? "Tente novamente em instantes." : "O jogo começará em breve! 🎾"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

