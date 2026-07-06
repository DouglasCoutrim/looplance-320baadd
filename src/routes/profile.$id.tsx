import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  MapPin,
  User as UserIcon,
  Settings,
  ArrowLeft,
  Trophy,
  Play,
  X,
  UserPlus,
  UserCheck,
  UserMinus,
} from "lucide-react";
import { ReplayCard } from "@/components/ReplayCard";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profile/$id")({
  component: ProfileView,
  head: ({ params }) => ({
    meta: [
      { title: `Perfil — Looplance` },
      { name: "description", content: `Perfil do atleta no Looplance (${params.id}).` },
    ],
  }),
});

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  state: string | null;
  favorite_sports: string[] | null;
  favorite_arenas: string[] | null;
}

interface Arena {
  id: string;
  nome: string;
}

interface Replay {
  id: string;
  video_url: string;
  created_at: string;
  quadra_id: string;
  quadras?: { nome: string; arenas?: { nome: string } | null } | null;
}

interface FollowUser {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  state: string | null;
}

type DrawerMode = "followers" | "following" | null;

function ProfileView() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [replays, setReplays] = useState<Replay[]>([]);

  // Follow state
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [hoveringFollowing, setHoveringFollowing] = useState(false);

  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);

  const loadFollowState = useCallback(
    async (targetId: string, viewer: string | null) => {
      const [{ count: followers }, { count: following }] = await Promise.all([
        supabase.from("follows" as any).select("*", { count: "exact", head: true }).eq("following_id", targetId),
        supabase.from("follows" as any).select("*", { count: "exact", head: true }).eq("follower_id", targetId),
      ]);
      setFollowersCount(followers ?? 0);
      setFollowingCount(following ?? 0);
      if (viewer && viewer !== targetId) {
        const { data } = await supabase
          .from("follows" as any)
          .select("id")
          .eq("follower_id", viewer)
          .eq("following_id", targetId)
          .maybeSingle();
        setIsFollowing(!!data);
      } else {
        setIsFollowing(false);
      }
    },
    [],
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        navigate({ to: "/auth" });
        return;
      }
      const viewer = sess.session.user.id;
      setViewerId(viewer);
      setIsOwner(viewer === id);

      const { data: prof } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, city, state, favorite_sports, favorite_arenas")
        .eq("id", id)
        .maybeSingle();

      setProfile(prof ?? null);

      const favIds = prof?.favorite_arenas ?? [];
      const [arenaRes, replayRes] = await Promise.all([
        favIds.length
          ? supabase.from("arenas").select("id, nome").in("id", favIds)
          : Promise.resolve({ data: [] as Arena[] }),
        supabase
          .from("replays")
          .select("id, video_url, created_at, quadra_id, quadras(nome, arenas(nome))")
          .eq("user_id", id)
          .order("created_at", { ascending: false })
          .limit(60),
      ]);

      setArenas((arenaRes.data as Arena[]) ?? []);
      setReplays((replayRes.data as Replay[]) ?? []);
      await loadFollowState(id, viewer);
      setLoading(false);
    })();
  }, [id, navigate, loadFollowState]);

  const handleFollowToggle = async () => {
    if (!viewerId || isOwner || followBusy) return;
    setFollowBusy(true);
    const wasFollowing = isFollowing;

    // Optimistic update
    setIsFollowing(!wasFollowing);
    setFollowersCount((c) => c + (wasFollowing ? -1 : 1));

    if (wasFollowing) {
      const { error } = await supabase
        .from("follows" as any)
        .delete()
        .eq("follower_id", viewerId)
        .eq("following_id", id);
      if (error) {
        setIsFollowing(true);
        setFollowersCount((c) => c + 1);
        toast.error("Não foi possível deixar de seguir");
      }
    } else {
      const { error } = await supabase
        .from("follows" as any)
        .insert({ follower_id: viewerId, following_id: id });
      if (error) {
        setIsFollowing(false);
        setFollowersCount((c) => c - 1);
        toast.error("Não foi possível seguir");
      }
    }
    setFollowBusy(false);
  };

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-brand-orange" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="grid min-h-screen place-items-center gap-3 bg-background p-6 text-center">
        <UserIcon className="h-12 w-12 text-zinc-500" />
        <h1 className="text-xl font-bold text-white">Perfil não encontrado</h1>
        <Link to="/" className="text-sm text-brand-orange underline">Voltar para o feed</Link>
      </div>
    );
  }

  const location = [profile.city, profile.state].filter(Boolean).join(" / ");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-zinc-800/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Feed
          </Link>
          <h1 className="text-base font-bold tracking-tight text-white">Perfil</h1>
          <span className="w-16" />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {/* Header card */}
        <section className="flex flex-col items-center gap-5 rounded-3xl border border-zinc-800/60 bg-zinc-900 p-6 text-center sm:flex-row sm:items-start sm:text-left">
          <div className="grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-brand-orange/30 bg-zinc-800">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name ?? "Atleta"} className="h-full w-full object-cover" />
            ) : (
              <UserIcon className="h-12 w-12 text-zinc-500" />
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="truncate text-2xl font-bold tracking-tight text-white">
                {profile.full_name || "Atleta"}
              </h2>

              {isOwner ? (
                <Link to="/profile/settings">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full border-zinc-700 bg-transparent text-zinc-200 transition-all duration-300 ease-out hover:border-zinc-500 hover:bg-zinc-800 hover:text-white"
                  >
                    <Settings className="mr-1.5 h-4 w-4" /> Editar perfil
                  </Button>
                </Link>
              ) : (
                <FollowButton
                  isFollowing={isFollowing}
                  busy={followBusy}
                  hovering={hoveringFollowing}
                  onHoverChange={setHoveringFollowing}
                  onClick={handleFollowToggle}
                />
              )}
            </div>

            {/* Counters */}
            <div className="flex items-center justify-center gap-6 sm:justify-start">
              <button
                onClick={() => setDrawerMode("followers")}
                className="group flex items-baseline gap-1.5 transition"
              >
                <span className="text-lg font-bold text-white group-hover:text-brand-orange">
                  {followersCount}
                </span>
                <span className="text-sm text-zinc-400 group-hover:text-zinc-200">Seguidores</span>
              </button>
              <button
                onClick={() => setDrawerMode("following")}
                className="group flex items-baseline gap-1.5 transition"
              >
                <span className="text-lg font-bold text-white group-hover:text-brand-orange">
                  {followingCount}
                </span>
                <span className="text-sm text-zinc-400 group-hover:text-zinc-200">Seguindo</span>
              </button>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold text-white">{replays.length}</span>
                <span className="text-sm text-zinc-400">Lances</span>
              </div>
            </div>

            {location && (
              <p className="inline-flex items-center gap-1.5 text-sm text-zinc-400">
                <MapPin className="h-4 w-4" /> {location}
              </p>
            )}

            {profile.favorite_sports && profile.favorite_sports.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5 sm:justify-start">
                {profile.favorite_sports.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-brand-orange/15 px-2.5 py-0.5 text-xs font-medium text-brand-orange"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}

            {arenas.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5 pt-1 sm:justify-start">
                {arenas.map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-800/60 px-2.5 py-0.5 text-xs font-medium text-zinc-300"
                  >
                    <Trophy className="h-3 w-3 text-brand-orange" /> {a.nome}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Replays gallery */}
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
              Meus lances ({replays.length})
            </h3>
          </div>
          {replays.length === 0 ? (
            <div className="grid place-items-center gap-2 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 py-16 text-center text-sm text-zinc-400">
              <Play className="h-8 w-8 text-zinc-600" />
              <p>Nenhum lance salvo ainda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {replays.map((r) => (
                <ReplayCard key={r.id} replay={r} onReward={() => {}} />
              ))}
            </div>
          )}
        </section>
      </main>

      {drawerMode && (
        <FollowsDrawer
          mode={drawerMode}
          profileId={id}
          viewerId={viewerId}
          onClose={() => setDrawerMode(null)}
          onCountChange={(delta) => {
            // Not strictly needed; drawer changes only viewer's own outgoing follows,
            // which don't affect the visited profile's counters.
            void delta;
          }}
        />
      )}
    </div>
  );
}

function FollowButton({
  isFollowing,
  busy,
  hovering,
  onHoverChange,
  onClick,
}: {
  isFollowing: boolean;
  busy: boolean;
  hovering: boolean;
  onHoverChange: (v: boolean) => void;
  onClick: () => void;
}) {
  if (!isFollowing) {
    return (
      <Button
        onClick={onClick}
        disabled={busy}
        size="sm"
        className="rounded-full bg-brand-orange px-5 font-semibold text-white shadow-[0_0_20px_rgba(249,115,22,0.15)] transition-all duration-300 ease-out hover:scale-[1.02] hover:bg-brand-orange/90"
      >
        <UserPlus className="mr-1.5 h-4 w-4" />
        Seguir
      </Button>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={busy}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      onFocus={() => onHoverChange(true)}
      onBlur={() => onHoverChange(false)}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-all duration-300 ease-out",
        hovering
          ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
          : "border-brand-orange/60 bg-transparent text-brand-orange hover:bg-brand-orange/10",
      )}
    >
      {hovering ? (
        <>
          <UserMinus className="h-4 w-4" />
          Deixar de seguir
        </>
      ) : (
        <>
          <UserCheck className="h-4 w-4" />
          Seguindo
        </>
      )}
    </button>
  );
}

function FollowsDrawer({
  mode,
  profileId,
  viewerId,
  onClose,
}: {
  mode: "followers" | "following";
  profileId: string;
  viewerId: string | null;
  onClose: () => void;
  onCountChange: (delta: number) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [viewerFollowing, setViewerFollowing] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const column = mode === "followers" ? "following_id" : "follower_id";
      const targetColumn = mode === "followers" ? "follower_id" : "following_id";
      const { data } = await supabase
        .from("follows" as any)
        .select(`${targetColumn}, profiles:${targetColumn}(id, full_name, avatar_url, city, state)`)
        .eq(column, profileId)
        .order("created_at", { ascending: false })
        .limit(200);

      const list = ((data ?? []) as any[])
        .map((row) => row.profiles)
        .filter(Boolean) as FollowUser[];
      setUsers(list);

      if (viewerId && list.length) {
        const ids = list.map((u) => u.id);
        const { data: mine } = await supabase
          .from("follows" as any)
          .select("following_id")
          .eq("follower_id", viewerId)
          .in("following_id", ids);
        setViewerFollowing(new Set(((mine ?? []) as any[]).map((r) => r.following_id)));
      }
      setLoading(false);
    })();
  }, [mode, profileId, viewerId]);

  const toggleFollow = async (targetId: string) => {
    if (!viewerId || busyId || viewerId === targetId) return;
    setBusyId(targetId);
    const wasFollowing = viewerFollowing.has(targetId);
    const next = new Set(viewerFollowing);
    if (wasFollowing) next.delete(targetId);
    else next.add(targetId);
    setViewerFollowing(next);

    if (wasFollowing) {
      const { error } = await supabase
        .from("follows" as any)
        .delete()
        .eq("follower_id", viewerId)
        .eq("following_id", targetId);
      if (error) {
        const rollback = new Set(next);
        rollback.add(targetId);
        setViewerFollowing(rollback);
        toast.error("Erro ao deixar de seguir");
      }
    } else {
      const { error } = await supabase
        .from("follows" as any)
        .insert({ follower_id: viewerId, following_id: targetId });
      if (error) {
        const rollback = new Set(next);
        rollback.delete(targetId);
        setViewerFollowing(rollback);
        toast.error("Erro ao seguir");
      }
    }
    setBusyId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
      />
      <div className="relative z-10 w-full max-w-md rounded-t-3xl border border-zinc-800/80 bg-zinc-900/95 backdrop-blur-md shadow-2xl animate-in slide-in-from-bottom-4 duration-300 sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-zinc-800/60 px-5 py-4">
          <h3 className="text-base font-semibold tracking-tight text-white">
            {mode === "followers" ? "Seguidores" : "Seguindo"}
          </h3>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-zinc-800 text-zinc-300 transition hover:bg-zinc-700 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-2 py-2">
          {loading ? (
            <div className="grid place-items-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-brand-orange" />
            </div>
          ) : users.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-500">
              {mode === "followers" ? "Ainda não há seguidores." : "Ainda não está seguindo ninguém."}
            </p>
          ) : (
            <ul className="space-y-1">
              {users.map((u) => {
                const followingThem = viewerFollowing.has(u.id);
                const isSelf = viewerId === u.id;
                return (
                  <li
                    key={u.id}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-zinc-800/60"
                  >
                    <Link
                      to="/profile/$id"
                      params={{ id: u.id }}
                      onClick={onClose}
                      className="flex min-w-0 flex-1 items-center gap-3"
                    >
                      <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border border-zinc-700 bg-zinc-800">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt={u.full_name ?? ""} className="h-full w-full object-cover" />
                        ) : (
                          <UserIcon className="h-5 w-5 text-zinc-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">
                          {u.full_name || "Atleta"}
                        </p>
                        {(u.city || u.state) && (
                          <p className="truncate text-xs text-zinc-500">
                            {[u.city, u.state].filter(Boolean).join(" / ")}
                          </p>
                        )}
                      </div>
                    </Link>

                    {!isSelf && viewerId && (
                      <button
                        onClick={() => toggleFollow(u.id)}
                        disabled={busyId === u.id}
                        className={cn(
                          "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-300 ease-out",
                          followingThem
                            ? "border border-brand-orange/60 bg-transparent text-brand-orange hover:bg-brand-orange/10"
                            : "bg-brand-orange text-white hover:scale-[1.03] hover:bg-brand-orange/90",
                        )}
                      >
                        {followingThem ? "Seguindo" : "Seguir"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
