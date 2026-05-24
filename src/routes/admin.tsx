import { createFileRoute, Outlet, Link, useLocation, useNavigate, redirect } from "@tanstack/react-router";
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
  Users,
  LogOut
} from "lucide-react";
import { useState, useEffect } from "react";
import logoUrl from "@/assets/looplance-logo.png";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ location }) => {
    // Skip auth check for login page to avoid recursion
    if (location.pathname === "/admin/login") return;

    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw redirect({ to: "/admin/login" });
    }

    // Check if super admin or arena owner
    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("is_super_admin, is_arena_owner")
        .eq("id", session.user.id)
        .maybeSingle();

      if (error) {
        console.error("Erro ao verificar acesso admin:", error);
        return;
      }

      console.log("Admin Check - Dados do Perfil:", profile);

      if (profile?.is_super_admin !== true && profile?.is_arena_owner !== true) {
        console.log("Acesso negado: não é super admin nem dono de arena.");
        throw redirect({ to: "/" });
      }
    } catch (err) {
      if (err && typeof err === 'object' && 'to' in err) throw err;
      console.error("Falha na verificação de admin:", err);
    }
  },

  errorComponent: ({ error }: { error: any }) => {
    const navigate = useNavigate();
    
    useEffect(() => {
      if (error.message === "unauthorized" || error.message === "forbidden") {
        navigate({ to: "/admin/login" });
      }
    }, [error, navigate]);

    return null;
  },
  component: AdminLayout,
});

function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logoff realizado");
    navigate({ to: "/admin/login" });
  };
  
  const navItems = [
    { to: "/admin", label: "Visão Geral", icon: LayoutDashboard },
    { to: "/admin/edge-devices", label: "Edge Devices", icon: HardDrive },
    { to: "/admin/input-boards", label: "Input Boards", icon: Usb },
    { to: "/admin/cameras", label: "Cameras", icon: Camera },
    { to: "/admin/arenas", label: "Arenas", icon: Tv },
    { to: "/admin/quadras", label: "Quadras", icon: Tv },
    { to: "/admin/users", label: "Usuários", icon: Users },
  ];

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

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
                ? "brand-gradient text-white border-transparent shadow-lg shadow-brand-orange/20 scale-[1.02]" 
                : "bg-white border-gray-100 text-gray-600 hover:border-brand-orange/30 hover:text-brand-orange"
            }`}
          >
            <Icon className={`h-5 w-5 ${isActive ? "text-white" : "text-gray-400 group-hover:text-brand-orange"}`} />
            <span className="text-sm">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header - Fixed Height & High Impact */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black shadow-xl h-16 sm:h-20">
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
                  <div className="pt-4 border-t border-gray-100">
                    <Link 
                      to="/" 
                      className="flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition-colors"
                    >
                      <ArrowLeft className="h-5 w-5" />
                      <span>Sair do Admin</span>
                    </Link>
                    <button 
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="h-5 w-5" />
                      <span>Sair da Conta</span>
                    </button>
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
          <div className="flex-1 flex justify-end gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-2 sm:px-3 py-1.5 backdrop-blur-md text-white/50">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">Config</span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleLogout}
              className="text-white/50 hover:text-red-500 hover:bg-red-500/10 rounded-full"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row max-w-7xl mx-auto w-full gap-6 p-4 sm:p-6 lg:p-8">
        {/* Navigation Sidebar - Hidden on mobile, shown on desktop */}
        <aside className="hidden md:block w-64 space-y-2 shrink-0">
          <div className="px-2 mb-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/80">Gestão de Infra</h2>
          </div>
          <NavLinks />
          <div className="mt-8 px-2 pt-6 border-t border-gray-200">
            <p className="text-[10px] font-medium text-muted-foreground leading-relaxed italic">
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
