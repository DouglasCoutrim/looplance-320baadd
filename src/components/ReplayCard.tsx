import { Download, Share2, Clock } from "lucide-react";
import { toast } from "sonner";

interface Replay {
  id: string;
  video_url: string;
  created_at: string;
  quadras?: { nome: string; arenas?: { nome: string } | null } | null;
}

export function ReplayCard({ replay, onReward }: { replay: Replay; onReward: () => void }) {
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
    <article className="glass-card overflow-hidden">
      <div className="relative aspect-video bg-black">
        <video
          src={replay.video_url}
          controls
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
          onPlay={onReward}
        />
      </div>
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-foreground">
            {replay.quadras?.nome ?? "Quadra"}
          </h3>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {date} · {time}
            {replay.quadras?.arenas?.nome && <span>· {replay.quadras.arenas.nome}</span>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={handleShare}
            aria-label="Compartilhar"
            className="grid h-10 w-10 place-items-center rounded-full border border-border bg-white/5 text-foreground transition hover:bg-white/10"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            onClick={handleDownload}
            aria-label="Download"
            className="brand-gradient brand-glow grid h-10 w-10 place-items-center rounded-full text-black transition hover:scale-105"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
