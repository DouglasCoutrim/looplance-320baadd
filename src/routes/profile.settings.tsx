import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toaster, toast } from "sonner";
import { Loader2, Upload, X, User as UserIcon, Save, ArrowLeft, Check, Search } from "lucide-react";

export const Route = createFileRoute("/profile/settings")({
  component: ProfileSettings,
  head: () => ({
    meta: [
      { title: "Meu perfil — Looplance" },
      { name: "description", content: "Edite seu perfil de atleta no Looplance." },
    ],
  }),
});

const BR_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB",
  "PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const SPORTS = [
  "Futebol","Futsal","Society","Futevôlei","Beach Tennis","Vôlei","Vôlei de praia",
  "Basquete","Tênis","Padel","Handebol","Squash",
];

const GENDERS = [
  { value: "masculino", label: "Masculino" },
  { value: "feminino", label: "Feminino" },
  { value: "outro", label: "Outro" },
  { value: "prefiro_nao_dizer", label: "Prefiro não dizer" },
];

interface Arena {
  id: string;
  nome: string;
  cidade: string | null;
  estado: string | null;
}

function ProfileSettings() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [state, setState] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [gender, setGender] = useState<string>("");
  const [sports, setSports] = useState<string[]>([]);
  const [favArenas, setFavArenas] = useState<string[]>([]);

  const [arenas, setArenas] = useState<Arena[]>([]);
  const [arenaQuery, setArenaQuery] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate({ to: "/auth" });
        return;
      }
      const uid = data.session.user.id;
      setUserId(uid);

      const [{ data: profile }, { data: arenaRows }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, avatar_url, city, state, gender, favorite_sports, favorite_arenas")
          .eq("id", uid)
          .maybeSingle(),
        supabase.from("arenas").select("id, nome, cidade, estado").order("nome"),
      ]);

      if (profile) {
        setFullName(profile.full_name ?? "");
        setAvatarUrl(profile.avatar_url ?? null);
        setCity(profile.city ?? "");
        setState(profile.state ?? "");
        setGender(profile.gender ?? "");
        setSports(profile.favorite_sports ?? []);
        setFavArenas(profile.favorite_arenas ?? []);
      }
      setArenas(arenaRows ?? []);
      setLoading(false);
    })();
  }, [navigate]);

  // Cities list dependent on state (from arenas). If no state chosen, show all cities.
  const cities = useMemo(() => {
    const set = new Set<string>();
    arenas.forEach((a) => {
      if (!a.cidade) return;
      if (state && (a.estado || "").toUpperCase() !== state) return;
      set.add(a.cidade.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [arenas, state]);

  const filteredArenas = useMemo(() => {
    const q = arenaQuery.trim().toLowerCase();
    return arenas.filter((a) => {
      if (!q) return true;
      return (
        a.nome.toLowerCase().includes(q) ||
        (a.cidade || "").toLowerCase().includes(q) ||
        (a.estado || "").toLowerCase().includes(q)
      );
    }).slice(0, 30);
  }, [arenas, arenaQuery]);

  const toggleSport = (s: string) =>
    setSports((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const toggleFavArena = (id: string) =>
    setFavArenas((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleAvatar = async (file: File) => {
    if (!userId) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 5MB)");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Envie apenas imagens");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `avatars/${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("arenas").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });
    if (error) {
      toast.error("Falha no upload: " + error.message);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("arenas").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    setUploading(false);
    toast.success("Foto atualizada");
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName || null,
        avatar_url: avatarUrl,
        city: city || null,
        state: state || null,
        gender: gender || null,
        favorite_sports: sports,
        favorite_arenas: favArenas,
      })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Perfil salvo!");
    navigate({ to: "/profile/$id", params: { id: userId } });
  };

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" />
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <h1 className="text-base font-bold">Meu perfil</h1>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span className="ml-1.5">Salvar</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-6">
        {/* Avatar */}
        <section className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="grid h-28 w-28 place-items-center overflow-hidden rounded-full border-4 border-primary/20 bg-muted">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <UserIcon className="h-12 w-12 text-muted-foreground" />
              )}
            </div>
            {avatarUrl && (
              <button
                onClick={() => setAvatarUrl(null)}
                className="absolute -right-1 -top-1 grid h-7 w-7 place-items-center rounded-full bg-destructive text-white shadow"
                aria-label="Remover foto"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleAvatar(e.target.files[0])}
          />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span className="ml-1.5">{avatarUrl ? "Trocar foto" : "Enviar foto"}</span>
          </Button>
        </section>

        {/* Basic */}
        <section className="space-y-4 rounded-2xl border bg-card p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Dados básicos</h2>
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Como você quer ser chamado" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[100px_1fr]">
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={state} onValueChange={(v) => { setState(v); setCity(""); }}>
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>
                  {BR_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              {cities.length > 0 ? (
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger><SelectValue placeholder="Selecione a cidade" /></SelectTrigger>
                  <SelectContent>
                    {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Sua cidade" />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Sexo</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {GENDERS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </section>

        {/* Sports */}
        <section className="space-y-3 rounded-2xl border bg-card p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Esportes que pratico</h2>
          <div className="flex flex-wrap gap-2">
            {SPORTS.map((s) => {
              const active = sports.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSport(s)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  {active && <Check className="h-3.5 w-3.5" />}
                  {s}
                </button>
              );
            })}
          </div>
        </section>

        {/* Fav Arenas */}
        <section className="space-y-3 rounded-2xl border bg-card p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Arenas favoritas</h2>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={arenaQuery}
              onChange={(e) => setArenaQuery(e.target.value)}
              placeholder="Buscar arena por nome ou cidade"
              className="pl-9"
            />
          </div>
          {favArenas.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {favArenas.map((id) => {
                const a = arenas.find((x) => x.id === id);
                if (!a) return null;
                return (
                  <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {a.nome}
                    <button onClick={() => toggleFavArena(id)} aria-label="Remover">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          <div className="max-h-64 divide-y overflow-y-auto rounded-lg border">
            {filteredArenas.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">Nenhuma arena encontrada.</p>
            )}
            {filteredArenas.map((a) => {
              const active = favArenas.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleFavArena(a.id)}
                  className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-muted ${active ? "bg-primary/5" : ""}`}
                >
                  <div>
                    <p className="font-medium">{a.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {[a.cidade, a.estado].filter(Boolean).join(" / ") || "—"}
                    </p>
                  </div>
                  {active ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : (
                    <span className="text-xs text-muted-foreground">Favoritar</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
