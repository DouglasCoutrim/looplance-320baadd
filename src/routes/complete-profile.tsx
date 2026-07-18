import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Toaster, toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import logoUrl from "@/assets/looplance-logo.png";

export const Route = createFileRoute("/complete-profile")({
  component: CompleteProfile,
  head: () => ({
    meta: [
      { title: "Complete seu cadastro — Looplance" },
      { name: "description", content: "Complete seu perfil para acessar o Looplance." },
    ],
  }),
});

const BR_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB",
  "PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const GENDERS = [
  { value: "masculino", label: "Masculino" },
  { value: "feminino", label: "Feminino" },
  { value: "outro", label: "Outro" },
  { value: "prefiro_nao_dizer", label: "Prefiro não dizer" },
];

function formatCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function isValidCpf(cpf: string) {
  const s = cpf.replace(/\D/g, "");
  if (s.length !== 11 || /^(\d)\1+$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(s[i]) * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  if (d1 !== parseInt(s[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(s[i]) * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  return d2 === parseInt(s[10]);
}

interface Arena { id: string; cidade: string | null; estado: string | null; }

function CompleteProfile() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate({ to: "/auth" });
        return;
      }
      const uid = data.session.user.id;
      setUserId(uid);
      const [{ data: prof }, { data: arenaRows }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, cpf, birth_date, gender, city, state")
          .eq("id", uid)
          .maybeSingle(),
        supabase.from("arenas").select("id, cidade, estado"),
      ]);
      if (prof) {
        setFullName(prof.full_name ?? "");
        if (prof.cpf) setCpf(formatCpf(prof.cpf));
        setBirthDate(prof.birth_date ?? "");
        setGender(prof.gender ?? "");
        setCity(prof.city ?? "");
        setState(prof.state ?? "");
      }
      setArenas((arenaRows as Arena[]) ?? []);
      setLoading(false);
    })();
  }, [navigate]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    arenas.forEach((a) => {
      if (!a.cidade) return;
      if (state && (a.estado || "").toUpperCase() !== state) return;
      set.add(a.cidade.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [arenas, state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!userId) return;

    const cpfClean = cpf.replace(/\D/g, "");

    if (!fullName.trim()) { setSubmitError("Informe seu nome completo"); return; }
    if (!isValidCpf(cpfClean)) { setSubmitError("CPF inválido"); return; }
    if (!birthDate) { setSubmitError("Informe sua data de nascimento"); return; }
    if (!gender) { setSubmitError("Selecione o sexo"); return; }
    if (!city.trim()) { setSubmitError("Informe sua cidade"); return; }

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        cpf: cpfClean,
        birth_date: birthDate,
        gender,
        city: city.trim(),
        state: state || null,
        consent_accepted: true,
        consent_timestamp: new Date().toISOString(),
      })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      const msg = "Erro ao salvar: " + error.message;
      setSubmitError(msg);
      toast.error(msg);
      return;
    }
    toast.success("Cadastro completo!");
    window.location.href = "/";
  };

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-10">
      <Toaster position="top-center" />
      <div className="w-full max-w-sm flex justify-center">
        <img src={logoUrl} alt="Looplance" className="w-full h-auto" />
      </div>

      <form
        onSubmit={handleSubmit}
        className="-mt-10 w-full max-w-sm rounded-3xl bg-white shadow-lg border border-gray-200 p-6 space-y-4"
      >
        <div className="text-center space-y-1">
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-black text-gray-900">Complete seu cadastro</h1>
          <p className="text-xs text-gray-500">
            Precisamos de alguns dados para liberar o acesso à plataforma.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Nome completo</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome completo" required />
        </div>

        <div className="space-y-2">
          <Label>CPF</Label>
          <Input
            value={cpf}
            onChange={(e) => setCpf(formatCpf(e.target.value))}
            placeholder="000.000.000-00"
            inputMode="numeric"
            maxLength={14}
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Data de nascimento</Label>
          <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required />
        </div>

        <div className="space-y-2">
          <Label>Sexo</Label>
          <Select value={gender} onValueChange={setGender}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {GENDERS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-[100px_1fr] gap-3">
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select value={state} onValueChange={(v) => { setState(v); setCity(""); }}>
              <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
              <SelectContent>
                {BR_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Cidade</Label>
            {cities.length > 0 ? (
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger><SelectValue placeholder="Selecione a cidade" /></SelectTrigger>
                <SelectContent>
                  {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Sua cidade" required />
            )}
          </div>
        </div>

        {submitError && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
            <span>{submitError}</span>
          </div>
        )}
        <Button type="submit" disabled={saving} className="w-full">
          {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : "Concluir cadastro"}
        </Button>
      </form>
    </div>
  );
}
