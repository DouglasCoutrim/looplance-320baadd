import { useState } from "react";
import logoUrl from "@/assets/looplance-logo.png";
import { AuthForm } from "./AuthForm";
import { 
  Play, 
  Share2, 
  Smartphone, 
  ShieldCheck, 
  ArrowRight, 
  Zap,
  Clock,
  Layout,
  Lock,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription
} from "@/components/ui/dialog";

export function LandingPage() {
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-brand-orange selection:text-white overflow-x-hidden">
      {/* Background patterns */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] left-[5%] w-[30%] h-[30%] bg-brand-orange/10 blur-[150px] rounded-full animate-pulse-glow" />
        <div className="absolute bottom-[20%] right-[10%] w-[25%] h-[25%] bg-brand-orange/5 blur-[120px] rounded-full" />
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
      </div>

      {/* Header */}
      <header className="relative z-50 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <img src={logoUrl} alt="Looplance" className="h-20 sm:h-28 w-auto object-contain" />
        </div>
        
        <Dialog open={isAuthOpen} onOpenChange={setIsAuthOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" className="text-white hover:bg-white/10 font-black uppercase tracking-widest text-xs h-10 px-6 rounded-xl border border-white/10 backdrop-blur-md">
              Fazer Login
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md p-0 overflow-hidden border-none bg-transparent shadow-none">
            <div className="relative">
              <button 
                onClick={() => setIsAuthOpen(false)}
                className="absolute right-4 top-4 z-50 text-gray-500 hover:text-gray-900 bg-white/10 hover:bg-white p-1 rounded-full transition-all"
              >
                <X className="h-5 w-5" />
              </button>
              <AuthForm />
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8 py-12 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">
          
          {/* Left Column: Copy & CTA */}
          <div className="space-y-12 animate-in fade-in slide-in-from-left-12 duration-1000">
            <div className="space-y-8">
              <h1 className="text-6xl sm:text-7xl lg:text-8xl font-black leading-[0.85] tracking-tighter uppercase">
                O SEU <br />
                <span className="brand-text">REPLAY</span> <br />
                <span className="text-white">NA PALMA DA MÃO.</span>
              </h1>
              <p className="text-xl text-gray-300 font-medium leading-relaxed max-w-lg">
                Reviva seus melhores momentos na quadra, baixe e compartilhe em tempo real com a tecnologia Looplance Edge.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <Button className="brand-gradient brand-glow text-white font-black uppercase tracking-widest px-8 h-14 rounded-2xl hover:scale-105 transition-all duration-300">
                Levar para minha Arena
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button variant="outline" className="border-white/20 bg-white/5 backdrop-blur-md text-white font-black uppercase tracking-widest px-8 h-14 rounded-2xl hover:bg-white/10 transition-all duration-300">
                Falar com Consultor
              </Button>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-2 gap-8 pt-8 border-t border-white/5">
              <div className="flex gap-4 group">
                <div className="h-10 w-10 shrink-0 rounded-xl bg-brand-orange/10 flex items-center justify-center text-brand-orange group-hover:brand-gradient group-hover:text-white transition-all duration-300">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black uppercase tracking-tight text-sm mb-1 text-white">Tempo Real</h3>
                  <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest leading-tight">Processado em segundos.</p>
                </div>
              </div>

              <div className="flex gap-4 group">
                <div className="h-10 w-10 shrink-0 rounded-xl bg-brand-orange/10 flex items-center justify-center text-brand-orange group-hover:brand-gradient group-hover:text-white transition-all duration-300">
                  <Share2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black uppercase tracking-tight text-sm mb-1 text-white">Compartilhar</h3>
                  <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest leading-tight">Direto para as redes.</p>
                </div>
              </div>

              <div className="flex gap-4 group">
                <div className="h-10 w-10 shrink-0 rounded-xl bg-brand-orange/10 flex items-center justify-center text-brand-orange group-hover:brand-gradient group-hover:text-white transition-all duration-300">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black uppercase tracking-tight text-sm mb-1 text-white">Mobile First</h3>
                  <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest leading-tight">Otimizado para o jogo.</p>
                </div>
              </div>

              <div className="flex gap-4 group">
                <div className="h-10 w-10 shrink-0 rounded-xl bg-brand-orange/10 flex items-center justify-center text-brand-orange group-hover:brand-gradient group-hover:text-white transition-all duration-300">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black uppercase tracking-tight text-sm mb-1 text-white">Segurança</h3>
                  <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest leading-tight">Processamento Edge.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Product Mockup */}
          <div className="relative animate-in fade-in slide-in-from-right-12 duration-1000 delay-300">
            {/* Ambient Glow */}
            <div className="absolute -inset-4 bg-brand-orange/20 blur-3xl rounded-[3rem] opacity-50" />
            
            {/* Phone Mockup */}
            <div className="relative mx-auto w-[280px] sm:w-[320px] aspect-[9/19.5] bg-zinc-900 rounded-[3rem] border-[8px] border-zinc-800 shadow-2xl overflow-hidden ring-1 ring-white/10 ring-inset">
              {/* Screen Content */}
              <div className="absolute inset-0 bg-[#0F1117] flex flex-col p-4">
                {/* Status Bar */}
                <div className="flex justify-between items-center mb-6 px-2">
                  <span className="text-[10px] font-bold">09:41</span>
                  <div className="flex gap-1">
                    <div className="h-2 w-2 rounded-full bg-white/20" />
                    <div className="h-2 w-2 rounded-full bg-white/20" />
                  </div>
                </div>

                {/* Video Player Mockup */}
                <div className="w-full aspect-[9/16] rounded-2xl bg-slate-900 relative overflow-hidden group mb-6 shadow-inner ring-1 ring-white/5">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
                  <div className="absolute inset-0 flex items-center justify-center z-20">
                    <div className="h-16 w-16 rounded-full brand-gradient flex items-center justify-center text-white shadow-xl group-hover:scale-110 transition-transform">
                      <Play className="h-8 w-8 fill-white" />
                    </div>
                  </div>
                  {/* Fake UI Overlay */}
                  <div className="absolute bottom-4 left-4 z-20">
                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-orange">Quadra 04 • Arena Cristal</p>
                    <p className="text-[8px] font-bold text-white/60">HÁ 2 MINUTOS</p>
                  </div>
                </div>

                {/* Bottom Stats/Actions */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                    <Share2 className="h-4 w-4 text-brand-orange" />
                  </div>
                  <div className="h-12 rounded-xl brand-gradient flex items-center justify-center">
                    <Smartphone className="h-4 w-4 text-white" />
                  </div>
                </div>
              </div>

              {/* Speaker/Camera Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 h-6 w-32 bg-zinc-800 rounded-b-2xl" />
            </div>

            {/* Floating Elements for Premium Feel */}
            <div className="absolute -top-10 -right-4 h-24 w-24 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center animate-bounce duration-[3000ms]">
               <Zap className="h-8 w-8 text-brand-orange" />
            </div>
            <div className="absolute bottom-20 -left-10 h-20 w-48 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-4 flex items-center gap-3 animate-pulse">
               <div className="h-10 w-10 rounded-full brand-gradient flex items-center justify-center shrink-0">
                 <Play className="h-5 w-5 text-white fill-white" />
               </div>
               <div>
                 <p className="text-[10px] font-black uppercase tracking-tight">Novo Replay!</p>
                 <p className="text-[8px] text-white/50">Processado com Edge AI</p>
               </div>
            </div>
          </div>
        </div>

        {/* Footer Propaganda */}
        <footer className="mt-24 pt-16 border-t border-white/5 grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg brand-gradient flex items-center justify-center text-white">
                <Zap className="h-4 w-4" />
              </div>
              <span className="font-black uppercase tracking-tighter text-xl">LOOPLANCE</span>
            </div>
            <p className="text-sm text-white/40 leading-relaxed italic">
              Transformando a experiência do esporte amador através da tecnologia Edge AI.
            </p>
          </div>
          
          <div className="md:col-span-2 flex flex-col justify-center space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-white/20">Expandindo o Ecossistema</h4>
            <div className="flex flex-wrap gap-4 text-[10px] font-black uppercase tracking-widest text-white/40">
              <span className="px-3 py-1 rounded-full border border-white/5">Looplance Edge</span>
              <span className="px-3 py-1 rounded-full border border-white/5">Instant Sharing</span>
              <span className="px-3 py-1 rounded-full border border-white/5">Premium Analytics</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
