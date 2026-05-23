import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  HardDrive, 
  Camera, 
  Tv, 
  Play, 
  Activity, 
  Users, 
  Zap, 
  ArrowRight,
  TrendingUp,
  ShieldCheck
} from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, Tooltip, Cell, XAxis, YAxis } from "recharts";

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
    <div className="space-y-8 pb-10">
      {/* Hero Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900 uppercase">
            Dashboard <span className="brand-text">Admin</span>
          </h1>
          <p className="text-muted-foreground mt-1 font-medium text-base sm:text-lg">
            Monitoramento e controle da infraestrutura <span className="text-brand-orange font-bold">Edge Replay</span>.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-3">
          <div className="h-12 w-12 rounded-full brand-gradient brand-glow flex items-center justify-center text-white">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Status do Sistema</p>
            <p className="text-sm font-bold text-green-600 flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" /> Operacional
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid - Using the white card style from the main app */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Edge Devices" 
          value={stats.devices} 
          icon={<HardDrive className="h-5 w-5" />} 
          description="Servidores Ubuntu Edge"
          link="/admin/edge-devices"
          color="orange"
        />
        <StatCard 
          title="Câmeras" 
          value={stats.cameras} 
          icon={<Camera className="h-5 w-5" />} 
          description="Fluxos RTSP Ativos"
          link="/admin/cameras"
          color="blue"
        />
        <StatCard 
          title="Arenas" 
          value={stats.arenas} 
          icon={<Tv className="h-5 w-5" />} 
          description="Complexos Esportivos"
          link="/admin/arenas"
          color="green"
        />
        <StatCard 
          title="Total Replays" 
          value={stats.replays} 
          icon={<Play className="h-5 w-5" />} 
          description="Lances Processados"
          color="purple"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Resource Distribution Chart */}
        <div className="lg:col-span-3 glass-card bg-white p-6 shadow-md border border-gray-200">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-gray-900 flex items-center gap-2 uppercase tracking-tight">
              <Activity className="h-5 w-5 text-brand-orange" />
              Distribuição de Infra
            </h3>
            <div className="inline-flex items-center gap-1 text-xs font-bold text-brand-orange bg-brand-orange/10 px-2 py-1 rounded-md">
              <TrendingUp className="h-3 w-3" /> +12% Crescimento
            </div>
          </div>
          
          <div className="h-[300px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fontWeight: 700, fill: '#64748b' }}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white p-3 border border-gray-100 rounded-xl shadow-xl text-xs font-black uppercase">
                          <span style={{ color: payload[0].payload.color }}>{payload[0].name}</span>: {payload[0].value}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="value" radius={[10, 10, 10, 10]} barSize={40}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions - High Impact */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xl font-black text-gray-900 flex items-center gap-2 uppercase tracking-tight px-1">
            <Zap className="h-5 w-5 text-brand-orange fill-brand-orange" />
            Ações Rápidas
          </h3>
          
          <QuickAction 
            to="/admin/edge-devices" 
            title="Provisionar Servidor" 
            description="Adicione um novo nó Ubuntu Edge" 
            icon={<HardDrive className="h-6 w-6" />}
          />
          <QuickAction 
            to="/admin/cameras" 
            title="Configurar Câmera" 
            description="Mapeie câmeras RTSP para quadras" 
            icon={<Camera className="h-6 w-6" />}
          />
          <QuickAction 
            to="/admin/arenas" 
            title="Nova Arena" 
            description="Cadastre um novo complexo esportivo" 
            icon={<Tv className="h-6 w-6" />}
          />
          
          <div className="glass-card brand-gradient brand-glow p-6 text-white mt-2 relative overflow-hidden group transition-transform hover:scale-[1.02]">
            <div className="relative z-10">
              <h4 className="font-black uppercase tracking-widest text-xs opacity-80 mb-1">Status Global</h4>
              <p className="text-2xl font-black leading-tight">Sua rede Edge está pronta para lances.</p>
              <button className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-md px-4 py-2 text-xs font-black uppercase tracking-widest hover:bg-white/30 transition">
                Ver Logs <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            <Zap className="absolute -bottom-4 -right-4 h-32 w-32 opacity-10 rotate-12 group-hover:rotate-0 transition-transform duration-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, description, link, color }: any) {
  const colorClasses: any = {
    orange: "text-orange-500 bg-orange-50",
    blue: "text-blue-500 bg-blue-50",
    green: "text-green-500 bg-green-50",
    purple: "text-purple-500 bg-purple-50",
  };

  const content = (
    <div className="glass-card bg-white p-4 sm:p-6 shadow-md border border-gray-200 transition-all hover:shadow-xl hover:-translate-y-1 group">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2.5 sm:p-3 rounded-2xl ${colorClasses[color] || colorClasses.orange} transition-colors group-hover:brand-gradient group-hover:text-white`}>
          {icon}
        </div>
        <div className="text-2xl sm:text-3xl font-black text-gray-900">{value}</div>
      </div>
      <div>
        <h4 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">{title}</h4>
        <p className="text-xs sm:text-sm font-medium text-gray-500 mt-1">{description}</p>
      </div>
    </div>
  );

  if (link) {
    return <Link to={link}>{content}</Link>;
  }
  return content;
}

function QuickAction({ to, title, description, icon }: any) {
  return (
    <Link 
      to={to} 
      className="flex items-center gap-3 sm:gap-4 glass-card bg-white p-3 sm:p-4 shadow-sm border border-gray-100 transition-all hover:border-brand-orange/50 hover:shadow-md hover:bg-gray-50 group"
    >
      <div className="h-12 w-12 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:brand-gradient group-hover:text-white transition-all">
        {icon}
      </div>
      <div className="flex-1">
        <div className="font-black uppercase tracking-tight text-sm text-gray-900">{title}</div>
        <div className="text-xs font-medium text-muted-foreground mt-0.5">{description}</div>
      </div>
      <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-brand-orange group-hover:translate-x-1 transition-all" />
    </Link>
  );
}
