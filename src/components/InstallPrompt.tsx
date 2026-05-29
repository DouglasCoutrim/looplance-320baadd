import { useState, useEffect } from "react";
import { Smartphone, X, Download } from "lucide-react";
import { Button } from "./ui/button";

export function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Check if already installed or dismissed
    const isDismissed = localStorage.getItem("install-prompt-dismissed");
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || 
                        (window.navigator as any).standalone;

    if (isStandalone || isDismissed) return;

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Fallback for iOS or if beforeinstallprompt isn't supported/fired yet
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIOS && !isStandalone && !isDismissed) {
      // Small delay to ensure UI is ready
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => {
        window.removeEventListener("beforeinstallprompt", handler);
        clearTimeout(timer);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    } else {
      // iOS fallback or generic instructions
      alert("Para instalar:\n1. Toque no ícone de compartilhar\n2. Role para baixo e toque em 'Adicionar à Tela de Início'");
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("install-prompt-dismissed", "true");
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-6 left-4 right-4 z-[100] animate-in slide-in-from-bottom-8 duration-500 sm:left-auto sm:right-6 sm:max-w-sm">
      <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-[#1A1C3A]/90 p-5 shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
        <button
          onClick={handleDismiss}
          className="absolute right-3 top-3 p-2 text-white/40 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-4">
          <div className="brand-gradient flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-lg brand-glow">
            <Smartphone className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1 pr-6">
            <h3 className="text-base font-black text-white leading-tight uppercase tracking-tight">
              Instale o <span className="brand-text">Looplance</span>
            </h3>
            <p className="mt-1 text-xs font-medium text-white/70 leading-relaxed">
              Acesse seus lances mais rápido direto da tela inicial.
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button
            onClick={handleInstall}
            className="flex-1 brand-gradient brand-glow text-white font-black uppercase tracking-widest text-[10px] h-10 rounded-xl"
          >
            <Download className="mr-2 h-3.5 w-3.5" /> Instalar agora
          </Button>
          <Button
            variant="ghost"
            onClick={handleDismiss}
            className="flex-1 text-white/60 hover:text-white hover:bg-white/5 font-bold uppercase tracking-widest text-[10px] h-10 rounded-xl"
          >
            Agora não
          </Button>
        </div>
      </div>
    </div>
  );
}
