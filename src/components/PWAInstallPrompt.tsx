import React, { useEffect, useState } from 'react';
import { X, Download } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

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

  useEffect(() => {
    const handler = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Check if user has already dismissed it in this session
      const dismissed = sessionStorage.getItem('pwa-prompt-dismissed');
      if (!dismissed) {
        setIsVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsVisible(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    await deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      toast.success('Looplance está sendo instalado!');
    } else {
      console.log('User dismissed the install prompt');
    }

    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  if (!isVisible || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-card border shadow-lg rounded-xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
            <Download className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Instalar Looplance</h3>
            <p className="text-xs text-muted-foreground">Acesse seus replays mais rápido!</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleInstallClick} className="whitespace-nowrap">
            Instalar
          </Button>
          <Button size="icon" variant="ghost" onClick={handleDismiss} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
