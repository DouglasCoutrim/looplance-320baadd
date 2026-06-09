import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import { 
  Tv, 
  HardDrive, 
  Usb, 
  Camera, 
  LayoutDashboard,
  Settings,
  ArrowLeft,
  Menu,
  X,
  Play,
  Users
} from "lucide-react";
import { useState, useEffect } from "react";
import logoUrl from "@/assets/looplance-logo.png";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/";
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_super_admin, is_arena_owner")
        .eq("id", user.id)
        .single();

      if (!profile?.is_super_admin && !profile?.is_arena_owner) {
        toast.error("Acesso restrito a administradores");
        window.location.href = "/";
        return;
      }

      setIsAdmin(true);
    };

    checkAdmin();
  }, []);

  const navItems = [
    { to: "/admin", label: "Visão Geral", icon: LayoutDashboard },
    { to: "/admin/users", label: "Usuários", icon: Users },
    { to: "/admin/edge-devices", label: "Edge Devices", icon: HardDrive },
    { to: "/admin/input-boards", label: "Input Boards", icon: Usb },
    { to: "/admin/cameras", label: "Cameras", icon: Camera },
    { to: "/admin/arenas", label: "Arenas", icon: Tv },
    { to: "/admin/quadras", label: "Quadras", icon: Tv },
    { to: "/admin/replays", label: "Replays", icon: Play },
  ];
  
  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-primary font-black uppercase tracking-widest text-xs">Verificando Credenciais...</p>
        </div>
      </div>
    );
  }

  const NavLinks = ({ className = "" }: { className?: string }) => (
    <nav className={`space-y-1 ${className}`}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.to || (item.to === "/admin" && location.pathname === "/admin/");
        
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all duration-200 border ${
              isActive 
                ? "bg-brand-dim text-brand-text border-l-[3px] border-l-brand border-t-transparent border-r-transparent border-b-transparent shadow-none" 
                : "bg-surface border-border text-secondary hover:border-brand/30 hover:text-brand"
            }`}
          >
            <Icon className={`h-5 w-5 ${isActive ? "text-brand" : "text-muted group-hover:text-brand"}`} />
            <span className="text-sm">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header - Fixed Height & High Impact */}
      <header className="sticky top-0 z-50 border-b border-border bg-surface shadow-subtle h-16 sm:h-20">
        <div className="mx-auto flex h-full max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          {/* Left: Back to Site / Menu Trigger */}
          <div className="flex-1 flex items-center gap-2">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden text-primary hover:bg-tag">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0 border-none bg-surface">
                <div className="bg-brand-dim p-6 text-brand-text">
                  <SheetHeader className="text-left">
                    <SheetTitle className="text-brand-text font-black uppercase tracking-tight text-xl">Menu Admin</SheetTitle>
                    <SheetDescription className="text-brand-text/70 text-xs font-bold uppercase tracking-widest">
                      Navegação do painel de controle Looplance Edge.
                    </SheetDescription>
                  </SheetHeader>
                </div>
                <div className="p-4 space-y-6">
                  <NavLinks />
                  <div className="pt-4 border-t border-border">
                    <Link 
                      to="/" 
                      className="flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-secondary hover:bg-tag transition-colors"
                    >
                      <ArrowLeft className="h-5 w-5" />
                      <span>Sair do Admin</span>
                    </Link>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <Link 
              to="/" 
              className="hidden md:inline-flex items-center gap-2 rounded-full border border-border bg-tag px-3 py-1.5 transition hover:bg-tag/80 text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-xs font-bold tracking-tight">Sair</span>
            </Link>
          </div>

          {/* Center: Logo */}
          <div className="flex-none relative flex justify-center items-center h-full">
            <Link to="/admin">
              <img 
                src={logoUrl} 
                alt="Looplance Admin" 
                className="h-24 sm:h-32 w-auto object-contain transition-transform hover:scale-105" 
                style={{ marginTop: '4px' }}
              />
            </Link>
          </div>

          {/* Right: User/Settings */}
          <div className="flex-1 flex justify-end">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-tag px-2 sm:px-3 py-1.5 text-muted">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">Config</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row max-w-7xl mx-auto w-full gap-6 p-4 sm:p-6 lg:p-8">
        {/* Navigation Sidebar - Hidden on mobile, shown on desktop */}
        <aside className="hidden md:block w-64 space-y-2 shrink-0">
          <div className="px-2 mb-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Gestão de Infra</h2>
          </div>
          <NavLinks />
          <div className="mt-8 px-2 pt-6 border-t border-border">
            <p className="text-[10px] font-medium text-muted leading-relaxed italic">
              Controlando o futuro do replay esportivo.
            </p>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0">
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
