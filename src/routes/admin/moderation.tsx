import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Trash2, Check, MessageSquare, Play, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/moderation")({
  component: ModerationPage,
});

interface ReportRow {
  id: string;
  reporter_id: string;
  target_id: string;
  target_type: "replay" | "comment";
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  reporter?: { full_name: string | null; email: string | null } | null;
}

interface ContentSnapshot {
  kind: "replay" | "comment";
  videoUrl?: string;
  quadraName?: string;
  content?: string;
  authorName?: string;
  missing?: boolean;
}

function ModerationPage() {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, ContentSnapshot>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("reports")
      .select("id, reporter_id, target_id, target_type, reason, details, status, created_at, reporter:reporter_id(full_name, email)")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) { toast.error("Sem permissão ou erro ao carregar."); return; }
    const rows = (data ?? []).map((r: any) => ({ ...r, reporter: r.reporter })) as ReportRow[];
    setReports(rows);
    // Fetch snapshots
    const snaps: Record<string, ContentSnapshot> = {};
    await Promise.all(rows.map(async (r) => {
      if (r.target_type === "replay") {
        const { data: rep } = await supabase.from("replays")
          .select("id, video_url, quadras(nome)")
          .eq("id", r.target_id).maybeSingle();
        snaps[r.id] = rep
          ? { kind: "replay", videoUrl: (rep as any).video_url, quadraName: (rep as any).quadras?.nome }
          : { kind: "replay", missing: true };
      } else {
        const { data: com } = await supabase.from("comments")
          .select("id, content, profiles:user_id(full_name)")
          .eq("id", r.target_id).maybeSingle();
        snaps[r.id] = com
          ? { kind: "comment", content: (com as any).content, authorName: (com as any).profiles?.full_name }
          : { kind: "comment", missing: true };
      }
    }));
    setSnapshots(snaps);
  };

  useEffect(() => { load(); }, []);

  const dismiss = async (r: ReportRow) => {
    setBusy(r.id);
    const { error } = await supabase.from("reports")
      .update({ status: "dismissed", reviewed_at: new Date().toISOString() })
      .eq("id", r.id);
    setBusy(null);
    if (error) { toast.error("Erro ao dispensar"); return; }
    setReports((rs) => rs.filter((x) => x.id !== r.id));
    toast.success("Denúncia dispensada.");
  };

  const removeContent = async (r: ReportRow) => {
    setBusy(r.id);
    const { error: delErr } = r.target_type === "comment"
      ? await supabase.from("comments").delete().eq("id", r.target_id)
      : await supabase.from("replays").delete().eq("id", r.target_id);
    if (delErr) { setBusy(null); toast.error("Erro ao remover conteúdo"); return; }
    const { error } = await supabase.from("reports")
      .update({ status: "reviewed", reviewed_at: new Date().toISOString() })
      .eq("id", r.id);
    setBusy(null);
    if (error) { toast.error("Conteúdo removido, mas erro ao marcar denúncia"); return; }
    setReports((rs) => rs.filter((x) => x.id !== r.id));
    toast.success("Conteúdo removido.");
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/30">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Moderação</h1>
            <p className="text-xs text-zinc-500">Denúncias pendentes</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-zinc-500" /></div>
        ) : reports.length === 0 ? (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-10 text-center text-zinc-500">
            Nenhuma denúncia pendente.
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => {
              const s = snapshots[r.id];
              return (
                <div key={r.id} className="rounded-2xl border border-zinc-800/70 bg-zinc-900/60 p-4">
                  <div className="flex items-start gap-3">
                    <div className={`grid h-9 w-9 place-items-center rounded-xl ring-1 ${r.target_type === "replay" ? "bg-orange-500/10 text-orange-400 ring-orange-500/30" : "bg-sky-500/10 text-sky-400 ring-sky-500/30"}`}>
                      {r.target_type === "replay" ? <Play className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-sm font-semibold text-white">{r.reason}</span>
                        <span className="text-[11px] text-zinc-500">
                          {new Date(r.created_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Denunciado por {r.reporter?.full_name || r.reporter?.email || "usuário"}
                      </p>
                      {r.details && (
                        <p className="mt-2 text-sm text-zinc-300 whitespace-pre-wrap">{r.details}</p>
                      )}

                      <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                        {!s ? (
                          <p className="text-xs text-zinc-500">Carregando conteúdo…</p>
                        ) : s.missing ? (
                          <p className="text-xs text-zinc-500 italic">Conteúdo original não encontrado (já removido).</p>
                        ) : s.kind === "replay" ? (
                          <div className="flex flex-col sm:flex-row gap-3">
                            <video
                              src={s.videoUrl}
                              controls
                              playsInline
                              className="w-full sm:w-48 aspect-[9/16] rounded-lg bg-black object-cover"
                            />
                            <div className="text-xs text-zinc-400">
                              <p className="text-zinc-200 font-medium">{s.quadraName ?? "Quadra"}</p>
                              <p className="text-[11px] text-zinc-500 mt-1 break-all">ID: {r.target_id}</p>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <p className="text-[11px] text-zinc-500">Comentário de {s.authorName ?? "usuário"}</p>
                            <p className="mt-1 text-sm text-zinc-100 whitespace-pre-wrap break-words">"{s.content}"</p>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => dismiss(r)}
                          disabled={busy === r.id}
                          className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-60 transition"
                        >
                          <Check className="h-4 w-4" /> Ignorar denúncia
                        </button>
                        <button
                          onClick={() => removeContent(r)}
                          disabled={busy === r.id}
                          className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-3 py-2 text-sm font-semibold text-white shadow-[0_0_20px_rgba(244,63,94,0.25)] hover:bg-rose-400 disabled:opacity-60 transition"
                        >
                          <Trash2 className="h-4 w-4" /> Remover conteúdo
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
