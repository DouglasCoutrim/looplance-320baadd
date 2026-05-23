import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { SidebarProvider, Sidebar, SidebarTrigger, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarFooter } from "@/components/ui/sidebar";
import { Home, Settings, Tv, HardDrive, Usb, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <Sidebar collapsible="icon" className="dark">
          <SidebarHeader>
            <Link to="/" className="flex items-center gap-2 p-2">
              <img src="/looplance-logo.png" alt="Looplance Admin" className="h-8 w-auto" />
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarMenu>
                <SidebarMenuItem>
                  <Button asChild variant="ghost" className="w-full justify-start">
                    <Link to="/admin/" activeProps={{ className: "bg-accent" }}>
                      <Home className="mr-2 h-4 w-4" />
                      Home
                    </Link>
                  </Button>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Button asChild variant="ghost" className="w-full justify-start">
                    <Link to="/admin/edge-devices" activeProps={{ className: "bg-accent" }}>
                      <HardDrive className="mr-2 h-4 w-4" />
                      Edge Devices
                    </Link>
                  </Button>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Button asChild variant="ghost" className="w-full justify-start">
                    <Link to="/admin/input-boards" activeProps={{ className: "bg-accent" }}>
                      <Usb className="mr-2 h-4 w-4" />
                      Input Boards
                    </Link>
                  </Button>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Button asChild variant="ghost" className="w-full justify-start">
                    <Link to="/admin/cameras" activeProps={{ className: "bg-accent" }}>
                      <Camera className="mr-2 h-4 w-4" />
                      Cameras
                    </Link>
                  </Button>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Button asChild variant="ghost" className="w-full justify-start">
                    <Link to="/admin/arenas" activeProps={{ className: "bg-accent" }}>
                      <Tv className="mr-2 h-4 w-4" />
                      Arenas
                    </Link>
                  </Button>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Button asChild variant="ghost" className="w-full justify-start">
                    <Link to="/admin/quadras" activeProps={{ className: "bg-accent" }}>
                      <Tv className="mr-2 h-4 w-4" />
                      Courts
                    </Link>
                  </Button>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="flex justify-center p-2">
            <SidebarTrigger className="rounded-full" />
          </SidebarFooter>
        </Sidebar>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}