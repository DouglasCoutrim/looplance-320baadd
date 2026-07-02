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
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (device: EdgeDevice) => {
    setEditingDevice(device);
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
        setIsDialogOpen(false);
        resetForm();
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

  const getStatusBadge = (device: EdgeDevice) => {
    const isOnline = device.last_seen && (new Date().getTime() - new Date(device.last_seen).getTime()) < 300000;
    if (isOnline) {
      return (
        <Badge className="bg-green-500 hover:bg-green-600 font-bold uppercase tracking-widest text-[10px] rounded-full px-3 py-1">
          <Wifi className="h-3 w-3 mr-1" /> Online
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="font-bold uppercase tracking-widest text-[10px] rounded-full px-3 py-1 bg-gray-100 text-gray-400">
        <WifiOff className="h-3 w-3 mr-1" /> Offline
      </Badge>
    );
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
              {editingDevice ? "Editar Servidor" : "Provisionar Servidor"}
            </DialogTitle>
          </DialogHeader>
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
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setIsDialogOpen(false); resetForm(); }} className="rounded-xl font-bold">Cancelar</Button>
            <Button onClick={handleSubmit} className="brand-gradient text-white font-black uppercase tracking-widest px-8 rounded-xl h-12">
              {editingDevice ? "Salvar" : "Provisionar"}
            </Button>
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
                    <code className="text-xs font-mono text-gray-900 break-all flex-1">{scriptDevice.id}</code>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => { navigator.clipboard.writeText(scriptDevice.id); toast.success("Token copiado!"); }}
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

      <div className="glass-card bg-white shadow-xl border border-gray-100 overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50/50 border-b border-gray-100">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4 px-6">Dispositivo</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4 px-6">Endereço (Hostname)</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4 px-6">Status</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4 px-6 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-40 text-center text-muted-foreground font-medium italic">
                  Nenhum dispositivo provisionado. Use o botão acima para começar.
                </TableCell>
              </TableRow>
            ) : (
              devices.map((device) => (
                <TableRow key={device.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-50 last:border-0 group">
                  <TableCell className="py-5 px-6">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-brand-orange transition-colors group-hover:brand-gradient group-hover:text-white">
                        <HardDrive className="h-6 w-6" />
                      </div>
                      <div>
                        <span className="font-black text-lg text-gray-900 uppercase tracking-tight">{device.name}</span>
                        <p className="text-xs font-medium text-muted-foreground">Token: {device.edge_token?.slice(0, 8)}...</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-5 px-6 font-mono text-xs font-bold text-gray-500">
                    {device.hostname || "não configurado"}
                  </TableCell>
                  <TableCell className="py-5 px-6">
                    {getStatusBadge(device)}
                    <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-tighter">
                      Visto {device.last_seen
                        ? formatDistanceToNow(new Date(device.last_seen), { addSuffix: true, locale: ptBR })
                        : "nunca"}
                    </p>
                  </TableCell>
                  <TableCell className="text-right py-5 px-6">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setScriptDevice(device)}
                        className="rounded-xl font-black uppercase tracking-widest text-[10px] px-3 border border-gray-100 hover:bg-gray-50 text-brand-orange"
                      >
                        <Terminal className="h-3.5 w-3.5 mr-1.5" /> Script Setup
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToken(device.edge_token)}
                        className="rounded-xl font-black uppercase tracking-widest text-[10px] px-3 border border-gray-100 hover:bg-gray-50"
                      >
                        Copiar Token
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(device)} className="h-10 w-10 rounded-xl text-gray-400 hover:text-brand-orange hover:bg-brand-orange/5">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeletingDevice(device)} className="h-10 w-10 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-500/5">
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
