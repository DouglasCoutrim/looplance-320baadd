import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { registerArenaUser } from "@/lib/user-admin.functions";
import logoUrl from "@/assets/looplance-logo.png";
import { UserPlus, Loader2, MapPin } from "lucide-react";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
  validateSearch: (search: Record<string, string>) => ({
    arena: search.arena ?? "",
  }),
});

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

function RegisterPage() {
  const navigate = useNavigate();
  const { arena: arenaId } = useSearch({ from: "/register" });
  const [arenaNome, setArenaNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const register = useServerFn(registerArenaUser);

  useEffect(() => {
    if (!arenaId) return;
    supabase.from("arenas").select("nome").eq("id", arenaId).single().then(({ data }) => {
      if (data) setArenaNome(data.nome);
    });
  }, [arenaId]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return toast.error("Informe seu nome completo");
    if (!isValidCpf(cpf)) return toast.error("CPF inválido");
    if (password.length < 6) return toast.error("Senha deve ter pelo menos 6 caracteres");
    if (!arenaId) return toast.error("Link inválido — código da arena não encontrado");

    setLoading(true);
    try {
      await register({
        data: {
          email: email.trim().toLowerCase(),
          password,
          full_name: fullName.trim(),
          cpf: cpf.replace(/\D/g, ""),
          arena_id: arenaId,
        },
      });
      setRegistered(true);
      toast.success("Cadastro realizado! Agora faça login.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao cadastrar");
    } finally {
      setLoading(false);
    }
  };

  if (!arenaId) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="text-center space-y-4">
          <MapPin className="h-16 w-16 text-brand-orange mx-auto" />
          <h1 className="text-2xl font-black text-gray-900">Link inválido</h1>
          <p className="text-muted-foreground">
            Escaneie o QR code da arena para se cadastrar.
          </p>
        </div>
      </div>
    );
  }

  if (registered) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
            <UserPlus className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-black text-gray-900">Cadastro realizado!</h1>
          <p className="text-muted-foreground">
            Sua conta foi criada e vinculada à <strong>{arenaNome}</strong>.
          </p>
          <button
            onClick={() => navigate({ to: "/auth" })}
            className="brand-gradient text-white font-black uppercase tracking-widest px-8 py-3 rounded-xl"
          >
            Ir para o login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-10">
      <Toaster theme="light" position="top-center" />

      <img src={logoUrl} alt="Looplance" className="h-20 sm:h-28 w-auto object-contain mb-8" />

      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8">
        {arenaNome && (
          <div className="flex items-center gap-2 mb-6 px-3 py-2 rounded-xl bg-brand-orange/5 border border-brand-orange/10">
            <MapPin className="h-4 w-4 text-brand-orange shrink-0" />
            <span className="text-sm font-bold text-gray-700 truncate">{arenaNome}</span>
          </div>
        )}

        <h1 className="text-2xl font-black text-gray-900 mb-1">Criar conta</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Preencha seus dados para se vincular à arena.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nome completo</label>
            <input
              type="text" value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Seu nome"
              className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">CPF</label>
            <input
              type="text" value={cpf}
              onChange={(e) => setCpf(formatCpf(e.target.value))}
              placeholder="000.000.000-00"
              maxLength={14}
              className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Email</label>
            <input
              type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Senha</label>
            <input
              type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange mt-1"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full brand-gradient text-white font-black uppercase tracking-widest h-12 rounded-xl hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "Criar conta"}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Já tem conta?{" "}
          <button onClick={() => navigate({ to: "/auth" })} className="text-brand-orange font-bold hover:underline">
            Faça login
          </button>
        </p>
      </div>
    </div>
  );
}
