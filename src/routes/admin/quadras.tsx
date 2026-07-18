import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, RefreshCw, Layout, Edit2, Trash2, Tv, MapPin, Building2, Upload, X, ImageIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
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
import { toast } from "sonner";

export const Route = createFileRoute("/admin/quadras")({
  component: Quadras,
});

type QuadraTipo = "grama" | "sintetico" | "areia" | "terra" | "cimento";

const TIPO_OPTIONS: { value: QuadraTipo; label: string }[] = [
  { value: "grama", label: "Grama" },
  { value: "sintetico", label: "Sintético" },
  { value: "areia", label: "Areia" },
  { value: "terra", label: "Terra" },
  { value: "cimento", label: "Cimento" },
];
const TIPO_LABEL: Record<string, string> = Object.fromEntries(TIPO_OPTIONS.map(o => [o.value, o.label]));

interface Quadra {
  id: string;
  nome: string;
  arena_id: string;
  tipo: QuadraTipo | null;
  cover_image_url: string | null;
  arenas?: { nome: string; cidade: string | null } | null;
}

interface ArenaOpt {
  id: string;
  nome: string;
  cidade: string | null;
}

function Quadras() {
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [arenas, setArenas] = useState<ArenaOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [name, setName] = useState("");
  const [arenaId, setArenaId] = useState("");
  const [tipo, setTipo] = useState<QuadraTipo | "">("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<Quadra | null>(null);
  const [deleting, setDeleting] = useState<Quadra | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState(false);

  // Cascading filters: cidade -> arena -> quadras
  const [cityFilter, setCityFilter] = useState<string>("");
  const [arenaFilter, setArenaFilter] = useState<string>("");

  const fetchData = async () => {
    setLoading(true);
    const [qRes, aRes] = await Promise.all([
      supabase.from("quadras").select("*, arenas(nome, cidade)").order("nome"),
      supabase.from("arenas").select("id, nome, cidade").order("nome"),
    ]);
    setQuadras(((qRes.data as any) || []) as Quadra[]);
    setArenas(aRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Only cities that actually have at least one arena registered
  const availableCities = useMemo(() => {
    const set = new Set<string>();
    for (const a of arenas) {
      const c = (a.cidade || "").trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort((x, y) => x.localeCompare(y, "pt-BR"));
  }, [arenas]);

  const arenasInCity = useMemo(
    () => (cityFilter ? arenas.filter((a) => (a.cidade || "").trim() === cityFilter) : []),
    [arenas, cityFilter]
  );

  const visibleQuadras = useMemo(
    () => (arenaFilter ? quadras.filter((q) => q.arena_id === arenaFilter) : []),
    [quadras, arenaFilter]
  );

  // Reset arena filter when city changes
  useEffect(() => {
    setArenaFilter("");
  }, [cityFilter]);

  const resetForm = () => {
    setName("");
    setArenaId(arenaFilter || "");
    setTipo("");
    setCoverUrl(null);
    setEditing(null);
    setViewMode(false);
  };

  const openCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEdit = (q: Quadra) => {
    setEditing(q);
    setViewMode(true);
    setName(q.nome);
    setArenaId(q.arena_id);
    setTipo(q.tipo ?? "");
    setCoverUrl(q.cover_image_url ?? null);
    setIsDialogOpen(true);
  };

  const handleCoverUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 8MB");
      return;
    }
    setUploadingCover(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `quadras/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("arenas")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("arenas").getPublicUrl(path);
      setCoverUrl(pub.publicUrl);
      toast.success("Imagem enviada");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar imagem");
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!name || !arenaId) {
      toast.error("Nome e Arena são obrigatórios");
      return;
    }
    const payload = {
      nome: name,
      arena_id: arenaId,
      tipo: tipo || null,
      cover_image_url: coverUrl,
    };
    if (editing) {
      const { error } = await supabase.from("quadras").update(payload).eq("id", editing.id);
      if (error) return toast.error("Erro ao atualizar quadra");
      toast.success("Quadra atualizada");
    } else {
      const { error } = await supabase.from("quadras").insert([payload]);
      if (error) return toast.error("Erro ao criar quadra");
      toast.success("Quadra criada");
    }
    setSubmitting(false);
    if (editing) {
      setViewMode(true);
    } else {
      setIsDialogOpen(false);
      resetForm();
    }
    fetchData();
  };

  const enterEditMode = () => setViewMode(false);

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("quadras").delete().eq("id", deleting.id);
    if (error) toast.error("Erro ao excluir quadra");
    else {
      toast.success("Quadra excluída");
      fetchData();
    }
    setDeleting(null);
  };

  const selectedArena = arenas.find((a) => a.id === arenaFilter);

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex gap-3">
          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading} className="rounded-xl border-gray-200 h-10 sm:h-12 w-10 sm:w-12 shadow-sm bg-white hover:bg-gray-50 shrink-0">
            <RefreshCw className={`h-5 w-5 text-gray-400 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button
                onClick={openCreate}
                disabled={!arenaFilter}
                title={!arenaFilter ? "Escolha cidade e arena antes de criar" : undefined}
                className="brand-gradient brand-glow text-white font-black uppercase tracking-widest px-4 sm:px-6 h-10 sm:h-12 rounded-xl transition-transform hover:scale-[1.02] text-xs sm:text-sm flex-1 sm:flex-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="mr-2 h-5 w-5" /> Nova Quadra
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl border-none shadow-2xl max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight text-gray-900">
                  {viewMode && editing ? editing.nome : (editing ? "Editar Quadra" : "Adicionar Quadra")}
                </DialogTitle>
              </DialogHeader>
              {viewMode && editing ? (
                <div className="grid gap-5 py-6">
                  {editing.cover_image_url && (
                    <div className="rounded-2xl overflow-hidden">
                      <img src={editing.cover_image_url} alt={editing.nome} className="w-full h-48 object-cover" />
                    </div>
                  )}
                  <div className="grid gap-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nome da Quadra</Label>
                    <p className="text-lg font-bold text-gray-900">{editing.nome}</p>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Complexo (Arena)</Label>
                    <p className="text-lg font-bold text-gray-900">{arenas.find((a) => a.id === editing.arena_id)?.nome || editing.arena_id}</p>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Tipo de Piso</Label>
                    {editing.tipo ? (
                      <span className="inline-block text-sm font-black uppercase tracking-widest px-3 py-1 rounded-full bg-brand-orange/10 text-brand-orange w-fit">
                        {TIPO_LABEL[editing.tipo]}
                      </span>
                    ) : (
                      <p className="text-sm text-muted-foreground font-medium">Não definido</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid gap-5 py-6">
                  {/* Cover upload */}
                  <div className="grid gap-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Imagem de Capa</Label>
                    <div className="flex items-center gap-4">
                      <div className="h-24 w-32 rounded-2xl bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                        {coverUrl ? (
                          <img src={coverUrl} alt="Capa" className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-7 w-7 text-gray-300" />
                        )}
                      </div>
                      <div className="flex flex-col gap-2 flex-1">
                        <input
                          ref={coverInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleCoverUpload(f);
                          }}
                        />
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => coverInputRef.current?.click()} disabled={uploadingCover} className="rounded-xl font-bold border-gray-200">
                            <Upload className="h-4 w-4 mr-2" />
                            {uploadingCover ? "Enviando..." : coverUrl ? "Trocar" : "Enviar capa"}
                          </Button>
                          {coverUrl && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => setCoverUrl(null)} className="rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50">
                              <X className="h-4 w-4 mr-1" /> Remover
                            </Button>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">PNG, JPG ou WebP — até 8MB.</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Complexo (Arena)</Label>
                    <Select value={arenaId} onValueChange={setArenaId}>
                      <SelectTrigger className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:ring-brand-orange">
                        <SelectValue placeholder="Selecione a arena" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-gray-100 shadow-xl">
                        {arenas.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.nome}{a.cidade ? ` — ${a.cidade}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-[1fr_200px]">
                    <div className="grid gap-2">
                      <Label htmlFor="name" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nome da Quadra</Label>
                      <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Quadra 01 - Central" className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:border-brand-orange focus:ring-brand-orange" />
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Tipo de Piso</Label>
                      <Select value={tipo || undefined} onValueChange={(v) => setTipo(v as QuadraTipo)}>
                        <SelectTrigger className="rounded-xl border-gray-100 bg-gray-50 h-12">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPO_OPTIONS.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter>
                {viewMode && editing ? (
                  <>
                    <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl font-bold">Fechar</Button>
                    <Button onClick={enterEditMode} className="brand-gradient text-white font-black uppercase tracking-widest px-8 rounded-xl h-12">Editar Quadra</Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl font-bold">Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={uploadingCover} className="brand-gradient text-white font-black uppercase tracking-widest px-8 rounded-xl h-12">Salvar</Button>
                  </>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Cascading filters: cidade -> arena */}
      <div className="glass-card bg-white shadow-xl border border-gray-100 p-4 sm:p-5 grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> 1. Cidade
          </Label>
          <Select value={cityFilter || "__none"} onValueChange={(v) => setCityFilter(v === "__none" ? "" : v)}>
            <SelectTrigger className="rounded-xl border-gray-100 bg-gray-50 h-12">
              <SelectValue placeholder={availableCities.length ? "Escolha a cidade" : "Nenhuma cidade cadastrada"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Nenhuma (limpar)</SelectItem>
              {availableCities.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> 2. Arena
          </Label>
          <Select
            value={arenaFilter || "__none"}
            onValueChange={(v) => setArenaFilter(v === "__none" ? "" : v)}
            disabled={!cityFilter}
          >
            <SelectTrigger className="rounded-xl border-gray-100 bg-gray-50 h-12">
              <SelectValue placeholder={cityFilter ? (arenasInCity.length ? "Escolha a arena" : "Sem arenas nesta cidade") : "Escolha a cidade primeiro"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Nenhuma (limpar)</SelectItem>
              {arenasInCity.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!arenaFilter ? (
        <div className="glass-card bg-white shadow-xl border border-gray-100 p-16 text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-brand-orange/10 flex items-center justify-center text-brand-orange mb-4">
            {cityFilter ? <Building2 className="h-8 w-8" /> : <MapPin className="h-8 w-8" />}
          </div>
          <h3 className="text-lg font-black uppercase tracking-tight text-gray-900">
            {cityFilter ? "Escolha a arena" : "Escolha uma cidade"}
          </h3>
          <p className="text-sm text-muted-foreground font-medium mt-1">
            {cityFilter
              ? `Selecione uma arena de ${cityFilter} para ver suas quadras.`
              : "Primeiro escolha a cidade, depois a arena, e as quadras aparecerão aqui."}
          </p>
        </div>
      ) : (
        <div className="glass-card bg-white shadow-xl border border-gray-100 overflow-x-auto">
          <div className="px-4 sm:px-6 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2 text-xs font-bold text-gray-600">
            <MapPin className="h-3.5 w-3.5 text-brand-orange" />
            <span>{cityFilter}</span>
            <span className="text-gray-400">/</span>
            <Building2 className="h-3.5 w-3.5 text-brand-orange" />
            <span>{selectedArena?.nome}</span>
          </div>
          <Table className="w-full min-w-[480px]">
            <TableHeader className="bg-gray-50/50 border-b border-gray-100">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-500 py-4 px-6">Quadra / Court</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-500 py-4 px-6">Arena Vinculada</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-gray-500 py-4 px-6">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleQuadras.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-40 text-center text-muted-foreground font-medium italic">
                    Nenhuma quadra cadastrada nesta arena.
                  </TableCell>
                </TableRow>
              ) : (
                visibleQuadras.map((q) => (
                  <TableRow key={q.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-50 last:border-0 group">
                    <TableCell className="py-4 sm:py-5 px-4 sm:px-6">
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="h-12 w-16 sm:h-14 sm:w-20 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 overflow-hidden shrink-0 border border-gray-100">
                          {q.cover_image_url ? (
                            <img src={q.cover_image_url} alt={q.nome} className="h-full w-full object-cover" />
                          ) : (
                            <Layout className="h-5 w-5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="font-black text-base sm:text-lg text-gray-900 uppercase tracking-tight block truncate">{q.nome}</span>
                          {q.tipo ? (
                            <span className="inline-block mt-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-brand-orange/10 text-brand-orange">
                              {TIPO_LABEL[q.tipo]}
                            </span>
                          ) : (
                            <p className="text-[10px] font-medium text-muted-foreground truncate">Sem tipo definido</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 sm:py-5 px-4 sm:px-6">
                      <div className="flex items-center gap-2">
                        <Tv className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-brand-orange shrink-0" />
                        <span className="font-bold text-gray-700 text-xs sm:text-sm truncate">{q.arenas?.nome}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right py-4 sm:py-5 px-4 sm:px-6 shrink-0">
                      <div className="flex justify-end gap-1 sm:gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(q)} className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl text-gray-400 hover:text-brand-orange hover:bg-brand-orange/5 transition-colors">
                          <Edit2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleting(q)} className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
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
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir quadra?</AlertDialogTitle>
            <AlertDialogDescription>
              A quadra "{deleting?.nome}" será removida permanentemente.
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
