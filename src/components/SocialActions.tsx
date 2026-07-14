import { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, Share2, Trash2, Send, Copy, MessageCircleMore, Flag } from "lucide-react";
import { ReportDialog, loadReported } from "@/components/ReportDialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import * as Popover from "@radix-ui/react-popover";

type TargetType = "replay" | "championship";

interface Props {
  targetId: string;
  targetType: TargetType;
  shareUrl: string;
  shareText?: string;
}

interface CommentRow {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: { full_name: string | null; avatar_url: string | null } | null;
}

function timeAgo(iso: string) {
  const diff = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function SocialActions({ targetId, targetType, shareUrl, shareText }: Props) {
  const [uid, setUid] = useState<string | null>(null);
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [likesCount, setLikesCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentsCount, setCommentsCount] = useState(0);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const loadedRef = useRef(false);
  const [reportComment, setReportComment] = useState<string | null>(null);
  const [reportedComments, setReportedComments] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!uid) return;
    const rebuild = () => {
      const all = loadReported(uid);
      const ids = new Set<string>();
      all.forEach((k) => { if (k.startsWith("comment:")) ids.add(k.slice("comment:".length)); });
      setReportedComments(ids);
    };
    rebuild();
    const onEvt = () => rebuild();
    window.addEventListener("looplance:reported", onEvt);
    return () => window.removeEventListener("looplance:reported", onEvt);
  }, [uid]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (!user) return;
      setUid(user.id);
      const { data: prof } = await supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle();
      setMyAvatar((prof as any)?.avatar_url ?? null);
    });
  }, []);

  useEffect(() => {
    (async () => {
      const [{ count: lc }, { count: cc }] = await Promise.all([
        supabase.from("likes").select("id", { count: "exact", head: true }).eq("target_id", targetId).eq("target_type", targetType),
        supabase.from("comments").select("id", { count: "exact", head: true }).eq("target_id", targetId).eq("target_type", targetType),
      ]);
      setLikesCount(lc ?? 0);
      setCommentsCount(cc ?? 0);
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        const { data: mine } = await supabase
          .from("likes").select("id")
          .eq("target_id", targetId).eq("target_type", targetType)
          .eq("user_id", u.user.id).maybeSingle();
        setLiked(!!mine);
      }
    })();
  }, [targetId, targetType]);

  // Realtime: novos comentários
  useEffect(() => {
    const ch = supabase
      .channel(`comments-${targetId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comments", filter: `target_id=eq.${targetId}` },
        async (payload) => {
          const record = payload.new as any;
          if (record.user_id === uid) return;
          const { data: prof } = await supabase
            .from("profiles")
            .select("full_name, avatar_url")
            .eq("id", record.user_id)
            .maybeSingle();
          setComments((c) => [{ ...record, profile: prof }, ...c]);
          setCommentsCount((c) => c + 1);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [targetId, uid]);

  const loadComments = async () => {
    const { data } = await supabase
      .from("comments")
      .select("id, user_id, content, created_at, profiles:user_id(full_name, avatar_url)")
      .eq("target_id", targetId).eq("target_type", targetType)
      .order("created_at", { ascending: false })
      .limit(100);
    const rows = (data ?? []).map((r: any) => ({ ...r, profile: r.profiles })) as CommentRow[];
    setComments(rows);
    setCommentsCount(rows.length);
    loadedRef.current = true;
  };

  const toggleComments = async () => {
    const next = !showComments;
    setShowComments(next);
    if (next && !loadedRef.current) await loadComments();
  };

  const toggleLike = async () => {
    if (!uid) { toast.error("Faça login para curtir"); return; }
    const prevLiked = liked;
    const prevCount = likesCount;
    setLiked(!prevLiked);
    setLikesCount(prevCount + (prevLiked ? -1 : 1));
    if (!prevLiked) { setPulse(true); setTimeout(() => setPulse(false), 300); }
    if (prevLiked) {
      const { error } = await supabase.from("likes").delete().eq("user_id", uid).eq("target_id", targetId).eq("target_type", targetType);
      if (error) { setLiked(prevLiked); setLikesCount(prevCount); toast.error("Não foi possível descurtir"); }
    } else {
      const { error } = await supabase.from("likes").insert({ user_id: uid, target_id: targetId, target_type: targetType });
      if (error) { setLiked(prevLiked); setLikesCount(prevCount); toast.error("Não foi possível curtir"); }
    }
  };

  const submitComment = async () => {
    const content = input.trim();
    if (!content) return;
    if (!uid) { toast.error("Faça login para comentar"); return; }
    setSending(true);
    const { data, error } = await supabase
      .from("comments")
      .insert({ user_id: uid, target_id: targetId, target_type: targetType, content })
      .select("id, user_id, content, created_at, profiles:user_id(full_name, avatar_url)")
      .single();
    setSending(false);
    if (error || !data) { toast.error("Erro ao comentar"); return; }
    const row: CommentRow = { ...(data as any), profile: (data as any).profiles };
    setComments((c) => [row, ...c]);
    setCommentsCount((c) => c + 1);
    setInput("");
  };

  const deleteComment = async (id: string) => {
    const prev = comments;
    setComments((c) => c.filter((x) => x.id !== id));
    setCommentsCount((c) => Math.max(0, c - 1));
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) { setComments(prev); setCommentsCount(prev.length); toast.error("Erro ao excluir"); }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copiado para a área de transferência", { position: "top-center" });
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  };

  const shareWhatsapp = () => {
    const text = encodeURIComponent(`${shareText ?? "Olha esse lance no Looplance!"} ${shareUrl}`);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="w-full">
      {/* Action bar */}
      <div className="flex items-center gap-5 px-1 py-2">
        <button onClick={toggleLike} className="group flex items-center gap-1.5 text-zinc-300 transition active:scale-95">
          <Heart
            className={`h-6 w-6 transition-all duration-200 ${liked ? "text-orange-500 fill-orange-500" : "text-zinc-300 group-hover:text-orange-400"} ${pulse ? "scale-125" : "scale-100"}`}
          />
          <span className="text-sm font-medium text-zinc-400 tabular-nums">{likesCount}</span>
        </button>

        <button onClick={toggleComments} className="group flex items-center gap-1.5 transition active:scale-95">
          <MessageCircle className="h-6 w-6 text-zinc-300 group-hover:text-orange-400 transition" />
          <span className="text-sm font-medium text-zinc-400 tabular-nums">{commentsCount}</span>
        </button>

        <Popover.Root>
          <Popover.Trigger asChild>
            <button className="group ml-auto flex items-center gap-1.5 transition active:scale-95">
              <Share2 className="h-6 w-6 text-zinc-300 group-hover:text-orange-400 transition" />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              side="top"
              align="end"
              sideOffset={8}
              className="z-[60] w-56 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/95 p-1.5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95"
            >
              <button onClick={copyLink} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-100 hover:bg-zinc-800 transition">
                <Copy className="h-4 w-4 text-zinc-400" /> Copiar link do lance
              </button>
              <button onClick={shareWhatsapp} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-100 hover:bg-zinc-800 transition">
                <MessageCircleMore className="h-4 w-4 text-emerald-400" /> Enviar via WhatsApp
              </button>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>

      {/* Comments drawer */}
      <div className={`grid transition-all duration-300 ease-out ${showComments ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <div className="mt-2 rounded-2xl border border-zinc-800/60 bg-zinc-900/70 backdrop-blur-md">
            <div className="max-h-80 overflow-y-auto p-3 space-y-3">
              {comments.length === 0 ? (
                <p className="text-center text-xs text-zinc-500 py-6">Seja o primeiro a comentar.</p>
              ) : comments.map((c) => {
                const isReported = reportedComments.has(c.id);
                if (isReported) {
                  return (
                    <div key={c.id} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-3 py-2 text-center text-[11px] text-zinc-500">
                      Comentário ocultado após sua denúncia.
                    </div>
                  );
                }
                return (
                  <div key={c.id} className="flex items-start gap-3 group">
                    <Avatar url={c.profile?.avatar_url} name={c.profile?.full_name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-semibold text-zinc-100 truncate">{c.profile?.full_name ?? "Usuário"}</span>
                        <span className="text-[11px] text-zinc-500">{timeAgo(c.created_at)}</span>
                      </div>
                      <p className="text-sm text-zinc-200 break-words whitespace-pre-wrap">{c.content}</p>
                    </div>
                    {uid === c.user_id ? (
                      <button
                        onClick={() => deleteComment(c.id)}
                        className="opacity-0 group-hover:opacity-100 transition text-zinc-500 hover:text-rose-400 p-1"
                        aria-label="Excluir comentário"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => setReportComment(c.id)}
                        className="opacity-0 group-hover:opacity-100 transition text-zinc-500 hover:text-rose-400 p-1"
                        aria-label="Denunciar comentário"
                      >
                        <Flag className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 border-t border-zinc-800/60 p-2.5">
              <Avatar url={myAvatar} name={null} />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
                placeholder="Adicione um comentário…"
                className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none px-1"
                maxLength={1000}
              />
              <button
                onClick={submitComment}
                disabled={!input.trim() || sending}
                className={`grid h-9 w-9 place-items-center rounded-full transition ${input.trim() && !sending ? "bg-orange-500 text-white hover:bg-orange-400 active:scale-95" : "bg-zinc-800 text-zinc-600 cursor-not-allowed"}`}
                aria-label="Enviar"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {reportComment && (
        <ReportDialog
          open={!!reportComment}
          onOpenChange={(o) => { if (!o) setReportComment(null); }}
          targetId={reportComment}
          targetType="comment"
        />
      )}
    </div>
  );
}

function Avatar({ url, name }: { url: string | null | undefined; name: string | null | undefined }) {
  const initial = (name ?? "?").trim().charAt(0).toUpperCase() || "?";
  if (url) {
    return <img src={url} alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-zinc-800" />;
  }
  return (
    <div className="grid h-8 w-8 place-items-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-300 ring-1 ring-zinc-700">
      {initial}
    </div>
  );
}
