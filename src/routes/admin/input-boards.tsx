import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, RefreshCw, Usb, Edit2, Trash2, HardDrive } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
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

export const Route = createFileRoute("/admin/input-boards")({
  component: InputBoards,
});

interface InputBoard {
  id: string;
  name: string;
  edge_device_id: string | null;
  vendor_id: string | null;
  product_id: string | null;
  device_name: string | null;
  created_at: string | null;
  edge_devices?: { name: string } | null;
}

interface EdgeDevice {
  id: string;
  name: string;
}

function InputBoards() {
  const [boards, setBoards] = useState<InputBoard[]>([]);
  const [devices, setDevices] = useState<EdgeDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InputBoard | null>(null);
  const [deleting, setDeleting] = useState<InputBoard | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [edgeDeviceId, setEdgeDeviceId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [productId, setProductId] = useState("");
  const [deviceName, setDeviceName] = useState("");

  const fetchData = async () => {
    setLoading(true);
    const [boardsRes, devicesRes] = await Promise.all([
      supabase.from("input_boards").select("*, edge_devices(name)").order("created_at", { ascending: false }),
      supabase.from("edge_devices").select("id, name").order("name")
    ]);

    if (boardsRes.error) toast.error("Erro ao buscar placas");
    else setBoards(boardsRes.data || []);

    if (devicesRes.error) toast.error("Erro ao buscar dispositivos");
    else setDevices(devicesRes.data || []);

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async () => {
    if (!name || !edgeDeviceId) {
      toast.error("Nome e Edge Device são obrigatórios");
      return;
    }

    const payload = {
      name,
      edge_device_id: edgeDeviceId,
      vendor_id: vendorId,
      product_id: productId,
      device_name: deviceName,
    };

    const { error } = editing
      ? await supabase.from("input_boards").update(payload).eq("id", editing.id)
      : await supabase.from("input_boards").insert([payload]);

    if (error) {
      toast.error(editing ? "Erro ao atualizar placa" : "Erro ao criar placa");
    } else {
      toast.success(editing ? "Placa atualizada" : "Placa criada com sucesso");
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    }
  };

  const resetForm = () => {
    setName("");
    setEdgeDeviceId("");
    setVendorId("");
    setProductId("");
    setDeviceName("");
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEdit = (b: InputBoard) => {
    setEditing(b);
    setName(b.name);
    setEdgeDeviceId(b.edge_device_id ?? "");
    setVendorId(b.vendor_id ?? "");
    setProductId(b.product_id ?? "");
    setDeviceName(b.device_name ?? "");
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("input_boards").delete().eq("id", deleting.id);
    if (error) toast.error("Erro ao excluir placa");
    else {
      toast.success("Placa excluída");
      fetchData();
    }
    setDeleting(null);
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-gray-900 uppercase">
            Input <span className="brand-text">Boards</span>
          </h1>
          <p className="text-muted-foreground mt-1 font-medium text-lg">
            Gerencie suas interfaces USB Zero Delay conectadas aos servidores.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading} className="rounded-xl border-gray-200 h-12 w-12 shadow-sm bg-white hover:bg-gray-50">
            <RefreshCw className={`h-5 w-5 text-gray-400 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} className="brand-gradient brand-glow text-white font-black uppercase tracking-widest px-6 h-12 rounded-xl transition-transform hover:scale-[1.02]">
                <Plus className="mr-2 h-5 w-5" /> Nova Placa
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl border-none shadow-2xl overflow-hidden p-0">
               <div className="brand-gradient p-6 text-white">
                <DialogTitle className="text-2xl font-black uppercase tracking-tight">{editing ? "Editar Interface USB" : "Adicionar Interface USB"}</DialogTitle>
                <p className="text-white/70 text-sm font-bold uppercase tracking-widest mt-1">Placas Zero Delay & Gatilhos</p>
              </div>

              <div className="p-8 space-y-6">
                <div className="grid gap-2">
                  <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nome da Interface</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Placa Quadra 1 - Principal" className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:ring-brand-orange" />
                </div>
                <div className="grid gap-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Servidor Vinculado (Edge Device)</Label>
                  <Select value={edgeDeviceId} onValueChange={setEdgeDeviceId}>
                    <SelectTrigger className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:ring-brand-orange">
                      <SelectValue placeholder="Selecione o dispositivo" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-xl border-gray-100">
                      {devices.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="vendor_id" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Vendor ID (HEX)</Label>
                    <Input id="vendor_id" value={vendorId} onChange={(e) => setVendorId(e.target.value)} placeholder="Ex: 0079" className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:ring-brand-orange font-mono" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="product_id" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Product ID (HEX)</Label>
                    <Input id="product_id" value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="Ex: 0006" className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:ring-brand-orange font-mono" />
                  </div>
                </div>
              </div>
              <DialogFooter className="bg-gray-50 p-6 flex justify-end gap-3 border-t border-gray-100">
                <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="font-bold rounded-xl">Cancelar</Button>
                <Button onClick={handleSubmit} className="brand-gradient text-white font-black uppercase tracking-widest px-8 h-12 rounded-xl shadow-lg shadow-brand-orange/20">{editing ? "Salvar Alterações" : "Cadastrar Placa"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="glass-card bg-white shadow-xl border border-gray-100 overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50/50 border-b border-gray-100">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4 px-6">Interface / ID</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4 px-6">Conexão Edge</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4 px-6 text-center">Identificação HW</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4 px-6">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {boards.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-40 text-center text-muted-foreground font-medium italic">
                  Nenhuma placa USB configurada. Verifique as conexões físicas dos Edge Devices.
                </TableCell>
              </TableRow>
            ) : (
              boards.map((board) => (
                <TableRow key={board.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-50 last:border-0 group">
                  <TableCell className="py-5 px-6">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 transition-colors group-hover:brand-gradient group-hover:text-white">
                        <Usb className="h-6 w-6" />
                      </div>
                      <div>
                        <span className="font-black text-lg text-gray-900 uppercase tracking-tight">{board.name}</span>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">USB Zero Delay</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-5 px-6">
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-brand-orange" />
                      <span className="font-bold text-gray-700">{board.edge_devices?.name || "Desvinculada"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-5 px-6 text-center">
                    <Badge variant="outline" className="rounded-lg font-mono text-[10px] border-gray-200 text-gray-500 px-3 py-1 bg-gray-50">
                      {board.vendor_id}:{board.product_id}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right py-5 px-6">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(board)} className="h-10 w-10 rounded-xl text-gray-400 hover:text-brand-orange hover:bg-brand-orange/5">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleting(board)} className="h-10 w-10 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50">
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
