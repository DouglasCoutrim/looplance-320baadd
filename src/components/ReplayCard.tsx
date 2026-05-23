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
        className="glass-card group relative aspect-[9/16] w-full overflow-hidden transition hover:scale-[1.02]"
      >
        <video
          src={`${replay.video_url}#t=3.0`}
          playsInline
          muted
          preload="metadata"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-100 transition group-hover:bg-black/40">
          <div className="brand-gradient grid h-10 w-10 place-items-center rounded-full text-black shadow-lg">
            <Play className="h-5 w-5 fill-black" />
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-left">
          <p className="truncate text-[9px] font-bold text-white">
            {replay.quadras?.nome ?? "Quadra"}
          </p>
          <p className="text-[8px] text-white/60">
            {date} · {time}
          </p>
        </div>
      </button>

      <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-[95vw] -translate-x-1/2 -translate-y-1/2 outline-none sm:max-w-md animate-in zoom-in-95 duration-200">
            <div className="relative flex flex-col items-center">
              <div className="relative aspect-[9/16] w-full max-h-[80vh] overflow-hidden rounded-2xl bg-black shadow-2xl">
                <video
                  src={replay.video_url}
                  autoPlay
                  controls
                  playsInline
                  className="h-full w-full object-contain"
                  onPlay={onReward}
                />
                <Dialog.Close className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur-md transition hover:bg-black/70">
                  <X className="h-5 w-5" />
                </Dialog.Close>
              </div>

              <div className="mt-6 flex w-full items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-bold text-white">
                    {replay.quadras?.nome ?? "Quadra"}
                  </h3>
                  <p className="flex items-center gap-1.5 text-xs text-white/60">
                    <Clock className="h-3 w-3" />
                    {date} · {time}
                    {replay.quadras?.arenas?.nome && <span>· {replay.quadras.arenas.nome}</span>}
                  </p>
                </div>
                
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={handleShare}
                    className="grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
                  >
                    <Share2 className="h-5 w-5" />
                  </button>
                  <button
                    onClick={handleDownload}
                    className="brand-gradient brand-glow grid h-12 w-12 place-items-center rounded-full text-black transition hover:scale-105 active:scale-95"
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
