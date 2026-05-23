import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, RefreshCw, Usb } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
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

  const handleCreate = async () => {
    if (!name || !edgeDeviceId) {
      toast.error("Nome e Edge Device são obrigatórios");
      return;
    }

    const { error } = await supabase
      .from("input_boards")
      .insert([{ 
        name, 
        edge_device_id: edgeDeviceId, 
        vendor_id: vendorId, 
        product_id: productId, 
        device_name: deviceName 
      }]);

    if (error) {
      toast.error("Erro ao criar placa");
    } else {
      toast.success("Placa criada com sucesso");
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
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Input Boards</h1>
          <p className="text-muted-foreground">Gerencie suas placas USB Zero Delay conectadas.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Nova Placa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Nova Placa USB</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nome Amigável</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Placa Quadra 1" />
                </div>
                <div className="grid gap-2">
                  <Label>Edge Device Vinculado</Label>
                  <Select value={edgeDeviceId} onValueChange={setEdgeDeviceId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o dispositivo" />
                    </SelectTrigger>
                    <SelectContent>
                      {devices.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="vendor_id">Vendor ID (HEX)</Label>
                    <Input id="vendor_id" value={vendorId} onChange={(e) => setVendorId(e.target.value)} placeholder="Ex: 0079" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="product_id">Product ID (HEX)</Label>
                    <Input id="product_id" value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="Ex: 0006" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="device_name">Nome do Dispositivo (OS)</Label>
                  <Input id="device_name" value={deviceName} onChange={(e) => setDeviceName(e.target.value)} placeholder="Ex: DragonRise Inc. Generic USB Joystick" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreate}>Criar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="rounded-md border bg-white dark:bg-gray-800 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Placa</TableHead>
              <TableHead>Edge Device</TableHead>
              <TableHead>IDs (Vendor/Product)</TableHead>
              <TableHead>Dispositivo OS</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {boards.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  {loading ? "Carregando..." : "Nenhuma placa encontrada."}
                </TableCell>
              </TableRow>
            ) : (
              boards.map((board) => (
                <TableRow key={board.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-blue-500/10 p-2">
                        <Usb className="h-4 w-4 text-blue-500" />
                      </div>
                      <span className="font-medium">{board.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{board.edge_devices?.name || "Não vinculado"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {board.vendor_id && board.product_id ? `${board.vendor_id}:${board.product_id}` : "-"}
                  </TableCell>
                  <TableCell className="text-sm truncate max-w-[200px]">{board.device_name || "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">Editar</Button>
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