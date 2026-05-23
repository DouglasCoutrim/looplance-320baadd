import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, RefreshCw, Camera, Video, Monitor } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/cameras")({
  component: Cameras,
});

const BUTTON_MAPPING = [
  { label: "K1 - Button 0", value: 0 },
  { label: "K2 - Button 1", value: 1 },
  { label: "K3 - Button 2", value: 2 },
  { label: "K4 - Button 3", value: 3 },
  { label: "K5 - Button 4", value: 4 },
  { label: "K6 - Button 5", value: 5 },
  { label: "K7 - Button 6", value: 6 },
  { label: "K8 - Button 7", value: 7 },
  { label: "K9 - Button 8", value: 8 },
  { label: "K10 - Button 9", value: 9 },
  { label: "K11 - Button 10", value: 10 },
  { label: "K12 - Button 11", value: 11 },
];

interface CameraType {
  id: string;
  name: string;
  rtsp_url: string | null;
  quadra_id: string | null;
  edge_device_id: string | null;
  input_board_id: string | null;
  trigger_button: number | null;
  replay_seconds: number | null;
  active: boolean | null;
  quadras?: { nome: string; arena_id: string; arenas?: { nome: string } | null } | null;
  edge_devices?: { name: string } | null;
  input_boards?: { name: string } | null;
}

function Cameras() {
  const [cameras, setCameras] = useState<CameraType[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [boards, setBoards] = useState<any[]>([]);
  const [quadras, setQuadras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    rtsp_url: "",
    quadra_id: "",
    edge_device_id: "",
    input_board_id: "",
    trigger_button: "0",
    replay_seconds: "15",
    active: true,
  });

  const fetchData = async () => {
    setLoading(true);
    const [camerasRes, devicesRes, boardsRes, quadrasRes] = await Promise.all([
      supabase.from("cameras").select("*, quadras(nome, arena_id, arenas(nome)), edge_devices(name), input_boards(name)").order("created_at", { ascending: false }),
      supabase.from("edge_devices").select("id, name").order("name"),
      supabase.from("input_boards").select("id, name, edge_device_id").order("name"),
      supabase.from("quadras").select("id, nome, arenas(nome)").order("nome")
    ]);

    setCameras(camerasRes.data || []);
    setDevices(devicesRes.data || []);
    setBoards(boardsRes.data || []);
    setQuadras(quadrasRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async () => {
    if (!formData.name || !formData.quadra_id) {
      toast.error("Nome e Quadra são obrigatórios");
      return;
    }

    const { error } = await supabase
      .from("cameras")
      .insert([{
        ...formData,
        trigger_button: parseInt(formData.trigger_button),
        replay_seconds: parseInt(formData.replay_seconds),
        edge_device_id: formData.edge_device_id || null,
        input_board_id: formData.input_board_id || null,
      }]);

    if (error) {
      toast.error("Erro ao criar câmera");
    } else {
      toast.success("Câmera criada com sucesso");
      setIsDialogOpen(false);
      fetchData();
    }
  };

  const filteredBoards = formData.edge_device_id 
    ? boards.filter(b => b.edge_device_id === formData.edge_device_id)
    : boards;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cameras</h1>
          <p className="text-muted-foreground">Configure o mapeamento de RTSP e Botões.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Nova Câmera
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Configurar Nova Câmera</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-6 py-4">
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label>Nome da Câmera</Label>
                    <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="Ex: Câmera Principal Quadra 1" />
                  </div>
                  <div className="grid gap-2">
                    <Label>RTSP URL</Label>
                    <Input value={formData.rtsp_url} onChange={(e) => setFormData({...formData, rtsp_url: e.target.value})} placeholder="rtsp://user:pass@ip:554/stream" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Quadra (Court)</Label>
                    <Select value={formData.quadra_id} onValueChange={(v) => setFormData({...formData, quadra_id: v})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a quadra" />
                      </SelectTrigger>
                      <SelectContent>
                        {quadras.map((q) => (
                          <SelectItem key={q.id} value={q.id}>{q.arenas?.nome} - {q.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Duração do Replay (segundos)</Label>
                    <Input type="number" value={formData.replay_seconds} onChange={(e) => setFormData({...formData, replay_seconds: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label>Edge Device</Label>
                    <Select value={formData.edge_device_id} onValueChange={(v) => setFormData({...formData, edge_device_id: v})}>
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
                  <div className="grid gap-2">
                    <Label>Input Board</Label>
                    <Select value={formData.input_board_id} onValueChange={(v) => setFormData({...formData, input_board_id: v})} disabled={!formData.edge_device_id}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a placa" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredBoards.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Botão de Gatilho (Trigger)</Label>
                    <Select value={formData.trigger_button} onValueChange={(v) => setFormData({...formData, trigger_button: v})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Mapeamento do botão" />
                      </SelectTrigger>
                      <SelectContent>
                        {BUTTON_MAPPING.map((b) => (
                          <SelectItem key={b.value} value={b.value.toString()}>{b.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 pt-4">
                    <Switch id="active" checked={formData.active} onCheckedChange={(v) => setFormData({...formData, active: v})} />
                    <Label htmlFor="active">Câmera Ativa</Label>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreate}>Salvar Configuração</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="rounded-md border bg-white dark:bg-gray-800 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Câmera</TableHead>
              <TableHead>Arena / Quadra</TableHead>
              <TableHead>Edge / Board</TableHead>
              <TableHead>Gatilho</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cameras.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  {loading ? "Carregando..." : "Nenhuma câmera configurada."}
                </TableCell>
              </TableRow>
            ) : (
              cameras.map((camera) => (
                <TableRow key={camera.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-orange-500/10 p-2">
                        <Video className="h-4 w-4 text-brand-orange" />
                      </div>
                      <div>
                        <div className="font-medium">{camera.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[150px] font-mono">{camera.rtsp_url}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{camera.quadras?.arenas?.nome}</div>
                    <div className="text-xs text-muted-foreground">{camera.quadras?.nome}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{camera.edge_devices?.name || "-"}</div>
                    <div className="text-xs text-muted-foreground">{camera.input_boards?.name || "-"}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">
                      K{ (camera.trigger_button ?? 0) + 1 } (Btn {camera.trigger_button})
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {camera.active ? (
                      <Badge className="bg-green-500">Ativa</Badge>
                    ) : (
                      <Badge variant="secondary">Inativa</Badge>
                    )}
                  </TableCell>
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