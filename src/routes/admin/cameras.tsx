import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, RefreshCw, Video, Edit2, Trash2, Layout, Upload, Check, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { generateAndUploadOverlay } from "@/utils/overlayGenerator";
import logoImg from "@/assets/looplance-logo.png";
import ReactPlayerType from "react-player";
import Hls from "hls.js";

const ReactPlayer = ReactPlayerType as any;

const HLSPlayer = ({ url, playing, muted }: { url: string, playing: boolean, muted: boolean }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (playing) {
          video.play().catch(e => console.error("Error playing video:", e));
        }
      });
      return () => hls.destroy();
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      if (playing) {
        video.play().catch(e => console.error("Error playing video:", e));
      }
    }
  }, [url, playing]);

  return (
    <video
      ref={videoRef}
      muted={muted}
      playsInline
      className="w-full h-full object-contain"
    />
  );
};


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
  { id: "zerodelay", name: "Placa Zero Delay", template: "rtsp://{user}:{pass}@{ip}:{port}/live/ch0" },
  { id: "custom", name: "Personalizado", template: "" }
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
  aspect_ratio: string | null;
  video_width: number | null;
  video_height: number | null;
  video_x: number | null;
  video_y: number | null;
  sponsor_logo_left: string | null;
  sponsor_logo_center: string | null;
  sponsor_logo_right: string | null;
  final_overlay_url: string | null;
  quadras?: { nome: string; arena_id: string; arenas?: { nome: string; sponsor_logo_left: string | null; sponsor_logo_center: string | null; sponsor_logo_right: string | null } | null } | null;
  edge_devices?: { name: string } | null;
  input_boards?: { name: string } | null;
}


