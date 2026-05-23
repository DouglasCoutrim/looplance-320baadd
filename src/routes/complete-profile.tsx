import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { UserCircle, Shield } from "lucide-react";
import logoUrl from "@/assets/looplance-logo.png";
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

export const Route = createFileRoute("/complete-profile")({
  component: CompleteProfile,
});

function CompleteProfile() {
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate({ to: "/login" });
        return;
      }
      
      // Pre-fill full name if available from social login
      if (user.user_metadata?.full_name) {
        setFullName(user.user_metadata.full_name);
      }
    };
    checkUser();
  }, [navigate]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!consentAccepted) {
      toast.error("Você precisa aceitar os termos para prosseguir.");
      return;
    }

    const updateToast = toast.loading("Salvando seus dados...");
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não encontrado");

      console.log("Updating profile for user:", user.id);
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        email: user.email,
        full_name: fullName,
        cpf: cpf,
        birth_date: birthDate,
        consent_accepted: true,
        consent_timestamp: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error("Supabase upsert error:", error);
        toast.error(error.message || "Erro ao atualizar perfil", { id: updateToast });
        setLoading(false);
        return;
      }

      console.log("Profile updated successfully");
      toast.success("Perfil atualizado com sucesso!", { id: updateToast });
      navigate({ to: "/" });
    } catch (error: any) {
      console.error("Detailed profile update error:", error);
      toast.error(error.message || "Ocorreu um erro inesperado", { id: updateToast });
      setLoading(false);
    }
  };

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
      <Card className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border-none">
        <div className="brand-gradient p-6 text-white text-center">
          <CardHeader className="p-0">
            <div className="flex justify-center mb-4">
              <img 
                src={logoUrl} 
                alt="Looplance" 
                className="h-20 w-auto object-contain" 
              />
            </div>
            <CardTitle className="text-2xl font-black uppercase tracking-tight">Completar Perfil</CardTitle>
            <CardDescription className="text-white/70 text-xs font-bold uppercase tracking-widest mt-1">
              Precisamos de mais alguns dados
            </CardDescription>
          </CardHeader>
        </div>
        
        <CardContent className="p-8">
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nome Completo</Label>
              <Input 
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
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">CPF</Label>
                <Input 
                  type="text" 
                  value={cpf} 
                  onChange={handleCpfChange} 
                  placeholder="000.000.000-00" 
                  className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:ring-brand-orange"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Data de Nasc.</Label>
                <Input 
                  type="date" 
                  value={birthDate} 
                  onChange={(e) => setBirthDate(e.target.value)} 
                  className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:ring-brand-orange"
                  required
                />
              </div>
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
              {loading ? "Salvando..." : "Concluir Cadastro"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}