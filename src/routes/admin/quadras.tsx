import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, RefreshCw, Layout, Edit2, Trash2, Tv, QrCode } from "lucide-react";
import { QuadraQRCode } from "@/components/QuadraQRCode";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/quadras")({
  component: Quadras,
});

interface Quadra {
  id: string;
  nome: string;
  arena_id: string;
  arenas?: { nome: string } | null;
}

function Quadras() {
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [arenas, setArenas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingQuadra, setEditingQuadra] = useState<Quadra | null>(null);
  
  const [name, setName] = useState("");
  const [arenaId, setArenaId] = useState("");

  const fetchData = async () => {
    setLoading(true);
    const [qRes, aRes] = await Promise.all([
      supabase.from("quadras").select("*, arenas(nome)").order("nome"),
      supabase.from("arenas").select("id, nome").order("nome")
    ]);
    setQuadras(qRes.data || []);
    setArenas(aRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async () => {
    if (!name || !arenaId) {
      toast.error("Nome e Arena são obrigatórios");
      return;
    }

    if (editingQuadra) {
      const { error } = await supabase.from("quadras").update({ nome: name, arena_id: arenaId }).eq("id", editingQuadra.id);
      if (error) toast.error("Erro ao atualizar quadra");
      else {
        toast.success("Quadra atualizada");
        setIsDialogOpen(false);
        setEditingQuadra(null);
        setName("");
        setArenaId("");
        fetchData();
      }
    } else {
      const { error } = await supabase.from("quadras").insert([{ nome: name, arena_id: arenaId }]);
      if (error) toast.error("Erro ao criar quadra");
      else {
        toast.success("Quadra criada");
        setIsDialogOpen(false);
        setName("");
        setArenaId("");
        fetchData();
      }
    }
  };

  const openEditDialog = (quadra: Quadra) => {
    setEditingQuadra(quadra);
    setName(quadra.nome);
    setArenaId(quadra.arena_id);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta quadra?")) return;
    const { error } = await supabase.from("quadras").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir quadra: " + error.message);
    else {
      toast.success("Quadra excluída");
      fetchData();
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white uppercase">
            Quadras <span className="brand-text">Pistas</span>
          </h1>
          <p className="text-white/50 mt-1 font-medium text-base sm:text-lg">
            Vincule quadras específicas aos seus complexos.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading} className="rounded-xl border-[#2a2a2a] h-10 sm:h-12 w-10 sm:w-12 bg-[#1a1a1a] hover:bg-[#222] border shrink-0">
            <RefreshCw className={`h-5 w-5 text-white/40 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingQuadra(null);
              setName("");
              setArenaId("");
            }
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingQuadra(null); setName(""); setArenaId(""); }} className="brand-gradient text-black font-black uppercase tracking-widest px-4 sm:px-6 h-10 sm:h-12 rounded-xl transition-transform hover:scale-[1.02] text-xs sm:text-sm flex-1 sm:flex-none">
                <Plus className="mr-2 h-5 w-5" /> Nova Quadra
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl border border-[#2a2a2a] shadow-2xl bg-[#1a1a1a] text-white">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight text-brand-orange">{editingQuadra ? "Editar Quadra" : "Configurar Quadra"}</DialogTitle>
                <DialogDescription className="text-sm font-bold uppercase tracking-widest text-white/70">
                  {editingQuadra ? "Atualize os dados desta quadra." : "Vincule uma nova quadra ou pista a um complexo esportivo."}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-6">
                <div className="grid gap-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-white/60">Complexo (Arena)</Label>
                  <Select value={arenaId} onValueChange={setArenaId}>
                    <SelectTrigger className="rounded-xl border-[#2a2a2a] bg-[#252525] h-12 text-white focus:ring-brand-orange">
                      <SelectValue placeholder="Selecione a arena" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-[#2a2a2a] bg-[#1a1a1a] text-white">
                      {arenas.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="name" className="text-xs font-black uppercase tracking-widest text-white/60">Nome da Quadra</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Quadra 01 - Central" className="rounded-xl border-[#2a2a2a] bg-[#252525] h-12 text-white placeholder:text-white/35 focus:border-brand-orange focus:ring-brand-orange" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl font-bold text-white/60 hover:text-white hover:bg-white/5">Cancelar</Button>
                <Button onClick={handleSave} className="brand-gradient text-black font-black uppercase tracking-widest px-8 rounded-xl h-12">Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="bg-[#1a1a1a] border border-[#2a2a2a] overflow-hidden overflow-x-auto rounded-[12px]">
        <Table>
          <TableHeader className="bg-transparent border-b border-white/5">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-white/60 py-4 px-6">Quadra / Court</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-white/60 py-4 px-6">Arena Vinculada</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-white/60 py-4 px-6">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quadras.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="h-40 text-center text-white/35 font-medium italic">
                  Nenhuma quadra encontrada para os filtros atuais.
                </TableCell>
              </TableRow>
            ) : (
              quadras.map((q) => (
                <TableRow key={q.id} className="hover:bg-white/[0.04] transition-colors border-b border-white/[0.07] last:border-0 group">
                  <TableCell className="py-4 sm:py-5 px-4 sm:px-6">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 transition-colors group-hover:brand-gradient group-hover:text-white shrink-0">
                        <Layout className="h-5 w-5 sm:h-6 sm:w-6" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-black text-base sm:text-lg text-[#ffffff] uppercase tracking-tight block truncate">{q.nome}</span>
                        <p className="text-[10px] font-medium text-white/35 truncate">ID: {q.id.slice(0, 8)}...</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-4 sm:py-5 px-4 sm:px-6">
                    <div className="flex items-center gap-2">
                      <Tv className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-brand-orange shrink-0" />
                      <span className="font-bold text-white/80 text-xs sm:text-sm truncate">{q.arenas?.nome}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right py-4 sm:py-5 px-4 sm:px-6 shrink-0">
                    <div className="flex justify-end gap-1 sm:gap-2">
                      <QuadraQRCode quadraId={q.id} quadraNome={q.nome} />
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => openEditDialog(q)}
                        className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl text-white/40 hover:text-brand-orange hover:bg-brand-orange/5 transition-colors"
                      >
                        <Edit2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(q.id)}
                        className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl text-white/40 hover:text-red-500 hover:bg-red-500/10 transition-colors"
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
