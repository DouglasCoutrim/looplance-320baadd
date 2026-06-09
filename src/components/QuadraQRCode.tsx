import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toPng } from "html-to-image";
import { Download, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface QuadraQRCodeProps {
  quadraId: string;
  quadraNome: string;
}

export function QuadraQRCode({ quadraId, quadraNome }: QuadraQRCodeProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const redirectUrl = `${window.location.origin}/?redirect_quadra=${quadraId}`;

  const downloadQRCode = async () => {
    if (!qrRef.current) return;

    try {
      const dataUrl = await toPng(qrRef.current, {
        cacheBust: true,
        backgroundColor: "#ffffff",
        style: {
          padding: "40px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        },
      });

      const link = document.createElement("a");
      link.download = `qrcode-looplance-${quadraNome.toLowerCase().replace(/\s+/g, "-")}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("QR Code baixado com sucesso!");
    } catch (err) {
      console.error("Erro ao gerar imagem:", err);
      toast.error("Erro ao baixar o QR Code");
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl text-muted hover:text-brand hover:bg-brand/5 transition-colors"
          title="Gerar QR Code"
        >
          <QrCode className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-2xl border border-border shadow-subtle bg-surface">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight text-primary">
            QR Code da Quadra
          </DialogTitle>
          <DialogDescription className="text-sm font-bold uppercase tracking-widest text-muted">
            Escaneie para acessar os replays de: {quadraNome}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center py-10 gap-8">
          <div
            ref={qrRef}
            className="p-6 bg-white rounded-3xl shadow-subtle border border-border flex flex-col items-center gap-4"
          >
            <QRCodeSVG value={redirectUrl} size={256} level="H" includeMargin={true} />
            <div className="text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-brand-text">
                Looplance Edge
              </p>
              <p className="text-xs font-bold text-primary uppercase">
                {quadraNome}
              </p>
            </div>
          </div>

          <div className="w-full space-y-4">
            <div className="p-4 bg-tag rounded-xl border border-border">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted mb-1">
                URL de Redirecionamento
              </p>
              <p className="text-xs font-mono text-secondary break-all select-all">
                {redirectUrl}
              </p>
            </div>

            <Button
              onClick={downloadQRCode}
              className="w-full bg-brand brand-glow text-white font-black uppercase tracking-widest h-12 rounded-xl transition-transform hover:scale-[1.02]"
            >
              <Download className="mr-2 h-5 w-5" /> Baixar Imagem (PNG)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
