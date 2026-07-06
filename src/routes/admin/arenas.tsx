import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, RefreshCw, MapPin, Edit2, Trash2, Upload, X, Phone } from "lucide-react";
import { MapPickerDialog } from "@/components/MapPickerDialog";
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

export const Route = createFileRoute("/admin/arenas")({
  component: Arenas,
});

interface Arena {
  id: string;
  nome: string;
  edge_device_id: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  telefone: string | null;
  logo_url: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at?: string;
}

interface Client {
  id: string;
  nome: string;
}

interface EdgeDevice {
  id: string;
  name: string;
  client_id: string | null;
}

const BR_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB",
  "PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const ARENA_SELECT = "id, nome, edge_device_id, endereco, cidade, estado, cep, telefone, logo_url, latitude, longitude, created_at";

function Arenas() {
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [edges, setEdges] = useState<EdgeDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // form state
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [edgeId, setEdgeId] = useState<string>("");
  const [endereco, setEndereco] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [cep, setCep] = useState("");
  const [telefone, setTelefone] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);

  // filter state (must pick a city to see arenas)
  const [filterEstado, setFilterEstado] = useState<string>("");
  const [cityFilter, setCityFilter] = useState<string>("");

  const [editing, setEditing] = useState<Arena | null>(null);
  const [deleting, setDeleting] = useState<Arena | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: a, error: e1 }, { data: c }, { data: ed }] = await Promise.all([
      supabase.from("arenas").select(ARENA_SELECT).order("nome"),
      supabase.from("clients").select("id, nome").order("nome"),
      supabase.from("edge_devices").select("id, name, client_id").order("name"),
    ]);
    if (e1) toast.error("Erro ao buscar arenas");
    else setArenas((a as Arena[]) || []);
    setClients(c || []);
    setEdges(ed || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const filteredEdges = useMemo(
    () => (clientId ? edges.filter((e) => e.client_id === clientId) : []),
    [edges, clientId]
  );

  // Estados that have at least one arena
  const availableStates = useMemo(() => {
    const set = new Set<string>();
    for (const a of arenas) {
      const s = (a.estado || "").trim().toUpperCase();
      if (s) set.add(s);
    }
    return Array.from(set).sort();
  }, [arenas]);

  // Cities (filtered by selected estado in form or filter)
  const citiesForState = (uf: string) => {
    const set = new Set<string>();
    for (const a of arenas) {
      const s = (a.estado || "").trim().toUpperCase();
      const c = (a.cidade || "").trim();
      if (c && (!uf || s === uf.toUpperCase())) set.add(c);
    }
    return Array.from(set).sort((x, y) => x.localeCompare(y, "pt-BR"));
  };

  const formCitySuggestions = useMemo(() => citiesForState(estado), [arenas, estado]);
  const filterCitySuggestions = useMemo(() => citiesForState(filterEstado), [arenas, filterEstado]);

  const visibleArenas = useMemo(() => {
    if (!cityFilter) return [];
    return arenas.filter((a) => {
      const cityOk = (a.cidade || "").trim() === cityFilter;
      const stateOk = !filterEstado || (a.estado || "").trim().toUpperCase() === filterEstado.toUpperCase();
      return cityOk && stateOk;
    });
  }, [arenas, cityFilter, filterEstado]);

  const resetForm = () => {
    setEditing(null);
    setName(""); setClientId(""); setEdgeId("");
    setEndereco(""); setCidade(""); setEstado(""); setCep(""); setTelefone("");
    setLatitude(""); setLongitude("");
    setLogoUrl(null);
  };

  const openCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEdit = (a: Arena) => {
    setEditing(a);
    setName(a.nome);
    const edge = edges.find((e) => e.id === a.edge_device_id);
    setClientId(edge?.client_id ?? "");
    setEdgeId(a.edge_device_id ?? "");
    setEndereco(a.endereco ?? "");
    setCidade(a.cidade ?? "");
    setEstado(a.estado ?? "");
    setCep(a.cep ?? "");
    setTelefone(a.telefone ?? "");
    setLatitude(a.latitude != null ? String(a.latitude) : "");
    setLongitude(a.longitude != null ? String(a.longitude) : "");
    setLogoUrl(a.logo_url ?? null);
    setIsDialogOpen(true);
  };

  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 5MB");
      return;
    }
    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `logos/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("arenas")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("arenas").getPublicUrl(path);
      setLogoUrl(pub.publicUrl);
      toast.success("Logo enviada");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar logo");
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };


  const handleSubmit = async () => {
    if (!name.trim()) return toast.error("Informe o nome da arena");
    if (!estado.trim()) return toast.error("Selecione o estado da arena");
    if (!cidade.trim()) return toast.error("Informe a cidade da arena");
    if (!clientId) return toast.error("Selecione o cliente");
    if (!edgeId) return toast.error("Selecione o Edge Device");

    // parse coords
    let lat: number | null = null;
    let lng: number | null = null;
    if (latitude.trim() || longitude.trim()) {
      lat = parseFloat(latitude.replace(",", "."));
      lng = parseFloat(longitude.replace(",", "."));
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        return toast.error("Coordenadas inválidas");
      }
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return toast.error("Coordenadas fora do intervalo válido");
      }
    }

    const payload = {
      nome: name.trim(),
      edge_device_id: edgeId,
      endereco: endereco.trim() || null,
      cidade: cidade.trim() || null,
      estado: estado.trim().toUpperCase() || null,
      cep: cep.trim() || null,
      telefone: telefone.trim() || null,
      logo_url: logoUrl,
      latitude: lat,
      longitude: lng,
    };

    setSubmitting(true);
    if (editing) {
      const { error } = await supabase.from("arenas").update(payload).eq("id", editing.id);
      setSubmitting(false);
      if (error) return toast.error("Erro ao atualizar arena");
      toast.success("Arena atualizada");
    } else {
      const { error } = await supabase.from("arenas").insert([payload]);
      setSubmitting(false);
      if (error) return toast.error("Erro ao criar arena");
      toast.success("Arena criada");
    }
    setIsDialogOpen(false);
    resetForm();
    fetchAll();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("arenas").delete().eq("id", deleting.id);
    if (error) toast.error("Erro ao excluir arena");
    else { toast.success("Arena excluída"); fetchAll(); }
    setDeleting(null);
  };

  const edgeName = (id: string | null) => edges.find((e) => e.id === id)?.name ?? "—";
  const clientName = (edgeDeviceId: string | null) => {
    const edge = edges.find((e) => e.id === edgeDeviceId);
    return clients.find((c) => c.id === edge?.client_id)?.nome ?? "—";
  };

  const mapsUrl = (a: Arena) =>
    a.latitude != null && a.longitude != null
      ? `https://www.google.com/maps?q=${a.latitude},${a.longitude}`
      : a.endereco
        ? `https://www.google.com/maps?q=${encodeURIComponent(a.endereco)}`
        : null;

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900 uppercase">
            Arenas <span className="brand-text">Complexos</span>
          </h1>
          <p className="text-muted-foreground mt-1 font-medium text-base sm:text-lg">
            Cada arena pertence a um Edge Device de um cliente.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="icon" onClick={fetchAll} disabled={loading} className="rounded-xl border-gray-200 h-10 sm:h-12 w-10 sm:w-12 shadow-sm bg-white hover:bg-gray-50 shrink-0">
            <RefreshCw className={`h-5 w-5 text-gray-400 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} className="brand-gradient brand-glow text-white font-black uppercase tracking-widest px-4 sm:px-6 h-10 sm:h-12 rounded-xl transition-transform hover:scale-[1.02] text-xs sm:text-sm flex-1 sm:flex-none">
                <Plus className="mr-2 h-5 w-5" /> Nova Arena
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl border-none shadow-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight text-gray-900">
                  {editing ? "Editar Arena" : "Adicionar Arena"}
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-5 py-6">
                {/* Logo upload */}
                <div className="grid gap-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Logo da Arena</Label>
                  <div className="flex items-center gap-4">
                    <div className="h-20 w-20 rounded-2xl bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
                      ) : (
                        <MapPin className="h-7 w-7 text-gray-300" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2 flex-1">
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleLogoUpload(f);
                        }}
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => logoInputRef.current?.click()}
                          disabled={uploadingLogo}
                          className="rounded-xl font-bold border-gray-200"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {uploadingLogo ? "Enviando..." : logoUrl ? "Trocar" : "Enviar logo"}
                        </Button>
                        {logoUrl && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setLogoUrl(null)}
                            className="rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50"
                          >
                            <X className="h-4 w-4 mr-1" /> Remover
                          </Button>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">PNG, JPG ou WebP — até 5MB.</p>
                    </div>
                  </div>
                </div>

                {/* Cliente + Edge */}
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Cliente</Label>
                    <Select value={clientId} onValueChange={(v) => { setClientId(v); setEdgeId(""); }}>
                      <SelectTrigger className="rounded-xl border-gray-100 bg-gray-50 h-12">
                        <SelectValue placeholder="Selecione o cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Edge Device</Label>
                    <Select value={edgeId} onValueChange={setEdgeId} disabled={!clientId}>
                      <SelectTrigger className="rounded-xl border-gray-100 bg-gray-50 h-12">
                        <SelectValue placeholder={clientId ? (filteredEdges.length ? "Selecione o edge" : "Sem edges") : "Selecione o cliente"} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredEdges.map((e) => (
                          <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Nome */}
                <div className="grid gap-2">
                  <Label htmlFor="name" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nome da Arena</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Ex: Arena Guga Kuerten" className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:border-brand-orange focus:ring-brand-orange" />
                </div>

                {/* Estado + Cidade + CEP */}
                <div className="grid gap-5 sm:grid-cols-[120px_1fr_160px]">
                  <div className="grid gap-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Estado (UF)</Label>
                    <Select
                      value={estado || undefined}
                      onValueChange={(v) => {
                        setEstado(v);
                        // se a cidade atual não pertence ao novo estado (na lista sugerida), mantém mas usuário pode ajustar
                      }}
                    >
                      <SelectTrigger className="rounded-xl border-gray-100 bg-gray-50 h-12">
                        <SelectValue placeholder="UF" />
                      </SelectTrigger>
                      <SelectContent>
                        {BR_STATES.map((uf) => (
                          <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="cidade" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Cidade</Label>
                    <Input
                      id="cidade"
                      value={cidade}
                      onChange={(e) => setCidade(e.target.value)}
                      maxLength={80}
                      placeholder={estado ? `Cidades em ${estado}` : "Selecione a UF"}
                      list="arena-cidades"
                      className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:border-brand-orange focus:ring-brand-orange"
                    />
                    <datalist id="arena-cidades">
                      {formCitySuggestions.map((c) => <option key={c} value={c} />)}
                    </datalist>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="cep" className="text-xs font-black uppercase tracking-widest text-muted-foreground">CEP</Label>
                    <Input
                      id="cep"
                      value={cep}
                      onChange={(e) => setCep(e.target.value)}
                      maxLength={12}
                      placeholder="00000-000"
                      className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:border-brand-orange focus:ring-brand-orange"
                    />
                  </div>
                </div>

                {/* Endereço + Telefone */}
                <div className="grid gap-5 sm:grid-cols-[1fr_240px]">
                  <div className="grid gap-2">
                    <Label htmlFor="endereco" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Endereço</Label>
                    <Input
                      id="endereco"
                      value={endereco}
                      onChange={(e) => setEndereco(e.target.value)}
                      maxLength={255}
                      placeholder="Rua, número, bairro"
                      className="rounded-xl border-gray-100 bg-gray-50 h-12 focus:border-brand-orange focus:ring-brand-orange"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="telefone" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Telefone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="telefone"
                        value={telefone}
                        onChange={(e) => setTelefone(e.target.value)}
                        maxLength={40}
                        placeholder="(00) 00000-0000"
                        className="rounded-xl border-gray-100 bg-gray-50 h-12 pl-10 focus:border-brand-orange focus:ring-brand-orange"
                      />
                    </div>
                  </div>
                </div>



                {/* Localização no mapa */}
                <div className="grid gap-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Localização no Mapa</Label>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="h-14 w-14 rounded-xl bg-brand-orange/10 flex items-center justify-center text-brand-orange shrink-0">
                      <MapPin className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {latitude && longitude ? (
                        <>
                          <p className="text-xs font-black uppercase tracking-widest text-gray-500">Pin salvo</p>
                          <p className="font-mono text-sm text-gray-800 truncate">
                            {parseFloat(latitude).toFixed(6)}, {parseFloat(longitude).toFixed(6)}
                          </p>
                          <a
                            href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-brand-orange font-bold hover:underline inline-flex items-center gap-1"
                          >
                            Ver no Google Maps
                          </a>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-bold text-gray-700">Nenhuma localização definida</p>
                          <p className="text-[11px] text-muted-foreground">
                            Abra o mapa e dê dois cliques no local exato da arena.
                          </p>
                        </>
                      )}
                    </div>
                    <Button
                      type="button"
                      onClick={() => setMapPickerOpen(true)}
                      className="rounded-xl brand-gradient text-white font-black uppercase tracking-widest px-5 h-11 text-xs shrink-0"
                    >
                      <MapPin className="h-4 w-4 mr-2" />
                      {latitude && longitude ? "Alterar no mapa" : "Selecionar no mapa"}
                    </Button>
                  </div>
                </div>

              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl font-bold">Cancelar</Button>
                <Button onClick={handleSubmit} disabled={submitting || uploadingLogo} className="brand-gradient text-white font-black uppercase tracking-widest px-8 rounded-xl h-12">
                  {submitting ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filtro: estado → cidade */}
      <div className="glass-card bg-white shadow-xl border border-gray-100 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-brand-orange/10 flex items-center justify-center text-brand-orange shrink-0">
            <MapPin className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Filtrar arenas</p>
            <p className="text-sm font-bold text-gray-800 truncate">
              {filterEstado && cityFilter
                ? `Mostrando arenas em ${cityFilter} / ${filterEstado}`
                : filterEstado
                  ? `Selecione uma cidade em ${filterEstado}`
                  : "Selecione um estado para começar"}
            </p>
          </div>
        </div>
        <div className="sm:w-40">
          <Select
            value={filterEstado || "__none"}
            onValueChange={(v) => { const uf = v === "__none" ? "" : v; setFilterEstado(uf); setCityFilter(""); }}
          >
            <SelectTrigger className="rounded-xl border-gray-100 bg-gray-50 h-12">
              <SelectValue placeholder={availableStates.length ? "UF" : "—"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Todas as UFs</SelectItem>
              {availableStates.map((uf) => (
                <SelectItem key={uf} value={uf}>{uf}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:w-64">
          <Select
            value={cityFilter || "__none"}
            onValueChange={(v) => setCityFilter(v === "__none" ? "" : v)}
          >
            <SelectTrigger className="rounded-xl border-gray-100 bg-gray-50 h-12">
              <SelectValue placeholder={filterCitySuggestions.length ? "Escolha a cidade" : "Sem cidades"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Nenhuma (limpar)</SelectItem>
              {filterCitySuggestions.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!cityFilter ? (
        <div className="glass-card bg-white shadow-xl border border-gray-100 p-16 text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-brand-orange/10 flex items-center justify-center text-brand-orange mb-4">
            <MapPin className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-black uppercase tracking-tight text-gray-900">Escolha uma cidade</h3>
          <p className="text-sm text-muted-foreground font-medium mt-1">
            {availableStates.length || filterCitySuggestions.length
              ? "Selecione uma cidade acima para ver as arenas. A UF é opcional para filtrar."
              : "Ainda não há arenas cadastradas. Cadastre uma arena para começar."}
          </p>
        </div>


      ) : (
      <>
        {/* Mobile card list */}
        <ul className="space-y-3 md:hidden">
          {visibleArenas.length === 0 ? (
            <li className="rounded-xl border border-zinc-800/60 bg-zinc-900 p-6 text-center text-sm text-zinc-400 italic">
              Nenhuma arena cadastrada em {cityFilter}.
            </li>
          ) : (
            visibleArenas.map((a) => {
              const mapLink = mapsUrl(a);
              const location = [a.cidade, a.estado].filter(Boolean).join(" / ");
              return (
                <li
                  key={a.id}
                  className="rounded-xl border border-zinc-800/60 bg-zinc-900 p-4 transition-all duration-300 ease-out hover:border-zinc-700 hover:scale-[1.01]"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-brand-orange/10 text-brand-orange grid place-items-center">
                      {a.logo_url ? (
                        <img src={a.logo_url} alt={a.nome} className="h-full w-full object-cover" />
                      ) : (
                        <MapPin className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <h3 className="text-base font-bold text-white tracking-tight truncate">{a.nome}</h3>
                      <div className="space-y-1 text-sm text-zinc-400">
                        <p className="truncate">{clientName(a.edge_device_id)} · <span className="font-mono text-xs text-zinc-500">{edgeName(a.edge_device_id)}</span></p>
                        {a.telefone && (
                          <p className="flex items-center gap-1.5 truncate"><Phone className="h-3.5 w-3.5 shrink-0 text-zinc-500" /> {a.telefone}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {location && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300">
                            <MapPin className="h-3 w-3" /> {location}
                          </span>
                        )}
                        {mapLink && (
                          <a
                            href={mapLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-full border border-brand-orange/30 bg-brand-orange/10 px-2.5 py-1 text-xs font-medium text-brand-orange hover:bg-brand-orange/20 transition"
                          >
                            <MapPin className="h-3 w-3" /> Ver no mapa
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(a)} className="h-8 w-8 text-zinc-400 hover:text-brand-orange hover:bg-zinc-800">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleting(a)} className="h-8 w-8 text-zinc-400 hover:text-red-400 hover:bg-zinc-800">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })
          )}
        </ul>

        {/* Desktop table */}
        <div className="hidden md:block rounded-2xl border border-zinc-800/60 bg-zinc-900 overflow-hidden">
          <Table>
            <TableHeader className="bg-zinc-950/40 border-b border-zinc-800/60">
              <TableRow className="hover:bg-transparent border-zinc-800/60">
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4 px-6">Arena</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4 px-6">Cliente</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4 px-6">Contato</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4 px-6">Edge</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4 px-6">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleArenas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 text-center text-zinc-400 font-medium italic">
                    Nenhuma arena cadastrada em {cityFilter}.
                  </TableCell>
                </TableRow>
              ) : (
                visibleArenas.map((a) => {
                  const mapLink = mapsUrl(a);
                  return (
                    <TableRow key={a.id} className="hover:bg-zinc-800/40 transition-colors border-b border-zinc-800/60 last:border-0 group">
                      <TableCell className="py-5 px-6">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-2xl bg-brand-orange/10 flex items-center justify-center text-brand-orange overflow-hidden shrink-0">
                            {a.logo_url ? (
                              <img src={a.logo_url} alt={a.nome} className="h-full w-full object-cover" />
                            ) : (
                              <MapPin className="h-6 w-6" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-base text-white tracking-tight block truncate">{a.nome}</span>
                            {a.endereco && (
                              <p className="text-xs text-zinc-400 truncate">{a.endereco}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-5 px-6 text-sm font-semibold text-zinc-200">
                        {clientName(a.edge_device_id)}
                      </TableCell>
                      <TableCell className="py-5 px-6 text-xs text-zinc-300">
                        <div className="space-y-0.5">
                          {a.telefone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-zinc-500" />{a.telefone}</div>}
                          {mapLink && (
                            <a href={mapLink} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-brand-orange font-bold hover:underline">
                              <MapPin className="h-3 w-3" /> Ver no mapa
                            </a>
                          )}
                          {!a.telefone && !mapLink && <span className="italic text-zinc-500">—</span>}
                        </div>
                      </TableCell>
                      <TableCell className="py-5 px-6 text-sm font-mono text-zinc-300">
                        {edgeName(a.edge_device_id)}
                      </TableCell>
                      <TableCell className="text-right py-5 px-6 shrink-0">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(a)} className="h-10 w-10 rounded-xl text-zinc-400 hover:text-brand-orange hover:bg-zinc-800 transition-colors">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleting(a)} className="h-10 w-10 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </>
      )}



      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir arena?</AlertDialogTitle>
            <AlertDialogDescription>
              A arena "{deleting?.nome}" será removida permanentemente. Quadras vinculadas podem ser afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-red-500 hover:bg-red-600 font-black uppercase tracking-widest">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MapPickerDialog
        open={mapPickerOpen}
        onOpenChange={setMapPickerOpen}
        initialLat={latitude ? parseFloat(latitude) : null}
        initialLng={longitude ? parseFloat(longitude) : null}
        addressHint={[endereco, cidade, estado].filter(Boolean).join(", ")}
        onConfirm={(loc) => {
          setLatitude(loc.lat.toFixed(7));
          setLongitude(loc.lng.toFixed(7));
          // Auto-fill address parts only when currently empty
          if (loc.cidade && !cidade.trim()) setCidade(loc.cidade);
          if (loc.estado && !estado.trim()) setEstado(loc.estado.toUpperCase());
          if (loc.cep && !cep.trim()) setCep(loc.cep);
          toast.success("Localização definida");
        }}
      />
    </div>
  );
}

