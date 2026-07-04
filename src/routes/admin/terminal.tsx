import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Terminal, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/terminal")({
  component: TerminalPage,
});

const TERMINAL_URL = "https://terminal.izyia.com.br";

function TerminalPage() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        navigate({ to: "/auth" });
        return;
      }
      const { data: p } = await supabase
        .from("profiles")
        .select("is_super_admin")
        .eq("id", session.session.user.id)
        .maybeSingle();
      if (p?.is_super_admin) setAuthorized(true);
      else {
        setAuthorized(false);
        navigate({ to: "/admin" });
      }
    })();
  }, [navigate]);

  if (authorized === null) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-gray-500 text-sm">
        Verificando permissão de administrador...
      </div>
    );
  }
  if (!authorized) return null;

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-gray-900 uppercase">
            Terminal <span className="brand-text">do Servidor</span>
          </h1>
          <p className="text-muted-foreground mt-1 font-medium text-lg">
            Acesso seguro ao shell da máquina local via túnel Cloudflare.
          </p>
        </div>
        <a href={TERMINAL_URL} target="_blank" rel="noopener noreferrer">
          <Button
            variant="outline"
            className="rounded-xl border-gray-200 h-12 px-5 font-black uppercase tracking-widest text-xs bg-white hover:bg-gray-50"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Abrir em nova aba
          </Button>
        </a>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-neutral-900 border-b border-white/10">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <div className="h-3 w-3 rounded-full bg-yellow-500" />
            <div className="h-3 w-3 rounded-full bg-green-500" />
          </div>
          <div className="flex items-center gap-2 ml-3">
            <Terminal className="h-3.5 w-3.5 text-green-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
              {TERMINAL_URL}
            </span>
          </div>
        </div>
        <iframe
          src={TERMINAL_URL}
          title="Terminal do Servidor"
          className="w-full h-[80vh] bg-black"
          sandbox="allow-scripts allow-same-origin allow-forms allow-clipboard-write allow-clipboard-read"
        />
      </div>

      <p className="text-[11px] font-medium text-muted-foreground italic px-2">
        Se o terminal não carregar, verifique se o túnel Cloudflare está ativo e se o subdomínio
        <code className="mx-1 font-mono text-brand-orange">terminal.izyia.com.br</code>
        está apontando para o serviço local.
      </p>
    </div>
  );
}
