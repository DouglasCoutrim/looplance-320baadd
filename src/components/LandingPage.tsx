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
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogTrigger,
} from "@/components/ui/dialog";

export function LandingPage() {
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0A0B14] text-white selection:bg-brand-orange selection:text-white overflow-x-hidden">
      {/* Background patterns */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-5%] w-[50%] h-[50%] bg-brand-orange/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[0%] right-[-5%] w-[40%] h-[40%] bg-brand-orange/5 blur-[100px] rounded-full" />
      </div>

      {/* Header com Logo em Destaque */}
      <header className="relative z-50 flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
        <div className="flex-1">
          {/* Espaçador para equilibrar o layout se necessário */}
        </div>
        
        <div className="flex-none">
          <img 
            src={logoUrl} 
            alt="Looplance" 
            className="h-32 sm:h-48 md:h-56 w-auto object-contain drop-shadow-[0_0_30px_rgba(255,102,0,0.2)]" 
          />
        </div>

        <div className="flex-1 flex justify-end">
          <Dialog open={isAuthOpen} onOpenChange={setIsAuthOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" className="text-white hover:bg-white/10 font-black uppercase tracking-widest text-xs h-12 px-8 rounded-xl border border-white/10 backdrop-blur-md transition-all hover:border-brand-orange/50">
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
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8 pt-8 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20 items-center">
          
          {/* LADO ESQUERDO: Copy e Features */}
          <div className="space-y-12 animate-in fade-in slide-in-from-left-8 duration-1000">
            <div className="space-y-6">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[0.9] tracking-tighter uppercase italic">
                O SEU <span className="brand-text">REPLAY</span> <br />
                <span className="text-white">NA PALMA DA MÃO.</span>
              </h1>
              <p className="text-lg text-gray-300 font-medium leading-relaxed max-w-lg">
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

            {/* Grid de Features 2x2 */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-10 pt-10 border-t border-white/10">
              <div className="flex flex-col gap-3 group">
                <div className="h-12 w-12 rounded-2xl bg-brand-orange/10 flex items-center justify-center text-brand-orange group-hover:brand-gradient group-hover:text-white transition-all duration-300 shadow-[0_0_20px_rgba(255,102,0,0.1)]">
                  <Zap className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-black uppercase tracking-tight text-sm text-white">Tempo Real</h3>
                  <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest leading-tight mt-1">Lances processados em segundos.</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 group">
                <div className="h-12 w-12 rounded-2xl bg-brand-orange/10 flex items-center justify-center text-brand-orange group-hover:brand-gradient group-hover:text-white transition-all duration-300 shadow-[0_0_20px_rgba(255,102,0,0.1)]">
                  <Share2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-black uppercase tracking-tight text-sm text-white">Compartilhar</h3>
                  <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest leading-tight mt-1">Envie para redes sociais na hora.</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 group">
                <div className="h-12 w-12 rounded-2xl bg-brand-orange/10 flex items-center justify-center text-brand-orange group-hover:brand-gradient group-hover:text-white transition-all duration-300 shadow-[0_0_20px_rgba(255,102,0,0.1)]">
                  <Smartphone className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-black uppercase tracking-tight text-sm text-white">Mobile First</h3>
                  <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest leading-tight mt-1">Otimizado para smartphones.</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 group">
                <div className="h-12 w-12 rounded-2xl bg-brand-orange/10 flex items-center justify-center text-brand-orange group-hover:brand-gradient group-hover:text-white transition-all duration-300 shadow-[0_0_20px_rgba(255,102,0,0.1)]">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-black uppercase tracking-tight text-sm text-white">Segurança</h3>
                  <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest leading-tight mt-1">Privacidade e controle total.</p>
                </div>
              </div>
            </div>
          </div>

          {/* LADO DIREITO: Mockup do Produto */}
          <div className="relative flex justify-center animate-in fade-in slide-in-from-right-8 duration-1000 delay-200">
            {/* Brilho Laranja de Fundo */}
            <div className="absolute -inset-10 bg-brand-orange/20 blur-[100px] rounded-full opacity-40 animate-pulse" />
            
            {/* Smartphone Frame */}
            <div className="relative w-[280px] sm:w-[320px] aspect-[9/19] bg-[#0F1117] rounded-[3rem] border-[10px] border-[#1A1C25] shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden ring-1 ring-white/10">
              {/* Screen Content */}
              <div className="absolute inset-0 flex flex-col pt-10 px-4">
                {/* Mockup Header */}
                <div className="flex items-center justify-between mb-8 px-2">
                  <div className="h-6 w-20 bg-white/5 rounded-full" />
                  <div className="h-6 w-6 rounded-full bg-white/5" />
                </div>

                {/* Player Mockup */}
                <div className="w-full aspect-[9/16] rounded-2xl bg-[#050505] relative overflow-hidden shadow-2xl ring-1 ring-white/10">
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/60 to-transparent">
                    <div className="h-16 w-16 rounded-full brand-gradient flex items-center justify-center text-white shadow-[0_0_30px_rgba(255,102,0,0.3)] hover:scale-110 transition-transform cursor-pointer">
                      <Play className="h-8 w-8 fill-white" />
                    </div>
                  </div>
                  
                  {/* Fake UI Items */}
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="h-3 w-2/3 bg-brand-orange/40 rounded-full mb-2" />
                    <div className="h-2 w-1/3 bg-white/10 rounded-full" />
                  </div>
                </div>

                {/* Mockup Actions */}
                <div className="mt-6 flex justify-around">
                   <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center"><Share2 className="h-5 w-5 text-gray-400" /></div>
                   <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center"><Smartphone className="h-5 w-5 text-gray-400" /></div>
                   <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center"><Zap className="h-5 w-5 text-brand-orange" /></div>
                </div>
              </div>

              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 h-7 w-32 bg-[#1A1C25] rounded-b-3xl" />
            </div>

            {/* Elemento Decorativo Flutuante */}
            <div className="absolute -bottom-6 -right-6 lg:-right-10 bg-[#1A1C25] border border-white/10 p-5 rounded-3xl shadow-2xl backdrop-blur-xl animate-float">
               <div className="flex items-center gap-4">
                 <div className="h-12 w-12 rounded-2xl brand-gradient flex items-center justify-center text-white">
                   <Play className="h-6 w-6 fill-white" />
                 </div>
                 <div>
                   <p className="text-xs font-black uppercase tracking-widest text-white">Replay Pronto!</p>
                   <p className="text-[10px] font-bold text-brand-orange uppercase">Assistir agora</p>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Minimalista */}
      <footer className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8 py-12 border-t border-white/5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3">
             <div className="h-8 w-8 rounded-lg brand-gradient flex items-center justify-center text-white">
               <Zap className="h-4 w-4" />
             </div>
             <span className="font-black uppercase tracking-tighter text-xl">LOOPLANCE</span>
          </div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            © 2026 Looplance Edge AI. Todos os direitos reservados.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-xs font-bold text-gray-400 hover:text-white transition-colors uppercase tracking-widest">Privacidade</a>
            <a href="#" className="text-xs font-bold text-gray-400 hover:text-white transition-colors uppercase tracking-widest">Termos</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
