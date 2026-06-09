import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, Lock, Loader2, Eye, EyeOff } from "lucide-react";
import logoUrl from "@/assets/logo-looplance.svg";

export function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      toast.success("Bem-vindo de volta!");
    } catch (error: any) {
      toast.error(error.message || "Erro na autenticação");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || "Erro no login com Google");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white px-8 py-12 flex flex-col items-center">
      <div className="mb-8 mt-6 w-full flex justify-center">
        <img src={logoUrl} alt="Looplance" className="w-[85%] max-w-[320px] h-auto object-contain" />
      </div>

      <p className="text-[#888] text-sm mb-10 text-center">
        inicie sessão para ver seus replays
      </p>

      <form onSubmit={handleLogin} className="w-full max-w-[280px] space-y-3">
        <div className="relative group">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#555] group-focus-within:text-[#F97316] transition-colors" />
          <Input
            type="email"
            placeholder="Endereço de Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-11 pl-10 bg-[#1A1A1A] border-none rounded-xl text-sm text-white placeholder:text-[#555] focus-visible:ring-1 focus-visible:ring-[#F97316]"
          />
        </div>

        <div className="relative group">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#555] group-focus-within:text-[#F97316] transition-colors" />
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="h-11 pl-10 pr-10 bg-[#1A1A1A] border-none rounded-xl text-sm text-white placeholder:text-[#555] focus-visible:ring-1 focus-visible:ring-[#F97316]"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#555] hover:text-white"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex justify-end">
          <button type="button" className="text-[#F97316] text-[10px] font-bold">
            Esqueceu sua senha?
          </button>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-11 bg-[#F97316] hover:bg-[#F97316]/90 text-black font-bold rounded-xl text-sm mt-1"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Iniciar Sessão"}
        </Button>
      </form>

      <div className="mt-auto space-y-6 flex flex-col items-center w-full">
        <p className="text-sm text-[#888]">
          Não tem uma conta? <button className="text-[#F97316] font-bold">Registrar-se</button>
        </p>
        
        <div className="flex gap-4 text-[10px] text-[#555] uppercase font-bold tracking-wider">
          <button>Política de Privacidade</button>
          <span>•</span>
          <button>Termos de Uso</button>
        </div>

        <button className="flex items-center gap-2 px-6 py-2 rounded-full border border-[#222] text-xs font-bold">
          <span className="w-4 h-4 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center text-[8px]">🌐</span>
          PT
        </button>
      </div>
    </div>
  );
}
