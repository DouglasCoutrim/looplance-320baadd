import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Plus, 
  RefreshCw, 
  Radio, 
  Edit2, 
  Trash2, 
  Camera, 
  Eye, 
  EyeOff,
  Search,
  Hash,
  Globe
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogFooter, 
  DialogDescription 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/botoeiras" as any)({
  component: BotoeirasPage,
});

interface Botoeira {
  id: string;
  botoeira_id: string;
  ip_local: string;
  local_key: string;
  camera_id: string;
  created_at: string;
}

function BotoeirasPage() {
  const [botoeiras, setBotoeiras] = useState<Botoeira[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBotoeira, setEditingBotoeira] = useState<Botoeira | null>(null);
  const [showLocalKey, setShowLocalKey] = useState(false);
  
  // Form state
  const [botoeiraId, setBotoeiraId] = useState("");
  const [ipLocal, setIpLocal] = useState("");
  const [localKey, setLocalKey] = useState("");
  const [cameraId, setCameraId] = useState("");

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("botoeiras" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao buscar botoeiras: " + error.message);
    } else {
      setBotoeiras(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const validateIP = (ip: string) => {
    const regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return regex.test(ip);
  };

  const handleSave = async () => {
    if (!botoeiraId || !ipLocal || !localKey || !cameraId) {
      toast.error("Todos os campos são obrigatórios");
      return;
    }

    if (!validateIP(ipLocal)) {
      toast.error("Formato de IP inválido (Ex: 192.168.1.15)");
      return;
    }

    setSaving(true);
    const payload = { 
      botoeira_id: botoeiraId, 
      ip_local: ipLocal, 
      local_key: localKey, 
      camera_id: cameraId 
    };

    if (editingBotoeira) {
      const { error } = await (supabase as any)
        .from("botoeiras")
        .update(payload)
        .eq("id", editingBotoeira.id);

      if (error) {
        toast.error("Erro ao atualizar botoeira: " + error.message);
      } else {
        toast.success("Botoeira atualizada com sucesso");
        closeDialog();
        fetchData();
      }
    } else {
      const { error } = await (supabase as any)
        .from("botoeiras")
        .insert([payload]);

      if (error) {
        toast.error("Erro ao cadastrar botoeira: " + error.message);
      } else {
        toast.success("Botoeira cadastrada com sucesso");
        closeDialog();
        fetchData();
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta botoeira?")) return;
    
    const { error } = await (supabase as any)
      .from("botoeiras")
      .delete()
      .eq("id", id);
      
    if (error) {
      toast.error("Erro ao excluir: " + error.message);
    } else {
      toast.success("Botoeira removida");
      fetchData();
    }
  };

  const openEditDialog = (b: Botoeira) => {
    setEditingBotoeira(b);
    setBotoeiraId(b.botoeira_id);
    setIpLocal(b.ip_local);
    setLocalKey(b.local_key);
    setCameraId(b.camera_id);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingBotoeira(null);
    setBotoeiraId("");
    setIpLocal("");
    setLocalKey("");
    setCameraId("");
    setShowLocalKey(false);
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-gray-900 uppercase">
            Gerenciamento de <span className="brand-text">Botoeiras</span>
          </h1>
          <p className="text-muted-foreground mt-1 font-medium text-lg">
            Módulos IoT físicos para disparo manual de replays.
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={fetchData} 
            disabled={loading} 
            className="rounded-xl border-gray-200 h-12 w-12 shadow-sm bg-white hover:bg-gray-50"
          >
            <RefreshCw className={`h-5 w-5 text-gray-400 ${loading ? "animate-spin" : ""}`} />
          </Button>
          
          <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
            <DialogTrigger asChild>
              <Button 
                onClick={() => { setEditingBotoeira(null); }} 
                className="brand-gradient brand-glow text-white font-black uppercase tracking-widest px-6 h-12 rounded-xl transition-transform hover:scale-[1.02]"
              >
                <Plus className="mr-2 h-5 w-5" /> Nova Botoeira
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] rounded-2xl border-none shadow-2xl overflow-hidden p-0">
               <div className="brand-gradient p-6 text-white">
                 <DialogTitle className="text-2xl font-black uppercase tracking-tight">
                   {editingBotoeira ? "Editar Botoeira" : "Nova Botoeira"}
                 </DialogTitle>
                <DialogDescription className="text-white/70 text-sm font-bold uppercase tracking-widest mt-1">
                  {editingBotoeira ? "Atualize as configurações do módulo IoT." : "Cadastre um novo botão Wi-Fi na rede da arena."}
                </DialogDescription>
              </div>

              <div className="p-8 space-y-6">
                <div className="grid gap-2">
                  <Label htmlFor="botoeira_id" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                    <Hash className="h-3 w-3" /> Device ID (botoeira_id)
                  </Label>
                  <Input 
                    id="botoeira_id" 
                    value={botoeiraId} 
                    onChange={(e) => setBotoeiraId(e.target.value)} 
                    placeholder="Ex: eb9fe..." 
                    className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:ring-brand-orange" 
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="ip_local" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                    <Globe className="h-3 w-3" /> IP Local
                  </Label>
                  <Input 
                    id="ip_local" 
                    value={ipLocal} 
                    onChange={(e) => setIpLocal(e.target.value)} 
                    placeholder="Ex: 192.168.1.15" 
                    className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:ring-brand-orange" 
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="local_key" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Local Key (Secret)
                  </Label>
                  <div className="relative">
                    <Input 
                      id="local_key" 
                      type={showLocalKey ? "text" : "password"}
                      value={localKey} 
                      onChange={(e) => setLocalKey(e.target.value)} 
                      placeholder="Chave secreta do dispositivo" 
                      className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:ring-brand-orange pr-12" 
                    />
                    <button
                      type="button"
                      onClick={() => setShowLocalKey(!showLocalKey)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showLocalKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="camera_id" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                    <Camera className="h-3 w-3" /> Câmera Vinculada
                  </Label>
                  <Input 
                    id="camera_id" 
                    value={cameraId} 
                    onChange={(e) => setCameraId(e.target.value)} 
                    placeholder="ID ou Nome da Câmera" 
                    className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:ring-brand-orange" 
                  />
                </div>
              </div>

              <DialogFooter className="bg-gray-50 p-6 flex justify-end gap-3 border-t border-gray-100">
                 <Button variant="ghost" onClick={closeDialog} className="font-bold rounded-xl" disabled={saving}>
                   Cancelar
                 </Button>
                <Button 
                  onClick={handleSave} 
                  disabled={saving}
                  className="brand-gradient text-white font-black uppercase tracking-widest px-8 h-12 rounded-xl shadow-lg shadow-brand-orange/20"
                >
                  {saving ? (
                    <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                  ) : null}
                  {editingBotoeira ? "Salvar Alterações" : "Cadastrar Botoeira"}
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
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4 px-6">Dispositivo / ID</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4 px-6">IP Local</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4 px-6">Câmera</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4 px-6">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4} className="py-8 text-center animate-pulse">
                    <div className="h-4 bg-gray-100 rounded-full w-3/4 mx-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : botoeiras.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="h-16 w-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
                      <Radio className="h-8 w-8" />
                    </div>
                    <div>
                      <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">Nenhuma botoeira encontrada</p>
                      <p className="text-gray-400 text-sm mt-1">Adicione módulos IoT para permitir o disparo de replays.</p>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={() => setIsDialogOpen(true)}
                      className="rounded-xl font-bold uppercase tracking-widest text-[10px] h-10 px-6 border-gray-200"
                    >
                      <Plus className="mr-2 h-4 w-4" /> Adicionar Primeira
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              botoeiras.map((b) => (
                <TableRow key={b.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-50 last:border-0 group">
                  <TableCell className="py-5 px-6">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-brand-orange/10 flex items-center justify-center text-brand-orange transition-colors group-hover:brand-gradient group-hover:text-white">
                        <Radio className="h-6 w-6" />
                      </div>
                      <div>
                        <span className="font-black text-lg text-gray-900 uppercase tracking-tight">{b.botoeira_id}</span>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Módulo IoT Wi-Fi</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-5 px-6">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="font-bold text-gray-700 font-mono">{b.ip_local}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-5 px-6">
                    <div className="flex items-center gap-2">
                      <Camera className="h-4 w-4 text-gray-400" />
                      <span className="font-bold text-gray-700">{b.camera_id}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right py-5 px-6">
                    <div className="flex justify-end gap-2">
                       <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => openEditDialog(b)}
                        className="h-10 w-10 rounded-xl text-gray-400 hover:text-brand-orange hover:bg-brand-orange/5"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(b.id)}
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
    </div>
  );
}
