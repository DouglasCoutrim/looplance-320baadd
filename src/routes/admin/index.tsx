import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HardDrive, Camera, Tv, Play, Activity, Users } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, Tooltip, Cell } from "recharts";

export const Route = createFileRoute("/admin/")({
  component: AdminHome,
});

function AdminHome() {
  const [stats, setStats] = useState({
    devices: 0,
    cameras: 0,
    arenas: 0,
    replays: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const [devices, cameras, arenas, replays] = await Promise.all([
        supabase.from("edge_devices").select("*", { count: "exact", head: true }),
        supabase.from("cameras").select("*", { count: "exact", head: true }),
        supabase.from("arenas").select("*", { count: "exact", head: true }),
        supabase.from("replays").select("*", { count: "exact", head: true }),
      ]);

      setStats({
        devices: devices.count || 0,
        cameras: cameras.count || 0,
        arenas: arenas.count || 0,
        replays: replays.count || 0,
      });
    };
    fetchStats();
  }, []);

  const data = [
    { name: "Devices", value: stats.devices, color: "#f97316" },
    { name: "Cameras", value: stats.cameras, color: "#3b82f6" },
    { name: "Arenas", value: stats.arenas, color: "#10b981" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Painel Administrativo</h1>
        <p className="text-muted-foreground mt-1">Visão geral da sua infraestrutura Edge.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Edge Devices" 
          value={stats.devices} 
          icon={<HardDrive className="h-4 w-4" />} 
          description="Servidores ativos"
          link="/admin/edge-devices"
        />
        <StatCard 
          title="Câmeras" 
          value={stats.cameras} 
          icon={<Camera className="h-4 w-4" />} 
          description="Câmeras configuradas"
          link="/admin/cameras"
        />
        <StatCard 
          title="Arenas" 
          value={stats.arenas} 
          icon={<Tv className="h-4 w-4" />} 
          description="Locais ativos"
          link="/admin/arenas"
        />
        <StatCard 
          title="Total Replays" 
          value={stats.replays} 
          icon={<Play className="h-4 w-4" />} 
          description="Vídeos gerados"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5 text-brand-orange" />
              Distribuição de Recursos
            </CardTitle>
          </CardHeader>
          <CardContent className="pl-2 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <Tooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white p-2 border rounded shadow-sm text-xs font-bold">
                          {payload[0].name}: {payload[0].value}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              Acesso Rápido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <QuickLink 
                to="/admin/edge-devices" 
                title="Provisionar Servidor" 
                description="Adicione um novo nó Ubuntu Edge" 
              />
              <QuickLink 
                to="/admin/cameras" 
                title="Configurar Câmera" 
                description="Mapeie câmeras RTSP para quadras" 
              />
              <QuickLink 
                to="/admin/arenas" 
                title="Nova Arena" 
                description="Cadastre um novo complexo esportivo" 
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, description, link }: any) {
  const content = (
    <Card className="transition-all hover:shadow-md hover:border-brand-orange/20 cursor-default">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );

  if (link) {
    return <Link to={link}>{content}</Link>;
  }
  return content;
}

function QuickLink({ to, title, description }: any) {
  return (
    <Link 
      to={to} 
      className="block group p-3 rounded-lg border border-transparent hover:border-border hover:bg-muted/50 transition-all"
    >
      <div className="font-medium text-sm group-hover:text-brand-orange transition-colors">{title}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
    </Link>
  );
}
