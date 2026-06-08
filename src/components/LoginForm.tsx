import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, Lock, Loader2, Eye, EyeOff } from "lucide-react";
import logoUrl from "@/assets/looplance-logo.png";

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
      <div className="mb-12">
        <img src={logoUrl} alt="Looplance" className="h-12 w-auto" />
      </div>

      <p className="text-[#888] text-sm mb-10 text-center">
        Inicie sessão para continuar no Looplance
      </p>

      <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
        <div className="relative group">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#555] group-focus-within:text-[#F97316] transition-colors" />
          <Input
            type="email"
            placeholder="Endereço de Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-14 pl-12 bg-[#1A1A1A] border-none rounded-2xl text-white placeholder:text-[#555] focus-visible:ring-1 focus-visible:ring-[#F97316]"
          />
        </div>

        <div className="relative group">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#555] group-focus-within:text-[#F97316] transition-colors" />
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="h-14 pl-12 pr-12 bg-[#1A1A1A] border-none rounded-2xl text-white placeholder:text-[#555] focus-visible:ring-1 focus-visible:ring-[#F97316]"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#555] hover:text-white"
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>

        <div className="flex justify-end">
          <button type="button" className="text-[#F97316] text-xs font-bold">
            Esqueceu sua senha?
          </button>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-14 bg-[#F97316] hover:bg-[#F97316]/90 text-black font-bold rounded-2xl text-base mt-2"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Iniciar Sessão"}
        </Button>

        <div className="relative flex items-center py-4">
          <div className="flex-grow border-t border-[#222]"></div>
          <span className="flex-shrink mx-4 text-[#444] text-xs uppercase">ou</span>
          <div className="flex-grow border-t border-[#222]"></div>
        </div>

        <Button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full h-14 bg-[#4285F4] hover:bg-[#4285F4]/90 text-white font-bold rounded-2xl flex items-center justify-center gap-3"
        >
          <div className="bg-white p-1.5 rounded-sm">
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" />
              <path fill="#FBBC05" d="M3.964 10.711c-.18-.54-.282-1.117-.282-1.711s.102-1.171.282-1.711V4.957H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.043l3.007-2.332z" />
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.443 2.043.957 4.957L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
            </svg>
          </div>
          Fazer Login com o Google
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
