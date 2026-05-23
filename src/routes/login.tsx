import { createFileRoute, useNavigate, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { LogIn } from "lucide-react";
import logoUrl from "@/assets/looplance-logo.png";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      throw redirect({ to: "/" });
    }
  },
  component: UserLogin,
});

function UserLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { redirect } = Route.useSearch() as { redirect?: string };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const loginToast = toast.loading("Verificando credenciais...");
    console.log("Login attempt started for:", email);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Supabase auth error:", error);
        toast.error(error.message || "Erro ao realizar login", { id: loginToast });
        setLoading(false);
        return;
      }
      
      if (!data.user) {
        toast.error("Usuário não encontrado após login", { id: loginToast });
        setLoading(false);
        return;
      }

      console.log("Login successful, user:", data.user.id);
      toast.success("Login realizado com sucesso!", { id: loginToast });
      
      // Short delay to ensure session is persisted
      setTimeout(() => {
        if (redirect) {
          console.log("Redirecting to:", redirect);
          if (redirect.startsWith("/")) {
            navigate({ to: redirect as any });
          } else {
            window.location.href = redirect;
          }
        } else {
          console.log("Navigating to home");
          navigate({ to: "/" });
        }
      }, 500);
    } catch (error: any) {
      console.error("Detailed login error:", error);
      toast.error(error.message || "Ocorreu um erro inesperado", { id: loginToast });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black p-4">
      <Card className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border-none">
        <div className="brand-gradient p-1 text-center border-b border-brand-orange/10">
          <CardHeader className="p-0 space-y-0">
            <div className="flex justify-center -mb-14 -mt-8">
              <img 
                src={logoUrl} 
                alt="Looplance" 
                className="h-48 w-auto object-contain drop-shadow-sm brightness-0 invert animate-logo-float" 
              />
            </div>
            <CardTitle className="text-lg font-black uppercase tracking-tight text-white relative z-10">Login</CardTitle>
            <CardDescription className="text-white/80 text-[10px] font-bold uppercase tracking-widest mt-0">
              Entre para ver seus lances
            </CardDescription>
          </CardHeader>
        </div>
        
        <CardContent className="p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">E-mail</Label>
              <Input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="seu@email.com" 
                className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:ring-brand-orange"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Senha</Label>
              <Input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="••••••••" 
                className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:ring-brand-orange"
                required
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full brand-gradient brand-glow text-white font-black uppercase tracking-widest h-12 rounded-xl transition-transform hover:scale-[1.02]"
              disabled={loading}
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-white px-3 text-muted-foreground font-black tracking-widest">Ou continue com</span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                const result = await lovable.auth.signInWithOAuth("google", {
                  redirect_uri: window.location.origin + "/",
                });
                if (result.error) {
                  toast.error("Erro ao entrar com Google");
                }
              }}
              className="flex-1 h-12 rounded-xl border-gray-200 bg-white hover:bg-gray-50 font-bold text-gray-700 flex items-center justify-center"
            >
              <svg className="h-6 w-6" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                const result = await lovable.auth.signInWithOAuth("apple", {
                  redirect_uri: window.location.origin + "/",
                });
                if (result.error) {
                  toast.error("Erro ao entrar com Apple");
                }
              }}
              className="flex-1 h-12 rounded-xl border-gray-200 bg-white hover:bg-gray-50 font-bold text-gray-900 flex items-center justify-center"
            >
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.74 1.18 0 2.15-1.04 3.74-1.04 1.38 0 2.67.79 3.5 2.04-3.14 1.88-2.48 5.98.22 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
            </Button>
          </div>
          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground font-medium">
              Não tem uma conta?{" "}
              <Link to="/signup" className="text-brand-orange font-bold hover:underline">
                Cadastre-se
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