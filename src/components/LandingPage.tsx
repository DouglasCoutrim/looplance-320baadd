import logoUrl from "@/assets/looplance-logo.png";
import { AuthForm } from "./AuthForm";
import { Sparkles, Play, Share2, Smartphone, ShieldCheck, Zap } from "lucide-react";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-brand selection:text-white">
      {/* Background patterns */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-10">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-brand blur-[120px] rounded-full animate-pulse-glow" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-brand blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8 pt-10 pb-24">
        {/* Navigation/Logo */}
        <header className="flex justify-center mb-16">
          <img src={logoUrl} alt="Looplance" className="h-44 sm:h-64 w-auto object-contain animate-in fade-in zoom-in duration-700" />
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Hero Content */}
          <div className="space-y-10 animate-in fade-in slide-in-from-left-8 duration-700">
            <div className="space-y-6">
              <h1 className="text-5xl sm:text-7xl font-black leading-[0.9] tracking-tighter uppercase">
                O SEU <span className="brand-text">REPLAY</span> <br />
                NA PALMA DA <span className="text-muted">MÃO.</span>
              </h1>
              <p className="text-xl text-secondary font-medium leading-relaxed max-w-lg italic">
                Reviva seus melhores momentos na quadra, baixe e compartilhe em tempo real com a tecnologia Looplance Edge.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6 pt-4">
              <div className="space-y-2 group">
                <div className="h-12 w-12 rounded-2xl bg-tag flex items-center justify-center text-brand group-hover:brand-gradient group-hover:text-white transition-all duration-300">
                  <Play className="h-6 w-6" />
                </div>
                <h3 className="font-black uppercase tracking-tight text-sm text-primary">Tempo Real</h3>
                <p className="text-xs text-muted leading-tight">Lances processados em segundos direto da quadra.</p>
              </div>
              <div className="space-y-2 group">
                <div className="h-12 w-12 rounded-2xl bg-tag flex items-center justify-center text-brand group-hover:brand-gradient group-hover:text-white transition-all duration-300">
                  <Share2 className="h-6 w-6" />
                </div>
                <h3 className="font-black uppercase tracking-tight text-sm text-primary">Fácil de Compartilhar</h3>
                <p className="text-xs text-muted leading-tight">Direto para o seu Instagram, WhatsApp ou Galeria.</p>
              </div>
              <div className="space-y-2 group">
                <div className="h-12 w-12 rounded-2xl bg-tag flex items-center justify-center text-brand group-hover:brand-gradient group-hover:text-white transition-all duration-300">
                  <Smartphone className="h-6 w-6" />
                </div>
                <h3 className="font-black uppercase tracking-tight text-sm text-primary">App Mobile First</h3>
                <p className="text-xs text-muted leading-tight">Interface otimizada para ser usada entre os sets.</p>
              </div>
              <div className="space-y-2 group">
                <div className="h-12 w-12 rounded-2xl bg-tag flex items-center justify-center text-brand group-hover:brand-gradient group-hover:text-white transition-all duration-300">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="font-black uppercase tracking-tight text-sm text-primary">Segurança</h3>
                <p className="text-xs text-muted leading-tight">Processamento local seguro e replays exclusivos.</p>
              </div>
            </div>

            <div className="pt-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-tag border border-border text-[10px] font-black uppercase tracking-widest text-brand-text">
                <Sparkles className="h-3 w-3 animate-pulse" />
                Looplance Edge v1.0 • O futuro do replay
              </div>
            </div>
          </div>

          {/* Login Column */}
          <div className="flex justify-center lg:justify-end animate-in fade-in slide-in-from-right-8 duration-700">
            <AuthForm />
          </div>
        </div>

        {/* Footer Propaganda */}
        <footer className="mt-32 pt-16 border-t border-border grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg brand-gradient flex items-center justify-center text-white">
                <Zap className="h-4 w-4" />
              </div>
              <span className="font-black uppercase tracking-tighter text-xl text-primary">LOOPLANCE</span>
            </div>
            <p className="text-sm text-muted leading-relaxed italic">
              Transformando a experiência do esporte amador através da tecnologia Edge AI.
            </p>
          </div>
          
          <div className="space-y-4 md:col-span-2 flex flex-col justify-center">
            <h4 className="text-xs font-black uppercase tracking-widest text-muted">Para Donos de Arena</h4>
            <div className="flex flex-wrap gap-4">
              <a href="#" className="px-6 py-3 rounded-xl bg-tag border border-border hover:bg-tag/80 transition text-sm font-bold text-primary">
                Levar para minha Arena
              </a>
              <a href="#" className="px-6 py-3 rounded-xl bg-tag border border-border hover:bg-tag/80 transition text-sm font-bold text-primary">
                Falar com Consultor
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
