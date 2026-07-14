import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

function getNotifSoundUrl(): string {
  try {
    const { data } = supabase.storage.from("som").getPublicUrl("notifica.mp3");
    return data.publicUrl;
  } catch {
    return "";
  }
}

export function useNotifications() {
  const [uid, setUid] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playSound = useCallback(() => {
    try {
      if (!audioRef.current) {
        const url = getNotifSoundUrl();
        if (!url) return;
        audioRef.current = new Audio(url);
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } catch {}
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUid(data.user.id);
    });
  }, []);

  useEffect(() => {
    if (!uid) return;
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) {
          const rows = data as AppNotification[];
          setNotifications(rows);
          setUnreadCount(rows.filter((n) => !n.read).length);
        }
      });
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const ch = supabase
      .channel(`notifications-${uid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
        (payload) => {
          const row = payload.new as AppNotification;
          setNotifications((prev) => [row, ...prev]);
          setUnreadCount((c) => c + 1);
          playSound();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [uid, playSound]);

  const markRead = useCallback(async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    if (!uid) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", uid).eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, [uid]);

  return { notifications, unreadCount, markRead, markAllRead };
}
