import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redireciona automaticamente para a nova interface mobile
    navigate({ to: "/mobile", replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-12 w-12 text-[#F97316] animate-spin mx-auto" />
        <p className="text-white/40 font-black uppercase tracking-widest text-[10px]">Carregando Looplance...</p>
      </div>
    </div>
  );
}
