import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, RefreshCw, Filter, Play, CheckSquare, Square } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/admin/replays")({
  component: ReplaysManagement,
});

interface Replay {
  id: string;
  video_url: string;
  created_at: string;
  quadra_id: string;
  quadras?: {
    nome: string;
    arena_id: string;
    arenas?: {
      nome: string;
    } | null;
  } | null;
}

function ReplaysManagement() {
  const [replays, setReplays] = useState<Replay[]>([]);
  const [arenas, setArenas] = useState<any[]>([]);
  const [quadras, setQuadras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArenaId, setSelectedArenaId] = useState<string>("all");
  const [selectedQuadraId, setSelectedQuadraId] = useState<string>("all");
  const [selectedReplayIds, setSelectedReplayIds] = useState<string[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [arenasRes, quadrasRes] = await Promise.all([
        supabase.from("arenas").select("id, nome").order("nome"),
        supabase.from("quadras").select("id, nome, arena_id").order("nome"),
      ]);

      if (arenasRes.data) setArenas(arenasRes.data);
      if (quadrasRes.data) setQuadras(quadrasRes.data);

      let query = supabase
        .from("replays")
        .select("*, quadras(nome, arena_id, arenas(nome))")
        .order("created_at", { ascending: false });

      if (selectedQuadraId !== "all") {
        query = query.eq("quadra_id", selectedQuadraId);
      } else if (selectedArenaId !== "all") {
        const arenaQuadras = quadrasRes.data?.filter(q => q.arena_id === selectedArenaId).map(q => q.id) || [];
        if (arenaQuadras.length > 0) {
          query = query.in("quadra_id", arenaQuadras);
        } else {
          // If arena has no quadras, it has no replays
          setReplays([]);
          setLoading(false);
          return;
        }
      }

      const { data, error } = await query.limit(200);
      if (error) throw error;
      setReplays(data || []);
      setSelectedReplayIds([]);
    } catch (error: any) {
      toast.error("Erro ao carregar dados: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedArenaId, selectedQuadraId]);

  const toggleSelectAll = () => {
    if (selectedReplayIds.length === replays.length) {
      setSelectedReplayIds([]);
    } else {
      setSelectedReplayIds(replays.map(r => r.id));
    }
  };

  const toggleSelectReplay = (id: string) => {
    setSelectedReplayIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedReplayIds.length === 0) return;
    if (!confirm(`Deseja excluir ${selectedReplayIds.length} replays permanentemente do site e do Cloudflare?`)) return;

    setLoading(true);
    try {
      // Get R2 keys for selected replays
      const replaysToDelete = replays
        .filter(r => selectedReplayIds.includes(r.id))
        .map(r => ({ id: r.id, r2_key: (r as any).r2_key }));

      const { data, error } = await supabase.functions.invoke('delete-replays', {
        body: { replays: replaysToDelete }
      });

      if (error) throw error;

      toast.success(`${selectedReplayIds.length} replays excluídos com sucesso`);
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao excluir replays: " + error.message);
      setLoading(false);
    }
  };

  const filteredQuadras = selectedArenaId === "all" 
    ? quadras 
    : quadras.filter(q => q.arena_id === selectedArenaId);

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-gray-900 uppercase">
            Gestão de <span className="brand-text">Replays</span>
          </h1>
          <p className="text-muted-foreground mt-1 font-medium text-lg">
            Visualize e faça a limpeza manual de lances processados.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading} className="rounded-xl border-gray-200 h-12 w-12 shadow-sm bg-white hover:bg-gray-50">
            <RefreshCw className={`h-5 w-5 text-gray-400 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDeleteSelected} 
            disabled={loading || selectedReplayIds.length === 0}
            className="rounded-xl font-black uppercase tracking-widest px-6 h-12 transition-transform hover:scale-[1.02]"
          >
            <Trash2 className="mr-2 h-5 w-5" /> Excluir ({selectedReplayIds.length})
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Filtrar por Arena</label>
          <Select value={selectedArenaId} onValueChange={(val) => { setSelectedArenaId(val); setSelectedQuadraId("all"); }}>
            <SelectTrigger className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:ring-brand-orange">
              <SelectValue placeholder="Todas as Arenas" />
            </SelectTrigger>
            <SelectContent className="rounded-xl shadow-xl border-gray-100">
              <SelectItem value="all">Todas as Arenas</SelectItem>
              {arenas.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Filtrar por Quadra</label>
          <Select value={selectedQuadraId} onValueChange={setSelectedQuadraId}>
            <SelectTrigger className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:ring-brand-orange">
              <SelectValue placeholder="Todas as Quadras" />
            </SelectTrigger>
            <SelectContent className="rounded-xl shadow-xl border-gray-100">
              <SelectItem value="all">Todas as Quadras</SelectItem>
              {filteredQuadras.map(q => (
                <SelectItem key={q.id} value={q.id}>{q.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end">
          <Button variant="ghost" onClick={() => { setSelectedArenaId("all"); setSelectedQuadraId("all"); }} className="mb-1 text-xs font-bold text-muted-foreground hover:text-brand-orange">
            Limpar Filtros
          </Button>
        </div>
      </div>

      <div className="glass-card bg-white shadow-xl border border-gray-100 overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader className="bg-gray-50/50 border-b border-gray-100">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[50px] py-4 px-6">
                <Checkbox 
                  checked={replays.length > 0 && selectedReplayIds.length === replays.length}
                  onCheckedChange={toggleSelectAll}
                  className="border-gray-300 data-[state=checked]:bg-brand-orange data-[state=checked]:border-brand-orange"
                />
              </TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4 px-6">Preview</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4 px-6">Localização</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4 px-6">Data / Hora</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4 px-6 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {replays.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-40 text-center text-muted-foreground font-medium italic">
                  Nenhum replay encontrado com os filtros selecionados.
                </TableCell>
              </TableRow>
            ) : (
              replays.map((replay) => (
                <TableRow key={replay.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-50 last:border-0 group">
                  <TableCell className="py-5 px-6">
                    <Checkbox 
                      checked={selectedReplayIds.includes(replay.id)}
                      onCheckedChange={() => toggleSelectReplay(replay.id)}
                      className="border-gray-300 data-[state=checked]:bg-brand-orange data-[state=checked]:border-brand-orange"
                    />
                  </TableCell>
                  <TableCell className="py-5 px-6">
                    <div className="relative h-16 w-28 rounded-lg overflow-hidden bg-black ring-1 ring-gray-100 group-hover:scale-105 transition-transform">
                      <video 
                        src={`${replay.video_url}#t=0.1`} 
                        className="h-full w-full object-cover opacity-80"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Play className="h-5 w-5 text-white fill-white/20" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-5 px-6">
                    <div className="flex flex-col">
                      <span className="font-black text-xs uppercase tracking-tight text-gray-700">{replay.quadras?.arenas?.nome}</span>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">{replay.quadras?.nome}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-5 px-6">
                    <div className="flex flex-col">
                      <span className="font-bold text-xs text-gray-700">
                        {format(new Date(replay.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                      <span className="text-[10px] font-medium text-muted-foreground uppercase">
                        {format(new Date(replay.created_at), "HH:mm:ss", { locale: ptBR })}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right py-5 px-6">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => {
                        setSelectedReplayIds([replay.id]);
                        setTimeout(() => handleDeleteSelected(), 100);
                      }}
                      className="h-10 w-10 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
