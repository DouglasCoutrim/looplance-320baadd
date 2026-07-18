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
}

interface MessageRow {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read: boolean;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "agora";
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  if (diff < 86400) return `${h}:${m}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${h}:${m}`;
}

function MessagesPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [openChat, setOpenChat] = useState<Contact | null>(null);
  const [msg, setMsg] = useState("");
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [sending, setSending] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (!user) return;
      setUid(user.id);
      loadContacts(user.id);
    });
  }, []);

  const loadContacts = async (userId: string) => {
    const { data: follows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId);
    const ids = (follows ?? []).map((f: any) => f.following_id);
    const followed: Contact[] = [];
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", ids);
      for (const p of (profs ?? []) as any[]) {
        followed.push({ id: p.id, full_name: p.full_name, avatar_url: p.avatar_url });
      }
    }

    if (followed.length === 0) {
      const { data: others } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .neq("id", userId)
        .limit(8);
      setContacts((others ?? []) as Contact[]);
      return;
    }
    setContacts(followed);

    const { data: allUnread } = await supabase
      .from("messages")
      .select("sender_id")
      .eq("receiver_id", userId)
      .eq("read", false);
    const counts: Record<string, number> = {};
    if (allUnread) {
      for (const row of allUnread) {
        counts[row.sender_id] = (counts[row.sender_id] || 0) + 1;
      }
    }
    setUnreadCounts(counts);
  };

  const openConversation = async (contact: Contact) => {
    setOpenChat(contact);
    if (!uid) return;
    loadMessages(uid, contact.id);

    supabase
      .from("messages")
      .update({ read: true })
      .eq("receiver_id", uid)
      .eq("sender_id", contact.id)
      .eq("read", false)
      .then(() => {
        setUnreadCounts((prev) => ({ ...prev, [contact.id]: 0 }));
      });
  };

  const loadMessages = async (userId: string, contactId: string) => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${userId})`)
      .order("created_at", { ascending: true });
    setMessages((data ?? []) as MessageRow[]);
  };

  // Realtime: novas mensagens no chat aberto
  useEffect(() => {
    if (!uid || !openChat) return;
    const ch = supabase
      .channel(`messages-${uid}-${openChat.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${uid}`,
        },
        (payload) => {
          const row = payload.new as MessageRow;
          if (row.sender_id !== openChat.id) return;
          setMessages((prev) => [...prev, row]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [uid, openChat]);

  // Toast ao receber mensagem de alguém que não está no chat aberto
  useEffect(() => {
    if (!uid) return;
    const ch = supabase
      .channel(`messages-toast-${uid}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${uid}`,
        },
        (payload) => {
          const row = payload.new as MessageRow;
          if (openChat && row.sender_id === openChat.id) return;
          const sender = contacts.find((c) => c.id === row.sender_id);
          if (sender) {
            toast(`${sender.full_name || "Alguém"} enviou uma mensagem`, {
              description: row.content.slice(0, 80),
              action: { label: "Abrir", onClick: () => openConversation(sender) },
              duration: 5000,
            });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [uid, openChat, contacts]);

  // Realtime: badge de não lidas (sempre ativo, mesmo sem chat aberto)
  useEffect(() => {
    if (!uid) return;
    const ch = supabase
      .channel(`messages-unread-${uid}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${uid}`,
        },
        (payload) => {
          const row = payload.new as MessageRow;
          setUnreadCounts((prev) => ({
            ...prev,
            [row.sender_id]: (prev[row.sender_id] || 0) + 1,
          }));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [uid]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const content = msg.trim();
    if (!content || !uid || !openChat || sending) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      sender_id: uid,
      receiver_id: openChat.id,
      content,
    });
    setSending(false);
    if (error) { toast.error("Erro ao enviar mensagem"); return; }
    setMessages((prev) => [...prev, {
      id: "",
      sender_id: uid,
      receiver_id: openChat.id,
      content,
      created_at: new Date().toISOString(),
      read: false,
    }]);
    setMsg("");
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
              onClick={() => openConversation(c)}
              className="w-full flex items-center gap-3.5 p-4 bg-card rounded-xl border border-border hover:border-orange-500/30 transition-all text-left group relative"
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
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm truncate">{c.full_name || "Atleta"}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {unreadCounts[c.id] && unreadCounts[c.id] > 0
                    ? `${unreadCounts[c.id]} mensagem(ns) não lida(s)`
                    : "Toque para conversar"}
                </p>
              </div>
              {unreadCounts[c.id] ? (
                <span className="absolute top-3 right-3 bg-orange-500 text-black text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {unreadCounts[c.id]}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {openChat && (
        <div
          className="fixed bottom-24 md:bottom-4 right-4 w-[92vw] max-w-sm bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50"
          style={{ height: "min(420px, 60vh)" }}
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
            </div>
            <button
              onClick={() => setOpenChat(null)}
              className="text-muted-foreground hover:text-foreground transition p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {messages.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-8">Comece uma conversa!</p>
            )}
            {messages.map((m, i) => (
              <div key={m.id || i} className={`flex ${m.sender_id === uid ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[80%]">
                  <div
                    className={`px-3.5 py-2 rounded-2xl text-sm ${
                      m.sender_id === uid
                        ? "text-black rounded-br-sm brand-gradient"
                        : "bg-secondary text-foreground rounded-bl-sm"
                    }`}
                  >
                    {m.content}
                  </div>
                  <p className={`text-[10px] text-zinc-500 mt-0.5 ${m.sender_id === uid ? "text-right" : "text-left"}`}>
                    {formatTime(m.created_at)}
                  </p>
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
              disabled={!msg.trim() || sending}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition hover:opacity-85 active:scale-95 shrink-0 ${msg.trim() && !sending ? "brand-gradient" : "bg-zinc-800 text-zinc-600 cursor-not-allowed"}`}
            >
              <Send className={`w-4 h-4 ${msg.trim() && !sending ? "text-black" : "text-zinc-600"}`} />
            </button>
          </div>
        </div>
      )}
    </SocialShell>
  );
}
