import { Download, Clock, Play, X, MoreVertical, Flag } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Popover from "@radix-ui/react-popover";
import { supabase } from "@/integrations/supabase/client";
import { SocialActions } from "@/components/SocialActions";
import { ReportDialog, useIsReported } from "@/components/ReportDialog";

interface Replay {
  id: string;
  video_url: string;
  created_at: string;
  quadras?: { nome: string; arenas?: { nome: string } | null } | null;
}

export function ReplayCard({ replay, onReward }: { replay: Replay; onReward: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null)); }, []);
  const hidden = useIsReported(uid, "replay", replay.id);

  const time = new Date(replay.created_at).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const date = new Date(replay.created_at).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });

  const logAction = (action: string) => {
    supabase.rpc("log_user_action", {
      p_action: action,
      p_resource_type: "replay",
      p_resource_id: replay.id,
      p_metadata: { quadra: replay.quadras?.nome ?? null },
    });
  };

  const handleDownload = async () => {
    try {
      const res = await fetch(replay.video_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `looplance-${replay.id}.mp4`;
      a.click();
      URL.revokeObjectURL(url);
      onReward();
      logAction("download_replay");
      toast.success("Download iniciado!");
    } catch {
      window.open(replay.video_url, "_blank");
      onReward();
      logAction("download_replay");
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: "Looplance — Meu lance",
      text: `Olha esse lance na ${replay.quadras?.nome ?? "quadra"}!`,
      url: replay.video_url,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(replay.video_url);
        toast.success("Link copiado!");
      }
      logAction("share_replay");
    } catch {
      /* user cancelled */
    }
  };

  return (
    <>
      <div className={`glass-card group relative aspect-[9/16] w-full overflow-hidden transition hover:scale-[1.03] hover:shadow-md ${hidden ? "pointer-events-none" : ""}`}>
        <button
          onClick={() => setIsOpen(true)}
          className="absolute inset-0 z-0 w-full h-full text-left"
          aria-label="Abrir replay"
        >
          <video
            src={`${replay.video_url}#t=3.0`}
            playsInline
            muted
            preload="metadata"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-100 transition group-hover:bg-black/25">
            <div className="brand-gradient grid h-8 w-8 place-items-center rounded-full text-white shadow-lg transition-transform group-hover:scale-110">
              <Play className="h-4 w-4 fill-white" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-left">
            <p className="truncate text-[10px] font-bold text-white uppercase tracking-wider">
              {replay.quadras?.nome ?? "Quadra"}
            </p>
            <p className="text-[9px] font-medium text-white/80">
              {date} · {time}
            </p>
          </div>
        </button>

        <Popover.Root>
          <Popover.Trigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="absolute top-2 right-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/50 text-white backdrop-blur-md opacity-80 hover:opacity-100 hover:bg-black/70 transition"
              aria-label="Mais opções"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              side="bottom" align="end" sideOffset={6}
              className="z-[60] w-52 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/95 p-1.5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95"
            >
              <Popover.Close asChild>
                <button
                  onClick={() => setReportOpen(true)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-rose-300 hover:bg-zinc-800 transition"
                >
                  <Flag className="h-4 w-4" /> Denunciar conteúdo
                </button>
              </Popover.Close>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        {hidden && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-zinc-950/85 backdrop-blur-xl p-3 text-center">
            <p className="text-xs text-zinc-300">Conteúdo ocultado após sua denúncia.</p>
          </div>
        )}
      </div>

      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetId={replay.id} targetType="replay" />

      <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md animate-in fade-in duration-300" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-[95vw] -translate-x-1/2 -translate-y-1/2 outline-none sm:max-w-md animate-in zoom-in-95 duration-300">
            <div className="relative flex flex-col items-center">
              <div className="relative aspect-[9/16] w-full max-h-[75vh] overflow-hidden rounded-3xl bg-black shadow-2xl ring-1 ring-white/10">
                <video
                  src={replay.video_url}
                  autoPlay
                  controls
                  playsInline
                  className="h-full w-full object-contain"
                  onPlay={onReward}
                />
                <Dialog.Close className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md transition hover:bg-black/60 active:scale-90">
                  <X className="h-5 w-5" />
                </Dialog.Close>
              </div>

              <div className="mt-4 w-full rounded-3xl border border-zinc-800/60 bg-zinc-900/80 p-4 backdrop-blur-2xl shadow-xl">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-black text-white">
                      {replay.quadras?.nome ?? "Quadra"}
                    </h3>
                    <p className="flex items-center gap-1.5 text-sm font-medium text-zinc-400">
                      <Clock className="h-3.5 w-3.5" />
                      {date} · {time}
                      {replay.quadras?.arenas?.nome && <span>· {replay.quadras.arenas.nome}</span>}
                    </p>
                  </div>
                  <button
                    onClick={handleDownload}
                    className="brand-gradient brand-glow grid h-11 w-11 place-items-center rounded-full text-white transition hover:scale-105 active:scale-95 shrink-0"
                    aria-label="Baixar"
                  >
                    <Download className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-2 border-t border-zinc-800/60 pt-1">
                  <SocialActions
                    targetId={replay.id}
                    targetType="replay"
                    shareUrl={replay.video_url}
                    shareText={`Olha esse lance na ${replay.quadras?.nome ?? "quadra"}!`}
                  />
                </div>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
