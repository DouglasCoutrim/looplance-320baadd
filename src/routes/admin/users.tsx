import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Toaster, toast } from "sonner";
import { Users, Shield, Trash2, Search, Activity } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/users")({
  component: UsersAdmin,
});

interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  cpf: string | null;
  arena_id: string | null;
  arena_nome: string | null;
  role: string | null;
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
  metadata: any;
  created_at: string;
}

interface Arena { id: string; nome: string }

function UsersAdmin() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [tab, setTab] = useState<"users" | "logs">("users");

  const load = async () => {
    setLoading(true);
    const { data: me } = await supabase.auth.getUser();
    if (!me.user) { setLoading(false); return; }

    const { data: profile } = await supabase
      .from("profiles").select("is_super_admin, is_arena_owner")
      .eq("id", me.user.id).maybeSingle();
    setIsSuperAdmin(!!profile?.is_super_admin);

    const { data: userList, error: uErr } = await supabase.rpc("admin_list_users");
    if (uErr) toast.error(uErr.message);
    else setUsers((userList ?? []) as UserRow[]);

    const { data: arenaList } = await supabase.from("arenas").select("id, nome").order("nome");
    setArenas(arenaList ?? []);

    const { data: logList } = await supabase
      .from("user_activity_logs").select("*")
      .order("created_at", { ascending: false }).limit(100);
    setLogs((logList ?? []) as LogRow[]);

    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateUser = async (
    id: string,
    changes: { role?: string; is_super_admin?: boolean; is_arena_owner?: boolean; arena_id?: string | null }
  ) => {
    const target = users.find((u) => u.id === id);
    if (!target) return;
    const { error } = await supabase.rpc("admin_update_user_profile", {
      user_id: id,
      new_role: changes.role ?? target.role ?? "user",
      new_is_super_admin: changes.is_super_admin ?? target.is_super_admin,
      new_is_arena_owner: changes.is_arena_owner ?? target.is_arena_owner,
      new_arena_id: changes.arena_id !== undefined ? changes.arena_id : target.arena_id,
    });
    if (error) return toast.error(error.message);
    await supabase.rpc("log_user_action", {
      p_action: "admin_update_user",
      p_resource_type: "user",
      p_resource_id: id,
      p_metadata: changes,
    });
    toast.success("Usuário atualizado");
    load();
  };

  const deleteUser = async (id: string) => {
    const { error } = await supabase.rpc("admin_delete_user", { p_user_id: id });
    if (error) return toast.error(error.message);
    await supabase.rpc("log_user_action", {
      p_action: "admin_delete_user",
      p_resource_type: "user",
      p_resource_id: id,
    });
    toast.success("Usuário removido");
    load();
  };

  const filtered = users.filter((u) => {
    if (!q) return true;
    const term = q.toLowerCase();
    return (
      u.email?.toLowerCase().includes(term) ||
      u.full_name?.toLowerCase().includes(term) ||
      u.cpf?.includes(term) ||
      u.arena_nome?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      <Toaster theme="light" position="top-center" />

      <div>
        <h1 className="text-3xl font-black text-gray-900 flex items-center gap-2">
          <Users className="h-7 w-7 text-brand-orange" /> Usuários & Logs
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Gerencie contas da plataforma e visualize o histórico de ações.
        </p>
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
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text" placeholder="Buscar por nome, email, CPF ou arena..."
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
                    <th className="text-left px-4 py-3">CPF</th>
                    <th className="text-left px-4 py-3">Arena</th>
                    <th className="text-left px-4 py-3">Papel</th>
                    <th className="text-left px-4 py-3">Permissões</th>
                    <th className="text-right px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={6} className="text-center py-10 text-gray-400">Carregando...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-10 text-gray-400">Nenhum usuário encontrado</td></tr>
                  ) : filtered.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-bold text-gray-900">{u.full_name || "—"}</div>
                        <div className="text-xs text-gray-500">{u.email}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{u.cpf || "—"}</td>
                      <td className="px-4 py-3">
                        {isSuperAdmin ? (
                          <select
                            value={u.arena_id ?? ""}
                            onChange={(e) => updateUser(u.id, { arena_id: e.target.value || null })}
                            className="text-xs bg-gray-100 rounded px-2 py-1 border-none outline-none"
                          >
                            <option value="">— Sem arena —</option>
                            {arenas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                          </select>
                        ) : (
                          <span className="text-xs">{u.arena_nome || "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isSuperAdmin ? (
                          <select
                            value={u.role ?? "user"}
                            onChange={(e) => updateUser(u.id, { role: e.target.value })}
                            className="text-xs bg-gray-100 rounded px-2 py-1 border-none outline-none"
                          >
                            <option value="user">Jogador</option>
                            <option value="operator">Operador</option>
                            <option value="admin">Admin</option>
                          </select>
                        ) : (
                          <span className="text-xs capitalize">{u.role || "user"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {isSuperAdmin && (
                            <label className="flex items-center gap-1.5 text-xs">
                              <input
                                type="checkbox" checked={u.is_super_admin}
                                onChange={(e) => updateUser(u.id, { is_super_admin: e.target.checked })}
                              />
                              <Shield className="h-3 w-3 text-red-500" /> Super Admin
                            </label>
                          )}
                          <label className="flex items-center gap-1.5 text-xs">
                            <input
                              type="checkbox" checked={u.is_arena_owner}
                              onChange={(e) => updateUser(u.id, { is_arena_owner: e.target.checked })}
                            />
                            Dono de Arena
                          </label>
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
                                  Esta ação vai remover permanentemente <strong>{u.email}</strong> da plataforma. Não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteUser(u.id)} className="bg-red-600 hover:bg-red-700">
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </td>
                    </tr>
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
