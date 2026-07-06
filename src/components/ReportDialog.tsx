import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type TargetType = "replay" | "comment";

const REASONS = [
  "Discurso de ódio ou preconceito",
  "Assédio ou intimidação",
  "Conteúdo inadequado/violência",
  "Spam ou propaganda invasiva",
];

const storageKey = (uid: string) => `looplance:reported:${uid}`;

export function loadReported(uid: string | null): Set<string> {
  if (!uid || typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch { return new Set(); }
}

function saveReported(uid: string, set: Set<string>) {
  try { localStorage.setItem(storageKey(uid), JSON.stringify([...set])); } catch {}
}

export function markReported(uid: string, targetType: TargetType, targetId: string) {
  const key = `${targetType}:${targetId}`;
  const set = loadReported(uid);
  set.add(key);
  saveReported(uid, set);
  window.dispatchEvent(new CustomEvent("looplance:reported", { detail: { key } }));
}

export function useIsReported(uid: string | null, targetType: TargetType, targetId: string) {
  const key = `${targetType}:${targetId}`;
  const [flag, setFlag] = useState(() => loadReported(uid).has(key));
  useEffect(() => {
    setFlag(loadReported(uid).has(key));
    const onEvt = (e: Event) => {
      const d = (e as CustomEvent).detail as { key: string };
      if (d?.key === key) setFlag(true);
    };
    window.addEventListener("looplance:reported", onEvt);
    return () => window.removeEventListener("looplance:reported", onEvt);
  }, [uid, key]);
  return flag;
}

export function ReportDialog({
  open,
  onOpenChange,
  targetId,
  targetType,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  targetId: string;
  targetType: TargetType;
}) {
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) { setReason(REASONS[0]); setDetails(""); }
  }, [open]);

  const submit = async () => {
    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSending(false); toast.error("Faça login para denunciar"); return; }
    const trimmed = details.trim().slice(0, 1000);
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      target_id: targetId,
      target_type: targetType,
      reason,
      details: trimmed || null,
    });
    setSending(false);
    if (error) { toast.error("Não foi possível enviar a denúncia"); return; }
    markReported(user.id, targetType, targetId);
    onOpenChange(false);
    toast.success("Obrigado por nos ajudar a manter a comunidade segura. Iremos analisar o conteúdo.", {
      position: "top-center",
      duration: 5000,
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-md animate-in fade-in" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[71] w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-zinc-800 bg-zinc-950/95 p-6 shadow-2xl outline-none backdrop-blur-xl animate-in fade-in zoom-in-95"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/30">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <Dialog.Title className="text-base font-semibold text-white">Denunciar conteúdo</Dialog.Title>
                <Dialog.Description className="text-xs text-zinc-400">Sua denúncia é anônima para outros usuários.</Dialog.Description>
              </div>
            </div>
            <Dialog.Close className="text-zinc-500 hover:text-zinc-200 transition"><X className="h-5 w-5" /></Dialog.Close>
          </div>

          <div className="mt-5 space-y-2">
            {REASONS.map((r) => {
              const active = reason === r;
              return (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`w-full text-left rounded-2xl border px-4 py-3 text-sm transition ${
                    active
                      ? "border-orange-500/60 bg-orange-500/10 text-white"
                      : "border-zinc-800 bg-zinc-900/60 text-zinc-200 hover:border-zinc-700 hover:bg-zinc-900"
                  }`}
                >
                  {r}
                </button>
              );
            })}
          </div>

          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Detalhes adicionais (opcional)"
            maxLength={1000}
            rows={3}
            className="mt-4 w-full resize-none rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500/60 focus:outline-none"
          />

          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-xl px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition"
            >
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={sending}
              className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_20px_rgba(244,63,94,0.25)] hover:bg-rose-400 disabled:opacity-60 transition"
            >
              {sending ? "Enviando…" : "Enviar denúncia"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
