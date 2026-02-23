"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";

function dayKey(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

export function useRealtimeCourseEvents({ role = "student" } = {}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let channel;

    async function boot() {
      setLoading(true);
      setErr("");

      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) {
        setErr("Not logged in.");
        setLoading(false);
        return;
      }

      // Determine which courses this user can see events for
      let courseIds = [];

      if (role === "teacher") {
        const { data, error } = await supabase
          .from("courses")
          .select("id")
          .eq("teacher_id", user.id);

        if (error) {
          setErr(error.message);
          setLoading(false);
          return;
        }

        courseIds = (data || []).map((x) => x.id);
      } else {
        const { data, error } = await supabase
          .from("enrollments")
          .select("course_id")
          .eq("student_id", user.id);

        if (error) {
          setErr(error.message);
          setLoading(false);
          return;
        }

        courseIds = (data || []).map((x) => x.course_id);
      }

      if (!courseIds.length) {
        setEvents([]);
        setLoading(false);
        return;
      }

      // Initial fetch
      const { data: ev, error: evErr } = await supabase
        .from("course_events")
        .select("id, course_id, kind, title, due_at, created_at")
        .in("course_id", courseIds)
        .order("due_at", { ascending: true });

      if (evErr) {
        setErr(evErr.message);
        setEvents([]);
        setLoading(false);
        return;
      }

      setEvents(ev || []);
      setLoading(false);

      // Realtime updates
      channel = supabase
        .channel(`course-events-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "course_events" },
          (payload) => {
            const row = payload.new || payload.old;
            if (!row) return;
            if (!courseIds.includes(row.course_id)) return;

            setEvents((prev) => {
              if (payload.eventType === "INSERT") {
                return [payload.new, ...prev].sort((a, b) =>
                  String(a.due_at || "").localeCompare(String(b.due_at || ""))
                );
              }

              if (payload.eventType === "UPDATE") {
                return prev
                  .map((x) => (x.id === payload.new.id ? payload.new : x))
                  .sort((a, b) =>
                    String(a.due_at || "").localeCompare(String(b.due_at || ""))
                  );
              }

              if (payload.eventType === "DELETE") {
                return prev.filter((x) => x.id !== payload.old.id);
              }

              return prev;
            });
          }
        )
        .subscribe();
    }

    boot();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [role]);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const e of events) {
      const k = dayKey(e.due_at);
      if (!k) continue;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(e);
    }
    return map;
  }, [events]);

  return { events, byDay, loading, err };
}