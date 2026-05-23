import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import { 
  Home, 
  Tv, 
  HardDrive, 
  Usb, 
  Camera, 
  ChevronLeft,
  LayoutDashboard,
  Settings,
  ArrowLeft
} from "lucide-react";
import logoUrl from "@/assets/looplance-logo.png";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const location = useLocation();
  
  const navItems = [
    { to: "/admin", label: "Visão Geral", icon: LayoutDashboard },
    { to: "/admin/edge-devices", label: "Edge Devices", icon: HardDrive },
    { to: "/admin/input-boards", label: "Input Boards", icon: Usb },
    { to: "/admin/cameras", label: "Cameras", icon: Camera },
    { to: "/admin/arenas", label: "Arenas", icon: Tv },
    { to: "/admin/quadras", label: "Quadras", icon: Tv },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header - Replicating the Main App's Hybrid Contrast Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black shadow-xl h-16 sm:h-20">
        <div className="mx-auto flex h-full max-w-6xl items-center px-4 sm:px-6">
          {/* Left: Back to Site */}
          <div className="flex-1">
            <Link 
              to="/" 
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur-md transition hover:bg-white/20 text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline text-xs font-bold tracking-tight">Sair do Admin</span>
            </Link>
          </div>

          {/* Center: Logo (Same as main app) */}
          <div className="flex-none relative flex justify-center items-center h-full">
            <Link to="/admin">
              <img 
                src={logoUrl} 
                alt="Looplance Admin" 
                className="h-28 sm:h-36 w-auto object-contain transition-transform hover:scale-105 z-50" 
                style={{ marginTop: '4px' }}
              />
            </Link>
          </div>

          {/* Right: User/Settings placeholder */}
          <div className="flex-1 flex justify-end">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur-md text-white/50">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">Config</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row max-w-7xl mx-auto w-full gap-6 p-4 sm:p-6 lg:p-8">
        {/* Navigation Sidebar - Modern and Themed */}
        <aside className="w-full md:w-64 space-y-2 shrink-0">
          <div className="px-2 mb-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/80">Navegação</h2>
          </div>
          <nav className="space-y-1">
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

          <div className="mt-8 px-2 pt-6 border-t border-gray-200">
            <p className="text-[10px] font-medium text-muted-foreground leading-relaxed italic">
              "A excelência é o resultado de milhares de lances em loop."
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
