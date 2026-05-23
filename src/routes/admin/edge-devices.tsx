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
      toast.error("Erro ao buscar dispositivos");
    } else {
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

  const handleCreate = async () => {
    if (!newName) {
      toast.error("Nome é obrigatório");
      return;
    }

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
          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading} className="rounded-xl border-gray-200 h-12 w-12 shadow-sm bg-white hover:bg-gray-50">
            <RefreshCw className={`h-5 w-5 text-gray-400 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="brand-gradient brand-glow text-white font-black uppercase tracking-widest px-6 h-12 rounded-xl transition-transform hover:scale-[1.02]">
                <Plus className="mr-2 h-5 w-5" /> Novo Device
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl border-none shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight text-gray-900">Provisionar Servidor</DialogTitle>
                <DialogDescription className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60">
                  Configure um novo nó de processamento local (Edge) para sua rede.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-6">
                <div className="grid gap-2">
                  <Label htmlFor="name" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nome do Dispositivo</Label>
                  <Input id="name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Edge Server Arena 1" className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:border-brand-orange focus:ring-brand-orange" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="hostname" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Hostname (Opcional)</Label>
                  <Input id="hostname" value={newHostname} onChange={(e) => setNewHostname(e.target.value)} placeholder="Ex: edge-01.local" className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:border-brand-orange focus:ring-brand-orange" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="arena" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Arena</Label>
                  <Select value={selectedArenaId} onValueChange={setSelectedArenaId}>
                    <SelectTrigger className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:border-brand-orange focus:ring-brand-orange">
                      <SelectValue placeholder="Selecione a arena deste servidor" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-xl border-gray-100">
                      {arenas.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl font-bold">Cancelar</Button>
                <Button onClick={handleCreate} className="brand-gradient text-white font-black uppercase tracking-widest px-8 rounded-xl h-12">Provisionar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="glass-card bg-white shadow-xl border border-gray-100 overflow-hidden overflow-x-auto">
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
                        {device.arenas && (
                          <Badge variant="outline" className="ml-2 text-[8px] border-orange-200 text-brand-orange">
                            {device.arenas.nome}
                          </Badge>
                        )}
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
                        onClick={() => copyToken(device.edge_token)}
                        className="rounded-xl font-black uppercase tracking-widest text-[10px] px-3 border border-gray-100 hover:bg-gray-50"
                      >
                        Copiar Token
                      </Button>
                      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-gray-400 hover:text-brand-orange hover:bg-brand-orange/5">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(device.id)}
                        className="h-10 w-10 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
