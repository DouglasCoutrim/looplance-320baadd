import { useState, useEffect } from "react";
import logoUrl from "@/assets/looplance-logo.png";
import { AuthForm } from "./AuthForm";
import { 
  Play, 
  Share2, 
  Smartphone, 
  ShieldCheck, 
  ArrowRight, 
  Zap,
  X,
  Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogTrigger,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function LandingPage() {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [showStickyCTA, setShowStickyCTA] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowStickyCTA(window.scrollY > 500);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white selection:bg-[#F97316] selection:text-white overflow-x-hidden pb-20">
      
      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 bg-[#0A0A0A]/80 backdrop-blur-md border-b border-[#222]">
        <div className="px-5 py-4 flex items-center justify-between">
          <img src={logoUrl} alt="Looplance" className="h-10 w-auto" />
          
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[40vh] bg-[#0A0A0A] border-t border-[#222]">
              <div className="flex flex-col gap-4 mt-8 px-5">
                <Button variant="ghost" className="justify-start text-lg">Produto</Button>
                <Button variant="ghost" className="justify-start text-lg">Arena</Button>
                <Button onClick={() => setIsAuthOpen(true)} className="w-full h-[52px] rounded-[14px] bg-[#F97316] text-white font-bold">Começar grátis</Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      {/* HERO SECTION */}
      <main className="px-5 pt-12 pb-16">
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 bg-[#111] px-4 py-2 rounded-full mb-6 border border-[#222]">
            <Zap className="h-4 w-4 text-[#F97316]" />
            <span className="text-sm">Tecnologia Edge AI • Tempo real</span>
          </div>

          <h1 className="text-[42px] font-black leading-[1.1] italic tracking-tighter mb-4">
            O seu <span className="text-[#F97316]">Replay</span><br/> na palma da mão.
          </h1>
          
          <p className="text-[17px] text-white/70 mb-8 max-w-[300px]">
            Reviva seus momentos na quadra com tecnologia de processamento instantâneo.
          </p>

          <div className="relative w-full max-w-[300px] aspect-[9/18] mx-auto mb-10">
            <div className="absolute inset-0 bg-[#F97316]/20 blur-[60px] rounded-full animate-pulse" />
            <div className="relative w-full h-full bg-[#111] rounded-[40px] border-4 border-[#222] overflow-hidden">
               <div className="absolute inset-0 flex items-center justify-center">
                  <Play className="h-16 w-16 text-white fill-white/20" />
               </div>
            </div>
          </div>

          <div className="w-full space-y-3">
            <Button className="w-full h-[52px] rounded-[14px] bg-[#F97316] text-white font-bold text-base">Começar agora →</Button>
            <Button variant="outline" className="w-full h-[52px] rounded-[14px] border-white/20 text-white font-bold text-base">Falar com consultor</Button>
          </div>
          <p className="text-xs text-white/50 mt-4">Grátis para testar • Sem cartão</p>
        </div>
      </main>

      {/* STICKY CTA */}
      {showStickyCTA && (
        <div className="fixed bottom-0 left-0 right-0 z-100 bg-[#0A0A0A] border-t border-[#F97316]/20 p-4 pb-8">
          <Button className="w-full h-[52px] rounded-[14px] bg-[#F97316] text-white font-bold text-base">Começar grátis</Button>
        </div>
      )}

      {/* Auth Modal */}
      <Dialog open={isAuthOpen} onOpenChange={setIsAuthOpen}>
        <DialogContent className="p-0 border-none bg-transparent">
          <AuthForm />
        </DialogContent>
      </Dialog>
    </div>
  );
}