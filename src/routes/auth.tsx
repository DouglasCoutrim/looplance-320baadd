import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import logoUrl from "@/assets/looplance-logo.png";
import { LogIn, UserPlus, Loader2, X } from "lucide-react";

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
  const [showTerms, setShowTerms] = useState(false);


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

  const handleOAuth = async (provider: "google" | "apple") => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setLoading(false);
      toast.error(result.error.message || "Falha ao autenticar");
      return;
    }
    if (result.redirected) return; // browser navigating to provider
    // popup flow completed
    navigate({ to: "/" });
  };


  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-10">
      <Toaster theme="light" position="top-center" />
      <div className="w-full max-w-sm flex justify-center">
        <img src={logoUrl} alt="Looplance" className="w-full h-auto" />
      </div>


      <div className="-mt-10 w-full max-w-sm rounded-3xl bg-white shadow-lg border border-gray-200 p-6">
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

        <div className="mb-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => handleOAuth("google")}
            disabled={loading}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white transition hover:bg-gray-50 disabled:opacity-60"
            aria-label="Continuar com Google"
            title="Continuar com Google"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.68 4.1-5.5 4.1a6.2 6.2 0 1 1 0-12.4c1.94 0 3.24.83 3.98 1.53l2.72-2.62A9.9 9.9 0 0 0 12 2a10 10 0 1 0 0 20c5.77 0 9.6-4.06 9.6-9.77 0-.66-.07-1.16-.16-1.66H12Z"/>
              <path fill="#34A853" d="M3.06 7.35 6.3 9.74C7.2 7.62 9.42 6.1 12 6.1c1.94 0 3.24.83 3.98 1.53l2.72-2.62A9.9 9.9 0 0 0 12 2a10 10 0 0 0-8.94 5.35Z"/>
              <path fill="#4A90E2" d="M12 22c2.7 0 4.97-.9 6.63-2.44l-3.15-2.58c-.86.6-2.02 1.03-3.48 1.03-2.83 0-5.23-1.9-6.08-4.48L2.7 15.9A10 10 0 0 0 12 22Z"/>
              <path fill="#FBBC05" d="M5.92 13.53a6.2 6.2 0 0 1 0-3.06L2.7 8.1a10 10 0 0 0 0 7.8l3.22-2.37Z"/>
            </svg>
          </button>
          <button
            type="button"
            onClick={() => handleOAuth("apple")}
            disabled={loading}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-black transition hover:bg-gray-50 disabled:opacity-60"
            aria-label="Continuar com Apple"
            title="Continuar com Apple"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M16.36 12.71c.02 2.3 2.02 3.06 2.04 3.07-.02.06-.32 1.09-1.05 2.15-.64.94-1.3 1.87-2.34 1.89-1.02.02-1.35-.6-2.51-.6-1.17 0-1.53.58-2.5.62-1 .04-1.77-1.01-2.41-1.94-1.32-1.9-2.33-5.38-.97-7.73.67-1.17 1.87-1.91 3.17-1.93.99-.02 1.92.67 2.52.67.6 0 1.74-.83 2.93-.71.5.02 1.9.2 2.8 1.52-.07.05-1.67.98-1.65 2.99Zm-1.94-5.83c.54-.65.9-1.55.8-2.44-.77.03-1.7.51-2.25 1.15-.5.57-.94 1.5-.82 2.37.86.07 1.74-.44 2.27-1.08Z"/>
            </svg>
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
              <span>
                Li e aceito os{" "}
                <button
                  type="button"
                  onClick={() => setShowTerms(true)}
                  className="font-bold text-orange-600 underline underline-offset-2 hover:text-orange-700"
                >
                  Termos de Uso e Política de Privacidade
                </button>{" "}
                da Looplance, e me responsabilizo integralmente pelos meus atos na plataforma.
              </span>
            </label>

            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><UserPlus className="h-5 w-5" /> Criar conta</>}
            </button>
          </form>
        )}
      </div>

      {showTerms && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowTerms(false)}
        >
          <div
            className="relative bg-white rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-lg font-black text-gray-900">Termos de Uso e Privacidade</h2>
              <button
                onClick={() => setShowTerms(false)}
                className="rounded-full p-1.5 hover:bg-gray-100 text-gray-500"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto text-sm text-gray-700 space-y-4 leading-relaxed">
              <section>
                <h3 className="font-bold text-gray-900 mb-1">1. Aceitação dos Termos</h3>
                <p>Ao criar uma conta na Looplance, você declara ter lido, compreendido e concordado integralmente com estes Termos de Uso e com a Política de Privacidade. Caso não concorde, não conclua o cadastro.</p>
              </section>
              <section>
                <h3 className="font-bold text-gray-900 mb-1">2. Cadastro e Veracidade das Informações</h3>
                <p>Você se compromete a fornecer dados verdadeiros, completos e atualizados (nome completo, CPF, e-mail). O uso de dados falsos, de terceiros ou fraudulentos poderá resultar no bloqueio imediato da conta e nas medidas legais cabíveis.</p>
              </section>
              <section>
                <h3 className="font-bold text-gray-900 mb-1">3. Responsabilidade do Usuário</h3>
                <p>Você é o único e integral responsável por todos os atos praticados a partir da sua conta, incluindo acessos, downloads, compartilhamentos e qualquer uso dos vídeos disponibilizados na plataforma. Isso abrange responsabilidade civil e criminal pelo uso indevido, redistribuição não autorizada, edição, exposição de terceiros sem consentimento ou qualquer conduta que viole a legislação vigente.</p>
              </section>
              <section>
                <h3 className="font-bold text-gray-900 mb-1">4. Uso dos Vídeos e Direitos Autorais</h3>
                <p>Os replays disponibilizados destinam-se ao uso pessoal e recreativo. É vedada a comercialização, veiculação em mídia paga, uso publicitário ou qualquer exploração comercial sem autorização expressa da Looplance e da arena responsável.</p>
              </section>
              <section>
                <h3 className="font-bold text-gray-900 mb-1">5. Segurança da Conta</h3>
                <p>Mantenha sua senha em sigilo. Toda atividade realizada com suas credenciais será presumida como sua. Comunique imediatamente qualquer suspeita de uso indevido.</p>
              </section>
              <section>
                <h3 className="font-bold text-gray-900 mb-1">6. Registro de Ações (Logs)</h3>
                <p>Para fins de segurança, auditoria e cumprimento legal, a Looplance registra ações realizadas na plataforma — como logins, downloads e compartilhamentos — vinculadas ao seu cadastro (nome, CPF e e-mail). Esses registros podem ser fornecidos às autoridades competentes mediante requisição legal.</p>
              </section>
              <section>
                <h3 className="font-bold text-gray-900 mb-1">7. Política de Privacidade (LGPD)</h3>
                <p>Seus dados pessoais são tratados conforme a Lei nº 13.709/2018 (LGPD), utilizados exclusivamente para autenticação, controle de acesso, prevenção a fraudes e melhoria da experiência. Não vendemos seus dados a terceiros. Você pode solicitar acesso, correção ou exclusão dos seus dados através dos canais oficiais.</p>
              </section>
              <section>
                <h3 className="font-bold text-gray-900 mb-1">8. Condutas Proibidas</h3>
                <p>É proibido: (i) tentar burlar mecanismos de segurança; (ii) compartilhar sua conta; (iii) baixar vídeos em massa por meios automatizados; (iv) utilizar a plataforma para constranger, difamar ou expor terceiros; (v) qualquer conduta ilegal.</p>
              </section>
              <section>
                <h3 className="font-bold text-gray-900 mb-1">9. Sanções</h3>
                <p>O descumprimento destes termos pode resultar em advertência, suspensão ou exclusão definitiva da conta, sem prejuízo das medidas judiciais aplicáveis.</p>
              </section>
              <section>
                <h3 className="font-bold text-gray-900 mb-1">10. Alterações</h3>
                <p>A Looplance pode atualizar estes termos periodicamente. O uso continuado da plataforma após alterações significa concordância com a nova versão.</p>
              </section>
              <p className="text-xs text-gray-500 pt-2 border-t border-gray-100">
                Ao marcar a caixa de aceite, você reconhece ter lido este documento e assume total responsabilidade pelos seus atos na plataforma Looplance.
              </p>
            </div>
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => setShowTerms(false)}
                className="btn-primary"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}


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
