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
  Users,
  Radio
} from "lucide-react";
import { useState, useEffect } from "react";
import logoUrl from "@/assets/logo-looplance.svg";
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
    { to: "/admin/botoeiras", label: "Botoeiras IoT", icon: Radio },
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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-brand-orange border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white font-black uppercase tracking-widest text-xs">Verificando Credenciais...</p>
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
                ? "brand-gradient text-black border-transparent shadow-lg shadow-brand-orange/20 scale-[1.02]" 
                : "bg-transparent border-transparent text-white/60 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon className={`h-5 w-5 ${isActive ? "text-black" : "text-white/40"}`} />
            <span className="text-sm">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header - Fixed Height & High Impact */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#111] shadow-xl h-16 sm:h-20">
        <div className="mx-auto flex h-full max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          {/* Left: Back to Site / Menu Trigger */}
          <div className="flex-1 flex items-center gap-2">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden text-white hover:bg-white/10">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0 border-none bg-background">
                <div className="brand-gradient p-6 text-white">
                  <SheetHeader className="text-left">
                    <SheetTitle className="text-white font-black uppercase tracking-tight text-xl">Menu Admin</SheetTitle>
                    <SheetDescription className="text-white/70 text-xs font-bold uppercase tracking-widest">
                      Navegação do painel de controle Looplance Edge.
                    </SheetDescription>
                  </SheetHeader>
                </div>
                <div className="p-4 space-y-6">
                  <NavLinks />
                  <div className="pt-4 border-t border-white/10">
                    <Link 
                      to="/" 
                      className="flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-gray-400 hover:bg-white/5 transition-colors"
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
              className="hidden md:inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur-md transition hover:bg-white/20 text-white"
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
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-2 sm:px-3 py-1.5 backdrop-blur-md text-white/50">
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
            <h2 className="text-[11px] font-black uppercase tracking-[0.8px] text-white/35">Gestão de Infra</h2>
          </div>
          <NavLinks />
          <div className="mt-8 px-2 pt-6 border-t border-white/10">
            <p className="text-[12px] font-medium text-white/35 leading-relaxed italic">
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
