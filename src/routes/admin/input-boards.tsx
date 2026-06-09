import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, RefreshCw, Usb, Edit2, Trash2, HardDrive } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
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
  const [editingBoard, setEditingBoard] = useState<InputBoard | null>(null);
  
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

  const handleSave = async () => {
    if (!name || !edgeDeviceId) {
      toast.error("Nome e Edge Device são obrigatórios");
      return;
    }

    const payload = { 
      name, 
      edge_device_id: edgeDeviceId, 
      vendor_id: vendorId, 
      product_id: productId, 
      device_name: deviceName 
    };

    if (editingBoard) {
      const { error } = await supabase
        .from("input_boards")
        .update(payload)
        .eq("id", editingBoard.id);

      if (error) {
        toast.error("Erro ao atualizar placa");
      } else {
        toast.success("Placa atualizada com sucesso");
        setIsDialogOpen(false);
        setEditingBoard(null);
        resetForm();
        fetchData();
      }
    } else {
      const { error } = await supabase
        .from("input_boards")
        .insert([payload]);

      if (error) {
        toast.error("Erro ao criar placa");
      } else {
        toast.success("Placa criada com sucesso");
        setIsDialogOpen(false);
        resetForm();
        fetchData();
      }
    }
  };

  const openEditDialog = (board: InputBoard) => {
    setEditingBoard(board);
    setName(board.name);
    setEdgeDeviceId(board.edge_device_id || "");
    setVendorId(board.vendor_id || "");
    setProductId(board.product_id || "");
    setDeviceName(board.device_name || "");
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta placa?")) return;
    const { error } = await supabase.from("input_boards").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir placa: " + error.message);
    else {
      toast.success("Placa excluída");
      fetchData();
    }
  };

  const resetForm = () => {
    setName("");
    setEdgeDeviceId("");
    setVendorId("");
    setProductId("");
    setDeviceName("");
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-primary uppercase">
            Input <span className="brand-text">Boards</span>
          </h1>
          <p className="text-secondary mt-1 font-medium text-lg">
            Gerencie suas interfaces USB Zero Delay conectadas aos servidores.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading} className="rounded-xl border-border h-12 w-12 shadow-sm bg-surface hover:bg-tag">
            <RefreshCw className={`h-5 w-5 text-muted ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingBoard(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingBoard(null); resetForm(); }} className="bg-brand brand-glow text-white font-black uppercase tracking-widest px-6 h-12 rounded-xl transition-transform hover:scale-[1.02]">
                <Plus className="mr-2 h-5 w-5" /> Nova Placa
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[20px] border border-border shadow-subtle overflow-hidden p-0 bg-surface">
               <div className="bg-brand-dim p-6 text-brand-text">
                 <DialogTitle className="text-2xl font-black uppercase tracking-tight">{editingBoard ? "Editar Interface USB" : "Adicionar Interface USB"}</DialogTitle>
                <DialogDescription className="text-brand-text/70 text-sm font-bold uppercase tracking-widest mt-1">
                  {editingBoard ? "Atualize as configurações desta interface USB." : "Configure uma nova interface USB Zero Delay para gatilhos de gravação."}
                </DialogDescription>
              </div>

              <div className="p-8 space-y-6">
                <div className="grid gap-2">
                  <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest text-secondary">Nome da Interface</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Placa Quadra 1 - Principal" className="rounded-xl border-border bg-input h-12 focus:ring-brand" />
                </div>
                <div className="grid gap-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-secondary">Servidor Vinculado (Edge Device)</Label>
                  <Select value={edgeDeviceId} onValueChange={setEdgeDeviceId}>
                    <SelectTrigger className="rounded-xl border-border bg-input h-12 focus:ring-brand">
                      <SelectValue placeholder="Selecione o dispositivo" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-subtle border-border">
                      {devices.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="vendor_id" className="text-[10px] font-black uppercase tracking-widest text-secondary">Vendor ID (HEX)</Label>
                    <Input id="vendor_id" value={vendorId} onChange={(e) => setVendorId(e.target.value)} placeholder="Ex: 0079" className="rounded-xl border-border bg-input h-12 focus:ring-brand font-mono" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="product_id" className="text-[10px] font-black uppercase tracking-widest text-secondary">Product ID (HEX)</Label>
                    <Input id="product_id" value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="Ex: 0006" className="rounded-xl border-border bg-input h-12 focus:ring-brand font-mono" />
                  </div>
                </div>
              </div>
              <DialogFooter className="bg-tag p-6 flex justify-end gap-3 border-t border-border">
                 <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="font-bold rounded-xl text-primary hover:bg-bg-card-hover">Cancelar</Button>
                <Button onClick={handleSave} className="bg-brand text-white font-black uppercase tracking-widest px-8 h-12 rounded-xl shadow-subtle">
                  {editingBoard ? "Salvar Alterações" : "Cadastrar Placa"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="glass-card bg-surface shadow-subtle border border-border overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader className="bg-tag border-b border-border">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted py-4 px-6">Interface / ID</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted py-4 px-6">Conexão Edge</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted py-4 px-6 text-center">Identificação HW</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-muted py-4 px-6">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {boards.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-40 text-center text-secondary font-medium italic">
                  Nenhuma placa USB configurada. Verifique as conexões físicas dos Edge Devices.
                </TableCell>
              </TableRow>
            ) : (
              boards.map((board) => (
                <TableRow key={board.id} className="hover:bg-bg-card-hover transition-colors border-b border-border last:border-0 group">
                  <TableCell className="py-5 px-6">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-brand-dim flex items-center justify-center text-brand transition-colors group-hover:bg-brand group-hover:text-white">
                        <Usb className="h-6 w-6" />
                      </div>
                      <div>
                        <span className="font-black text-lg text-primary uppercase tracking-tight">{board.name}</span>
                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest">USB Zero Delay</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-5 px-6">
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-brand" />
                      <span className="font-bold text-secondary">{board.edge_devices?.name || "Desvinculada"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-5 px-6 text-center">
                    <Badge variant="offline" className="rounded-lg font-mono text-[10px] px-3 py-1">
                      {board.vendor_id}:{board.product_id}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right py-5 px-6">
                    <div className="flex justify-end gap-2">
                       <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => openEditDialog(board)}
                        className="h-10 w-10 rounded-xl text-muted hover:text-brand hover:bg-brand/5"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(board.id)}
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
