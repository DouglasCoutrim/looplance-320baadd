import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import {
  Search, Sparkles, Play, Heart, MessageCircle, Share2, UserPlus, UserCheck, MoreHorizontal, Radio, Download,
  MapPin, Loader2, X, Video, Camera,
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
  user_id: string | null;
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
  const [uid, setUid] = useState<string | null>(null);
  const [points, setPoints] = useState(0);
  const [likesMap, setLikesMap] = useState<Record<string, { liked: boolean; count: number }>>({});
  const [playing, setPlaying] = useState<string | null>(null);
  const [checkin, setCheckin] = useState<{ arena_id: string; arena_nome: string; quadra_id: string; quadra_nome: string } | null>(null);
  const [showCheckinDialog, setShowCheckinDialog] = useState(false);
  const [searchArena, setSearchArena] = useState("");
  const [arenas, setArenas] = useState<Array<{ id: string; nome: string; endereco: string | null }>>([]);
  const [selectedArena, setSelectedArena] = useState<string | null>(null);
  const [arenaQuadras, setArenaQuadras] = useState<Array<{ id: string; nome: string }>>([]);
  const [loadingCheckin, setLoadingCheckin] = useState(false);
  const [liveStarting, setLiveStarting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return navigate({ to: "/auth" });
      const currentUid = data.session.user.id;
      setUid(currentUid);
      const { data: prof } = await supabase
        .from("profiles")
        .select("cpf, birth_date, gender, city")
        .eq("id", currentUid)
        .maybeSingle();
      const missing = !prof || !prof.cpf || !prof.birth_date || !prof.gender || !prof.city;
      if (missing) return navigate({ to: "/complete-profile" });
      setAuthChecked(true);
      loadCheckin(currentUid);
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
      .select("id, video_url, created_at, quadra_id, user_id, quadras(nome, arenas(nome))")
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(30);
    const list = (data ?? []) as Replay[];
    setReplays(list);
    const ids = list.map((r) => r.id);
    if (ids.length > 0) loadLikes(ids);
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
      .eq("streaming_status", "live");
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

  const loadLikes = async (ids: string[]) => {
    if (!uid || ids.length === 0) return;
    const [{ data: myLikes }, { data: allLikes }] = await Promise.all([
      supabase.from("likes").select("target_id").eq("user_id", uid).in("target_id", ids).eq("target_type", "replay"),
      supabase.from("likes").select("target_id").in("target_id", ids).eq("target_type", "replay"),
    ]);
    const likedSet = new Set((myLikes ?? []).map((l) => l.target_id));
    const counts: Record<string, number> = {};
    (allLikes ?? []).forEach((l) => { counts[l.target_id] = (counts[l.target_id] || 0) + 1; });
    const map: Record<string, { liked: boolean; count: number }> = {};
    ids.forEach((id) => { map[id] = { liked: likedSet.has(id), count: counts[id] || 0 }; });
    setLikesMap(map);
  };

  const toggleLike = async (id: string) => {
    if (!uid) return;
    const entry = likesMap[id] || { liked: false, count: 0 };
    const newLiked = !entry.liked;
    setLikesMap((prev) => ({ ...prev, [id]: { liked: newLiked, count: entry.count + (newLiked ? 1 : -1) } }));
    if (newLiked) {
      const { error } = await supabase.from("likes").insert({ user_id: uid, target_id: id, target_type: "replay" });
      if (error) { setLikesMap((prev) => ({ ...prev, [id]: { liked: false, count: entry.count } })); return; }
      setPoints((p) => p + 5);
    } else {
      const { error } = await supabase.from("likes").delete().eq("user_id", uid).eq("target_id", id).eq("target_type", "replay");
      if (error) { setLikesMap((prev) => ({ ...prev, [id]: { liked: true, count: entry.count } })); }
    }
  };

  const loadCheckin = async (userId: string) => {
    const { data } = await supabase
      .from("check_ins")
      .select("arena_id, quadra_id, arenas!inner(nome), quadras!inner(nome)")
      .eq("user_id", userId)
      .eq("active", true)
      .maybeSingle();
    if (data) {
      const d = data as any;
      setCheckin({ arena_id: d.arena_id, arena_nome: d.arenas?.nome ?? "", quadra_id: d.quadra_id, quadra_nome: d.quadras?.nome ?? "" });
    }
  };

  const searchArenasFn = async (q: string) => {
    if (!q.trim()) { setArenas([]); return; }
    const { data } = await supabase
      .from("arenas")
      .select("id, nome, endereco")
      .ilike("nome", `%${q}%`)
      .limit(10);
    setArenas((data ?? []) as Array<{ id: string; nome: string; endereco: string | null }>);
  };

  const selectArena = async (arenaId: string) => {
    setSelectedArena(arenaId);
    const { data } = await supabase
      .from("quadras")
      .select("id, nome")
      .eq("arena_id", arenaId)
      .order("nome");
    setArenaQuadras((data ?? []) as Array<{ id: string; nome: string }>);
  };

  const handleCheckin = async (qId: string) => {
    if (!uid || !selectedArena) return;
    setLoadingCheckin(true);
    const arena = arenas.find((a) => a.id === selectedArena);
    const quadra = arenaQuadras.find((q) => q.id === qId);
    const { error } = await supabase.from("check_ins").insert({
      user_id: uid,
      arena_id: selectedArena,
      quadra_id: qId,
    });
    setLoadingCheckin(false);
    if (error) { toast.error("Erro ao fazer check-in"); return; }
    setCheckin({ arena_id: selectedArena, arena_nome: arena?.nome ?? "", quadra_id: qId, quadra_nome: quadra?.nome ?? "" });
    setShowCheckinDialog(false);
    setSearchArena("");
    setArenas([]);
    setSelectedArena(null);
    setArenaQuadras([]);
    toast.success(`Check-in realizado em ${quadra?.nome ?? "quadra"}`);
  };

  const handleCheckout = async () => {
    if (!uid) return;
    const { error } = await supabase
      .from("check_ins")
      .update({ active: false })
      .eq("user_id", uid)
      .eq("active", true);
    if (error) { toast.error("Erro ao sair"); return; }
    setCheckin(null);
    toast.success("Check-out realizado");
  };

  const handleStartLive = async () => {
    if (!checkin) return;
    setLiveStarting(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error("Sessão expirada"); setLiveStarting(false); return; }
    try {
      const res = await fetch("/api/public/check-in/start-live", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || "Erro ao iniciar live"); setLiveStarting(false); return; }
      toast.success("Live iniciada! Transmitindo para o YouTube.");
    } catch { toast.error("Erro de conexão"); }
    setLiveStarting(false);
  };

  const handleClaim = async (id: string) => {
    if (!uid) return;
    const { data, error } = await (supabase.rpc as any)("claim_replay", { p_replay_id: id });
    if (error) { toast.error("Erro ao reivindicar lance: " + error.message); return; }
    if (!data) { toast.error("Este lance já foi reivindicado por outro atleta"); return; }
    setReplays((prev) => prev.map((r) => (r.id === id ? { ...r, user_id: uid } : r)));
    toast.success("Lance reivindicado!");
  };

  const filtered = (() => {
    let list = replays;
    if (checkin) {
      list = list.filter((r) => r.quadra_id === checkin.quadra_id);
    }
    if (search) {
      list = list.filter((r) =>
        (r.quadras?.nome || "").toLowerCase().includes(search.toLowerCase()) ||
        (r.quadras?.arenas?.nome || "").toLowerCase().includes(search.toLowerCase())
      );
    }
    return list;
  })();

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

          {/* Check-in banner */}
          {checkin ? (
            <div className="flex items-center gap-3 rounded-2xl border border-brand-orange/30 bg-brand-orange/5 px-4 py-3">
              <MapPin className="w-5 h-5 text-brand-orange shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{checkin.arena_nome}</p>
                <p className="text-xs text-muted-foreground">Quadra {checkin.quadra_nome}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleStartLive}
                  disabled={liveStarting}
                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-brand-orange text-black hover:opacity-85 transition disabled:opacity-50"
                >
                  {liveStarting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Video className="w-3.5 h-3.5" />}
                  {liveStarting ? "Iniciando..." : "Iniciar Live"}
                </button>
                <button
                  onClick={handleCheckout}
                  className="text-xs text-muted-foreground hover:text-foreground transition px-2 py-1"
                >
                  Sair
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCheckinDialog(true)}
              className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-left transition hover:border-brand-orange/30 hover:bg-brand-orange/5 group"
            >
              <div className="w-9 h-9 rounded-full bg-secondary grid place-items-center shrink-0 group-hover:bg-brand-orange/20 transition">
                <MapPin className="w-4 h-4 text-brand-orange" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold">Fazer check-in na arena</p>
                <p className="text-xs text-muted-foreground">Toque para selecionar onde você está</p>
              </div>
            </button>
          )}

          {/* Avatar row — perfil logado + comunidade */}
          <div className="flex gap-3.5 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {stories.map((s) => (
              <Link
                key={s.id}
                to="/profile/$id"
                params={{ id: s.id }}
                className="flex flex-col items-center gap-1.5 shrink-0 group"
              >
                <div className="w-14 h-14 rounded-full overflow-hidden bg-card border-2 border-zinc-700 transition-transform group-hover:scale-105">
                  <img src={s.avatar_url!} alt={s.full_name || ""} className="w-full h-full object-cover" />
                </div>
                <span className="text-[11px] text-muted-foreground text-center w-16 truncate">
                  {(s.full_name || "Atleta").split(" ")[0]}
                </span>
              </Link>
            ))}
          </div>

          {/* Live now — 0: oculto, 1: card único, multi: carrossel */}
          {liveList.length > 0 && (
            <div className={liveList.length > 1 ? "-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : ""}>
              <div className={liveList.length > 1 ? "flex gap-3 w-max snap-x" : ""}>
                {(liveList.length > 1 ? liveList : [liveList[0]]).map((l) => (
                  <Link
                    key={l.quadra_id}
                    to="/arena/$id"
                    params={{ id: l.arena_id }}
                    search={{ live: l.quadra_id }}
                    className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-3 transition hover:border-primary/60 ${
                      liveList.length > 1
                        ? "min-w-[220px] aspect-video snap-start"
                        : "w-full aspect-video"
                    }`}
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
              const likeEntry = likesMap[post.id] || { liked: false, count: 0 };
              const isLiked = likeEntry.liked;
              const isClaimed = post.user_id === uid;
              const isPlaying = playing === post.id;
              const claimDisabled = post.user_id !== null && post.user_id !== uid;
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
                          {likeEntry.count}
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
                        onClick={async () => {
                          try {
                            const res = await fetch(post.video_url);
                            const blob = await res.blob();
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `looplance-${post.id}.mp4`;
                            a.click();
                            URL.revokeObjectURL(url);
                            toast.success("Download iniciado!");
                          } catch {
                            window.open(post.video_url, "_blank");
                          }
                        }}
                        className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-md bg-orange-500 hover:bg-orange-600 text-white transition"
                      >
                        <Download className="w-4 h-4" /> Baixar
                      </button>
                      <button
                        onClick={claimDisabled ? undefined : () => handleClaim(post.id)}
                        disabled={claimDisabled}
                        className={`ml-auto transition-all ${
                          isClaimed ? "text-green-400" : claimDisabled ? "text-zinc-600 cursor-not-allowed" : "text-muted-foreground hover:text-green-400"
                        }`}
                        title={isClaimed ? "Seu lance" : claimDisabled ? "Já reivindicado" : "Reivindicar lance"}
                      >
                        {isClaimed ? <UserCheck className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
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

      {/* Check-in dialog */}
      {showCheckinDialog && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowCheckinDialog(false)}>
          <div
            className="w-full md:max-w-md bg-card border border-border rounded-t-2xl md:rounded-2xl p-5 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black uppercase tracking-wide" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                Fazer check-in
              </h2>
              <button onClick={() => setShowCheckinDialog(false)} className="text-muted-foreground hover:text-foreground p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Buscar arena */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchArena}
                onChange={(e) => { setSearchArena(e.target.value); searchArenasFn(e.target.value); }}
                placeholder="Buscar arena pelo nome..."
                className="w-full bg-secondary rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none border border-transparent focus:border-primary/60 transition"
              />
            </div>

            {/* Lista de arenas */}
            {!selectedArena && arenas.length > 0 && (
              <div className="space-y-1 mb-4">
                {arenas.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => selectArena(a.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition text-left"
                  >
                    <MapPin className="w-4 h-4 text-brand-orange shrink-0" />
                    <div>
                      <p className="text-sm font-semibold">{a.nome}</p>
                      {a.endereco && <p className="text-xs text-muted-foreground">{a.endereco}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Quadras da arena selecionada */}
            {selectedArena && (
              <div>
                <button
                  onClick={() => { setSelectedArena(null); setArenaQuadras([]); }}
                  className="text-xs text-brand-orange hover:underline mb-3 inline-block"
                >
                  ← Voltar para arenas
                </button>
                <p className="text-sm text-muted-foreground mb-3">Selecione a quadra onde você está:</p>
                <div className="space-y-1">
                  {arenaQuadras.map((q) => (
                    <button
                      key={q.id}
                      onClick={() => handleCheckin(q.id)}
                      disabled={loadingCheckin}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition text-left disabled:opacity-50"
                    >
                      <div className="w-8 h-8 rounded-full bg-secondary grid place-items-center shrink-0">
                        <span className="text-xs font-bold text-brand-orange">{q.nome.slice(0, 1)}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{q.nome}</p>
                      </div>
                      {loadingCheckin && <Loader2 className="w-4 h-4 animate-spin text-brand-orange" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!searchArena && !selectedArena && (
              <p className="text-xs text-center text-muted-foreground py-6">Digite o nome da arena para começar</p>
            )}
          </div>
        </div>
      )}
    </SocialShell>
  );
}
