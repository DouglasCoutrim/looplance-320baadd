import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, RefreshCw, MapPin, Edit2, Trash2 } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/arenas")({
  component: Arenas,
});

interface Arena {
  id: string;
  nome: string;
  edge_device_id: string | null;
  created_at?: string;
}

interface Client {
  id: string;
  nome: string;
}

interface EdgeDevice {
  id: string;
  name: string;
  client_id: string | null;
}

function Arenas() {
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [edges, setEdges] = useState<EdgeDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [edgeId, setEdgeId] = useState<string>("");
  const [editing, setEditing] = useState<Arena | null>(null);
  const [deleting, setDeleting] = useState<Arena | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: a, error: e1 }, { data: c }, { data: ed }] = await Promise.all([
      supabase.from("arenas").select("id, nome, edge_device_id, created_at").order("nome"),
      supabase.from("clients").select("id, nome").order("nome"),
      supabase.from("edge_devices").select("id, name, client_id").order("name"),
    ]);
    if (e1) toast.error("Erro ao buscar arenas");
    else setArenas(a || []);
    setClients(c || []);
    setEdges(ed || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const filteredEdges = useMemo(
    () => (clientId ? edges.filter((e) => e.client_id === clientId) : []),
    [edges, clientId]
  );

  const openCreate = () => {
    setEditing(null);
    setName(""); setClientId(""); setEdgeId("");
    setIsDialogOpen(true);
  };

  const openEdit = (a: Arena) => {
    setEditing(a);
    setName(a.nome);
    const edge = edges.find((e) => e.id === a.edge_device_id);
    setClientId(edge?.client_id ?? "");
    setEdgeId(a.edge_device_id ?? "");
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return toast.error("Informe o nome da arena");
    if (!clientId) return toast.error("Selecione o cliente");
    if (!edgeId) return toast.error("Selecione o Edge Device");

    const payload = { nome: name.trim(), edge_device_id: edgeId };
    if (editing) {
      const { error } = await supabase.from("arenas").update(payload).eq("id", editing.id);
      if (error) return toast.error("Erro ao atualizar arena");
      toast.success("Arena atualizada");
    } else {
      const { error } = await supabase.from("arenas").insert([payload]);
      if (error) return toast.error("Erro ao criar arena");
      toast.success("Arena criada");
    }
    setIsDialogOpen(false);
    setEditing(null); setName(""); setClientId(""); setEdgeId("");
    fetchAll();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("arenas").delete().eq("id", deleting.id);
    if (error) toast.error("Erro ao excluir arena");
    else { toast.success("Arena excluída"); fetchAll(); }
    setDeleting(null);
  };

  const edgeName = (id: string | null) => edges.find((e) => e.id === id)?.name ?? "—";
  const clientName = (edgeDeviceId: string | null) => {
    const edge = edges.find((e) => e.id === edgeDeviceId);
    return clients.find((c) => c.id === edge?.client_id)?.nome ?? "—";
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900 uppercase">
            Arenas <span className="brand-text">Complexos</span>
          </h1>
          <p className="text-muted-foreground mt-1 font-medium text-base sm:text-lg">
            Cada arena pertence a um Edge Device de um cliente.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="icon" onClick={fetchAll} disabled={loading} className="rounded-xl border-gray-200 h-10 sm:h-12 w-10 sm:w-12 shadow-sm bg-white hover:bg-gray-50 shrink-0">
            <RefreshCw className={`h-5 w-5 text-gray-400 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) { setEditing(null); setName(""); setClientId(""); setEdgeId(""); } }}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} className="brand-gradient brand-glow text-white font-black uppercase tracking-widest px-4 sm:px-6 h-10 sm:h-12 rounded-xl transition-transform hover:scale-[1.02] text-xs sm:text-sm flex-1 sm:flex-none">
                <Plus className="mr-2 h-5 w-5" /> Nova Arena
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl border-none shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight text-gray-900">
                  {editing ? "Editar Arena" : "Adicionar Arena"}
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-5 py-6">
                <div className="grid gap-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Cliente</Label>
                  <Select value={clientId} onValueChange={(v) => { setClientId(v); setEdgeId(""); }}>
                    <SelectTrigger className="rounded-xl border-gray-100 bg-gray-50 h-12">
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Edge Device</Label>
                  <Select value={edgeId} onValueChange={setEdgeId} disabled={!clientId}>
                    <SelectTrigger className="rounded-xl border-gray-100 bg-gray-50 h-12">
                      <SelectValue placeholder={clientId ? (filteredEdges.length ? "Selecione o edge" : "Cliente sem edges cadastrados") : "Selecione um cliente primeiro"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredEdges.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="name" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nome da Arena</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Arena Guga Kuerten" className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:border-brand-orange focus:ring-brand-orange" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl font-bold">Cancelar</Button>
                <Button onClick={handleSubmit} className="brand-gradient text-white font-black uppercase tracking-widest px-8 rounded-xl h-12">Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="glass-card bg-white shadow-xl border border-gray-100 overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50/50 border-b border-gray-100">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-3 sm:py-4 px-4 sm:px-6">Arena</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-3 sm:py-4 px-4 sm:px-6 hidden md:table-cell">Cliente</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-3 sm:py-4 px-4 sm:px-6 hidden md:table-cell">Edge</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground py-3 sm:py-4 px-4 sm:px-6">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {arenas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-40 text-center text-muted-foreground font-medium italic">
                  Nenhuma arena cadastrada no momento.
                </TableCell>
              </TableRow>
            ) : (
              arenas.map((a) => (
                <TableRow key={a.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-50 last:border-0 group">
                  <TableCell className="py-4 sm:py-5 px-4 sm:px-6">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-brand-orange/10 flex items-center justify-center text-brand-orange transition-colors group-hover:brand-gradient group-hover:text-white shrink-0">
                        <MapPin className="h-5 w-5 sm:h-6 sm:w-6" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-black text-base sm:text-lg text-gray-900 uppercase tracking-tight block truncate">{a.nome}</span>
                        <p className="text-[10px] font-medium text-muted-foreground truncate md:hidden">
                          {clientName(a.edge_device_id)} • {edgeName(a.edge_device_id)}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-4 sm:py-5 px-4 sm:px-6 hidden md:table-cell text-sm font-semibold text-gray-700">
                    {clientName(a.edge_device_id)}
                  </TableCell>
                  <TableCell className="py-4 sm:py-5 px-4 sm:px-6 hidden md:table-cell text-sm font-mono text-gray-700">
                    {edgeName(a.edge_device_id)}
                  </TableCell>
                  <TableCell className="text-right py-4 sm:py-5 px-4 sm:px-6 shrink-0">
                    <div className="flex justify-end gap-1 sm:gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(a)} className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl text-gray-400 hover:text-brand-orange hover:bg-brand-orange/5 transition-colors">
                        <Edit2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleting(a)} className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir arena?</AlertDialogTitle>
            <AlertDialogDescription>
              A arena "{deleting?.nome}" será removida permanentemente. Quadras vinculadas podem ser afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-red-500 hover:bg-red-600 font-black uppercase tracking-widest">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
