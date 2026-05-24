import { createFileRoute, useNavigate, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { UserPlus, ArrowLeft, Shield } from "lucide-react";
import logoUrl from "@/assets/looplance-logo.png";
import { useAuth } from "@/providers/AuthProvider";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/signup")({
  // Redirection handled globally in __root.tsx
  component: SignUp,
});

function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const navigate = useNavigate();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!consentAccepted) {
      toast.error("Você precisa aceitar os termos para prosseguir.");
      return;
    }

    const signupToast = toast.loading("Criando sua conta...");
    setLoading(true);

    try {
      console.log("Starting signup for:", email);
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            cpf: cpf,
            birth_date: birthDate,
            consent_accepted: true,
          },
        },
      });

      if (error) {
        console.error("Supabase signup error:", error);
        toast.error(error.message || "Erro ao realizar cadastro", { id: signupToast });
        setLoading(false);
        return;
      }

      console.log("Signup successful");
      toast.success("Cadastro realizado com sucesso! Verifique seu e-mail.", { id: signupToast });
      navigate({ to: "/login" });
    } catch (error: any) {
      console.error("Detailed signup error:", error);
      toast.error(error.message || "Ocorreu um erro inesperado", { id: signupToast });
      setLoading(false);
    }
  };

  // Basic CPF mask (e.g. 000.000.000-00)
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length <= 11) {
      value = value.replace(/(\d{3})(\d)/, "$1.$2");
      value = value.replace(/(\d{3})(\d)/, "$1.$2");
      value = value.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
      setCpf(value);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black p-4">
      <Card className="w-full max-w-md bg-white rounded-3xl shadow-2xl border-none relative">
        <div className="brand-gradient p-1 text-center relative border-b border-white/10 rounded-t-3xl">
          <Link to="/login" className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors z-20">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <CardHeader className="p-0 space-y-0">
            <div className="flex justify-center -mb-14 -mt-8">
              <img 
                src={logoUrl} 
                alt="Looplance" 
                className="h-48 w-auto object-contain drop-shadow-sm brightness-0 invert animate-logo-float" 
              />
            </div>
            <CardTitle className="text-lg font-black uppercase tracking-tight text-white relative z-10">Criar Conta</CardTitle>
            <CardDescription className="text-white/80 text-[10px] font-bold uppercase tracking-widest mt-0">
              Junte-se à Looplance
            </CardDescription>
          </CardHeader>
        </div>
        
        <CardContent className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nome Completo</Label>
              <Input 
                id="fullName"
                name="fullName"
                type="text" 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)} 
                placeholder="Seu nome completo" 
                className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:ring-brand-orange"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cpf" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">CPF</Label>
                <Input 
                  id="cpf"
                  name="cpf"
                  type="text" 
                  value={cpf} 
                  onChange={handleCpfChange} 
                  placeholder="000.000.000-00" 
                  className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:ring-brand-orange"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthDate" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Data de Nasc.</Label>
                <Input 
                  id="birthDate"
                  name="birthDate"
                  type="date" 
                  value={birthDate} 
                  onChange={(e) => setBirthDate(e.target.value)} 
                  className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:ring-brand-orange"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">E-mail</Label>
              <Input 
                id="email"
                name="email"
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="seu@email.com" 
                className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:ring-brand-orange"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Senha</Label>
              <Input 
                id="password"
                name="password"
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="••••••••" 
                className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:ring-brand-orange"
                required
              />
            </div>

            <div className="flex items-start space-x-3 pt-2">
              <Checkbox 
                id="consent" 
                checked={consentAccepted}
                onCheckedChange={(checked) => setConsentAccepted(checked === true)}
                className="mt-1 border-gray-300 data-[state=checked]:bg-brand-orange data-[state=checked]:border-brand-orange"
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="consent"
                  className="text-xs font-medium text-gray-600 leading-normal"
                >
                  Li e concordo com o{" "}
                  <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
                    <DialogTrigger asChild>
                      <button type="button" className="text-brand-orange hover:underline font-bold">
                        Termo de Consentimento e Uso de Imagem
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto rounded-3xl p-8">
                      <DialogHeader>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="h-10 w-10 rounded-full bg-brand-orange/10 flex items-center justify-center">
                            <Shield className="h-5 w-5 text-brand-orange" />
                          </div>
                          <DialogTitle className="text-xl font-black uppercase tracking-tight">Termos Legais</DialogTitle>
                        </div>
                        <DialogDescription className="text-gray-900 font-medium space-y-4 text-justify leading-relaxed">
                          <p className="font-black text-center mb-6">
                            TERMO DE CONSENTIMENTO E AUTORIZAÇÃO DE USO DE IMAGEM E VOZ
                          </p>
                          <p>
                            Pelo presente instrumento, o USUÁRIO, ao se cadastrar e utilizar o sistema de replays esportivos Looplance nas dependências da ARENA PARCEIRA, declara ciência e concorda expressamente com os termos:
                          </p>
                          <p>
                            <strong>1. DA AUTORIZAÇÃO DE CAPTAÇÃO:</strong> O USUÁRIO autoriza, de forma gratuita, livre e espontânea, a captação de sua imagem, voz e performance esportiva.
                          </p>
                          <p>
                            <strong>2. DA DISPONIBILIZAÇÃO:</strong> O USUÁRIO autoriza que os vídeos gerados sejam disponibilizados na plataforma Looplance, podendo ser acessados, baixados e compartilhados por outros usuários da mesma partida.
                          </p>
                          <p>
                            <strong>3. DA ISENÇÃO DE RESPONSABILIDADE:</strong> A ARENA e a plataforma LOOPLANCE ficam integralmente isentas de qualquer responsabilidade civil ou criminal decorrente do mau uso, edição, montagem ou compartilhamento indevido dos vídeos por parte de terceiros após o download.
                          </p>
                          <p>
                            <strong>4. DA PRIVACIDADE:</strong> O tratamento de dados (nome, e-mail, telefone e imagem) ocorre estritamente para a prestação do serviço de replays, não sendo comercializados para terceiros.
                          </p>
                          <p>
                            <strong>5.</strong> Fica eleito o foro da Comarca de Cristalina, Estado de Goiás, para dirimir eventuais dúvidas.
                          </p>
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter className="mt-6">
                        <Button 
                          type="button" 
                          onClick={() => {
                            setConsentAccepted(true);
                            setTermsOpen(false);
                          }}
                          className="brand-gradient text-white font-bold rounded-xl w-full"
                        >
                          Compreendo e Aceito
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </label>
              </div>
            </div>
            
            <Button 
              type="submit" 
              className={`w-full h-12 rounded-xl transition-all font-black uppercase tracking-widest mt-4 ${
                consentAccepted 
                  ? "brand-gradient brand-glow text-white hover:scale-[1.02]" 
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
              disabled={loading || !consentAccepted}
            >
              {loading ? "Processando..." : "Cadastrar"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground font-medium">
              Já tem uma conta?{" "}
              <Link to="/login" className="text-brand-orange font-bold hover:underline">
                Fazer Login
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
      
      <p className="mt-8 text-white/40 text-xs font-bold uppercase tracking-[0.2em]">
        Looplance System
      </p>
    </div>
  );
}