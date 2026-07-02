import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, HardDrive, Play, Wifi, WifiOff, Clock, Cpu, MemoryStick, Thermometer, ArrowDownUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";


export const Route = createFileRoute("/admin/monitoring")({
  component: MonitoringPage,
});

type EdgeDevice = {
  id: string;
  name: string;
  hostname: string | null;
  local_ip: string | null;
  edge_version: string | null;
  status: string | null;
  last_seen: string | null;
  uptime_seconds: number | null;
  arena_id: string | null;
  cpu_percent: number | null;
  memory_percent: number | null;
  memory_total_mb: number | null;
  memory_used_mb: number | null;
  disk_percent: number | null;
  temperature_c: number | null;
  net_rx_bps: number | null;
  net_tx_bps: number | null;
  load_avg_1m: number | null;
};


type Replay = {
  id: string;
  quadra_id: string | null;
  edge_device_id: string | null;
  video_url: string | null;
  duration_sec: number | null;
  file_size_bytes: number | null;
  created_at: string;
};

const HEARTBEAT_STALE_MS = 60_000; // 60s sem heartbeat = offline

function isOnline(lastSeen: string | null) {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < HEARTBEAT_STALE_MS;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatUptime(seconds: number | null) {
  if (!seconds) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function MonitoringPage() {
  const [devices, setDevices] = useState<EdgeDevice[]>([]);
  const [replays, setReplays] = useState<Replay[]>([]);
  const [loading, setLoading] = useState(true);
  const [, forceRerender] = useState(0);

  // Load initial data
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [d, r] = await Promise.all([
        supabase.from("edge_devices").select("*").order("last_seen", { ascending: false, nullsFirst: false }),
        supabase.from("replays").select("*").order("created_at", { ascending: false }).limit(20),
      ]);
      if (!mounted) return;
      if (d.data) setDevices(d.data as EdgeDevice[]);
      if (r.data) setReplays(r.data as Replay[]);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel("admin-monitoring")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "edge_devices" },
        (payload) => {
          setDevices((prev) => {
            if (payload.eventType === "DELETE") {
              return prev.filter((d) => d.id !== (payload.old as EdgeDevice).id);
            }
            const next = payload.new as EdgeDevice;
            const idx = prev.findIndex((d) => d.id === next.id);
            if (idx === -1) return [next, ...prev];
            const copy = [...prev];
            copy[idx] = next;
            return copy;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "replays" },
        (payload) => {
          setReplays((prev) => [payload.new as Replay, ...prev].slice(0, 20));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Tick a cada 10s para recalcular "online/offline" baseado em last_seen
  useEffect(() => {
    const t = setInterval(() => forceRerender((n) => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  const onlineCount = devices.filter((d) => isOnline(d.last_seen)).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900">Monitoramento</h1>
        <p className="text-sm text-gray-500 mt-1">
          Heartbeats dos Edge Devices e replays chegando em tempo real.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          icon={<Wifi className="h-5 w-5" />}
          label="Edges Online"
          value={loading ? "…" : `${onlineCount}/${devices.length}`}
          accent="from-emerald-500 to-emerald-600"
        />
        <SummaryCard
          icon={<HardDrive className="h-5 w-5" />}
          label="Total de Edges"
          value={loading ? "…" : devices.length.toString()}
          accent="from-brand-orange to-brand-yellow"
        />
        <SummaryCard
          icon={<Play className="h-5 w-5" />}
          label="Replays (últimos)"
          value={loading ? "…" : replays.length.toString()}
          accent="from-blue-500 to-blue-600"
        />
        <SummaryCard
          icon={<Activity className="h-5 w-5" />}
          label="Status"
          value="Ao vivo"
          accent="from-purple-500 to-purple-600"
          pulse
        />
      </div>

      {/* Edge Devices Table */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-brand-orange" />
            <h2 className="font-black uppercase tracking-tight text-gray-900">Edge Devices</h2>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            heartbeat &lt; 60s = online
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-500">
              <tr>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Nome</th>
                <th className="px-5 py-3 text-left">Hostname / IP</th>
                <th className="px-5 py-3 text-left">Versão</th>
                <th className="px-5 py-3 text-left">Uptime</th>
                <th className="px-5 py-3 text-left">Último heartbeat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {devices.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-400">
                    Nenhum Edge Device cadastrado ainda.
                  </td>
                </tr>
              )}
              {devices.map((d) => {
                const online = isOnline(d.last_seen);
                return (
                  <tr key={d.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          online
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                        {online ? "Online" : "Offline"}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-bold text-gray-900">{d.name}</td>
                    <td className="px-5 py-3 text-gray-600">
                      <div className="font-mono text-xs">{d.hostname || "—"}</div>
                      <div className="font-mono text-[11px] text-gray-400">{d.local_ip || "—"}</div>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-600">
                      {d.edge_version || "—"}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{formatUptime(d.uptime_seconds)}</td>
                    <td className="px-5 py-3 text-gray-500">
                      {d.last_seen
                        ? formatDistanceToNow(new Date(d.last_seen), {
                            addSuffix: true,
                            locale: ptBR,
                          })
                        : "Nunca"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Replays Feed */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Play className="h-5 w-5 text-brand-orange" />
          <h2 className="font-black uppercase tracking-tight text-gray-900">
            Replays Recentes
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          {replays.length === 0 && !loading && (
            <div className="px-5 py-8 text-center text-gray-400">
              Aguardando o primeiro replay chegar…
            </div>
          )}
          {replays.map((r) => (
            <div key={r.id} className="px-5 py-3 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
              <div className="h-10 w-10 rounded-lg brand-gradient flex items-center justify-center shrink-0">
                <Play className="h-4 w-4 text-white fill-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-xs text-gray-900 truncate">{r.id}</div>
                <div className="text-[11px] text-gray-500 flex items-center gap-3 mt-0.5">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                  <span>{r.duration_sec ? `${r.duration_sec}s` : "—"}</span>
                  <span>{formatBytes(r.file_size_bytes)}</span>
                </div>
              </div>
              {r.video_url && (
                <a
                  href={r.video_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] font-black uppercase tracking-widest text-brand-orange hover:underline shrink-0"
                >
                  Abrir
                </a>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  accent,
  pulse,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
  pulse?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 relative overflow-hidden">
      <div
        className={`absolute top-0 right-0 h-16 w-16 rounded-full bg-gradient-to-br ${accent} opacity-10 -translate-y-4 translate-x-4`}
      />
      <div className={`inline-flex items-center justify-center h-9 w-9 rounded-xl bg-gradient-to-br ${accent} text-white mb-2 ${pulse ? "animate-pulse" : ""}`}>
        {icon}
      </div>
      <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</div>
      <div className="text-2xl font-black text-gray-900 mt-0.5">{value}</div>
    </div>
  );
}