function Cameras() {
  const [cameras, setCameras] = useState<CameraType[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [boards, setBoards] = useState<any[]>([]);
  const [quadras, setQuadras] = useState<any[]>([]);
  const [arenas, setArenas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCamera, setEditingCamera] = useState<CameraType | null>(null);
  const [activePreviewCamera, setActivePreviewCamera] = useState<CameraType | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    rtsp_url: "",
    arena_id: "",
    quadra_id: "",
    edge_device_id: "",
    input_board_id: "",
    trigger_button: "0",
    replay_seconds: "15",
    active: true,
    aspect_ratio: "16:9",
    sponsor_logo_left: "",
    sponsor_logo_center: "",
    sponsor_logo_right: "",
    final_overlay_url: "",
    // Helper fields
    brand: "custom",
    username: "admin",
    password: "",
    ip: "",
    port: "554",
  });


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

  useEffect(() => {
    // Reset quadra_id if arena changes
    if (formData.arena_id) {
      const quadraInArena = quadras.find(q => q.id === formData.quadra_id && q.arena_id === formData.arena_id);
      if (!quadraInArena) {
        setFormData(prev => ({ ...prev, quadra_id: "" }));
      }

      // Auto-select edge device for this arena
      if (devices.length > 0) {
        const arenaEdge = devices.find(d => d.arena_id === formData.arena_id);
        if (arenaEdge && !formData.edge_device_id) {
          setFormData(prev => ({ ...prev, edge_device_id: arenaEdge.id }));
        }
      }
    }
  }, [formData.arena_id, devices]);

  const fetchData = async () => {
    setLoading(true);
    
    // Get current user profile
    const { data: { user } } = await supabase.auth.getUser();
    let currentProfile = null;
    
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      currentProfile = profile;
      setUserProfile(profile);
    }

    const [camerasRes, devicesRes, boardsRes, quadrasRes, arenasRes] = await Promise.all([
      supabase.from("cameras").select("*, quadras(nome, arena_id, arenas(nome, sponsor_logo_left, sponsor_logo_center, sponsor_logo_right)), edge_devices(name), input_boards(name)").order("created_at", { ascending: false }),
      supabase.from("edge_devices").select("id, name, arena_id").order("name"),
      supabase.from("input_boards").select("id, name, edge_device_id").order("name"),
      supabase.from("quadras").select("id, nome, arena_id, arenas(nome)").order("nome"),
      supabase.from("arenas").select("id, nome").order("nome")
    ]);

    let filteredCameras = camerasRes.data || [];
    
    // Filter by arena owner if applicable
    if (currentProfile && currentProfile.is_arena_owner && !currentProfile.is_super_admin && currentProfile.arena_id) {
      filteredCameras = filteredCameras.filter(cam => cam.quadras?.arena_id === currentProfile.arena_id);
    }

    setCameras(filteredCameras);
    setDevices(devicesRes.data || []);
    setBoards(boardsRes.data || []);
    setQuadras(quadrasRes.data || []);
    setArenas(arenasRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async () => {
    if (!formData.name || !formData.quadra_id) {
      toast.error("Nome e Quadra são obrigatórios");
      return;
    }

    const is16x9 = formData.aspect_ratio === "16:9";
    const payload = {
      name: formData.name,
      rtsp_url: formData.rtsp_url,
      quadra_id: formData.quadra_id,
      edge_device_id: formData.edge_device_id || null,
      input_board_id: formData.input_board_id || null,
      trigger_button: parseInt(formData.trigger_button),
      replay_seconds: parseInt(formData.replay_seconds),
      active: formData.active,
      aspect_ratio: formData.aspect_ratio,
      sponsor_logo_left: formData.sponsor_logo_left || null,
      sponsor_logo_center: formData.sponsor_logo_center || null,
      sponsor_logo_right: formData.sponsor_logo_right || null,
      video_width: is16x9 ? 916 : 1080,
      video_height: is16x9 ? 827 : 1386,
      video_x: is16x9 ? 502 : 0,
      video_y: is16x9 ? 120 : 267,
    };


    if (editingCamera) {
      const { error } = await supabase
        .from("cameras")
        .update(payload)
        .eq("id", editingCamera.id);

      if (error) {
        toast.error("Erro ao atualizar câmera");
      } else {
        toast.success("Câmera atualizada com sucesso");
        closeDialog();
        fetchData();
      }
    } else {
      const { error } = await supabase
        .from("cameras")
        .insert([payload]);

      if (error) {
        toast.error("Erro ao criar câmera");
      } else {
        toast.success("Câmera criada com sucesso");
        closeDialog();
        fetchData();
      }
    }
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingCamera(null);
    setFormData({
      name: "",
      rtsp_url: "",
      arena_id: "",
      quadra_id: "",
      edge_device_id: "",
      input_board_id: "",
      trigger_button: "0",
      replay_seconds: "15",
      active: true,
      aspect_ratio: "16:9",
      sponsor_logo_left: "",
      sponsor_logo_center: "",
      sponsor_logo_right: "",
      final_overlay_url: "",
      brand: "custom",
      username: "admin",
      password: "",
      ip: "",
      port: "554",
    });

  };

  const openEditDialog = (camera: CameraType) => {
    setEditingCamera(camera);
    setFormData({
      name: camera.name,
      rtsp_url: camera.rtsp_url || "",
      arena_id: camera.quadras?.arena_id || "",
      quadra_id: camera.quadra_id || "",
      edge_device_id: camera.edge_device_id || "",
      input_board_id: camera.input_board_id || "",
      trigger_button: (camera.trigger_button || 0).toString(),
      replay_seconds: (camera.replay_seconds || 15).toString(),
      active: camera.active ?? true,
      aspect_ratio: camera.aspect_ratio || "16:9",
      sponsor_logo_left: camera.sponsor_logo_left || camera.quadras?.arenas?.sponsor_logo_left || "",
      sponsor_logo_center: camera.sponsor_logo_center || camera.quadras?.arenas?.sponsor_logo_center || "",
      sponsor_logo_right: camera.sponsor_logo_right || camera.quadras?.arenas?.sponsor_logo_right || "",
      final_overlay_url: camera.final_overlay_url || "",
      brand: "custom",
      username: "",
      password: "",
      ip: "",
      port: "554",
    });
    setIsDialogOpen(true);
  };


  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta câmera?")) return;
    const { error } = await supabase.from("cameras").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir câmera: " + error.message);
    else {
      toast.success("Câmera excluída");
      fetchData();
    }
  };

  const filteredBoards = formData.edge_device_id 
    ? boards.filter(b => b.edge_device_id === formData.edge_device_id)
    : boards;

  const filteredQuadras = formData.arena_id
    ? quadras.filter(q => q.arena_id === formData.arena_id)
    : quadras;

  const [generatingOverlay, setGeneratingOverlay] = useState(false);

  const handleGenerateOverlay = async () => {
    if (!editingCamera) {
      toast.error("Salve a câmera antes de gerar o overlay");
      return;
    }

    try {
      setGeneratingOverlay(true);
      const publicUrl = await generateAndUploadOverlay({
        id: editingCamera.id,
        aspect_ratio: formData.aspect_ratio,
        sponsor_logo_left: formData.sponsor_logo_left,
        sponsor_logo_center: formData.sponsor_logo_center,
        sponsor_logo_right: formData.sponsor_logo_right,
      });

      const { error } = await supabase
        .from("cameras")
        .update({ final_overlay_url: publicUrl })
        .eq("id", editingCamera.id);

      if (error) throw error;

      setFormData(prev => ({ ...prev, final_overlay_url: publicUrl }));
      toast.success("Overlay gerado com sucesso!");
      fetchData();
    } catch (error: any) {
      console.error("Error generating overlay:", error);
      toast.error("Erro ao gerar overlay: " + error.message);
    } finally {
      setGeneratingOverlay(false);
    }
  };

  const handleLogoUpload = async (file: File, side: 'left' | 'center' | 'right') => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${editingCamera?.id || 'temp'}-${side}-${Math.random()}.${fileExt}`;
      const filePath = `sponsors/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("overlays")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("overlays")
        .getPublicUrl(filePath);
      
      setFormData(prev => ({ ...prev, [`sponsor_logo_${side}`]: publicUrl }));
      toast.success(`Logo ${side} atualizado`);
    } catch (error: any) {
      toast.error("Erro no upload: " + error.message);
    }
  };

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
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            if (!open) closeDialog();
            else setIsDialogOpen(true);
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => closeDialog()} className="brand-gradient brand-glow text-white font-black uppercase tracking-widest px-6 h-12 rounded-xl transition-transform hover:scale-[1.02]">
                <Plus className="mr-2 h-5 w-5" /> Nova Câmera
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] rounded-2xl border-none shadow-2xl overflow-hidden p-0 flex flex-col">
              <div className="brand-gradient p-6 text-white shrink-0">
                <DialogTitle className="text-2xl font-black uppercase tracking-tight">{editingCamera ? "Editar Câmera" : "Configurar Câmera"}</DialogTitle>
                <DialogDescription className="text-white/70 text-sm font-bold uppercase tracking-widest mt-1">
                  {editingCamera ? "Atualize as configurações desta fonte de vídeo." : "Mapeie fontes de vídeo RTSP e vincule a quadras e servidores edge."}
                </DialogDescription>
              </div>
              
              <div className="p-8 flex-1 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Arena</Label>
                    <Select value={formData.arena_id} onValueChange={(v) => {
                      const arenaEdge = devices.find(d => d.arena_id === v);
                      setFormData(prev => ({
                        ...prev, 
                        arena_id: v,
                        quadra_id: "", // Reset quadra when arena changes
                        edge_device_id: arenaEdge ? arenaEdge.id : ""
                      }));
                    }}>
                      <SelectTrigger className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:ring-brand-orange">
                        <SelectValue placeholder="Selecione a arena" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl shadow-xl border-gray-100">
                        {arenas.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Quadra (Court)</Label>
                    <Select value={formData.quadra_id} onValueChange={(v) => setFormData({...formData, quadra_id: v})} disabled={!formData.arena_id}>
                      <SelectTrigger className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:ring-brand-orange">
                        <SelectValue placeholder={formData.arena_id ? "Selecione a quadra" : "Selecione uma arena primeiro"} />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl shadow-xl border-gray-100">
                        {filteredQuadras.map((q) => (
                          <SelectItem key={q.id} value={q.id}>{q.nome}</SelectItem>
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

                  <div className="grid gap-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Aspect Ratio</Label>
                    <Select value={formData.aspect_ratio} onValueChange={(v) => setFormData({...formData, aspect_ratio: v})}>
                      <SelectTrigger className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:ring-brand-orange">
                        <SelectValue placeholder="Selecione o formato" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl shadow-xl border-gray-100">
                        <SelectItem value="16:9">16:9 (Horizontal)</SelectItem>
                        <SelectItem value="9:16">9:16 (Vertical)</SelectItem>
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

                <div className="col-span-full border-t border-gray-100 mt-4 pt-6">
                  <h3 className="text-lg font-black uppercase tracking-tight text-gray-900 flex items-center gap-2 mb-6">
                    <Layout className="h-5 w-5 text-brand-orange" />
                    Gerador de Overlay Dinâmico
                  </h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-8">
                    <div className="space-y-6">
                      <div className="grid grid-cols-3 gap-4">
                        {(['left', 'center', 'right'] as const).map((side) => (
                          <div key={side} className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block text-center capitalize">{side}</Label>
                            <div 
                              onClick={() => document.getElementById(`cam-sponsor-${side}`)?.click()}
                              className="aspect-square rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center cursor-pointer hover:border-brand-orange/50 hover:bg-brand-orange/5 transition-all group overflow-hidden relative"
                            >
                              {formData[`sponsor_logo_${side}` as keyof typeof formData] ? (
                                <img src={formData[`sponsor_logo_${side}` as keyof typeof formData] as string} className="w-full h-full object-contain p-2" alt={`Sponsor ${side}`} />
                              ) : (
                                <Upload className="h-6 w-6 text-gray-300 group-hover:text-brand-orange transition-colors" />
                              )}
                              <input 
                                id={`cam-sponsor-${side}`}
                                type="file" 
                                className="hidden" 
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleLogoUpload(file, side);
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-3">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          <span>Canvas:</span>
                          <span className="text-gray-900">{formData.aspect_ratio === '16:9' ? '1920x1080' : '1080x1920'}</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          <span>Área Vídeo:</span>
                          <span className="text-gray-900">{formData.aspect_ratio === '16:9' ? '916x827' : '1080x1386'}</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          <span>Posição (X,Y):</span>
                          <span className="text-gray-900">{formData.aspect_ratio === '16:9' ? '502, 120' : '0, 267'}</span>
                        </div>
                      </div>

                      <Button 
                        onClick={handleGenerateOverlay} 
                        disabled={generatingOverlay || !editingCamera}
                        className="w-full brand-gradient text-white font-black uppercase tracking-widest h-12 rounded-xl shadow-lg"
                      >
                        {generatingOverlay ? (
                          <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                        ) : formData.final_overlay_url ? (
                          <Check className="mr-2 h-5 w-5" />
                        ) : (
                          <Layout className="mr-2 h-5 w-5" />
                        )}
                        {generatingOverlay ? "Gerando..." : formData.final_overlay_url ? "Regerar Overlay" : "Gerar Overlay Final"}
                      </Button>
                      
                      {!editingCamera && (
                        <p className="text-[10px] text-red-500 font-bold uppercase text-center">
                          * Salve a câmera primeiro para habilitar o gerador
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-center">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Preview em Tempo Real ({formData.aspect_ratio})</Label>
                      <div className={`relative bg-black rounded-2xl overflow-hidden shadow-2xl border-4 border-gray-800 ${formData.aspect_ratio === '16:9' ? 'w-full aspect-[16/9]' : 'w-[180px] aspect-[9/16]'}`}>
                        <div className={`absolute bg-gray-900/50 flex items-center justify-center border-2 border-brand-orange z-0 transition-all duration-300
                          ${formData.aspect_ratio === '16:9' 
                            ? 'left-[26%] top-[11%] w-[48%] h-[76%]' 
                            : 'left-0 top-[14%] w-full h-[72%]'}`}
                        >
                          <span className="text-[10px] text-brand-orange font-black uppercase tracking-widest text-center px-2">
                            Área do Vídeo<br/>
                            {formData.aspect_ratio === '16:9' ? '916x827' : '1080x1386'}
                          </span>
                        </div>

                        <div className={`absolute top-0 left-0 w-full flex items-center justify-center p-4 z-20 ${formData.aspect_ratio === '16:9' ? 'h-[15%]' : 'h-[15%] bg-black/40 backdrop-blur-sm'}`}>
                          <img src={logoImg} className="h-6 object-contain brightness-0 invert" alt="Logo" />
                        </div>

                        <div className={`absolute bottom-0 left-0 w-full flex items-center justify-between px-3 gap-2 z-20
                          ${formData.aspect_ratio === '16:9' ? 'h-[15%] bg-black/20' : 'h-[12%] brand-gradient'}`}
                        >
                          {(['left', 'center', 'right'] as const).map((side) => (
                            <div key={side} className="flex-1 h-full flex items-center justify-center overflow-hidden py-1">
                              {formData[`sponsor_logo_${side}` as keyof typeof formData] && (
                                <img 
                                  src={formData[`sponsor_logo_${side}` as keyof typeof formData] as string} 
                                  className="max-h-full max-w-full object-contain" 
                                  alt={`Sponsor ${side}`} 
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

              <DialogFooter className="bg-gray-50 p-6 flex justify-end gap-3 border-t border-gray-100">
                 <Button variant="ghost" onClick={closeDialog} className="font-bold rounded-xl">Cancelar</Button>
                <Button onClick={handleSave} className="brand-gradient text-white font-black uppercase tracking-widest px-8 h-12 rounded-xl shadow-lg shadow-brand-orange/20">
                  {editingCamera ? "Salvar Alterações" : "Salvar Configuração"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="glass-card bg-white shadow-xl border border-gray-100 overflow-hidden overflow-x-auto">
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
                      <button 
                        onClick={() => setActivePreviewCamera(camera)}
                        className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 transition-all hover:scale-110 active:scale-95 group-hover:brand-gradient group-hover:text-white group-hover:brand-glow group-hover:border-transparent border border-blue-500/20 shadow-sm"
                        title="Visualizar Câmera Ao Vivo"
                      >
                        <Video className="h-6 w-6" />
                      </button>
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
                        onClick={() => openEditDialog(camera)}
                        className="h-10 w-10 rounded-xl text-gray-400 hover:text-brand-orange hover:bg-brand-orange/5"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(camera.id)}
                        className="h-10 w-10 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50"
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

      <Dialog open={!!activePreviewCamera} onOpenChange={(open) => !open && setActivePreviewCamera(null)}>
        <DialogContent className="max-w-[90vw] md:max-w-4xl p-0 bg-black border-none overflow-hidden rounded-2xl shadow-2xl">
          <DialogTitle className="sr-only">Visualização ao Vivo - {activePreviewCamera?.name}</DialogTitle>
          <div className="relative aspect-video w-full bg-black flex items-center justify-center">
            {activePreviewCamera && (
              <ReactPlayer
                url={`https://live.izyia.com.br/${activePreviewCamera.id}/index.m3u8`}
                playing={true}
                muted={true}
                controls={false}
                width="100%"
                height="100%"
                style={{ position: 'absolute', top: 0, left: 0 }}
                onError={(e: any) => {
                  console.error("ReactPlayer Error:", e);
                  toast.error("Erro ao carregar stream ao vivo");
                }}
              />
            )}
            
            <div className="absolute top-4 left-4 z-10">
              <Badge className="brand-gradient text-white border-none font-black uppercase tracking-widest px-3 py-1 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                AO VIVO: {activePreviewCamera?.name}
              </Badge>
            </div>

            <button 
              onClick={() => setActivePreviewCamera(null)}
              className="absolute top-4 right-4 z-20 h-10 w-10 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-all backdrop-blur-md border border-white/20"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
