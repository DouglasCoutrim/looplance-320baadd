import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Home, Compass, Play, MessageCircle, User, Bell, Settings, LogOut, LayoutDashboard, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  is_super_admin?: boolean | null;
  is_arena_owner?: boolean | null;
}

interface Props {
  children: ReactNode;
  active?: "feed" | "explore" | "replays" | "messages" | "profile";
}

export function SocialShell({ children, active = "feed" }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string | null>(null);

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
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const isAdmin = !!(profile?.is_super_admin || profile?.is_arena_owner);
  const soon = (label: string) => () => toast(`${label} em breve 🚧`);

  const nav = [
    { id: "feed", icon: Home, label: "Início", to: "/" as const, onClick: undefined },
    { id: "explore", icon: Compass, label: "Explorar", to: undefined, onClick: soon("Explorar") },
    { id: "replays", icon: Play, label: "Replays", to: "/" as const, onClick: undefined },
    { id: "messages", icon: MessageCircle, label: "Mensagens", to: undefined, onClick: soon("Mensagens") },
    {
      id: "profile", icon: User, label: "Perfil",
      to: profile ? ("/profile/$id" as const) : undefined,
      params: profile ? { id: profile.id } : undefined,
      onClick: profile ? undefined : soon("Perfil"),
    },
  ];

  const initials = (profile?.full_name || email || "U")
    .split(" ").slice(0, 2).map(s => s[0]?.toUpperCase()).join("");

  const isActive = (id: string) => (id === "feed" ? location.pathname === "/" : id === active);

  return (
    <div className="min-h-screen bg-background text-foreground flex relative">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 h-screen sticky top-0 border-r border-border px-5 py-6 gap-1 shrink-0 bg-background">
        <Link to="/" className="flex items-center gap-2.5 mb-8 px-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 brand-gradient">
            <Zap className="w-5 h-5 text-black" fill="currentColor" />
          </div>
          <span
            className="text-2xl font-black tracking-tight brand-text"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            Loop Lance
          </span>
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
                  {...(item.params ? { params: item.params } : {})}
                  className={cls}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {item.label}
                </Link>
              );
            }
            return (
              <button key={item.id} onClick={item.onClick} className={cls}>
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
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center brand-gradient">
              <Zap className="w-4 h-4 text-black" fill="currentColor" />
            </div>
            <span
              className="text-xl font-black brand-text"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              Loop Lance
            </span>
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
                <Link key={item.id} to={item.to} {...(item.params ? { params: item.params } : {})}>
                  {inner}
                </Link>
              );
            }
            return <button key={item.id} onClick={item.onClick}>{inner}</button>;
          })}
        </div>
      </nav>
    </div>
  );
}
