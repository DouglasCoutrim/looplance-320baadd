import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, RefreshCw, UserPlus, Shield, Trash2, Mail } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

interface Profile {
  id: string;
  email: string;
  is_super_admin: boolean;
  created_at: string;
}

function AdminUsers() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Form state for new admin
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao buscar usuários");
    } else {
      setProfiles((data as Profile[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setCreating(true);
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      // The trigger 'on_auth_user_created' will handle profile creation.
      // But we need to make sure 'is_super_admin' is set if the trigger didn't catch the email logic or for explicit setting.
      // Note: By default the trigger makes anyone douglas@... a super admin.
      // If we want this form to create ANY super admin, we need to update the profile.
      
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ is_super_admin: true })
        .eq("id", authData.user?.id || "");

      if (updateError) throw updateError;

      toast.success("Novo Super Admin criado com sucesso!");
      setIsDialogOpen(false);
      setEmail("");
      setPassword("");
      fetchProfiles();
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar administrador");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-gray-900 uppercase">
            Gestão <span className="brand-text">Admins</span>
          </h1>
          <p className="text-muted-foreground mt-1 font-medium text-lg">
            Gerencie as contas de Super Admin do sistema.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="icon" onClick={fetchProfiles} disabled={loading} className="rounded-xl border-gray-200 h-12 w-12 shadow-sm bg-white hover:bg-gray-50">
            <RefreshCw className={`h-5 w-5 text-gray-400 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="brand-gradient brand-glow text-white font-black uppercase tracking-widest px-6 h-12 rounded-xl transition-transform hover:scale-[1.02]">
                <UserPlus className="mr-2 h-5 w-5" /> Novo Admin
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl border-none shadow-2xl overflow-hidden p-0">
               <div className="brand-gradient p-6 text-white">
                <DialogTitle className="text-2xl font-black uppercase tracking-tight">Criar Super Admin</DialogTitle>
                <DialogDescription className="text-white/70 text-sm font-bold uppercase tracking-widest mt-1">
                  Adicione um novo administrador com acesso total ao sistema.
                </DialogDescription>
              </div>

              <form onSubmit={handleCreateAdmin}>
                <div className="p-8 space-y-6">
                  <div className="grid gap-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">E-mail Corporativo</Label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input 
                        type="email" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        placeholder="exemplo@looplance.app" 
                        className="rounded-xl border-gray-100 bg-gray-50 h-12 pl-12 focus:ring-brand-orange" 
                        required
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Senha Provisória</Label>
                    <Input 
                      type="password" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      placeholder="••••••••" 
                      className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:ring-brand-orange" 
                      required
                    />
                  </div>
                </div>
                <DialogFooter className="bg-gray-50 p-6 flex justify-end gap-3 border-t border-gray-100">
                  <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="font-bold rounded-xl">Cancelar</Button>
                  <Button type="submit" disabled={creating} className="brand-gradient text-white font-black uppercase tracking-widest px-8 h-12 rounded-xl shadow-lg shadow-brand-orange/20">
                    {creating ? "Criando..." : "Confirmar Cadastro"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="glass-card bg-white shadow-xl border border-gray-100 overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader className="bg-gray-50/50 border-b border-gray-100">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4 px-6">Usuário / E-mail</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4 px-6">Privilégios</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4 px-6">Data de Cadastro</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4 px-6">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-40 text-center text-muted-foreground font-medium italic">
                  Nenhum administrador encontrado.
                </TableCell>
              </TableRow>
            ) : (
              profiles.map((profile) => (
                <TableRow key={profile.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-50 last:border-0 group">
                  <TableCell className="py-5 px-6">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-brand-orange/10 flex items-center justify-center text-brand-orange transition-colors group-hover:brand-gradient group-hover:text-white">
                        <Mail className="h-6 w-6" />
                      </div>
                      <div>
                        <span className="font-black text-lg text-gray-900 tracking-tight">{profile.email}</span>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Acesso Administrativo</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-5 px-6">
                    {profile.is_super_admin ? (
                      <Badge className="brand-gradient text-white border-none font-black uppercase tracking-widest text-[9px] rounded-full px-3 py-1">
                        <Shield className="h-3 w-3 mr-1" /> Super Admin
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="font-black uppercase tracking-widest text-[9px] rounded-full px-3 py-1">Usuário Comum</Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-5 px-6">
                    <span className="text-xs font-bold text-gray-500">
                      {new Date(profile.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </TableCell>
                  <TableCell className="text-right py-5 px-6">
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        disabled={profile.email === 'douglas@looplance.app'}
                        className="h-10 w-10 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
