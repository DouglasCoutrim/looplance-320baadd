import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Home, Compass, Play, MessageCircle, User, Bell, LogOut, LayoutDashboard,
  Search, TrendingUp, Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import logoSvg from "@/assets/looplance-logo.svg";

interface Profile {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  is_super_admin?: boolean | null;
  is_arena_owner?: boolean | null;
}

interface Suggestion {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface Props {
  children: ReactNode;
  active?: "feed" | "explore" | "replays" | "messages" | "profile";
  hideRightPanel?: boolean;
}

const TRENDING = [
  "#EnterradaPerfeita",
  "#GolDoAno",
  "#LoopLance",
  "#ArenaFever",
  "#TempoExtra",
  "#MatchPoint",
  "#MomentosMágicos",
];

export function SocialShell({ children, active = "feed", hideRightPanel = false }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [followed, setFollowed] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setEmail(data.user.email ?? null);
      const { data: p } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, is_super_admin, is_arena_owner")
        .eq("id", data.user.id)
        .maybeSingle();
      if (p) setProfile(p as Profile);
      const { data: sugg } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .neq("id", data.user.id)
        .limit(4);
      setSuggestions((sugg ?? []) as Suggestion[]);
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const isAdmin = !!(profile?.is_super_admin || profile?.is_arena_owner);
  const soon = (label: string) => () => toast(`${label} em breve 🚧`);

  const nav = [
    { id: "feed", icon: Home, label: "Início", to: "/" as const },
    { id: "explore", icon: Compass, label: "Explorar", to: "/explore" as const },
    { id: "replays", icon: Play, label: "Replays", to: "/replays" as const },
    { id: "messages", icon: MessageCircle, label: "Mensagens", to: "/messages" as const },
    {
      id: "profile", icon: User, label: "Perfil",
      to: profile ? ("/profile/$id" as const) : undefined,
      params: profile ? { id: profile.id } : undefined,
      onClick: profile ? undefined : soon("Perfil"),
    },
  ] as const;

  const initials = (profile?.full_name || email || "U")
    .split(" ").slice(0, 2).map(s => s[0]?.toUpperCase()).join("");

  const isActive = (id: string) => {
    if (id === "feed") return location.pathname === "/";
    if (id === "profile") return location.pathname.startsWith("/profile");
    return id === active || location.pathname.startsWith(`/${id}`);
  };

  const toggleFollow = (id: string) =>
    setFollowed((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  return (
    <div className="min-h-screen bg-background text-foreground flex relative">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 h-screen sticky top-0 border-r border-border px-5 py-6 gap-1 shrink-0 bg-background">
        <Link to="/" className="mb-8 px-2">
          <img src={logoSvg} alt="Loop Lance" className="h-10 w-auto object-contain" />
        </Link>

        <nav className="flex flex-col gap-1 flex-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const activeStyle = isActive(item.id);
            const cls = `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
              activeStyle
                ? "text-black shadow-lg brand-gradient"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`;
            if (item.to) {
              return (
                <Link
                  key={item.id}
                  to={item.to}
                  {...(("params" in item && item.params) ? { params: item.params } : {})}
                  className={cls}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {item.label}
                </Link>
              );
            }
            return (
              <button key={item.id} onClick={"onClick" in item ? item.onClick : undefined} className={cls}>
                <Icon className="w-5 h-5 shrink-0" />
                {item.label}
              </button>
            );
          })}

          {isAdmin && (
            <Link
              to="/admin"
              className="mt-3 flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition"
            >
              <LayoutDashboard className="w-5 h-5 shrink-0 text-brand-orange" />
              Painel Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/60 group mt-4">
          <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 p-[2px] brand-gradient">
            <div className="w-full h-full rounded-full overflow-hidden bg-background flex items-center justify-center">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-black text-foreground">{initials}</span>
              )}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{profile?.full_name || "Você"}</p>
            <p className="text-xs text-muted-foreground truncate">{email || ""}</p>
          </div>
          <button onClick={handleLogout} title="Sair" className="text-muted-foreground hover:text-foreground transition">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 max-w-2xl mx-auto px-4 pt-4 pb-24 md:pb-8 md:pt-6">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between mb-5">
          <Link to="/">
            <img src={logoSvg} alt="Loop Lance" className="h-9 w-auto object-contain" />
          </Link>
          <div className="flex gap-2 items-center">
            {isAdmin && (
              <Link
                to="/admin"
                className="grid place-items-center h-9 w-9 rounded-xl border border-border text-brand-orange bg-secondary/50"
                title="Admin"
              >
                <LayoutDashboard className="w-4 h-4" />
              </Link>
            )}
            <button className="relative grid place-items-center h-9 w-9 rounded-xl border border-border text-muted-foreground">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full brand-gradient" />
            </button>
            <button
              onClick={handleLogout}
              className="grid place-items-center h-9 w-9 rounded-xl border border-border text-muted-foreground"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {children}
      </main>

      {/* Right desktop panel */}
      {!hideRightPanel && (
        <aside className="hidden lg:flex flex-col w-80 h-screen sticky top-0 border-l border-border px-5 py-6 gap-7 shrink-0 overflow-y-auto">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar..."
                className="w-full bg-secondary rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none border border-transparent focus:border-primary/60 transition"
              />
            </div>
            <button className="relative w-9 h-9 bg-secondary rounded-xl flex items-center justify-center hover:bg-secondary/80 transition shrink-0">
              <Bell className="w-4 h-4 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full brand-gradient" />
            </button>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3.5">
              <TrendingUp className="w-4 h-4 text-brand-orange" />
              <h3
                className="font-black text-sm uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.08em" }}
              >
                Trending
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {TRENDING.map((tag, i) => (
                <span
                  key={tag}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer transition-all hover:scale-105 ${
                    i === 0 ? "text-black brand-gradient" : "bg-secondary"
                  }`}
                  style={i === 0 ? undefined : { color: "#ff9500" }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {suggestions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3.5">
                <Users className="w-4 h-4 text-brand-orange" />
                <h3
                  className="font-black text-sm uppercase"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.08em" }}
                >
                  Atletas Sugeridos
                </h3>
              </div>
              <div className="space-y-3">
                {suggestions.map((s) => (
                  <div key={s.id} className="flex items-center gap-3">
                    <Link
                      to="/profile/$id"
                      params={{ id: s.id }}
                      className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-secondary grid place-items-center"
                    >
                      {s.avatar_url ? (
                        <img src={s.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-muted-foreground">
                          {(s.full_name || "?").slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link
                        to="/profile/$id"
                        params={{ id: s.id }}
                        className="text-sm font-semibold truncate block hover:text-brand-orange transition"
                      >
                        {s.full_name || "Atleta"}
                      </Link>
                      <p className="text-xs text-muted-foreground">Looplance</p>
                    </div>
                    <button
                      onClick={() => toggleFollow(s.id)}
                      className={`text-xs font-bold px-3.5 py-1.5 rounded-full transition-all shrink-0 ${
                        followed.has(s.id) ? "bg-secondary text-muted-foreground" : "text-black brand-gradient"
                      }`}
                    >
                      {followed.has(s.id) ? "Seguindo" : "Seguir"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      )}

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border bg-background/95 backdrop-blur-xl">
        <div className="flex items-center justify-around px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          {nav.map((item) => {
            const Icon = item.icon;
            const activeStyle = isActive(item.id);
            const inner = (
              <div className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 ${activeStyle ? "text-black brand-gradient" : "text-muted-foreground"}`}>
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-bold">{item.label}</span>
              </div>
            );
            if (item.to) {
              return (
                <Link key={item.id} to={item.to} {...(("params" in item && item.params) ? { params: item.params } : {})}>
                  {inner}
                </Link>
              );
            }
            return <button key={item.id} onClick={"onClick" in item ? item.onClick : undefined}>{inner}</button>;
          })}
        </div>
      </nav>
    </div>
  );
}
