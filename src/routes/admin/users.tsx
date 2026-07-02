import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { inviteUser } from "@/lib/user-admin.functions";
import { Toaster, toast } from "sonner";
import {
  Users, Shield, Trash2, Search, Activity, UserPlus, Building2, Home, User as UserIcon, X,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/users")({
  component: UsersAdmin,
});

type AppRole = "super_admin" | "client_owner" | "arena_owner" | "arena_user";

interface RoleEntry {
  role: AppRole;
  arena_id: string | null;
  client_id: string | null;
}

interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  cpf: string | null;
  arena_id: string | null;
  arena_nome: string | null;
  client_id: string | null;
  client_nome: string | null;
  roles: RoleEntry[];
  is_super_admin: boolean;
  is_arena_owner: boolean;
  created_at: string;
}

interface LogRow {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  arena_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface Arena { id: string; nome: string }
interface Client { id: string; nome: string }

const ROLE_META: Record<AppRole, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  super_admin: { label: "Super Admin", color: "bg-red-100 text-red-700 border-red-200", icon: Shield },
  client_owner: { label: "Dono de Cliente", color: "bg-purple-100 text-purple-700 border-purple-200", icon: Building2 },
  arena_owner: { label: "Dono de Arena", color: "bg-brand-orange/10 text-brand-orange border-brand-orange/20", icon: Home },
  arena_user: { label: "Usuário de Arena", color: "bg-gray-100 text-gray-600 border-gray-200", icon: UserIcon },
};

