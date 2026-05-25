import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, RefreshCw, MapPin, Edit2, Trash2, Upload, Layout } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logoImg from "@/assets/looplance-logo.png";

export const Route = createFileRoute("/admin/arenas")({
  component: Arenas,
});

interface Arena {
  id: string;
  nome: string;
  cidade: string | null;
  telefone: string | null;
  endereco: string | null;
  foto_url: string | null;
  sponsor_logo_left: string | null;
  sponsor_logo_center: string | null;
  sponsor_logo_right: string | null;
  final_overlay_url: string | null;
  created_at?: string;
}

function Arenas() {
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingArena, setEditingArena] = useState<Arena | null>(null);
  const [name, setName] = useState("");
  const [cidade, setCidade] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sponsorLeft, setSponsorLeft] = useState<File | null>(null);
  const [sponsorCenter, setSponsorCenter] = useState<File | null>(null);
  const [sponsorRight, setSponsorRight] = useState<File | null>(null);
  
  const [previewLeft, setPreviewLeft] = useState<string | null>(null);
  const [previewCenter, setPreviewCenter] = useState<string | null>(null);
  const [previewRight, setPreviewRight] = useState<string | null>(null);

  const fetchArenas = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("arenas").select("*").order("nome");
    if (error) toast.error("Erro ao buscar arenas");
    else setArenas(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchArenas();
  }, []);

  const handleSave = async () => {
    if (!name) return;
    
    setUploading(true);
    let currentFotoUrl = editingArena?.foto_url || null;
    let currentSponsorLeft = editingArena?.sponsor_logo_left || null;
    let currentSponsorCenter = editingArena?.sponsor_logo_center || null;
    let currentSponsorRight = editingArena?.sponsor_logo_right || null;

    const uploadFile = async (file: File, bucket: string) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);
      
      return publicUrl;
    };

    try {
      if (fotoFile) {
        currentFotoUrl = await uploadFile(fotoFile, 'arenas');
      }
      if (sponsorLeft) {
        currentSponsorLeft = await uploadFile(sponsorLeft, 'arenas');
      }
      if (sponsorCenter) {
        currentSponsorCenter = await uploadFile(sponsorCenter, 'arenas');
      }
      if (sponsorRight) {
        currentSponsorRight = await uploadFile(sponsorRight, 'arenas');
      }

      const arenaData = {
        nome: name,
        cidade,
        telefone,
        endereco,
        foto_url: currentFotoUrl,
        sponsor_logo_left: currentSponsorLeft,
        sponsor_logo_center: currentSponsorCenter,
        sponsor_logo_right: currentSponsorRight,
      };
    
    if (editingArena) {
      const { error } = await supabase.from("arenas").update(arenaData).eq("id", editingArena.id);
      if (error) {
        console.error("Erro ao atualizar arena:", error);
        toast.error("Erro ao atualizar arena: " + error.message);
      } else {
        toast.success("Arena atualizada");
        closeDialog();
        fetchArenas();
      }
    } else {
        const { error } = await supabase.from("arenas").insert([arenaData]);
        if (error) toast.error("Erro ao criar arena");
        else {
          toast.success("Arena criada");
          closeDialog();
          fetchArenas();
        }
      }
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingArena(null);
    setName("");
    setCidade("");
    setTelefone("");
    setEndereco("");
    setFotoFile(null);
    setSponsorLeft(null);
    setSponsorCenter(null);
    setSponsorRight(null);
    setPreviewLeft(null);
    setPreviewCenter(null);
    setPreviewRight(null);
  };

  const openEditDialog = (arena: Arena) => {
    setEditingArena(arena);
    setName(arena.nome);
    setCidade(arena.cidade || "");
    setTelefone(arena.telefone || "");
    setEndereco(arena.endereco || "");
    setPreviewLeft(arena.sponsor_logo_left);
    setPreviewCenter(arena.sponsor_logo_center);
    setPreviewRight(arena.sponsor_logo_right);
    setIsDialogOpen(true);
  };
  
  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta arena?")) return;
    
    const { error } = await supabase.from("arenas").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir arena: " + error.message);
    } else {
      toast.success("Arena excluída com sucesso");
      fetchArenas();
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900 uppercase">
            Arenas <span className="brand-text">Complexos</span>
          </h1>
          <p className="text-muted-foreground mt-1 font-medium text-base sm:text-lg">
            Gerencie os locais onde o espetáculo acontece.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="icon" onClick={fetchArenas} disabled={loading} className="rounded-xl border-gray-200 h-10 sm:h-12 w-10 sm:w-12 shadow-sm bg-white hover:bg-gray-50 shrink-0">
            <RefreshCw className={`h-5 w-5 text-gray-400 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            if (!open) closeDialog();
            else setIsDialogOpen(true);
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => closeDialog()} className="brand-gradient brand-glow text-white font-black uppercase tracking-widest px-4 sm:px-6 h-10 sm:h-12 rounded-xl transition-transform hover:scale-[1.02] text-xs sm:text-sm flex-1 sm:flex-none">
                <Plus className="mr-2 h-5 w-5" /> Nova Arena
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl border-none shadow-2xl max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight text-gray-900">{editingArena ? "Editar Arena" : "Adicionar Arena"}</DialogTitle>
                <DialogDescription className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60">
                  {editingArena ? "Atualize os dados desta arena." : "Cadastre um novo complexo esportivo no sistema."}
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6">
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nome da Arena</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Arena Guga Kuerten" className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:border-brand-orange focus:ring-brand-orange" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="cidade" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Cidade</Label>
                    <Input id="cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex: São Paulo" className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:border-brand-orange focus:ring-brand-orange" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="telefone" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Telefone</Label>
                    <Input id="telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="Ex: (11) 99999-9999" className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:border-brand-orange focus:ring-brand-orange" />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="endereco" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Endereço Completo</Label>
                    <Input id="endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número, bairro" className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:border-brand-orange focus:ring-brand-orange" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="foto" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Foto da Arena</Label>
                    <div className="flex flex-col gap-4">
                      {editingArena?.foto_url && !fotoFile && (
                        <div className="h-20 w-32 rounded-lg overflow-hidden border border-gray-100">
                          <img src={editingArena.foto_url} alt="Preview" className="h-full w-full object-cover" />
                        </div>
                      )}
                      <Input 
                        id="foto" 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => setFotoFile(e.target.files?.[0] || null)}
                        className="rounded-xl border-gray-100 bg-gray-50 h-12 pt-2 focus:border-brand-orange focus:ring-brand-orange cursor-pointer" 
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 mt-2 pt-6">
                <h3 className="text-lg font-black uppercase tracking-tight text-gray-900 flex items-center gap-2 mb-6">
                  <Layout className="h-5 w-5 text-brand-orange" />
                  Patrocinadores da Grade
                </h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block text-center">Esquerda</Label>
                        <div 
                          onClick={() => document.getElementById('sponsor-left')?.click()}
                          className="aspect-square rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center cursor-pointer hover:border-brand-orange/50 hover:bg-brand-orange/5 transition-all group overflow-hidden relative"
                        >
                          {previewLeft ? (
                            <img src={previewLeft} className="w-full h-full object-contain p-2" alt="Sponsor Left" />
                          ) : (
                            <Upload className="h-6 w-6 text-gray-300 group-hover:text-brand-orange transition-colors" />
                          )}
                          <input 
                            id="sponsor-left" 
                            type="file" 
                            className="hidden" 
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setSponsorLeft(file);
                                setPreviewLeft(URL.createObjectURL(file));
                              }
                            }}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block text-center">Centro</Label>
                        <div 
                          onClick={() => document.getElementById('sponsor-center')?.click()}
                          className="aspect-square rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center cursor-pointer hover:border-brand-orange/50 hover:bg-brand-orange/5 transition-all group overflow-hidden relative"
                        >
                          {previewCenter ? (
                            <img src={previewCenter} className="w-full h-full object-contain p-2" alt="Sponsor Center" />
                          ) : (
                            <Upload className="h-6 w-6 text-gray-300 group-hover:text-brand-orange transition-colors" />
                          )}
                          <input 
                            id="sponsor-center" 
                            type="file" 
                            className="hidden" 
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setSponsorCenter(file);
                                setPreviewCenter(URL.createObjectURL(file));
                              }
                            }}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block text-center">Direita</Label>
                        <div 
                          onClick={() => document.getElementById('sponsor-right')?.click()}
                          className="aspect-square rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center cursor-pointer hover:border-brand-orange/50 hover:bg-brand-orange/5 transition-all group overflow-hidden relative"
                        >
                          {previewRight ? (
                            <img src={previewRight} className="w-full h-full object-contain p-2" alt="Sponsor Right" />
                          ) : (
                            <Upload className="h-6 w-6 text-gray-300 group-hover:text-brand-orange transition-colors" />
                          )}
                          <input 
                            id="sponsor-right" 
                            type="file" 
                            className="hidden" 
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setSponsorRight(file);
                                setPreviewRight(URL.createObjectURL(file));
                              }
                            }}
                          />
                        </div>
                      </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-medium italic">
                      * Recomendado: Imagens em PNG com fundo transparente.
                    </p>
                  </div>

                  <div className="flex flex-col items-center">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Preview da Moldura (Mobile 9:16)</Label>
                    <div className="w-[180px] aspect-[9/16] bg-black rounded-2xl overflow-hidden shadow-2xl border-4 border-gray-800 relative">
                      {/* Top Bar */}
                      <div className="absolute top-0 left-0 w-full h-[15%] bg-black/40 backdrop-blur-sm border-b border-white/10 flex items-center justify-center p-4">
                        <img src={logoImg} className="h-6 object-contain brightness-0 invert" alt="Logo" />
                      </div>

                      {/* Content Simulator */}
                      <div className="w-full h-full bg-gradient-to-b from-gray-900 to-black flex items-center justify-center">
                        <span className="text-[10px] text-white/20 font-black uppercase tracking-widest">Vídeo Replay</span>
                      </div>

                      {/* Bottom Bar */}
                      <div className="absolute bottom-0 left-0 w-full h-[12%] brand-gradient flex items-center justify-between px-3 gap-2">
                        <div className="flex-1 h-full flex items-center justify-start overflow-hidden">
                          {previewLeft && <img src={previewLeft} className="h-4 w-auto object-contain brightness-0 invert" alt="L" />}
                        </div>
                        <div className="flex-1 h-full flex items-center justify-center overflow-hidden">
                          {previewCenter && <img src={previewCenter} className="h-4 w-auto object-contain brightness-0 invert" alt="C" />}
                        </div>
                        <div className="flex-1 h-full flex items-center justify-end overflow-hidden">
                          {previewRight && <img src={previewRight} className="h-4 w-auto object-contain brightness-0 invert" alt="R" />}
                        </div>
                      </div>
                    </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={closeDialog} className="rounded-xl font-bold">Cancelar</Button>
                <Button onClick={handleSave} disabled={uploading} className="brand-gradient text-white font-black uppercase tracking-widest px-8 rounded-xl h-12">
                  {uploading ? "Salvando..." : "Salvar"}
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
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-3 sm:py-4 px-4 sm:px-6">Local / Nome</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground py-3 sm:py-4 px-4 sm:px-6">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {arenas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="h-40 text-center text-muted-foreground font-medium italic">
                  Nenhuma arena cadastrada no momento.
                </TableCell>
              </TableRow>
            ) : (
              arenas.map((a) => (
                <TableRow key={a.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-50 last:border-0 group">
                  <TableCell className="py-4 sm:py-5 px-4 sm:px-6">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="h-12 w-12 rounded-2xl overflow-hidden border border-gray-100 flex items-center justify-center bg-brand-orange/10 text-brand-orange shrink-0">
                        {a.foto_url ? (
                          <img src={a.foto_url} alt={a.nome} className="h-full w-full object-cover" />
                        ) : (
                          <MapPin className="h-6 w-6" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="font-black text-base sm:text-lg text-gray-900 uppercase tracking-tight block truncate">{a.nome}</span>
                        <div className="flex gap-2 items-center">
                          <p className="text-[10px] font-medium text-muted-foreground truncate">{a.cidade || "Cidade não informada"}</p>
                          {a.telefone && <span className="text-[10px] text-muted-foreground/40">•</span>}
                          <p className="text-[10px] font-medium text-muted-foreground truncate">{a.telefone}</p>
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right py-4 sm:py-5 px-4 sm:px-6 shrink-0">
                    <div className="flex justify-end gap-1 sm:gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => openEditDialog(a)}
                        className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl text-gray-400 hover:text-brand-orange hover:bg-brand-orange/5 transition-colors"
                      >
                        <Edit2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(a.id)}
                        className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
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
    </div>
  );
}
