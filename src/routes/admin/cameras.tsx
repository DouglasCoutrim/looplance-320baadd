import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, RefreshCw, Camera, Video, Edit2, Trash2, Zap, Copy, Radio } from "lucide-react";
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

const CAMERA_BRANDS = [
  { id: "intelbras", name: "Intelbras / Mibo", template: "rtsp://{user}:{pass}@{ip}:{port}/cam/realmonitor?channel=1&subtype=0" },
  { id: "hikvision", name: "Hikvision", template: "rtsp://{user}:{pass}@{ip}:{port}/Streaming/Channels/101" },
  { id: "dahua", name: "Dahua", template: "rtsp://{user}:{pass}@{ip}:{port}/cam/realmonitor?channel=1&subtype=0" },
  { id: "giga", name: "Giga Security", template: "rtsp://{user}:{pass}@{ip}:{port}/ch0/0" },
  { id: "tecvoz", name: "Tecvoz", template: "rtsp://{user}:{pass}@{ip}:{port}/live/ch0" },
  { id: "tplink", name: "TP-Link (Tapo)", template: "rtsp://{user}:{pass}@{ip}:{port}/stream1" },
  { id: "axis", name: "Axis", template: "rtsp://{user}:{pass}@{ip}:{port}/axis-media/media.amp?" },
  { id: "custom", name: "Personalizado", template: "" }
];

interface ProtocolSettings {
  ip?: string;
  port?: string;
  username?: string;
  password?: string;
  channel?: string;
  brand?: string;
}

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
  stream_protocol: string | null;
  rtmp_stream_key: string | null;
  protocol_settings: ProtocolSettings | null;
  quadras?: { nome: string; arena_id: string; arenas?: { nome: string } | null } | null;
  edge_devices?: { name: string } | null;
  input_boards?: { name: string } | null;
}

const RTMP_BASE = "rtmp://live.izyia.com.br/live";
const buildRtmpUrl = (key: string | null | undefined) =>
  key ? `${RTMP_BASE}/${key}` : "";

