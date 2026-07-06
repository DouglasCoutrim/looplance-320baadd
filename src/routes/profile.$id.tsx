import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, User as UserIcon, Settings, ArrowLeft, Trophy, Play } from "lucide-react";
import { ReplayCard } from "@/components/ReplayCard";

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

function ProfileView() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [replays, setReplays] = useState<Replay[]>([]);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        navigate({ to: "/auth" });
        return;
      }
      setIsOwner(sess.session.user.id === id);

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
      setLoading(false);
    })();
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="grid min-h-screen place-items-center gap-3 p-6 text-center">
        <UserIcon className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-bold">Perfil não encontrado</h1>
        <Link to="/" className="text-sm text-primary underline">Voltar para o feed</Link>
      </div>
    );
  }

  const location = [profile.city, profile.state].filter(Boolean).join(" / ");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Feed
          </Link>
          <h1 className="text-base font-bold">Perfil</h1>
          {isOwner ? (
            <Link to="/profile/settings">
              <Button size="sm" variant="outline">
                <Settings className="h-4 w-4" /> <span className="ml-1.5">Editar</span>
              </Button>
            </Link>
          ) : (
            <span className="w-16" />
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {/* Header card */}
        <section className="flex flex-col items-center gap-4 rounded-3xl border bg-card p-6 text-center sm:flex-row sm:text-left">
          <div className="grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-primary/20 bg-muted">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name ?? "Atleta"} className="h-full w-full object-cover" />
            ) : (
              <UserIcon className="h-12 w-12 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 space-y-2">
            <h2 className="text-2xl font-black">{profile.full_name || "Atleta"}</h2>
            {location && (
              <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" /> {location}
              </p>
            )}
            {profile.favorite_sports && profile.favorite_sports.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5 sm:justify-start">
                {profile.favorite_sports.map((s) => (
                  <span key={s} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    {s}
                  </span>
                ))}
              </div>
            )}
            {arenas.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5 pt-1 sm:justify-start">
                {arenas.map((a) => (
                  <span key={a.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-medium">
                    <Trophy className="h-3 w-3" /> {a.nome}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Replays gallery */}
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Meus lances ({replays.length})
            </h3>
          </div>
          {replays.length === 0 ? (
            <div className="grid place-items-center gap-2 rounded-2xl border border-dashed py-16 text-center text-sm text-muted-foreground">
              <Play className="h-8 w-8" />
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
    </div>
  );
}
