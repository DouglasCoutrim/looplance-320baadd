import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Activity,
  HardDrive,
  Play,
  Wifi,
  WifiOff,
  Clock,
  Cpu,
  MemoryStick,
  Thermometer,
  ArrowDownUp,
  Server,
} from "lucide-react";
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

function formatBps(bps: number | null) {
  if (bps == null) return "—";
  if (bps < 1024) return `${bps} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  if (bps < 1024 * 1024 * 1024) return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
  return `${(bps / (1024 * 1024 * 1024)).toFixed(2)} GB/s`;
}

function pctColor(v: number | null | undefined) {
  if (v == null) return "bg-gray-200";
  if (v >= 90) return "bg-red-500";
  if (v >= 75) return "bg-amber-500";
  if (v >= 50) return "bg-yellow-400";
  return "bg-emerald-500";
}

function tempColor(v: number | null | undefined) {
  if (v == null) return "text-gray-400";
  if (v >= 80) return "text-red-600";
  if (v >= 65) return "text-amber-600";
  return "text-emerald-600";
}

function MetricBar({ value, label }: { value: number | null; label: string }) {
  const v = value ?? 0;
  return (
    <div className="min-w-[110px]">
      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
        <span>{label}</span>
        <span className="text-gray-900">{value == null ? "—" : `${v.toFixed(0)}%`}</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full ${pctColor(value)} transition-all`}
          style={{ width: `${Math.min(100, Math.max(0, v))}%` }}
        />
      </div>
    </div>
  );
}


function DeviceGridCard({ device }: { device: EdgeDevice }) {
  const online = isOnline(device.last_seen);
  const [open, setOpen] = useState(false);

  return (
    <div className="relative group flex flex-col items-center gap-2 p-3 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-100 transition-colors">
      {/* Hover balloon (CSS only) */}
      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-60 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
        <div className="bg-gray-900 text-white rounded-xl shadow-xl p-3 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold truncate">{device.name}</span>
            <span className={`ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${online ? "bg-emerald-500/20 text-emerald-300" : "bg-gray-700 text-gray-400"}`}>
              {online ? <Wifi className="h-2.5 w-2.5" /> : <WifiOff className="h-2.5 w-2.5" />}
              {online ? "Online" : "Offline"}
            </span>
          </div>
          <div className="space-y-1">
            <MetricBar value={device.cpu_percent} label="CPU" />
            <MetricBar value={device.memory_percent} label="RAM" />
            <MetricBar value={device.disk_percent} label="Disco" />
          </div>
          <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
            <span>{device.local_ip || "—"}</span>
            <span>v{device.edge_version || "?"}</span>
          </div>
          {/* Arrow */}
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-gray-900 rotate-45" />
        </div>
      </div>

      {/* Click popover */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="flex flex-col items-center gap-1.5 w-full focus:outline-none">
            <div
              className={`relative flex items-center justify-center h-14 w-14 rounded-2xl transition-colors ${
                online
                  ? "bg-emerald-50 text-emerald-600 ring-2 ring-emerald-200"
                  : "bg-gray-100 text-gray-400 ring-2 ring-gray-200"
              }`}
            >
              <Server className="h-7 w-7" />
              {online && (
                <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
              )}
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-700 text-center leading-tight truncate w-full">
              {device.name}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" side="top" align="center">
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-gray-900">{device.name}</div>
                <div className="font-mono text-[11px] text-gray-500">{device.hostname || "—"}</div>
                <div className="font-mono text-[11px] text-gray-400">{device.local_ip || "—"}</div>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                  online ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                }`}
              >
                {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {online ? "Online" : "Offline"}
              </span>
            </div>

            <div className="space-y-2">
              <MetricBar value={device.cpu_percent} label="CPU" />
              {device.load_avg_1m != null && (
                <div className="text-[10px] text-gray-400 font-mono">load {device.load_avg_1m}</div>
              )}
              <MetricBar value={device.memory_percent} label="RAM" />
              {device.memory_total_mb && (
                <div className="text-[10px] text-gray-400 font-mono">
                  {device.memory_used_mb ?? 0}/{device.memory_total_mb} MB
                </div>
              )}
              <MetricBar value={device.disk_percent} label="Disco" />
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Temperatura</div>
                <div className={`text-lg font-black ${tempColor(device.temperature_c)}`}>
                  {device.temperature_c != null ? `${device.temperature_c}°C` : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Uptime</div>
                <div className="text-gray-900 font-bold">{formatUptime(device.uptime_seconds)}</div>
              </div>
            </div>

            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Rede</div>
              <div className="flex items-center gap-4 text-[11px] font-mono text-gray-700">
                <span className="text-emerald-600">↓ {formatBps(device.net_rx_bps)}</span>
                <span className="text-blue-600">↑ {formatBps(device.net_tx_bps)}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Heartbeat</div>
              <div className="text-xs text-gray-600">
                {device.last_seen
                  ? formatDistanceToNow(new Date(device.last_seen), {
                      addSuffix: true,
                      locale: ptBR,
                    })
                  : "Nunca"}
              </div>
              <div className="text-[10px] text-gray-400 font-mono mt-0.5">v{device.edge_version || "?"}</div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
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

      {/* Edge Devices Grid */}
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
        <div className="p-5">
          {devices.length === 0 && !loading && (
            <div className="text-center text-gray-400 py-8">
              Nenhum Edge Device cadastrado ainda.
            </div>
          )}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4">
            {devices.map((d) => (
              <DeviceGridCard key={d.id} device={d} />
            ))}
          </div>
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
