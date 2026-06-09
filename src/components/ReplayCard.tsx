import { Download, Share2, Clock, Play, X } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";

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
      toast.success("Download iniciado!");
    } catch {
      window.open(replay.video_url, "_blank");
      onReward();
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
    } catch {
      /* user cancelled */
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="glass-card group relative aspect-[9/16] w-full overflow-hidden transition hover:scale-[1.03] hover:shadow-subtle"
      >
        <video
          src={`${replay.video_url}#t=3.0`}
          playsInline
          muted
          preload="metadata"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/5 opacity-100 transition group-hover:bg-black/20">
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
          <Dialog.Overlay className="fixed inset-0 z-50 bg-[#1A1008]/45 backdrop-blur-sm animate-in fade-in duration-300" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-[95vw] -translate-x-1/2 -translate-y-1/2 outline-none sm:max-w-md animate-in zoom-in-95 duration-300 bg-surface border border-border rounded-[20px] overflow-hidden">
            <div className="relative flex flex-col items-center">
              <div className="relative aspect-[9/16] w-full max-h-[75vh] overflow-hidden rounded-b-none bg-surface shadow-subtle ring-1 ring-border">
                <video
                  src={replay.video_url}
                  autoPlay
                  controls
                  playsInline
                  className="h-full w-full object-contain"
                  onPlay={onReward}
                />
                <Dialog.Close className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-[#F5F0EB] text-[#1A1008]/50 transition hover:bg-[#FFE8D6] active:scale-90 shadow-sm">
                  <X className="h-5 w-5" />
                </Dialog.Close>
              </div>

              <div className="flex w-full items-center justify-between gap-4 p-5 bg-surface border-t border-border shadow-subtle">
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-black text-brand-text">
                    {replay.quadras?.nome ?? "Quadra"}
                  </h3>
                  <p className="flex items-center gap-1.5 text-sm font-medium text-secondary">
                    <Clock className="h-3.5 w-3.5" />
                    {date} · {time}
                    {replay.quadras?.arenas?.nome && <span>· {replay.quadras.arenas.nome}</span>}
                  </p>
                </div>
                
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    onClick={handleShare}
                    className="grid h-12 w-12 place-items-center rounded-full border border-border bg-tag text-secondary transition hover:bg-tag/80 active:scale-90"
                  >
                    <Share2 className="h-5 w-5" />
                  </button>
                  <button
                    onClick={handleDownload}
                    className="bg-brand brand-glow grid h-12 w-12 place-items-center rounded-full text-white transition hover:scale-105 active:scale-95"
                  >
                    <Download className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
