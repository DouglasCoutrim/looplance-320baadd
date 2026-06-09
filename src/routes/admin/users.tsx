import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Users, 
  Search, 
  UserPlus, 
  MoreVertical, 
  Shield, 
  UserX, 
  Key, 
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  Settings2
} from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/users")({
  component: UsersManagement,
});

function UsersManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  const [newPassword, setNewPassword] = useState("");
  const [createUserForm, setCreateUserForm] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "user",
    isSuperAdmin: false,
    isArenaOwner: false
  });
  const [editUserForm, setEditUserForm] = useState({
    fullName: "",
    role: "",
    isSuperAdmin: false,
    isArenaOwner: false
  });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast.error("Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(user => 
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    try {
      // Nota: No Supabase, mudar a senha de OUTRO usuário exige Admin API (Service Role)
      // Como estamos no client, sugerimos usar uma Edge Function ou informar que isso
      // requer privilégios de sistema. Para esta demo, tentamos atualizar a auth (se for o próprio)
      // ou mostramos que a funcionalidade depende da Edge Function.
      
      toast.info("Funcionalidade de troca de senha remota requer configuração de Edge Function no Supabase.");
      setIsPasswordDialogOpen(false);
      setNewPassword("");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleCreateUser = async () => {
    try {
      // Criação de usuário no Supabase Auth via Client não permite criar OUTROS usuários
      // Geralmente se usa supabase.auth.admin.createUser que exige service_role.
      // Aqui vamos simular o sucesso e avisar sobre a necessidade da Edge Function para produção.
      toast.warning("Para criar usuários diretamente, é necessário configurar uma Edge Function com privilégios administrativos.");
      setIsCreateDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      const { error } = await supabase.rpc("admin_update_user_profile", {
        user_id: selectedUser.id,
        new_role: editUserForm.role,
        new_is_super_admin: editUserForm.isSuperAdmin,
        new_is_arena_owner: editUserForm.isArenaOwner
      });

      if (error) throw error;

      toast.success("Perfil atualizado com sucesso");
      setIsEditDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error("Erro ao atualizar perfil: " + error.message);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.")) return;

    try {
      const { error } = await supabase.from("profiles").delete().eq("id", userId);
      if (error) throw error;
      
      toast.success("Usuário removido do sistema");
      fetchUsers();
    } catch (error: any) {
      toast.error("Erro ao excluir: " + error.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-primary uppercase">
            Gestão de <span className="brand-text">Usuários</span>
          </h1>
          <p className="text-secondary mt-1 font-medium">
            Administre acessos, permissões e contas de usuários do sistema.
          </p>
        </div>
        <Button 
          onClick={() => setIsCreateDialogOpen(true)}
          className="bg-brand text-white border-none brand-glow"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Novo Usuário
        </Button>
      </div>

      <div className="glass-card bg-surface p-6 shadow-subtle border border-border">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <Input 
            placeholder="Buscar por nome ou e-mail..." 
            className="pl-10 h-12 bg-tag border-border focus:ring-brand/12"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 text-brand animate-spin" />
            <p className="text-xs font-black uppercase tracking-widest text-muted">Carregando Usuários...</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader className="bg-tag">
                <TableRow>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest">Usuário</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest">Cargo</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest">Status Admin</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id} className="hover:bg-bg-card-hover transition-colors">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-primary">{user.full_name || "Sem Nome"}</span>
                        <span className="text-xs text-secondary">{user.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="offline" className="capitalize font-bold">
                        {user.role || "usuário"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {user.is_super_admin && (
                          <Badge variant="brand" className="font-black text-[9px] uppercase tracking-tighter">
                            Super Admin
                          </Badge>
                        )}
                        {user.is_arena_owner && (
                          <Badge variant="brand" className="font-black text-[9px] uppercase tracking-tighter">
                            Dono de Arena
                          </Badge>
                        )}
                        {!user.is_super_admin && !user.is_arena_owner && (
                          <Badge variant="offline" className="font-black text-[9px] uppercase tracking-tighter">
                            Padrão
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-tag">
                            <MoreVertical className="h-4 w-4 text-secondary" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel className="text-[10px] uppercase font-black text-muted">Gerenciar Usuário</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => {
                            setSelectedUser(user);
                            setEditUserForm({
                              fullName: user.full_name || "",
                              role: user.role || "user",
                              isSuperAdmin: user.is_super_admin || false,
                              isArenaOwner: user.is_arena_owner || false
                            });
                            setIsEditDialogOpen(true);
                          }}>
                            <Settings2 className="h-4 w-4 mr-2" />
                            Editar Permissões
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setSelectedUser(user);
                            setIsPasswordDialogOpen(true);
                          }}>
                            <Key className="h-4 w-4 mr-2" />
                            Alterar Senha
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-red-600 focus:text-red-600 focus:bg-red-50"
                            onClick={() => handleDeleteUser(user.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir Usuário
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Dialog: Editar Perfil */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-surface border-border rounded-[20px]">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight text-brand-text">Editar Permissões</DialogTitle>
            <DialogDescription>
              Ajuste o cargo e privilégios administrativos de {selectedUser?.full_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-secondary">Cargo Funcional</Label>
              <Select 
                value={editUserForm.role} 
                onValueChange={(v) => setEditUserForm(prev => ({ ...prev, role: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um cargo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário Comum</SelectItem>
                  <SelectItem value="manager">Gerente de Arena</SelectItem>
                  <SelectItem value="staff">Equipe Técnica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center justify-between p-3 border border-border rounded-xl bg-bg-card-hover">
              <div className="space-y-0.5">
                <Label className="text-sm font-bold text-primary">Super Admin</Label>
                <p className="text-[10px] text-secondary">Acesso total a todas as arenas e infra.</p>
              </div>
              <Switch 
                checked={editUserForm.isSuperAdmin}
                onCheckedChange={(v) => setEditUserForm(prev => ({ ...prev, isSuperAdmin: v }))}
              />
            </div>

            <div className="flex items-center justify-between p-3 border border-border rounded-xl bg-bg-card-hover">
              <div className="space-y-0.5">
                <Label className="text-sm font-bold text-primary">Dono de Arena</Label>
                <p className="text-[10px] text-secondary">Pode gerenciar suas próprias quadras e replays.</p>
              </div>
              <Switch 
                checked={editUserForm.isArenaOwner}
                onCheckedChange={(v) => setEditUserForm(prev => ({ ...prev, isArenaOwner: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdateProfile} className="bg-brand text-white border-none">Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Alterar Senha */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="sm:max-w-[400px] bg-surface border-border rounded-[20px]">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight text-brand-text">Alterar Senha</DialogTitle>
            <DialogDescription>
              Defina uma nova senha de acesso para o usuário.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Nova Senha</Label>
              <Input 
                type="password" 
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdatePassword} className="bg-brand text-white border-none">Atualizar Senha</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Criar Usuário */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[450px] bg-surface border-border rounded-[20px]">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight text-brand-text">Novo Usuário</DialogTitle>
            <DialogDescription>
              Cadastre um novo usuário diretamente no sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Nome Completo</Label>
              <Input placeholder="Ex: João Silva" />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-2">
              <Label>Senha Inicial</Label>
              <Input type="password" placeholder="Senha provisória" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateUser} className="bg-brand text-white border-none">Criar Conta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}