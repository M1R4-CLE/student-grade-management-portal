"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";

export function useRealtimeNotifications({ limit = 8 } = {}) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [ready, setReady] = useState(false);

  // for toast popups
  const [lastNew, setLastNew] = useState(null);

  const userIdRef = useRef(null);

  useEffect(() => {
    let channel;

    async function boot() {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) return;

      userIdRef.current = user.id;

      // Initial load
      const { data, error } = await supabase
        .from("notifications")
        .select("id,type,title,body,link,created_at,read_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        setItems([]);
        setUnread(0);
        setReady(true);
        return;
      }

      const list = data || [];
      setItems(list);
      setUnread(list.filter((n) => !n.read_at).length);
      setReady(true);

      // Realtime
      channel = supabase
        .channel(`notifications-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const n = payload.new;

            setItems((prev) => {
              const next = [n, ...prev].slice(0, limit);
              setUnread(next.filter((z) => !z.read_at).length);
              return next;
            });

            // trigger toast
            setLastNew(n);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const updated = payload.new;

            // ✅ FIX: compute unread from the same "prev" state (no stale closure)
            setItems((prev) => {
              const next = prev.map((x) => (x.id === updated.id ? updated : x));
              setUnread(next.filter((z) => !z.read_at).length);
              return next;
            });
          }
        )
        .subscribe();
    }

    boot();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [limit]);

  const markAllRead = async () => {
    const user_id = userIdRef.current;
    if (!user_id) return;

    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user_id)
      .is("read_at", null);
  };

  return { items, unread, ready, lastNew, markAllRead };
}