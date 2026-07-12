import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send, X, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SocialShell } from "@/components/SocialShell";

export const Route = createFileRoute("/messages")({
  component: MessagesPage,
  head: () => ({
    meta: [
      { title: "Mensagens — Loop Lance" },
      { name: "description", content: "Converse com atletas e amigos da rede Loop Lance." },
    ],
  }),
});

interface Contact {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  online?: boolean;
}

function MessagesPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [openChat, setOpenChat] = useState<Contact | null>(null);
  const [msg, setMsg] = useState("");
  const [thread, setThread] = useState<{ from: "me" | "them"; text: string; time: string }[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: follows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", data.user.id);
      const ids = (follows ?? []).map((f: any) => f.following_id);
      if (ids.length === 0) {
        const { data: any } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .neq("id", data.user.id)
          .limit(8);
        setContacts(((any ?? []) as Contact[]).map((c, i) => ({ ...c, online: i % 2 === 0 })));
        return;
      }
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", ids);
      setContacts(((profs ?? []) as Contact[]).map((c, i) => ({ ...c, online: i % 2 === 0 })));
    });
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread, openChat]);

  const send = () => {
    if (!msg.trim() || !openChat) return;
    setThread((t) => [...t, { from: "me", text: msg.trim(), time: "agora" }]);
    setMsg("");
    toast("Mensagens em tempo real em breve 🚧");
  };

  return (
    <SocialShell active="messages">
      <h1
        className="text-3xl font-black uppercase tracking-wide mb-5"
        style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
      >
        Mensagens
      </h1>

      {contacts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-16 text-center">
          <MessageCircle className="w-8 h-8 text-brand-orange" />
          <p className="text-sm text-muted-foreground max-w-xs">
            Siga atletas para começar a conversar com sua comunidade.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setOpenChat(c);
                setThread([]);
              }}
              className="w-full flex items-center gap-3.5 p-4 bg-card rounded-xl border border-border hover:border-orange-500/30 transition-all text-left group"
            >
              <div className="relative shrink-0">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-secondary grid place-items-center">
                  {c.avatar_url ? (
                    <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-muted-foreground">
                      {(c.full_name || "?").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                {c.online && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-card" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm truncate">{c.full_name || "Atleta"}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {c.online ? "Online agora" : "Toque para iniciar uma conversa"}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {openChat && (
        <div
          className="fixed bottom-24 md:bottom-4 right-4 w-[92vw] max-w-sm bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50"
          style={{ height: 420 }}
        >
          <div
            className="flex items-center gap-3 p-4 border-b border-border shrink-0"
            style={{ background: "var(--gradient-brand-soft)" }}
          >
            <div className="w-9 h-9 rounded-full overflow-hidden bg-secondary grid place-items-center shrink-0">
              {openChat.avatar_url ? (
                <img src={openChat.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-bold">{(openChat.full_name || "?").slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{openChat.full_name || "Atleta"}</p>
              <p className="text-xs text-green-400 font-medium">Online</p>
            </div>
            <button
              onClick={() => setOpenChat(null)}
              className="text-muted-foreground hover:text-foreground transition p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {thread.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-8">Comece uma conversa!</p>
            )}
            {thread.map((m, i) => (
              <div key={i} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] px-3.5 py-2 rounded-2xl text-sm ${
                    m.from === "me"
                      ? "text-black rounded-br-sm brand-gradient"
                      : "bg-secondary text-foreground rounded-bl-sm"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <div className="p-3 border-t border-border flex gap-2 shrink-0">
            <input
              type="text"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Mensagem..."
              className="flex-1 bg-secondary rounded-xl px-3.5 py-2 text-sm focus:outline-none border border-transparent focus:border-primary/60 transition"
            />
            <button
              onClick={send}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition hover:opacity-85 active:scale-95 shrink-0 brand-gradient"
            >
              <Send className="w-4 h-4 text-black" />
            </button>
          </div>
        </div>
      )}
    </SocialShell>
  );
}
