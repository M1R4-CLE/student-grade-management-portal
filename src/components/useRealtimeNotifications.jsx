"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";

export function useRealtimeNotifications({ limit = 8 } = {}) {
  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);
  const [lastNew, setLastNew] = useState(null);

  const userIdRef = useRef(null);

  const unread = useMemo(
    () => (items || []).filter((n) => !n.read_at).length,
    [items]
  );

  useEffect(() => {
    let channel;

    async function boot() {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) {
        setItems([]);
        setReady(true);
        return;
      }

      userIdRef.current = user.id;

      const { data, error } = await supabase
        .from("notifications")
        .select("id,type,title,body,link,created_at,read_at,user_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        setItems([]);
        setReady(true);
        return;
      }

      setItems(data || []);
      setReady(true);

      channel = supabase
        .channel(`rt-notifications-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.eventType === "INSERT") {
              const nextRow = payload.new;
              setItems((prev) => {
                const dedup = [nextRow, ...prev.filter((x) => x.id !== nextRow.id)];
                return dedup.slice(0, limit);
              });
              setLastNew(nextRow);
              return;
            }

            if (payload.eventType === "UPDATE") {
              const updated = payload.new;
              setItems((prev) =>
                prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x))
              );
              return;
            }

            if (payload.eventType === "DELETE") {
              const removedId = payload.old?.id;
              if (!removedId) return;
              setItems((prev) => prev.filter((x) => x.id !== removedId));
            }
          }
        )
        .subscribe();
    }

    boot();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [limit]);

  const markOneAsRead = async (id) => {
    const now = new Date().toISOString();
    const userId = userIdRef.current;
    if (!userId || !id) return;

    const { error } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) return;

    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at || now } : n))
    );
  };

  const markAllAsRead = async () => {
    const now = new Date().toISOString();
    const userId = userIdRef.current;
    if (!userId) return;

    const unreadIds = items.filter((n) => !n.read_at).map((n) => n.id);
    if (!unreadIds.length) return;

    const { error } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .in("id", unreadIds)
      .eq("user_id", userId);

    if (error) return;

    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || now })));
  };

  const deleteOne = async (id) => {
    const userId = userIdRef.current;
    if (!userId || !id) return;

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) return;

    setItems((prev) => prev.filter((n) => n.id !== id));
  };

  const deleteAllRead = async () => {
    const userId = userIdRef.current;
    if (!userId) return;

    const readIds = items.filter((n) => !!n.read_at).map((n) => n.id);
    if (!readIds.length) return;

    const { error } = await supabase
      .from("notifications")
      .delete()
      .in("id", readIds)
      .eq("user_id", userId);

    if (error) return;

    setItems((prev) => prev.filter((n) => !n.read_at));
  };

  return {
    items,
    unread,
    ready,
    lastNew,
    markOneAsRead,
    markAllAsRead,
    deleteOne,
    deleteAllRead,
  };
}