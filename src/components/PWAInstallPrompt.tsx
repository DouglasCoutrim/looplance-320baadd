import React, { useEffect, useState } from 'react';
import { Download, Share } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';

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
      setIsVisible(true);
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
      toast.info('Para instalar: toque no ícone de compartilhar e depois em "Adicionar à Tela de Início"', {
        duration: 5000,
      });
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
    <div className="fixed bottom-0 left-0 right-0 z-[100] animate-in fade-in slide-in-from-bottom-full duration-500 bg-black/95 backdrop-blur-md border-t border-white/10 p-4 pb-safe-offset-4">
      <div className="max-w-md mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
            <Download className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white text-base truncate">Instalar Looplance</h3>
            <p className="text-sm text-gray-400 truncate">Acesse seus replays instantaneamente!</p>
          </div>
        </div>
        
        <Button 
          size="lg" 
          onClick={handleInstallClick} 
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 h-12 rounded-full shadow-lg shadow-primary/30 active:scale-95 transition-transform"
        >
          {isIOS ? (
            <div className="flex items-center gap-2">
              <Share className="w-4 h-4" />
              <span>Como instalar</span>
            </div>
          ) : 'Instalar'}
        </Button>
      </div>
    </div>
  );
}

