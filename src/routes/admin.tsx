import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { SidebarProvider, Sidebar, SidebarTrigger, SidebarHeader, SidebarContent, SidebarGroup, SidebarMenu, SidebarMenuItem, SidebarFooter } from "@/components/ui/sidebar";
import { Home, Settings, Tv, HardDrive, Usb, Camera, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoUrl from "@/assets/looplance-logo.png";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 w-full">
        <Sidebar collapsible="icon" className="dark border-r border-white/10 overflow-hidden">
          <SidebarHeader className="border-b border-white/10 p-4">
            <Link to="/admin" className="flex items-center gap-2">
              <img src={logoUrl} alt="Looplance Admin" className="h-8 w-auto" />
              <span className="font-bold text-sm tracking-tight text-white group-data-[collapsible=icon]:hidden">
                Admin Panel
              </span>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarMenu>
                <SidebarMenuItem>
                  <Button asChild variant="ghost" className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10">
                    <Link to="/admin" activeProps={{ className: "bg-white/10 text-white font-bold" }}>
                      <Home className="mr-2 h-4 w-4" />
                      Visão Geral
                    </Link>
                  </Button>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Button asChild variant="ghost" className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10">
                    <Link to="/admin/edge-devices" activeProps={{ className: "bg-white/10 text-white font-bold" }}>
                      <HardDrive className="mr-2 h-4 w-4" />
                      Edge Devices
                    </Link>
                  </Button>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Button asChild variant="ghost" className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10">
                    <Link to="/admin/input-boards" activeProps={{ className: "bg-white/10 text-white font-bold" }}>
                      <Usb className="mr-2 h-4 w-4" />
                      Input Boards
                    </Link>
                  </Button>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Button asChild variant="ghost" className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10">
                    <Link to="/admin/cameras" activeProps={{ className: "bg-white/10 text-white font-bold" }}>
                      <Camera className="mr-2 h-4 w-4" />
                      Cameras
                    </Link>
                  </Button>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Button asChild variant="ghost" className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10">
                    <Link to="/admin/arenas" activeProps={{ className: "bg-white/10 text-white font-bold" }}>
                      <Tv className="mr-2 h-4 w-4" />
                      Arenas
                    </Link>
                  </Button>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Button asChild variant="ghost" className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10">
                    <Link to="/admin/quadras" activeProps={{ className: "bg-white/10 text-white font-bold" }}>
                      <Tv className="mr-2 h-4 w-4" />
                      Quadras
                    </Link>
                  </Button>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="border-t border-white/10 p-4 bg-black">
            <Link 
              to="/" 
              className="flex items-center justify-center gap-2 w-full rounded-md border border-white/20 bg-white/5 py-2 text-xs font-bold text-white transition hover:bg-white/10 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:justify-center"
            >
              <ChevronLeft className="h-4 w-4 shrink-0" />
              <span className="group-data-[collapsible=icon]:hidden">Voltar ao Site</span>
            </Link>
            <div className="mt-2 flex justify-center">
              <SidebarTrigger className="rounded-full text-white/50 hover:text-white" />
            </div>
          </SidebarFooter>
        </Sidebar>
        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950 min-h-screen">
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
