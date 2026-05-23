import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, RefreshCw, MapPin, Edit2, Trash2, Settings, Eraser, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/arenas")({
  component: Arenas,
});

interface Arena {
  id: string;
  nome: string;
  created_at?: string;
  arena_settings?: {
    id: string;
    replay_retention_days: number;
    auto_cleanup_enabled: boolean;
  } | null;
}

function Arenas() {
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [name, setName] = useState("");

  const fetchArenas = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("arenas")
      .select("*, arena_settings(*)")
      .order("nome");
      
    if (error) toast.error("Erro ao buscar arenas");
    else setArenas((data as unknown as Arena[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchArenas();
  }, []);

  const handleCreate = async () => {
    if (!name) return;
    const { error } = await supabase.from("arenas").insert([{ nome: name }]);
    if (error) toast.error("Erro ao criar arena");
    else {
      toast.success("Arena criada");
      setIsDialogOpen(false);
      setName("");
      fetchArenas();
    }
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

  const handleClearReplays = async (arenaId: string) => {
    if (!confirm("Tem certeza que deseja apagar TODOS os replays desta arena? Esta ação não pode ser desfeita.")) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-replays", {
        body: { arena_id: arenaId, action: "clear_all" }
      });

      if (error) throw error;
      
      toast.success(`${data.deleted_count} replays removidos com sucesso!`);
    } catch (error: any) {
      toast.error("Erro ao limpar replays: " + (error.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSettings = async (arenaId: string, retentionDays: number, autoCleanup: boolean) => {
    const { error } = await supabase
      .from("arena_settings")
      .upsert({ 
        arena_id: arenaId, 
        replay_retention_days: retentionDays, 
        auto_cleanup_enabled: autoCleanup,
        updated_at: new Date().toISOString()
      }, { onConflict: 'arena_id' });

    if (error) {
      toast.error("Erro ao atualizar configurações: " + error.message);
    } else {
      toast.success("Configurações atualizadas");
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
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="brand-gradient brand-glow text-white font-black uppercase tracking-widest px-4 sm:px-6 h-10 sm:h-12 rounded-xl transition-transform hover:scale-[1.02] text-xs sm:text-sm flex-1 sm:flex-none">
                <Plus className="mr-2 h-5 w-5" /> Nova Arena
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl border-none shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight text-gray-900">Adicionar Arena</DialogTitle>
                <DialogDescription className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60">
                  Cadastre um novo complexo esportivo no sistema.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-6">
                <div className="grid gap-2">
                  <Label htmlFor="name" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nome da Arena</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Arena Guga Kuerten" className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:border-brand-orange focus:ring-brand-orange" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl font-bold">Cancelar</Button>
                <Button onClick={handleCreate} className="brand-gradient text-white font-black uppercase tracking-widest px-8 rounded-xl h-12">Salvar</Button>
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
                      <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-brand-orange/10 flex items-center justify-center text-brand-orange transition-colors group-hover:brand-gradient group-hover:text-white shrink-0">
                        <MapPin className="h-5 w-5 sm:h-6 sm:w-6" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-black text-base sm:text-lg text-gray-900 uppercase tracking-tight block truncate">{a.nome}</span>
                        <p className="text-[10px] font-medium text-muted-foreground truncate">ID: {a.id.slice(0, 8)}...</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right py-4 sm:py-5 px-4 sm:px-6 shrink-0">
                    <div className="flex justify-end gap-1 sm:gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl text-gray-400 hover:text-brand-orange hover:bg-brand-orange/5 transition-colors">
                            <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-2xl">
                          <DialogHeader>
                            <DialogTitle className="uppercase font-black">Configurações - {a.nome}</DialogTitle>
                            <DialogDescription className="font-bold text-xs uppercase opacity-60">Gestão de armazenamento e replays</DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-6 py-4">
                            <div className="flex flex-col gap-2">
                              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Retenção de Replays (Dias)</Label>
                              <Input 
                                type="number" 
                                defaultValue={a.arena_settings?.replay_retention_days || 7}
                                onBlur={(e) => handleUpdateSettings(a.id, parseInt(e.target.value), a.arena_settings?.auto_cleanup_enabled ?? true)}
                                className="rounded-xl h-12"
                              />
                            </div>
                            <div className="flex items-center justify-between gap-2 p-4 rounded-xl bg-gray-50">
                              <div className="space-y-0.5">
                                <Label className="text-sm font-black uppercase tracking-tight">Limpeza Automática</Label>
                                <p className="text-[10px] font-medium text-muted-foreground">Apagar replays antigos automaticamente</p>
                              </div>
                              <input 
                                type="checkbox"
                                className="h-5 w-5 rounded border-gray-300 text-brand-orange focus:ring-brand-orange"
                                defaultChecked={a.arena_settings?.auto_cleanup_enabled ?? true}
                                onChange={(e) => handleUpdateSettings(a.id, a.arena_settings?.replay_retention_days || 7, e.target.checked)}
                              />
                            </div>
                            <div className="pt-4 border-t border-gray-100">
                              <Button 
                                variant="destructive" 
                                onClick={() => handleClearReplays(a.id)}
                                disabled={loading}
                                className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-xs gap-2"
                              >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />}
                                Limpar todos os replays
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl text-gray-400 hover:text-brand-orange hover:bg-brand-orange/5 transition-colors">
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
