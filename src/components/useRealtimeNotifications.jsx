"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";

function isGradeLikeNotification(n) {
  const t = String(n?.type || "").toLowerCase();
  const title = String(n?.title || "").toLowerCase();
  return t === "grade" || title.includes("grade");
}

function extractCoursePrefix(body = "") {
  const txt = String(body || "").trim();
  if (!txt) return "";
  const idx = txt.indexOf(":");
  return (idx > 0 ? txt.slice(0, idx) : txt).trim().toLowerCase();
}

function hasConcreteGradeInfo(n) {
  const body = String(n?.body || "");
  return /\bfinal grade\b/i.test(body) || /%/.test(body);
}

function createdAtMs(n) {
  const t = new Date(n?.created_at || "").getTime();
  return Number.isFinite(t) ? t : 0;
}

function dedupeNotifications(rows = []) {
  const sorted = [...rows].sort((a, b) => createdAtMs(b) - createdAtMs(a));
  const out = [];
  const windowMs = 90 * 1000;

  for (const row of sorted) {
    if (!isGradeLikeNotification(row)) {
      out.push(row);
      continue;
    }

    const rowPrefix = extractCoursePrefix(row?.body);
    const rowTime = createdAtMs(row);
    const rowSpecific = hasConcreteGradeInfo(row);

    const dupIdx = out.findIndex((x) => {
      if (!isGradeLikeNotification(x)) return false;

      const samePrefix = extractCoursePrefix(x?.body) === rowPrefix;
      const closeInTime = Math.abs(createdAtMs(x) - rowTime) <= windowMs;

      if (rowPrefix) return samePrefix && closeInTime;
      return closeInTime;
    });

    if (dupIdx === -1) {
      out.push(row);
      continue;
    }

    const existing = out[dupIdx];
    const existingSpecific = hasConcreteGradeInfo(existing);
    if (!existingSpecific && rowSpecific) {
      out[dupIdx] = row;
    }
  }

  return out;
}

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

      setItems(dedupeNotifications(data || []).slice(0, limit));
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
                const next = [nextRow, ...prev.filter((x) => x.id !== nextRow.id)];
                return dedupeNotifications(next).slice(0, limit);
              });
              setLastNew(nextRow);
              return;
            }

            if (payload.eventType === "UPDATE") {
              const updated = payload.new;
              setItems((prev) =>
                dedupeNotifications(
                  prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x))
                ).slice(0, limit)
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