function UsersAdmin() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | AppRole>("all");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [tab, setTab] = useState<"users" | "logs">("users");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteForm, setInviteForm] = useState<{
    email: string; full_name: string; role: AppRole; arena_id: string; client_id: string;
  }>({ email: "", full_name: "", role: "arena_user", arena_id: "", client_id: "" });

  const invite = useServerFn(inviteUser);

  const load = async () => {
    setLoading(true);
    const { data: me } = await supabase.auth.getUser();
    if (!me.user) { setLoading(false); return; }

    const { data: super_check } = await supabase.rpc("has_role", {
      _user_id: me.user.id, _role: "super_admin",
    });
    setIsSuperAdmin(!!super_check);

    const { data: userList, error: uErr } = await supabase.rpc("admin_list_users");
    if (uErr) toast.error(uErr.message);
    else setUsers((userList ?? []) as unknown as UserRow[]);

    const [{ data: arenaList }, { data: clientList }] = await Promise.all([
      supabase.from("arenas").select("id, nome").order("nome"),
      supabase.from("clients").select("id, nome").order("nome"),
    ]);
    setArenas(arenaList ?? []);
    setClients((clientList ?? []) as Client[]);

    const { data: logList } = await supabase
      .from("user_activity_logs").select("*")
      .order("created_at", { ascending: false }).limit(100);
    setLogs((logList ?? []) as unknown as LogRow[]);

    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const deleteUser = async (id: string) => {
    const { error } = await supabase.rpc("admin_delete_user", { p_user_id: id });
    if (error) return toast.error(error.message);
    toast.success("Usuário removido");
    load();
  };

  const assignRole = async (u: UserRow, role: AppRole, arena_id?: string | null, client_id?: string | null) => {
    const { error } = await supabase.rpc("admin_assign_role", {
      p_user_id: u.id, p_role: role,
      p_arena_id: arena_id ?? undefined,
      p_client_id: client_id ?? undefined,
    });
    if (error) return toast.error(error.message);
    toast.success("Papel atribuído");
    load();
  };

  const revokeRole = async (u: UserRow, r: RoleEntry) => {
    const { error } = await supabase.rpc("admin_revoke_role", {
      p_user_id: u.id, p_role: r.role,
      p_arena_id: r.arena_id ?? undefined,
      p_client_id: r.client_id ?? undefined,
    });
    if (error) return toast.error(error.message);
    toast.success("Papel removido");
    load();
  };

  const handleInvite = async () => {
    if (!inviteForm.email || !inviteForm.full_name) {
      return toast.error("Preencha nome e email");
    }
    const needsArena = inviteForm.role === "arena_user" || inviteForm.role === "arena_owner";
    const needsClient = inviteForm.role === "client_owner";
    if (needsArena && !inviteForm.arena_id) return toast.error("Selecione a arena");
    if (needsClient && !inviteForm.client_id) return toast.error("Selecione o cliente");

    setInviting(true);
    try {
      await invite({
        data: {
          email: inviteForm.email.trim().toLowerCase(),
          full_name: inviteForm.full_name.trim(),
          role: inviteForm.role,
          arena_id: needsArena ? inviteForm.arena_id : null,
          client_id: needsClient ? inviteForm.client_id : null,
        },
      });
      toast.success("Convite enviado por email");
      setInviteOpen(false);
      setInviteForm({ email: "", full_name: "", role: "arena_user", arena_id: "", client_id: "" });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao convidar");
    } finally {
      setInviting(false);
    }
  };

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== "all") {
        const has = u.roles.some((r) => r.role === roleFilter);
        if (!has) return false;
      }
      if (!q) return true;
      const term = q.toLowerCase();
      return (
        u.email?.toLowerCase().includes(term) ||
        u.full_name?.toLowerCase().includes(term) ||
        u.cpf?.includes(term) ||
        u.arena_nome?.toLowerCase().includes(term) ||
        u.client_nome?.toLowerCase().includes(term)
      );
    });
  }, [users, q, roleFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: users.length, super_admin: 0, client_owner: 0, arena_owner: 0, arena_user: 0 };
    users.forEach((u) => u.roles.forEach((r) => { c[r.role] = (c[r.role] ?? 0) + 1; }));
    return c;
  }, [users]);

  const availableRoles: AppRole[] = isSuperAdmin
    ? ["super_admin", "arena_owner"]
    : ["arena_owner"];

  return (
    <div className="space-y-6">
      <Toaster theme="light" position="top-center" />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black text-gray-900 flex items-center gap-2">
            <Users className="h-7 w-7 text-brand-orange" /> Usuários & Logs
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Gerencie super admins, donos de cliente, donos de arena e usuários finais.
          </p>
        </div>

        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-brand-orange to-brand-yellow text-white font-bold gap-2">
              <UserPlus className="h-4 w-4" /> Convidar usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Convidar novo usuário</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome completo</Label>
                <Input value={inviteForm.full_name}
                  onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })}
                  placeholder="João Silva" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="usuario@exemplo.com" />
              </div>
              <div>
                <Label>Papel</Label>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as AppRole })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  {availableRoles.map((r) => (
                    <option key={r} value={r}>{ROLE_META[r].label}</option>
                  ))}
                </select>
              </div>
              {(inviteForm.role === "arena_user" || inviteForm.role === "arena_owner") && (
                <div>
                  <Label>Arena</Label>
                  <select
                    value={inviteForm.arena_id}
                    onChange={(e) => setInviteForm({ ...inviteForm, arena_id: e.target.value })}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="">— Selecione —</option>
                    {arenas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                  </select>
                </div>
              )}
              {inviteForm.role === "client_owner" && (
                <div>
                  <Label>Cliente</Label>
                  <select
                    value={inviteForm.client_id}
                    onChange={(e) => setInviteForm({ ...inviteForm, client_id: e.target.value })}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="">— Selecione —</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
              )}
              <p className="text-xs text-gray-500">
                O usuário receberá um email para criar a senha e acessar a plataforma.
              </p>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setInviteOpen(false)}>Cancelar</Button>
              <Button onClick={handleInvite} disabled={inviting}
                className="bg-gradient-to-r from-brand-orange to-brand-yellow text-white">
                {inviting ? "Enviando..." : "Enviar convite"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setTab("users")}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition ${tab === "users" ? "border-brand-orange text-gray-900" : "border-transparent text-gray-500"}`}
        >
          Usuários ({users.length})
        </button>
        <button
          onClick={() => setTab("logs")}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition flex items-center gap-1.5 ${tab === "logs" ? "border-brand-orange text-gray-900" : "border-transparent text-gray-500"}`}
        >
          <Activity className="h-4 w-4" /> Atividade ({logs.length})
        </button>
      </div>

      {tab === "users" ? (
        <>
          <div className="flex flex-wrap gap-2">
            {(["all", "super_admin", "client_owner", "arena_owner", "arena_user"] as const).map((r) => {
              const isActive = roleFilter === r;
              const label = r === "all" ? "Todos" : ROLE_META[r].label;
              return (
                <button key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                    isActive
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {label} <span className="opacity-60">({counts[r] ?? 0})</span>
                </button>
              );
            })}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text" placeholder="Buscar por nome, email, CPF, arena ou cliente..."
              value={q} onChange={(e) => setQ(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm outline-none focus:border-brand-orange"
            />
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="text-left px-4 py-3">Usuário</th>
                    <th className="text-left px-4 py-3">Vínculos</th>
                    <th className="text-left px-4 py-3">Papéis</th>
                    <th className="text-left px-4 py-3">Adicionar papel</th>
                    <th className="text-right px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={5} className="text-center py-10 text-gray-400">Carregando...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-10 text-gray-400">Nenhum usuário encontrado</td></tr>
                  ) : filtered.map((u) => (
                    <UserRowEditor
                      key={u.id}
                      user={u}
                      arenas={arenas}
                      clients={clients}
                      isSuperAdmin={isSuperAdmin}
                      availableRoles={availableRoles}
                      onAssign={assignRole}
                      onRevoke={revokeRole}
                      onDelete={deleteUser}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="text-left px-4 py-3">Quando</th>
                  <th className="text-left px-4 py-3">Usuário</th>
                  <th className="text-left px-4 py-3">Ação</th>
                  <th className="text-left px-4 py-3">Recurso</th>
                  <th className="text-left px-4 py-3">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-10 text-gray-400">Sem atividade registrada</td></tr>
                ) : logs.map((l) => {
                  const user = users.find((u) => u.id === l.user_id);
                  return (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(l.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold">{user?.full_name || user?.email || l.user_id?.slice(0, 8)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded bg-brand-orange/10 text-brand-orange text-xs font-bold">
                          {l.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {l.resource_type ? `${l.resource_type}${l.resource_id ? ` · ${l.resource_id.slice(0, 8)}` : ""}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                        {l.metadata && Object.keys(l.metadata).length ? JSON.stringify(l.metadata) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function UserRowEditor({
  user, arenas, clients, isSuperAdmin, availableRoles, onAssign, onRevoke, onDelete,
}: {
  user: UserRow;
  arenas: Arena[];
  clients: Client[];
  isSuperAdmin: boolean;
  availableRoles: AppRole[];
  onAssign: (u: UserRow, r: AppRole, a?: string | null, c?: string | null) => void;
  onRevoke: (u: UserRow, r: RoleEntry) => void;
  onDelete: (id: string) => void;
}) {
  const [newRole, setNewRole] = useState<AppRole>(availableRoles[0]);
  const [newArena, setNewArena] = useState("");
  const [newClient, setNewClient] = useState("");

  const arenaLabel = (id: string | null) => arenas.find((a) => a.id === id)?.nome ?? "—";
  const clientLabel = (id: string | null) => clients.find((c) => c.id === id)?.nome ?? "—";

  const submit = () => {
    if ((newRole === "arena_user" || newRole === "arena_owner") && !newArena) return;
    if (newRole === "client_owner" && !newClient) return;
    onAssign(user, newRole,
      (newRole === "arena_user" || newRole === "arena_owner") ? newArena : null,
      newRole === "client_owner" ? newClient : null);
    setNewArena(""); setNewClient("");
  };

  return (
    <tr className="hover:bg-gray-50 align-top">
      <td className="px-4 py-3 min-w-[200px]">
        <div className="font-bold text-gray-900">{user.full_name || "—"}</div>
        <div className="text-xs text-gray-500">{user.email}</div>
        {user.cpf && <div className="text-[10px] font-mono text-gray-400 mt-0.5">{user.cpf}</div>}
      </td>
      <td className="px-4 py-3 text-xs text-gray-600">
        {user.arena_nome && <div className="flex items-center gap-1"><Home className="h-3 w-3" /> {user.arena_nome}</div>}
        {user.client_nome && <div className="flex items-center gap-1 mt-0.5"><Building2 className="h-3 w-3" /> {user.client_nome}</div>}
        {!user.arena_nome && !user.client_nome && <span className="text-gray-300">—</span>}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          {user.roles.length === 0 && <span className="text-xs text-gray-400">sem papel</span>}
          {user.roles.map((r, i) => {
            const meta = ROLE_META[r.role];
            const Icon = meta.icon;
            const scope = r.arena_id ? arenaLabel(r.arena_id) : r.client_id ? clientLabel(r.client_id) : null;
            const canRevoke = isSuperAdmin || (r.role !== "super_admin" && r.role !== "client_owner");
            return (
              <div key={i} className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-bold w-fit ${meta.color}`}>
                <Icon className="h-3 w-3" />
                {meta.label}
                {scope && <span className="opacity-70 font-normal">· {scope}</span>}
                {canRevoke && (
                  <button onClick={() => onRevoke(user, r)} className="ml-0.5 hover:opacity-70">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1.5 min-w-[220px]">
          <select value={newRole} onChange={(e) => setNewRole(e.target.value as AppRole)}
            className="text-xs bg-gray-100 rounded px-2 py-1 border-none outline-none">
            {availableRoles.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
          </select>
          {(newRole === "arena_user" || newRole === "arena_owner") && (
            <select value={newArena} onChange={(e) => setNewArena(e.target.value)}
              className="text-xs bg-gray-100 rounded px-2 py-1 border-none outline-none">
              <option value="">— Arena —</option>
              {arenas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          )}
          {newRole === "client_owner" && (
            <select value={newClient} onChange={(e) => setNewClient(e.target.value)}
              className="text-xs bg-gray-100 rounded px-2 py-1 border-none outline-none">
              <option value="">— Cliente —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          )}
          <button onClick={submit}
            className="text-xs font-bold px-2 py-1 rounded bg-gradient-to-r from-brand-orange to-brand-yellow text-white hover:opacity-90">
            + Adicionar
          </button>
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        {isSuperAdmin && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50">
                <Trash2 className="h-4 w-4" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação vai remover permanentemente <strong>{user.email}</strong> da plataforma. Não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(user.id)} className="bg-red-600 hover:bg-red-700">
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </td>
    </tr>
  );
}
