import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, RefreshCw, Layout } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
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

  const handleCreate = async () => {
    if (!name || !arenaId) return;
    const { error } = await supabase.from("quadras").insert([{ nome: name, arena_id: arenaId }]);
    if (error) toast.error("Erro ao criar quadra");
    else {
      toast.success("Quadra criada");
      setIsDialogOpen(false);
      setName("");
      fetchData();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quadras (Courts)</h1>
          <p className="text-muted-foreground">Gerencie as quadras vinculadas às arenas.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Nova Quadra</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Adicionar Quadra</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="arena">Arena</Label>
                  <Select value={arenaId} onValueChange={setArenaId}>
                    <SelectTrigger><SelectValue placeholder="Selecione a arena" /></SelectTrigger>
                    <SelectContent>
                      {arenas.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="name">Nome da Quadra</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Quadra Central" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreate}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="rounded-md border bg-white dark:bg-gray-800 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quadra</TableHead>
              <TableHead>Arena</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quadras.map((q) => (
              <TableRow key={q.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Layout className="h-4 w-4 text-brand-orange" />
                    <span className="font-medium">{q.nome}</span>
                  </div>
                </TableCell>
                <TableCell>{q.arenas?.nome}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm">Editar</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}