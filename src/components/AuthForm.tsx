import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Mail, Lock, Loader2, ArrowRight, ShieldCheck } from "lucide-react";

export function AuthForm() {
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSignUp && !consentAccepted) {
      toast.error("Você deve concordar com o termo de consentimento.");
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              consent_accepted: true,
              consent_timestamp: new Date().toISOString(),
            }
          }
        });
        if (error) throw error;
        toast.success("Cadastro realizado! Verifique seu e-mail.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Bem-vindo de volta!");
      }
    } catch (error: any) {
      toast.error(error.message || "Erro na autenticação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6 p-8 glass-card">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-black uppercase tracking-tight text-primary">
          {isSignUp ? "Criar Conta" : "Fazer Login"}
        </h2>
        <p className="text-secondary text-sm font-medium uppercase tracking-widest">
          {isSignUp ? "Junte-se à comunidade Looplance" : "Acesse seus lances favoritos"}
        </p>
      </div>

      <form onSubmit={handleAuth} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-secondary">E-mail</Label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <Input
              id="email"
              type="email"
              placeholder="exemplo@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="pl-12 rounded-xl border-border bg-input h-12 focus:ring-brand"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-secondary">Senha</Label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="pl-12 rounded-xl border-border bg-input h-12 focus:ring-brand"
            />
          </div>
        </div>

        {isSignUp && (
          <div className="flex items-start space-x-3 p-4 bg-input rounded-xl border border-border animate-in fade-in slide-in-from-top-2">
            <Checkbox 
              id="consent" 
              checked={consentAccepted}
              onCheckedChange={(checked) => setConsentAccepted(checked as boolean)}
              className="mt-1 border-border data-[state=checked]:bg-brand data-[state=checked]:border-brand"
            />
            <div className="grid gap-1.5 leading-none">
              <label
                htmlFor="consent"
                className="text-xs font-medium text-secondary cursor-pointer"
              >
                Li e concordo com o{" "}
                <Dialog>
                  <DialogTrigger asChild>
                    <button type="button" className="text-brand font-bold hover:underline">
                      Termo de Consentimento e Uso de Imagem
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2 text-brand-text">
                        <ShieldCheck className="h-5 w-5 text-brand" />
                        Termo de Consentimento
                      </DialogTitle>
                      <DialogDescription className="font-bold text-xs uppercase tracking-widest text-brand-text/60">
                        Looplance • Segurança e Privacidade
                      </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4 space-y-4 text-sm leading-relaxed text-secondary text-justify">
                      <p className="font-black text-primary uppercase italic">TERMO DE CONSENTIMENTO E AUTORIZAÇÃO DE USO DE IMAGEM E VOZ</p>
                      <p>Pelo presente instrumento, o USUÁRIO, ao se cadastrar e utilizar o sistema de replays esportivos Looplance nas dependências da ARENA PARCEIRA, declara ciência e concorda expressamente com os termos:</p>
                      <ol className="list-decimal pl-5 space-y-3">
                        <li><span className="font-bold text-primary">DA AUTORIZAÇÃO DE CAPTAÇÃO:</span> O USUÁRIO autoriza, de forma gratuita, livre e espontânea, a captação de sua imagem, voz e performance esportiva.</li>
                        <li><span className="font-bold text-primary">DA DISPONIBILIZAÇÃO:</span> O USUÁRIO autoriza que os vídeos gerados sejam disponibilizados na plataforma Looplance, podendo ser acessados, baixados e compartilhados por outros usuários da mesma partida.</li>
                        <li><span className="font-bold text-primary">DA ISENÇÃO DE RESPONSABILIDADE:</span> A ARENA e a plataforma LOOPLANCE ficam integralmente isentas de qualquer responsabilidade civil ou criminal decorrente do mau uso, edição, montagem ou compartilhamento indevido dos vídeos por parte de terceiros após o download.</li>
                        <li><span className="font-bold text-primary">DA PRIVACIDADE:</span> O tratamento de dados (nome, e-mail, telefone e imagem) ocorre estritamente para a prestação do serviço de replays, não sendo comercializados para terceiros.</li>
                        <li>Fica eleito o foro da Comarca de Cristalina, Estado de Goiás, para dirimir eventuais dúvidas.</li>
                      </ol>
                    </div>
                    <DialogFooter className="mt-6">
                      <Button 
                        type="button" 
                        onClick={() => {
                          setConsentAccepted(true);
                        }}
                        className="brand-gradient text-white font-black uppercase tracking-widest w-full sm:w-auto"
                      >
                        Aceitar e Continuar
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </label>
            </div>
          </div>
        )}

        <Button
          type="submit"
          disabled={loading || (isSignUp && !consentAccepted)}
          className={`w-full brand-glow text-white font-black uppercase tracking-widest h-14 rounded-xl transition-all ${
            (isSignUp && !consentAccepted) ? 'bg-gray-300 cursor-not-allowed opacity-50' : 'brand-gradient hover:scale-[1.02]'
          }`}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              {isSignUp ? "Cadastrar" : "Entrar"}
              <ArrowRight className="ml-2 h-5 w-5" />
            </>
          )}
        </Button>
      </form>

      <div className="text-center">
        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-xs font-bold text-secondary uppercase tracking-widest hover:text-brand transition-colors underline underline-offset-4"
        >
          {isSignUp ? "Já tem uma conta? Entre aqui" : "Não tem conta? Cadastre-se"}
        </button>
      </div>
    </div>
  );
}
