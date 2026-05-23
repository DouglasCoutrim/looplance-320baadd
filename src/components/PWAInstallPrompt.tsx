import React, { useEffect, useState } from 'react';
import { Download, Share, X, PlusSquare } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    // Check if it's iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    const handler = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Check if already installed
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
      if (!isStandalone) {
        setIsVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    
    if (isStandalone) {
      setIsVisible(false);
    } else if (ios && isMobile) {
      // For iOS, beforeinstallprompt doesn't fire, so we show it manually if on mobile and not standalone
      setIsVisible(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [isMobile]);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }

    if (!deferredPrompt) return;

    // Show the install prompt
    await deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      toast.success('Looplance está sendo instalado!');
      setIsVisible(false);
    }

    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
  };

  // Only show on mobile as requested
  if (!isMobile || !isVisible) return null;
  // For non-iOS, we only show if we have the deferredPrompt
  if (!isIOS && !deferredPrompt) return null;

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-[100] animate-in fade-in slide-in-from-bottom-full duration-700 bg-black/95 backdrop-blur-xl border-t border-white/10 p-5 pb-8 sm:pb-5">
        <div className="max-w-md mx-auto flex items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 bg-brand-orange rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-orange/20 ring-1 ring-white/20">
                <Download className="w-7 h-7" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse border-2 border-black" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-white text-lg tracking-tight">Instalar Looplance</h3>
              <p className="text-sm text-gray-400 font-medium truncate">Seus lances sempre à mão!</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              size="lg" 
              onClick={handleInstallClick} 
              className="bg-brand-orange hover:bg-brand-orange/90 text-white font-black px-6 h-12 rounded-2xl shadow-lg shadow-brand-orange/30 active:scale-95 transition-all border border-white/10"
            >
              {isIOS ? (
                <div className="flex items-center gap-2">
                  <Share className="w-5 h-5" />
                  <span>Instalar</span>
                </div>
              ) : 'Instalar'}
            </Button>
            <button 
              onClick={() => setIsVisible(false)}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white/40 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <Dialog open={showIOSInstructions} onOpenChange={setShowIOSInstructions}>
        <DialogContent className="bg-[#111] border-white/10 text-white sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-center mb-2">Instalar no iPhone/iPad</DialogTitle>
            <DialogDescription className="text-gray-400 text-center">
              Siga estes passos simples para adicionar o Looplance à sua tela de início:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-brand-orange flex items-center justify-center text-white font-bold shrink-0">1</div>
              <div className="flex-1">
                <p className="text-white font-bold mb-1">Toque no ícone de Compartilhar</p>
                <p className="text-gray-400 text-sm">Toque no ícone <Share className="inline-block w-4 h-4 mx-1" /> na parte inferior do Safari.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-brand-orange flex items-center justify-center text-white font-bold shrink-0">2</div>
              <div className="flex-1">
                <p className="text-white font-bold mb-1">Role para baixo</p>
                <p className="text-gray-400 text-sm">Procure e toque na opção "Adicionar à Tela de Início".</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-brand-orange flex items-center justify-center text-white font-bold shrink-0">3</div>
              <div className="flex-1">
                <p className="text-white font-bold mb-1">Confirme</p>
                <p className="text-gray-400 text-sm">Toque em "Adicionar" no canto superior direito.</p>
              </div>
            </div>
          </div>
          <Button 
            className="w-full bg-brand-orange hover:bg-brand-orange/90 text-white font-black h-12 rounded-xl"
            onClick={() => setShowIOSInstructions(false)}
          >
            Entendi
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}


