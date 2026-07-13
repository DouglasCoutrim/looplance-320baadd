import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit2, Trash2, Building2, Snowflake, Play, Mail, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/clients")({
  component: ClientsPage,
});

interface Client {
  id: string;
  nome: string;
  email: string | null;
  documento: string | null;
  documento_tipo: "cpf" | "cnpj" | null;
  telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  is_frozen: boolean;
  frozen_at: string | null;
  frozen_reason: string | null;
  created_at: string | null;
}

const emptyForm = {
  nome: "",
  email: "",
  documento: "",
  documento_tipo: "cpf" as "cpf" | "cnpj",
  telefone: "",
  endereco: "",
  cidade: "",
  estado: "",
};

function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState<Client | null>(null);
  const [freezing, setFreezing] = useState<Client | null>(null);
  const [freezeReason, setFreezeReason] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [viewMode, setViewMode] = useState(false);

  const fetchClients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("clients").select("*").order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar clientes");
    else setClients((data ?? []) as Client[]);
    setLoading(false);
  };

  useEffect(() => { fetchClients(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setIsDialogOpen(true); };
  const openEdit = (c: Client) => {
    setEditing(c);
    setViewMode(true);
    setForm({
      nome: c.nome ?? "",
      email: c.email ?? "",
      documento: c.documento ?? "",
      documento_tipo: (c.documento_tipo ?? "cpf") as "cpf" | "cnpj",
      telefone: c.telefone ?? "",
      endereco: c.endereco ?? "",
      cidade: c.cidade ?? "",
      estado: c.estado ?? "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.nome.trim()) { toast.error("Nome é obrigatório"); return; }
    const payload = {
      nome: form.nome.trim(),
      email: form.email.trim() || null,
      documento: form.documento.trim() || null,
      documento_tipo: form.documento.trim() ? form.documento_tipo : null,
      telefone: form.telefone.trim() || null,
      endereco: form.endereco.trim() || null,
      cidade: form.cidade.trim() || null,
      estado: form.estado.trim().toUpperCase().slice(0, 2) || null,
    };
    if (editing) {
      const { error } = await supabase.from("clients").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Cliente atualizado");
    } else {
      const { error } = await supabase.from("clients").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Cliente cadastrado");
    }
    if (editing) {
      setViewMode(true);
    } else {
      setIsDialogOpen(false);
      setForm(emptyForm);
    }
    fetchClients();
  };

  const enterEditMode = () => setViewMode(false);

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("clients").delete().eq("id", deleting.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Cliente removido");
    setDeleting(null);
    fetchClients();
  };

  const handleFreezeToggle = async () => {
    if (!freezing) return;
    const willFreeze = !freezing.is_frozen;
    const { error } = await supabase.from("clients").update({
      is_frozen: willFreeze,
      frozen_at: willFreeze ? new Date().toISOString() : null,
      frozen_reason: willFreeze ? (freezeReason.trim() || null) : null,
    }).eq("id", freezing.id);
    if (error) { toast.error(error.message); return; }
    toast.success(willFreeze ? "Cliente congelado — edges bloqueados" : "Cliente reativado");
    setFreezing(null);
    setFreezeReason("");
    fetchClients();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-gray-900 flex items-center gap-2">
            <Building2 className="h-7 w-7 text-brand-orange" /> Clientes
          </h1>
          <p className="text-sm text-muted-foreground font-medium mt-1">
            Gerencie os clientes que possuem edges no sistema
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="brand-gradient text-white font-black uppercase tracking-widest rounded-xl h-12 px-6">
              <Plus className="h-4 w-4 mr-2" /> Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight">
                {viewMode && editing ? editing.nome : editing ? "Editar Cliente" : "Adicionar Cliente"}
              </DialogTitle>
            </DialogHeader>
            {viewMode && editing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
                <div className="sm:col-span-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Nome / Razão Social</Label>
                  <p className="mt-1 text-sm font-medium">{editing.nome}</p>
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Email</Label>
                  <p className="mt-1 text-sm font-medium">{editing.email || "\u2014"}</p>
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Telefone</Label>
                  <p className="mt-1 text-sm font-medium">{editing.telefone || "\u2014"}</p>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Documento</Label>
                  <p className="mt-1 text-sm font-medium">{editing.documento_tipo ? `${editing.documento_tipo.toUpperCase()} \u00b7 ${editing.documento || "\u2014"}` : "\u2014"}</p>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Endereço</Label>
                  <p className="mt-1 text-sm font-medium">{editing.endereco || "\u2014"}</p>
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Cidade</Label>
                  <p className="mt-1 text-sm font-medium">{editing.cidade || "\u2014"}</p>
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Estado</Label>
                  <p className="mt-1 text-sm font-medium">{editing.estado || "\u2014"}</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
                <Field label="Nome / Razão Social *" value={form.nome} onChange={(v) => setForm({ ...form, nome: v })} className="sm:col-span-2" />
                <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
                <Field label="Telefone" value={form.telefone} onChange={(v) => setForm({ ...form, telefone: v })} />
                <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                  <div>
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Tipo</Label>
                    <select
                      value={form.documento_tipo}
                      onChange={(e) => setForm({ ...form, documento_tipo: e.target.value as "cpf" | "cnpj" })}
                      className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-medium"
                    >
                      <option value="cpf">CPF</option>
                      <option value="cnpj">CNPJ</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <Field label={form.documento_tipo === "cpf" ? "CPF" : "CNPJ"} value={form.documento} onChange={(v) => setForm({ ...form, documento: v })} />
                  </div>
                </div>
                <Field label="Endereço" value={form.endereco} onChange={(v) => setForm({ ...form, endereco: v })} className="sm:col-span-2" />
                <Field label="Cidade" value={form.cidade} onChange={(v) => setForm({ ...form, cidade: v })} />
                <Field label="Estado (UF)" value={form.estado} onChange={(v) => setForm({ ...form, estado: v.toUpperCase().slice(0, 2) })} />
              </div>
            )}
            <DialogFooter>
              {viewMode && editing ? (
                <>
                  <Button variant="ghost" onClick={() => { setForm(emptyForm); setIsDialogOpen(false); }} className="rounded-xl font-bold">Fechar</Button>
                  <Button onClick={enterEditMode} className="brand-gradient text-white font-black uppercase tracking-widest px-8 rounded-xl h-12">Editar Cliente</Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => { setIsDialogOpen(false); setEditing(null); setForm(emptyForm); }} className="rounded-xl font-bold">Cancelar</Button>
                  <Button onClick={handleSubmit} className="brand-gradient text-white font-black uppercase tracking-widest px-8 rounded-xl h-12">
                    {editing ? "Salvar" : "Cadastrar"}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 py-16 text-center text-sm text-zinc-400">Carregando...</div>
      ) : clients.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 py-16 text-center">
          <Building2 className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-400 font-medium">Nenhum cliente cadastrado ainda</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {clients.map((c) => {
              const location = [c.cidade, c.estado].filter(Boolean).join(" / ");
              return (
                <li
                  key={c.id}
                  className="rounded-xl border border-zinc-800/60 bg-zinc-900 p-4 transition-all duration-300 ease-out hover:border-zinc-700"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <h3 className="text-base font-bold text-white tracking-tight truncate">{c.nome}</h3>
                      <div className="space-y-1 text-sm text-zinc-400">
                        {c.email && (
                          <p className="flex items-center gap-1.5 truncate"><Mail className="h-3.5 w-3.5 shrink-0 text-zinc-500" /> {c.email}</p>
                        )}
                        {c.telefone && (
                          <p className="flex items-center gap-1.5 truncate"><Phone className="h-3.5 w-3.5 shrink-0 text-zinc-500" /> {c.telefone}</p>
                        )}
                        {c.documento && (
                          <p className="font-mono text-xs text-zinc-500 uppercase">{c.documento_tipo} · {c.documento}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {location && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300">
                            <MapPin className="h-3 w-3" /> {location}
                          </span>
                        )}
                        {c.is_frozen ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2.5 py-1 text-xs text-blue-300 border border-blue-500/20">
                            <Snowflake className="h-3 w-3" /> Congelado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-300 border border-emerald-500/20">
                            Ativo
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => { setFreezing(c); setFreezeReason(c.frozen_reason ?? ""); }}
                        className="h-8 w-8 text-zinc-400 hover:text-brand-orange hover:bg-zinc-800"
                      >
                        {c.is_frozen ? <Play className="h-4 w-4" /> : <Snowflake className="h-4 w-4" />}
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(c)} className="h-8 w-8 text-zinc-400 hover:text-brand-orange hover:bg-zinc-800"><Edit2 className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleting(c)} className="h-8 w-8 text-zinc-400 hover:text-red-400 hover:bg-zinc-800"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Desktop table */}
          <div className="hidden md:block rounded-2xl border border-zinc-800/60 bg-zinc-900 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400">Cliente</TableHead>
                  <TableHead className="text-zinc-400">Documento</TableHead>
                  <TableHead className="text-zinc-400">Localização</TableHead>
                  <TableHead className="text-zinc-400">Contato</TableHead>
                  <TableHead className="text-zinc-400">Status</TableHead>
                  <TableHead className="text-right text-zinc-400">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => (
                  <TableRow key={c.id} className="border-zinc-800/60 hover:bg-zinc-800/40">
                    <TableCell>
                      <div className="font-bold text-white">{c.nome}</div>
                      {c.email && <div className="text-xs text-zinc-400">{c.email}</div>}
                    </TableCell>
                    <TableCell className="text-sm text-zinc-300">
                      {c.documento ? (
                        <>
                          <div className="font-mono">{c.documento}</div>
                          <div className="text-[10px] uppercase tracking-widest text-zinc-500">{c.documento_tipo}</div>
                        </>
                      ) : <span className="text-zinc-500">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-zinc-300">
                      {c.cidade || c.estado ? `${c.cidade ?? ""}${c.cidade && c.estado ? " / " : ""}${c.estado ?? ""}` : <span className="text-zinc-500">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-zinc-300">{c.telefone || <span className="text-zinc-500">—</span>}</TableCell>
                    <TableCell>
                      {c.is_frozen ? (
                        <Badge className="bg-blue-500/15 text-blue-300 border border-blue-500/20 gap-1"><Snowflake className="h-3 w-3" /> Congelado</Badge>
                      ) : (
                        <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">Ativo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => { setFreezing(c); setFreezeReason(c.frozen_reason ?? ""); }}
                          title={c.is_frozen ? "Reativar" : "Congelar"}
                          className="text-zinc-400 hover:text-brand-orange hover:bg-zinc-800"
                        >
                          {c.is_frozen ? <Play className="h-4 w-4" /> : <Snowflake className="h-4 w-4" />}
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(c)} className="text-zinc-400 hover:text-brand-orange hover:bg-zinc-800"><Edit2 className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleting(c)} className="text-zinc-400 hover:text-red-400 hover:bg-zinc-800"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}


      {/* Freeze / unfreeze dialog */}
      <Dialog open={!!freezing} onOpenChange={(o) => { if (!o) { setFreezing(null); setFreezeReason(""); } }}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight">
              {freezing?.is_frozen ? "Reativar Cliente" : "Congelar Cliente"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              {freezing?.is_frozen
                ? <>O cliente <strong>{freezing?.nome}</strong> voltará a operar normalmente e todos os edges dele serão reativados.</>
                : <>Ao congelar <strong>{freezing?.nome}</strong>, todos os edges, heartbeats e replays desse cliente serão bloqueados no servidor até a reativação.</>
              }
            </p>
            {!freezing?.is_frozen && (
              <div>
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Motivo (opcional)</Label>
                <Textarea
                  value={freezeReason}
                  onChange={(e) => setFreezeReason(e.target.value)}
                  placeholder="Ex.: Inadimplência – fatura de novembro"
                  className="mt-1 rounded-xl"
                  rows={3}
                />
              </div>
            )}
            {freezing?.is_frozen && freezing?.frozen_reason && (
              <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700 mb-1">Motivo original</p>
                <p className="text-sm text-blue-900">{freezing.frozen_reason}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setFreezing(null); setFreezeReason(""); }} className="rounded-xl font-bold">Cancelar</Button>
            <Button
              onClick={handleFreezeToggle}
              className={`rounded-xl font-black uppercase tracking-widest px-6 h-11 text-white ${freezing?.is_frozen ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"}`}
            >
              {freezing?.is_frozen ? "Reativar" : "Congelar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black uppercase tracking-tight">Deletar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar <strong>{deleting?.nome}</strong>? Os edges vinculados a este cliente ficarão sem cliente associado. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-bold">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest">
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", className = "",
}: { label: string; value: string; onChange: (v: string) => void; type?: string; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 rounded-xl h-11" />
    </div>
  );
}