function Cameras() {
  const [cameras, setCameras] = useState<CameraType[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [boards, setBoards] = useState<any[]>([]);
  const [quadras, setQuadras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CameraType | null>(null);
  const [deleting, setDeleting] = useState<CameraType | null>(null);

  const emptyForm = {
    name: "",
    rtsp_url: "",
    quadra_id: "",
    edge_device_id: "",
    input_board_id: "",
    trigger_button: "0",
    replay_seconds: "15",
    active: true,
    stream_protocol: "rtmp" as "rtmp" | "rtsp",
    brand: "custom",
    username: "admin",
    password: "",
    ip: "",
    port: "554",
    channel: "",
  };

  // Form state
  const [formData, setFormData] = useState({ ...emptyForm });

  const generateRtspUrl = () => {
    if (formData.brand === "custom") return;
    
    const brand = CAMERA_BRANDS.find(b => b.id === formData.brand);
    if (!brand || !brand.template) return;

    let url = brand.template
      .replace("{user}", formData.username || "admin")
      .replace("{pass}", formData.password || "senha")
      .replace("{ip}", formData.ip || "192.168.1.100")
      .replace("{port}", formData.port || "554");
    
    setFormData(prev => ({ ...prev, rtsp_url: url }));
  };

  useEffect(() => {
    if (formData.brand !== "custom") {
      generateRtspUrl();
    }
  }, [formData.brand, formData.username, formData.password, formData.ip, formData.port]);

  const fetchData = async () => {
    setLoading(true);
    const [camerasRes, devicesRes, boardsRes, quadrasRes] = await Promise.all([
      supabase.from("cameras").select("*, quadras(nome, arena_id, arenas(nome)), edge_devices(name), input_boards(name)").order("created_at", { ascending: false }),
      supabase.from("edge_devices").select("id, name").order("name"),
      supabase.from("input_boards").select("id, name, edge_device_id").order("name"),
      supabase.from("quadras").select("id, nome, arenas(nome)").order("nome")
    ]);

    setCameras((camerasRes.data || []) as any as CameraType[]);
    setDevices(devicesRes.data || []);
    setBoards(boardsRes.data || []);
    setQuadras(quadrasRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);


  const handleSubmit = async () => {
    if (!formData.name || !formData.quadra_id) {
      toast.error("Nome e Quadra são obrigatórios");
      return;
    }

    const isRtsp = formData.stream_protocol === "rtsp";
    const protocol_settings = isRtsp
      ? {
          brand: formData.brand,
          ip: formData.ip,
          port: formData.port,
          username: formData.username,
          password: formData.password,
          channel: formData.channel,
        }
      : {};

    const payload: any = {
      name: formData.name,
      rtsp_url: isRtsp ? formData.rtsp_url : null,
      quadra_id: formData.quadra_id,
      edge_device_id: formData.edge_device_id || null,
      input_board_id: formData.input_board_id || null,
      trigger_button: parseInt(formData.trigger_button),
      replay_seconds: parseInt(formData.replay_seconds),
      active: formData.active,
      stream_protocol: formData.stream_protocol,
      protocol_settings,
    };

    const { error } = editing
      ? await supabase.from("cameras").update(payload).eq("id", editing.id)
      : await supabase.from("cameras").insert([payload]);

    if (error) {
      toast.error(editing ? "Erro ao atualizar câmera" : "Erro ao criar câmera");
    } else {
      toast.success(editing ? "Câmera atualizada" : "Câmera criada com sucesso");
      setIsDialogOpen(false);
      setEditing(null);
      setFormData(emptyForm);
      fetchData();
    }
  };

  const openCreate = () => {
    setEditing(null);
    setFormData(emptyForm);
    setIsDialogOpen(true);
  };

  const openEdit = (c: CameraType) => {
    const ps = (c.protocol_settings ?? {}) as ProtocolSettings;
    setEditing(c);
    setFormData({
      ...emptyForm,
      name: c.name,
      rtsp_url: c.rtsp_url ?? "",
      quadra_id: c.quadra_id ?? "",
      edge_device_id: c.edge_device_id ?? "",
      input_board_id: c.input_board_id ?? "",
      trigger_button: String(c.trigger_button ?? 0),
      replay_seconds: String(c.replay_seconds ?? 15),
      active: c.active ?? true,
      stream_protocol: (c.stream_protocol === "rtsp" ? "rtsp" : "rtmp"),
      brand: ps.brand ?? "custom",
      username: ps.username ?? "admin",
      password: ps.password ?? "",
      ip: ps.ip ?? "",
      port: ps.port ?? "554",
      channel: ps.channel ?? "",
    });
    setIsDialogOpen(true);
  };

  const copyRtmpUrl = async (key: string | null | undefined) => {
    const url = buildRtmpUrl(key);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("URL RTMP copiada!");
    } catch {
      toast.error("Não foi possível copiar. Copie manualmente.");
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("cameras").delete().eq("id", deleting.id);
    if (error) toast.error("Erro ao excluir câmera");
    else {
      toast.success("Câmera excluída");
      fetchData();
    }
    setDeleting(null);
  };

  const [triggering, setTriggering] = useState<string | null>(null);
  const handleManualTrigger = async (camera: CameraType) => {
    if (!camera.active) {
      toast.error("Ative a câmera antes de disparar um replay");
      return;
    }
    if (!camera.edge_device_id) {
      toast.error("Câmera sem edge device vinculado");
      return;
    }
    setTriggering(camera.id);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("manual_replay_triggers").insert([{
      camera_id: camera.id,
      edge_device_id: camera.edge_device_id,
      requested_by: user?.id ?? null,
    }]);
    setTriggering(null);
    if (error) {
      toast.error("Falha ao disparar replay: " + error.message);
    } else {
      toast.success(`Replay disparado! O edge captura em até 3s (${camera.replay_seconds ?? 15}s de vídeo).`);
    }
  };

  const filteredBoards = formData.edge_device_id
    ? boards.filter(b => b.edge_device_id === formData.edge_device_id)
    : boards;

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-gray-900 uppercase">
            Câmeras <span className="brand-text">Captura</span>
          </h1>
          <p className="text-muted-foreground mt-1 font-medium text-lg">
            Mapeie fontes de vídeo RTSP e gatilhos de gravação.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading} className="rounded-xl border-gray-200 h-12 w-12 shadow-sm bg-white hover:bg-gray-50">
            <RefreshCw className={`h-5 w-5 text-gray-400 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) { setEditing(null); setFormData(emptyForm); } }}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} className="brand-gradient brand-glow text-white font-black uppercase tracking-widest px-6 h-12 rounded-xl transition-transform hover:scale-[1.02]">
                <Plus className="mr-2 h-5 w-5" /> Nova Câmera
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl rounded-2xl border-none shadow-2xl overflow-hidden p-0">
              <div className="brand-gradient p-6 text-white">
                <DialogTitle className="text-2xl font-black uppercase tracking-tight">{editing ? "Editar Câmera" : "Configurar Câmera"}</DialogTitle>
                <p className="text-white/70 text-sm font-bold uppercase tracking-widest mt-1">Integração RTSP & Edge</p>
              </div>
              
              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 max-h-[70vh] overflow-y-auto">
                <div className="space-y-6">
                  <div className="grid gap-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nome da Câmera</Label>
                    <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="Ex: Câmera Principal Quadra 1" className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:ring-brand-orange" />
                  </div>
                  
                  <div className="grid gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50/30">
                    <div className="grid gap-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Marca da Câmera</Label>
                      <Select value={formData.brand} onValueChange={(v) => setFormData({...formData, brand: v})}>
                        <SelectTrigger className="rounded-xl border-gray-100 bg-white h-12 focus:ring-brand-orange">
                          <SelectValue placeholder="Selecione a marca" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl shadow-xl border-gray-100">
                          {CAMERA_BRANDS.map((b) => (
                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.brand !== "custom" && (
                      <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="grid gap-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Usuário</Label>
                          <Input value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value})} placeholder="admin" className="rounded-xl border-gray-100 bg-white h-12 focus:ring-brand-orange" />
                        </div>
                        <div className="grid gap-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Senha</Label>
                          <Input type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} placeholder="senha" className="rounded-xl border-gray-100 bg-white h-12 focus:ring-brand-orange" />
                        </div>
                        <div className="grid gap-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Endereço IP</Label>
                          <Input value={formData.ip} onChange={(e) => setFormData({...formData, ip: e.target.value})} placeholder="192.168.1.100" className="rounded-xl border-gray-100 bg-white h-12 focus:ring-brand-orange" />
                        </div>
                        <div className="grid gap-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Porta</Label>
                          <Input value={formData.port} onChange={(e) => setFormData({...formData, port: e.target.value})} placeholder="554" className="rounded-xl border-gray-100 bg-white h-12 focus:ring-brand-orange" />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">RTSP URL Final</Label>
                    <Input value={formData.rtsp_url} onChange={(e) => setFormData({...formData, rtsp_url: e.target.value, brand: "custom"})} placeholder="rtsp://user:pass@ip:554/stream" className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:ring-brand-orange font-mono text-[10px]" />
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Quadra (Court)</Label>
                    <Select value={formData.quadra_id} onValueChange={(v) => setFormData({...formData, quadra_id: v})}>
                      <SelectTrigger className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:ring-brand-orange">
                        <SelectValue placeholder="Selecione a quadra" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl shadow-xl border-gray-100">
                        {quadras.map((q) => (
                          <SelectItem key={q.id} value={q.id}>{q.arenas?.nome} - {q.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="grid gap-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Edge Device</Label>
                    <Select value={formData.edge_device_id} onValueChange={(v) => setFormData({...formData, edge_device_id: v})}>
                      <SelectTrigger className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:ring-brand-orange">
                        <SelectValue placeholder="Selecione o servidor" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl shadow-xl border-gray-100">
                        {devices.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-4 grid-cols-2">
                    <div className="grid gap-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Botão (Gatilho)</Label>
                      <Select value={formData.trigger_button} onValueChange={(v) => setFormData({...formData, trigger_button: v})}>
                        <SelectTrigger className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:ring-brand-orange">
                          <SelectValue placeholder="Botão" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl shadow-xl border-gray-100">
                          {BUTTON_MAPPING.map((b) => (
                            <SelectItem key={b.value} value={b.value.toString()}>{b.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Seconds</Label>
                      <Input type="number" value={formData.replay_seconds} onChange={(e) => setFormData({...formData, replay_seconds: e.target.value})} className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:ring-brand-orange" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl border border-dashed border-gray-200 bg-gray-50/50">
                    <Label htmlFor="active" className="text-sm font-bold text-gray-700 uppercase tracking-tight">Câmera Ativa</Label>
                    <Switch id="active" checked={formData.active} onCheckedChange={(v) => setFormData({...formData, active: v})} className="data-[state=checked]:bg-brand-orange" />
                  </div>
                </div>
              </div>
              <DialogFooter className="bg-gray-50 p-6 flex justify-end gap-3 border-t border-gray-100">
                <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="font-bold rounded-xl">Cancelar</Button>
                <Button onClick={handleSubmit} className="brand-gradient text-white font-black uppercase tracking-widest px-8 h-12 rounded-xl shadow-lg shadow-brand-orange/20">{editing ? "Salvar Alterações" : "Salvar Configuração"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="glass-card bg-white shadow-xl border border-gray-100 overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50/50 border-b border-gray-100">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4 px-6">Identificação</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4 px-6">Localização</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4 px-6 text-center">Config / Gatilho</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4 px-6">Status</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4 px-6">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cameras.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-40 text-center text-muted-foreground font-medium italic">
                  Nenhuma câmera configurada. Comece adicionando sua primeira fonte de vídeo.
                </TableCell>
              </TableRow>
            ) : (
              cameras.map((camera) => (
                <TableRow key={camera.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-50 last:border-0 group">
                  <TableCell className="py-5 px-6">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 transition-colors group-hover:brand-gradient group-hover:text-white">
                        <Video className="h-6 w-6" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-black text-lg text-gray-900 uppercase tracking-tight block truncate">{camera.name}</span>
                        <p className="text-[10px] font-bold text-muted-foreground font-mono truncate max-w-[200px]">{camera.rtsp_url}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-5 px-6">
                    <div className="flex flex-col">
                      <span className="font-black text-xs uppercase tracking-tight text-gray-700">{camera.quadras?.arenas?.nome}</span>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">{camera.quadras?.nome}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-5 px-6 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <Badge variant="outline" className="rounded-lg font-black uppercase tracking-tighter text-[9px] border-gray-200 text-gray-600 bg-gray-50">
                        BTN K{ (camera.trigger_button ?? 0) + 1 }
                      </Badge>
                      <span className="text-[10px] font-bold text-brand-orange">{camera.replay_seconds}s Replay</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-5 px-6">
                    {camera.active ? (
                      <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-200 font-black uppercase tracking-widest text-[9px] rounded-full px-3 py-1">Ativa</Badge>
                    ) : (
                      <Badge variant="secondary" className="font-black uppercase tracking-widest text-[9px] rounded-full px-3 py-1 opacity-50">Inativa</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right py-5 px-6">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleManualTrigger(camera)}
                        disabled={triggering === camera.id}
                        title="Disparar replay manual (sem botoeira)"
                        className="h-10 w-10 rounded-xl text-gray-400 hover:text-brand-orange hover:bg-brand-orange/5"
                      >
                        <Zap className={`h-4 w-4 ${triggering === camera.id ? "animate-pulse" : ""}`} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(camera)} className="h-10 w-10 rounded-xl text-gray-400 hover:text-brand-orange hover:bg-brand-orange/5">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleting(camera)} className="h-10 w-10 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50">
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

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir câmera?</AlertDialogTitle>
            <AlertDialogDescription>
              A câmera "{deleting?.name}" será removida permanentemente.
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
