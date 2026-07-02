import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import logoUrl from "@/assets/looplance-logo.png";
import { LogIn, UserPlus, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Entrar — Looplance" },
      { name: "description", content: "Acesse sua conta para ver e baixar seus lances." },
    ],
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

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  // Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");

  // Signup
  const [sFullName, setSFullName] = useState("");
  const [sCpf, setSCpf] = useState("");
  const [sEmail, setSEmail] = useState("");
  const [sPass, setSPass] = useState("");
  const [sConsent, setSConsent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPass,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    await supabase.rpc("log_user_action", {
      p_action: "login",
      p_metadata: {},
    });
    toast.success("Bem-vindo!");
    navigate({ to: "/" });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sFullName.trim()) return toast.error("Informe seu nome completo");
    if (!isValidCpf(sCpf)) return toast.error("CPF inválido");
    if (sPass.length < 6) return toast.error("Senha deve ter pelo menos 6 caracteres");
    if (!sConsent) return toast.error("É preciso aceitar os termos");

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: sEmail.trim(),
      password: sPass,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: sFullName.trim(),
          cpf: sCpf.replace(/\D/g, ""),
          consent_accepted: true,
          consent_timestamp: new Date().toISOString(),
        },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada! Você já pode entrar.");
    setTab("login");
    setLoginEmail(sEmail.trim());
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-10">
      <Toaster theme="light" position="top-center" />
      <div className="w-full max-w-sm flex justify-center">
        <img src={logoUrl} alt="Looplance" className="w-full h-auto" />
      </div>


      <div className="-mt-2 w-full max-w-sm rounded-3xl bg-white shadow-lg border border-gray-200 p-6">
        <div className="grid grid-cols-2 rounded-full bg-gray-100 p-1 text-sm font-bold mb-6">
          <button
            onClick={() => setTab("login")}
            className={`rounded-full py-2 transition ${tab === "login" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}
          >
            Entrar
          </button>
          <button
            onClick={() => setTab("signup")}
            className={`rounded-full py-2 transition ${tab === "signup" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}
          >
            Cadastrar
          </button>
        </div>

        {tab === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <Field label="Email">
              <input
                type="email" required autoComplete="email"
                value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)}
                className="input" placeholder="voce@email.com"
              />
            </Field>
            <Field label="Senha">
              <input
                type="password" required autoComplete="current-password"
                value={loginPass} onChange={(e) => setLoginPass(e.target.value)}
                className="input" placeholder="••••••••"
              />
            </Field>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><LogIn className="h-5 w-5" /> Entrar</>}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignup} className="space-y-4">
            <Field label="Nome completo">
              <input
                type="text" required autoComplete="name"
                value={sFullName} onChange={(e) => setSFullName(e.target.value)}
                className="input" placeholder="Seu nome completo"
              />
            </Field>
            <Field label="CPF">
              <input
                type="text" required inputMode="numeric"
                value={sCpf} onChange={(e) => setSCpf(formatCpf(e.target.value))}
                className="input" placeholder="000.000.000-00" maxLength={14}
              />
            </Field>
            <Field label="Email">
              <input
                type="email" required autoComplete="email"
                value={sEmail} onChange={(e) => setSEmail(e.target.value)}
                className="input" placeholder="voce@email.com"
              />
            </Field>
            <Field label="Senha">
              <input
                type="password" required autoComplete="new-password" minLength={6}
                value={sPass} onChange={(e) => setSPass(e.target.value)}
                className="input" placeholder="Mínimo 6 caracteres"
              />
            </Field>
            <label className="flex items-start gap-2 text-xs text-gray-600">
              <input
                type="checkbox" checked={sConsent} onChange={(e) => setSConsent(e.target.checked)}
                className="mt-0.5"
              />
              <span>Aceito os termos de uso e a política de privacidade da Looplance.</span>
            </label>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><UserPlus className="h-5 w-5" /> Criar conta</>}
            </button>
          </form>
        )}
      </div>

      <style>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #e5e7eb;
          background: #f9fafb;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          outline: none;
          transition: all 0.15s;
        }
        .input:focus { border-color: #f97316; box-shadow: 0 0 0 1px #f97316; }
        .btn-primary {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          border-radius: 9999px;
          padding: 0.875rem 1rem;
          font-weight: 800;
          color: white;
          background: linear-gradient(135deg, #f97316, #fbbf24);
          box-shadow: 0 8px 24px -8px rgba(249, 115, 22, 0.6);
          transition: transform 0.15s;
        }
        .btn-primary:hover:not(:disabled) { transform: scale(1.02); }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
