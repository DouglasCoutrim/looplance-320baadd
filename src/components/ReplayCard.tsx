import { Download, Clock, Play, X } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { supabase } from "@/integrations/supabase/client";
import { SocialActions } from "@/components/SocialActions";

interface Replay {
  id: string;
  video_url: string;
  created_at: string;
  quadras?: { nome: string; arenas?: { nome: string } | null } | null;
}

export function ReplayCard({ replay, onReward }: { replay: Replay; onReward: () => void }) {
  const [isOpen, setIsOpen] = useState(false);

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
      <button 
        onClick={() => setIsOpen(true)}
        className="glass-card group relative aspect-[9/16] w-full overflow-hidden transition hover:scale-[1.03] hover:shadow-md"
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
