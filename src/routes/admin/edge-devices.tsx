import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Copy, RefreshCw, HardDrive, Edit2, Trash2, Wifi, WifiOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  created_at: string | null;
  arena_id: string | null;
  arenas?: { nome: string } | null;
}

function EdgeDevices() {
  const [devices, setDevices] = useState<EdgeDevice[]>([]);
  const [arenas, setArenas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<EdgeDevice | null>(null);
  const [newName, setNewName] = useState("");
  const [newHostname, setNewHostname] = useState("");
  const [selectedArenaId, setSelectedArenaId] = useState("");

  const fetchData = async () => {
    setLoading(true);
    const [devicesRes, arenasRes] = await Promise.all([
      supabase.from("edge_devices").select("*, arenas(nome)").order("created_at", { ascending: false }),
      supabase.from("arenas").select("id, nome").order("nome")
    ]);

    if (devicesRes.error) {
      console.error("Erro ao buscar dispositivos:", devicesRes.error);
      toast.error("Erro ao buscar dispositivos: " + devicesRes.error.message);
    } else {
      console.log("Dispositivos carregados:", devicesRes.data);
      setDevices(devicesRes.data || []);
    }
    
    if (!arenasRes.error) {
      setArenas(arenasRes.data || []);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async () => {
    if (!newName) {
      toast.error("Nome é obrigatório");
      return;
    }

    if (editingDevice) {
      const { error } = await supabase
        .from("edge_devices")
        .update({ 
          name: newName, 
          hostname: newHostname, 
          arena_id: selectedArenaId || null
        })
        .eq("id", editingDevice.id);

      if (error) {
        toast.error("Erro ao atualizar dispositivo");
      } else {
        toast.success("Dispositivo atualizado com sucesso");
        setIsDialogOpen(false);
        setEditingDevice(null);
        setNewName("");
        setNewHostname("");
        setSelectedArenaId("");
        fetchData();
      }
    } else {
      const { error } = await supabase
        .from("edge_devices")
        .insert([{ 
          name: newName, 
          hostname: newHostname, 
          status: "offline",
          arena_id: selectedArenaId || null
        }]);

      if (error) {
        toast.error("Erro ao criar dispositivo");
      } else {
        toast.success("Dispositivo criado com sucesso");
        setIsDialogOpen(false);
        setNewName("");
        setNewHostname("");
        setSelectedArenaId("");
        fetchData();
      }
    }
  };

  const openEditDialog = (device: EdgeDevice) => {
    setEditingDevice(device);
    setNewName(device.name);
    setNewHostname(device.hostname || "");
    setSelectedArenaId(device.arena_id || "");
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este dispositivo?")) return;
    
    const { error } = await supabase.from("edge_devices").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir dispositivo: " + error.message);
    } else {
      toast.success("Dispositivo excluído com sucesso");
      fetchData();
    }
  };

  const copyToken = (token: string | null) => {
    if (!token) return;
    navigator.clipboard.writeText(token);
    toast.success("Token copiado para a área de transferência");
  };

  const getStatusBadge = (device: EdgeDevice) => {
    const isOnline = device.last_seen && (new Date().getTime() - new Date(device.last_seen).getTime()) < 300000; // 5 minutes
    if (isOnline) {
      return (
        <Badge variant="online" className="font-bold uppercase tracking-widest text-[10px] rounded-full px-3 py-1">
          <Wifi className="h-3 w-3 mr-1" /> Online
        </Badge>
      );
    }
    return (
      <Badge variant="offline" className="font-bold uppercase tracking-widest text-[10px] rounded-full px-3 py-1">
        <WifiOff className="h-3 w-3 mr-1" /> Offline
      </Badge>
    );
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-primary uppercase">
            Edge <span className="brand-text">Devices</span>
          </h1>
          <p className="text-secondary mt-1 font-medium text-lg">
            Gerencie seus servidores locais de processamento de vídeo.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading} className="rounded-xl border-border h-12 w-12 shadow-sm bg-surface hover:bg-tag">
            <RefreshCw className={`h-5 w-5 text-muted ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingDevice(null);
              setNewName("");
              setNewHostname("");
              setSelectedArenaId("");
            }
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingDevice(null); setNewName(""); setNewHostname(""); setSelectedArenaId(""); }} className="bg-brand brand-glow text-white font-black uppercase tracking-widest px-6 h-12 rounded-xl transition-transform hover:scale-[1.02]">
                <Plus className="mr-2 h-5 w-5" /> Novo Device
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[20px] border border-border shadow-subtle bg-surface">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight text-primary">{editingDevice ? "Editar Servidor" : "Provisionar Servidor"}</DialogTitle>
                <DialogDescription className="text-sm font-bold uppercase tracking-widest text-secondary">
                  {editingDevice ? "Atualize as configurações deste servidor edge." : "Configure um novo nó de processamento local (Edge) para sua rede."}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-6">
                <div className="grid gap-2">
                  <Label htmlFor="name" className="text-xs font-black uppercase tracking-widest text-secondary">Nome do Dispositivo</Label>
                  <Input id="name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Edge Server Arena 1" className="rounded-xl border-border bg-input h-12 focus:border-brand focus:ring-brand" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="hostname" className="text-xs font-black uppercase tracking-widest text-secondary">Hostname (Opcional)</Label>
                  <Input id="hostname" value={newHostname} onChange={(e) => setNewHostname(e.target.value)} placeholder="Ex: edge-01.local" className="rounded-xl border-border bg-input h-12 focus:border-brand focus:ring-brand" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="arena" className="text-xs font-black uppercase tracking-widest text-secondary">Arena</Label>
                  <Select value={selectedArenaId} onValueChange={setSelectedArenaId}>
                    <SelectTrigger className="rounded-xl border-border bg-input h-12 focus:border-brand focus:ring-brand">
                      <SelectValue placeholder="Selecione a arena deste servidor" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-subtle border-border">
                      {arenas.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl font-bold">Cancelar</Button>
                <Button onClick={handleSave} className="bg-brand text-white font-black uppercase tracking-widest px-8 rounded-xl h-12">{editingDevice ? "Atualizar" : "Provisionar"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="glass-card bg-surface shadow-subtle border border-border overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader className="bg-tag border-b border-border">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted py-4 px-6">Dispositivo</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted py-4 px-6">Endereço (Hostname)</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted py-4 px-6">Status</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted py-4 px-6 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-40 text-center text-secondary font-medium italic">
                  Nenhum dispositivo provisionado. Use o botão acima para começar.
                </TableCell>
              </TableRow>
            ) : (
              devices.map((device) => (
                <TableRow key={device.id} className="hover:bg-bg-card-hover transition-colors border-b border-border last:border-0 group">
                  <TableCell className="py-5 px-6">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-brand-dim flex items-center justify-center text-brand transition-colors group-hover:bg-brand group-hover:text-white">
                        <HardDrive className="h-6 w-6" />
                      </div>
                      <div>
                        <span className="font-black text-lg text-primary uppercase tracking-tight">{device.name}</span>
                        {device.arenas && (
                          <Badge variant="brand" className="ml-2 text-[8px]">
                            {device.arenas.nome}
                          </Badge>
                        )}
                        <p className="text-xs font-medium text-secondary">Token: {device.edge_token?.slice(0, 8)}...</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-5 px-6 font-mono text-xs font-bold text-secondary">
                    {device.hostname || "não configurado"}
                  </TableCell>
                  <TableCell className="py-5 px-6">
                    {getStatusBadge(device)}
                    <p className="text-[10px] font-bold text-muted mt-1 uppercase tracking-tighter">
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
                        onClick={() => copyToken(device.edge_token)}
                        className="rounded-xl font-black uppercase tracking-widest text-[10px] px-3 border border-border hover:bg-tag"
                      >
                        Copiar Token
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => openEditDialog(device)}
                        className="h-10 w-10 rounded-xl text-muted hover:text-brand hover:bg-brand/5"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(device.id)}
                        className="h-10 w-10 rounded-xl text-muted hover:text-danger hover:bg-danger/10"
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
