import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { deleteReplay, deleteReplaysBulk } from "@/lib/replay-admin.functions";
import { toast } from "sonner";
import { Play, Trash2, Clock, Filter } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/admin/replays")({
  component: ReplaysAdminPage,
});

type Arena = { id: string; nome: string };
type Quadra = { id: string; nome: string; arena_id: string };
type ReplayRow = {
  id: string;
  arena_id: string | null;
  quadra_id: string | null;
  video_url: string | null;
  r2_key: string | null;
  duration_sec: number | null;
  file_size_bytes: number | null;
  created_at: string;
};

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function ReplaysAdminPage() {
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [replays, setReplays] = useState<ReplayRow[]>([]);
  const [arenaId, setArenaId] = useState<string>("");
  const [quadraId, setQuadraId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const delOne = useServerFn(deleteReplay);
  const delBulk = useServerFn(deleteReplaysBulk);

  // Load arenas & quadras once
  useEffect(() => {
    (async () => {
      const [a, q] = await Promise.all([
        supabase.from("arenas").select("id, nome").order("nome"),
        supabase.from("quadras").select("id, nome, arena_id").order("nome"),
      ]);
      if (a.data) setArenas(a.data as Arena[]);
      if (q.data) setQuadras(q.data as Quadra[]);
    })();
  }, []);

  // Load replays whenever filters change
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      let q = supabase
        .from("replays")
        .select("id, arena_id, quadra_id, video_url, r2_key, duration_sec, file_size_bytes, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (arenaId) q = q.eq("arena_id", arenaId);
      if (quadraId) q = q.eq("quadra_id", quadraId);
      const { data } = await q;
      if (!mounted) return;
      setReplays((data ?? []) as ReplayRow[]);
      setSelected(new Set());
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [arenaId, quadraId]);

  const quadrasFiltered = useMemo(
    () => (arenaId ? quadras.filter((q) => q.arena_id === arenaId) : quadras),
    [quadras, arenaId],
  );

  const arenaName = (id: string | null) => arenas.find((a) => a.id === id)?.nome ?? "—";
  const quadraName = (id: string | null) => quadras.find((q) => q.id === id)?.nome ?? "—";

  const allChecked = replays.length > 0 && selected.size === replays.length;
  const toggleAll = () => {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(replays.map((r) => r.id)));
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleDeleteOne = async (id: string) => {
    if (!confirm("Apagar este replay? Ele será removido do R2 e do banco.")) return;
    setBusy(true);
    try {
      await delOne({ data: { replay_id: id } });
      setReplays((prev) => prev.filter((r) => r.id !== id));
      setSelected((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      toast.success("Replay apagado");
    } catch (err) {
      toast.error(`Falha ao apagar: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteBulk = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Apagar ${selected.size} replay(s)? Serão removidos do R2 e do banco.`)) return;
    setBusy(true);
    try {
      const ids = Array.from(selected);
      const res = await delBulk({ data: { replay_ids: ids } });
      setReplays((prev) => prev.filter((r) => !selected.has(r.id)));
      setSelected(new Set());
      toast.success(`Apagados: ${res.deleted} · Falhas: ${res.failed}`);
    } catch (err) {
      toast.error(`Falha ao apagar em massa: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900">Replays</h1>
          <p className="text-sm text-gray-500 mt-1">
            Filtre por arena e quadra. Apague um ou vários — remove do R2 e do banco.
          </p>
        </div>
        <button
          onClick={handleDeleteBulk}
          disabled={selected.size === 0 || busy}
          className="inline-flex items-center gap-2 rounded-xl bg-red-600 text-white px-4 py-2.5 text-sm font-black uppercase tracking-tight shadow hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <Trash2 className="h-4 w-4" />
          Apagar selecionados ({selected.size})
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex items-center gap-2 text-brand-orange">
          <Filter className="h-4 w-4" />
          <span className="text-[10px] font-black uppercase tracking-widest">Filtros</span>
        </div>
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Arena</span>
            <select
              value={arenaId}
              onChange={(e) => {
                setArenaId(e.target.value);
                setQuadraId("");
              }}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Todas</option>
              {arenas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Quadra</span>
            <select
              value={quadraId}
              onChange={(e) => setQuadraId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Todas</option>
              {quadrasFiltered.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.nome}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3 text-xs font-black uppercase tracking-widest text-gray-500">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={toggleAll}
            className="h-4 w-4 accent-brand-orange"
          />
          <span className="flex-1">
            {loading ? "Carregando…" : `${replays.length} replay(s)`}
          </span>
        </div>

        {!loading && replays.length === 0 && (
          <div className="px-5 py-10 text-center text-gray-400">Nenhum replay encontrado.</div>
        )}

        <div className="divide-y divide-gray-100">
          {replays.map((r) => (
            <div
              key={r.id}
              className={`px-5 py-3 flex items-center gap-4 transition-colors ${
                selected.has(r.id) ? "bg-brand-orange/5" : "hover:bg-gray-50/50"
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(r.id)}
                onChange={() => toggleOne(r.id)}
                className="h-4 w-4 accent-brand-orange"
              />
              <div className="h-10 w-10 rounded-lg brand-gradient flex items-center justify-center shrink-0">
                <Play className="h-4 w-4 text-white fill-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-black text-sm text-gray-900 truncate">
                  {arenaName(r.arena_id)} · {quadraName(r.quadra_id)}
                </div>
                <div className="text-[11px] text-gray-500 flex items-center gap-3 mt-0.5">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                  <span>{r.duration_sec ? `${r.duration_sec}s` : "—"}</span>
                  <span>{formatBytes(r.file_size_bytes)}</span>
                  <span className="font-mono truncate max-w-[220px]">{r.id}</span>
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
              <button
                onClick={() => handleDeleteOne(r.id)}
                disabled={busy}
                title="Apagar replay (R2 + banco)"
                className="shrink-0 grid h-9 w-9 place-items-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
