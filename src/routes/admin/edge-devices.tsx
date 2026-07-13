import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Copy, RefreshCw, HardDrive, Edit2, Trash2, Wifi, WifiOff, Terminal } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/admin/edge-devices")({
  component: EdgeDevices,
});

interface EdgeDevice {
  id: string;
  name: string;
  hostname: string | null;
  status: string | null;
  last_seen: string | null;
  edge_token: string | null;
  install_passphrase: string | null;
  client_id: string | null;
  created_at: string | null;
}

interface ClientLite { id: string; nome: string; is_frozen: boolean }

function EdgeDevices() {
  const [devices, setDevices] = useState<EdgeDevice[]>([]);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<EdgeDevice | null>(null);
  const [deletingDevice, setDeletingDevice] = useState<EdgeDevice | null>(null);
  const [scriptDevice, setScriptDevice] = useState<EdgeDevice | null>(null);
  const [newName, setNewName] = useState("");
  const [newHostname, setNewHostname] = useState("");
  const [newClientId, setNewClientId] = useState<string>("");
  const [viewMode, setViewMode] = useState(false);

  const installCommand = () => `curl -fsSL ${window.location.origin}/install | sudo bash`;
  const clientNameOf = (id: string | null) => id ? (clients.find((c) => c.id === id)?.nome ?? "—") : "—";

  const fetchDevices = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("edge_devices")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao buscar dispositivos");
    } else {
      setDevices(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchClients = async () => {
    const { data } = await supabase.from("clients").select("id, nome, is_frozen").order("nome");
    setClients((data ?? []) as ClientLite[]);
  };

  useEffect(() => { fetchClients(); }, []);

  const resetForm = () => {
    setNewName("");
    setNewHostname("");
    setNewClientId("");
    setEditingDevice(null);
    setViewMode(false);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (device: EdgeDevice) => {
    setEditingDevice(device);
    setViewMode(true);
    setNewName(device.name);
    setNewHostname(device.hostname || "");
    setNewClientId(device.client_id || "");
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!newName) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (!newClientId) {
      toast.error("Selecione o cliente responsável por este edge");
      return;
    }

    const payload: any = {
      name: newName,
      hostname: newHostname || null,
      client_id: newClientId,
    };

    if (editingDevice) {
      const { error } = await supabase.from("edge_devices").update(payload).eq("id", editingDevice.id);
      if (error) toast.error("Erro ao atualizar dispositivo");
      else {
        toast.success("Dispositivo atualizado com sucesso");
        setViewMode(true);
        fetchDevices();
      }
    } else {
      const { error } = await supabase.from("edge_devices").insert([{ ...payload, status: "offline" }]);
      if (error) toast.error("Erro ao criar dispositivo");
      else {
        toast.success("Dispositivo criado com sucesso");
        setIsDialogOpen(false);
        resetForm();
        fetchDevices();
      }
    }
  };

  const enterEditMode = () => setViewMode(false);

  const handleDelete = async () => {
    if (!deletingDevice) return;
    const { error } = await supabase
      .from("edge_devices")
      .delete()
      .eq("id", deletingDevice.id);

    if (error) {
      toast.error("Erro ao deletar dispositivo");
    } else {
      toast.success("Dispositivo deletado com sucesso");
      setDeletingDevice(null);
      fetchDevices();
    }
  };

  const copyToken = (token: string | null) => {
    if (!token) return;
    navigator.clipboard.writeText(token);
    toast.success("Token copiado para a área de transferência");
  };

  const getStatusMeta = (device: EdgeDevice) => {
    const hasSeen = !!device.last_seen;
    const isOnline = hasSeen && (new Date().getTime() - new Date(device.last_seen!).getTime()) < 300000;
    if (isOnline) {
      return {
        label: "Online",
        dot: "bg-green-500",
        badge: "bg-green-100 text-green-700",
        border: "border-l-green-500",
        icon: <Wifi className="h-3 w-3 mr-1" />,
      };
    }
    if (!hasSeen) {
      return {
        label: "Em setup",
        dot: "bg-yellow-500",
        badge: "bg-yellow-100 text-yellow-700",
        border: "border-l-yellow-500",
        icon: <RefreshCw className="h-3 w-3 mr-1" />,
      };
    }
    return {
      label: "Offline",
      dot: "bg-red-500",
      badge: "bg-red-100 text-red-700",
      border: "border-l-red-500",
      icon: <WifiOff className="h-3 w-3 mr-1" />,
    };
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-gray-900 uppercase">
            Edge <span className="brand-text">Devices</span>
          </h1>
          <p className="text-muted-foreground mt-1 font-medium text-lg">
            Gerencie seus servidores locais de processamento de vídeo.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="icon" onClick={fetchDevices} disabled={loading} className="rounded-xl border-gray-200 h-12 w-12 shadow-sm bg-white hover:bg-gray-50">
            <RefreshCw className={`h-5 w-5 text-gray-400 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={openCreateDialog} className="brand-gradient brand-glow text-white font-black uppercase tracking-widest px-6 h-12 rounded-xl transition-transform hover:scale-[1.02]">
            <Plus className="mr-2 h-5 w-5" /> Novo Device
          </Button>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="rounded-2xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight text-gray-900">
              {viewMode ? editingDevice?.name : (editingDevice ? "Editar Servidor" : "Provisionar Servidor")}
            </DialogTitle>
          </DialogHeader>
          {viewMode ? (
            <div className="grid gap-6 py-6">
              <div className="grid gap-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Cliente Responsável</Label>
                <p className="text-sm font-medium">{clientNameOf(newClientId)}</p>
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nome do Dispositivo</Label>
                <p className="text-sm font-medium">{newName}</p>
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Hostname</Label>
                <p className="text-sm font-medium">{newHostname || "—"}</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 py-6">
              <div className="grid gap-2">
                <Label htmlFor="client" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Cliente Responsável *</Label>
                <select
                  id="client"
                  value={newClientId}
                  onChange={(e) => setNewClientId(e.target.value)}
                  className="rounded-xl border border-gray-100 bg-gray-50 h-12 px-3 text-sm font-medium focus:border-brand-orange focus:ring-brand-orange"
                >
                  <option value="">Selecione um cliente</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}{c.is_frozen ? " (congelado)" : ""}
                    </option>
                  ))}
                </select>
                {clients.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nenhum cliente cadastrado. <a href="/admin/clients" className="text-brand-orange font-bold underline">Cadastre um cliente primeiro</a>.
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nome do Dispositivo</Label>
                <Input id="name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Edge Server Arena 1" className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:border-brand-orange focus:ring-brand-orange" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="hostname" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Hostname (Opcional)</Label>
                <Input id="hostname" value={newHostname} onChange={(e) => setNewHostname(e.target.value)} placeholder="Ex: edge-01.local" className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:border-brand-orange focus:ring-brand-orange" />
              </div>
            </div>
          )}
          <DialogFooter>
            {viewMode ? (
              <>
                <Button variant="ghost" onClick={() => { setIsDialogOpen(false); resetForm(); }} className="rounded-xl font-bold">Fechar</Button>
                <Button onClick={enterEditMode} className="brand-gradient text-white font-black uppercase tracking-widest px-8 rounded-xl h-12">Editar Device</Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => { setIsDialogOpen(false); resetForm(); }} className="rounded-xl font-bold">Cancelar</Button>
                <Button onClick={handleSubmit} className="brand-gradient text-white font-black uppercase tracking-widest px-8 rounded-xl h-12">
                  {editingDevice ? "Salvar" : "Provisionar"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!scriptDevice} onOpenChange={(open) => !open && setScriptDevice(null)}>
        <DialogContent className="rounded-2xl border-none shadow-2xl max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight text-gray-900">
              Script de Instalação <span className="brand-text">Ubuntu</span>
            </DialogTitle>
          </DialogHeader>
          {scriptDevice && (
            <div className="space-y-5 py-4">
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-2">
                  Cole o comando abaixo no terminal do servidor Ubuntu (como root ou com sudo). Ele vai pedir <strong>o token do device</strong> e <strong>a palavra-chave</strong> exibidos aqui embaixo, validar e então instalar tudo automaticamente.
                </p>
              </div>
              <div className="rounded-xl bg-gray-900 p-4 font-mono text-xs text-green-400 overflow-x-auto">
                <code>{installCommand()}</code>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Token do device</p>
                  <div className="flex items-center gap-2">
                    <code className="text-base font-mono font-black text-gray-900 tracking-widest flex-1">{scriptDevice.edge_token ?? "—"}</code>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (scriptDevice.edge_token) {
                          navigator.clipboard.writeText(scriptDevice.edge_token);
                          toast.success("Token copiado!");
                        }
                      }}
                      className="h-7 w-7 shrink-0"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="rounded-xl border border-orange-200 p-3 bg-orange-50">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-orange-700 mb-1">Palavra-chave</p>
                  <div className="flex items-center gap-2">
                    <code className="text-base font-mono font-black text-orange-900 tracking-widest flex-1">{scriptDevice.install_passphrase ?? "—"}</code>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (scriptDevice.install_passphrase) {
                          navigator.clipboard.writeText(scriptDevice.install_passphrase);
                          toast.success("Palavra-chave copiada!");
                        }
                      }}
                      className="h-7 w-7 shrink-0"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(installCommand());
                    toast.success("Comando copiado!");
                  }}
                  className="brand-gradient text-white font-black uppercase tracking-widest rounded-xl flex-1"
                >
                  <Copy className="h-4 w-4 mr-2" /> Copiar Comando
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.open(`${window.location.origin}/install`, "_blank")}
                  className="rounded-xl font-bold border-gray-200"
                >
                  <Terminal className="h-4 w-4 mr-2" /> Ver Script
                </Button>
              </div>
              <div className="rounded-xl bg-orange-50 border border-orange-100 p-3">
                <p className="text-xs font-bold text-orange-900 uppercase tracking-widest mb-1">⚠ Importante</p>
                <p className="text-xs text-orange-800">A palavra-chave é única deste device. Guarde-a em local seguro — sem ela a instalação não é concluída.</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingDevice} onOpenChange={(open) => !open && setDeletingDevice(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black uppercase tracking-tight">Deletar Dispositivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar <strong>{deletingDevice?.name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-bold">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-red-500 hover:bg-red-600 font-black uppercase tracking-widest">
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Grid responsivo: 1 col mobile, 2 tablet, 3 desktop */}
      {devices.length === 0 ? (
        <div className="bg-white shadow-sm border border-gray-200 p-16 text-center text-muted-foreground font-medium italic rounded-2xl">
          Nenhum dispositivo provisionado. Use o botão acima para começar.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {devices.map((device) => {
            const client = clients.find((c) => c.id === device.client_id);
            const status = getStatusMeta(device);
            return (
              <article
                key={device.id}
                className="group relative bg-white rounded-2xl border border-gray-200/80 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-gray-300 transition-all duration-200 overflow-hidden flex flex-col"
              >
                {/* Header row: status pill + row actions */}
                <div className="flex items-center justify-between px-5 pt-4">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${status.badge}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                    {status.label}
                  </span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(device)}
                      className="h-8 w-8 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100"
                      aria-label="Editar"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingDevice(device)}
                      className="h-8 w-8 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                      aria-label="Deletar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Identidade: ícone + nome + cliente */}
                <div className="px-5 pt-3 pb-4 flex items-start gap-3">
                  <div className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/10 flex items-center justify-center text-brand-orange">
                    <HardDrive className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-[17px] leading-tight text-gray-900 truncate">
                      {device.name}
                    </h3>
                    <div className="mt-1 flex items-center gap-2 min-w-0">
                      {client ? (
                        <>
                          <span className="text-xs font-medium text-gray-500 truncate">{client.nome}</span>
                          {client.is_frozen && (
                            <span className="shrink-0 inline-flex items-center rounded-md bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide">
                              Congelado
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs italic text-gray-400">sem cliente</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Meta: hostname, token, last seen */}
                <div className="px-5 pb-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 w-16 shrink-0">Host</span>
                    <span className="font-mono text-gray-600 truncate">
                      {device.hostname || <span className="text-gray-300">não configurado</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 w-16 shrink-0">Token</span>
                    <code className="font-mono font-semibold text-gray-800 truncate flex-1">
                      {device.edge_token ?? "—"}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyToken(device.edge_token)}
                      className="shrink-0 h-6 w-6 rounded-md text-gray-400 hover:text-gray-900 hover:bg-gray-100 inline-flex items-center justify-center transition-colors"
                      aria-label="Copiar token"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 w-16 shrink-0">Visto</span>
                    <span className="text-gray-500">
                      {device.last_seen
                        ? formatDistanceToNow(new Date(device.last_seen), { addSuffix: true, locale: ptBR })
                        : "nunca"}
                    </span>
                  </div>
                </div>

                {/* Ações principais */}
                <div className="mt-auto grid grid-cols-2 border-t border-gray-100 divide-x divide-gray-100">
                  <button
                    type="button"
                    onClick={() => copyToken(device.edge_token)}
                    className="inline-flex items-center justify-center gap-2 h-11 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copiar Token
                  </button>
                  <button
                    type="button"
                    onClick={() => setScriptDevice(device)}
                    className="inline-flex items-center justify-center gap-2 h-11 text-xs font-semibold text-brand-orange hover:bg-orange-50 transition-colors"
                  >
                    <Terminal className="h-3.5 w-3.5" /> Script Setup
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
