import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import logoUrl from "@/assets/looplance-logo.png";

export const Route = createFileRoute("/admin/login")({
  component: AdminLogin,
});

function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // Check if user is super admin
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("is_super_admin")
        .eq("id", authData.user.id)
        .single();

      if (profileError || !profileData?.is_super_admin) {
        await supabase.auth.signOut();
        toast.error("Acesso negado. Apenas super admins podem acessar esta área.");
        setLoading(false);
        return;
      }

      toast.success("Login realizado com sucesso!");
      navigate({ to: "/admin" });
    } catch (error: any) {
      toast.error(error.message || "Erro ao realizar login");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black p-4">
      <Card className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border-none">
        <div className="brand-gradient p-6 text-white text-center">
          <CardHeader className="p-0">
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md">
                <Lock className="h-6 w-6 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-black uppercase tracking-tight">Painel Admin</CardTitle>
            <CardDescription className="text-white/70 text-xs font-bold uppercase tracking-widest mt-1">
              Acesso Restrito - Super Admin
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
              {loading ? "Entrando..." : "Acessar Painel"}
            </Button>
          </form>

        </CardContent>
      </Card>
      
      <p className="mt-8 text-white/40 text-xs font-bold uppercase tracking-[0.2em]">
        Looplance Edge System
      </p>
    </div>
  );
}
