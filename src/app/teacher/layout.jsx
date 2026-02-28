"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import PageShell from "@/components/PageShell";

async function resolveCurrentUser() {
  const { data: sessionData } = await supabase.auth.getSession();
  let user = sessionData?.session?.user || null;
  if (user) return user;

  const { data: userData } = await supabase.auth.getUser();
  user = userData?.user || null;
  if (user) return user;

  await new Promise((resolve) => setTimeout(resolve, 220));
  const { data: retrySessionData } = await supabase.auth.getSession();
  user = retrySessionData?.session?.user || null;
  if (user) return user;

  const { data: retryUserData } = await supabase.auth.getUser();
  return retryUserData?.user || null;
}

function fmtWhen(dueAt, kind) {
  const d = new Date(dueAt);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
  const type = String(kind || "").toUpperCase();
  return `${date} - ${type}`;
}

export default function TeacherLayout({ children }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("Teacher");
  const [teacherId, setTeacherId] = useState("");
  const [upcoming, setUpcoming] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);

      const user = await resolveCurrentUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .single();

      if (pErr || !profile) {
        router.replace("/login");
        return;
      }

      const role = String(profile.role || "").trim().toLowerCase();
      if (role !== "teacher") {
        router.replace("/student/dashboard");
        return;
      }

      if (cancelled) return;

      setFullName(profile.full_name || "Teacher");
      setTeacherId(user.id);

      // Load upcoming events for courses this teacher owns
      const { data: coursesData } = await supabase
        .from("courses")
        .select("id")
        .eq("teacher_id", user.id);

      if (cancelled) return;

      const courseIds = (coursesData || []).map((c) => c.id).filter(Boolean);

      if (courseIds.length) {
        const nowIso = new Date().toISOString();
        const { data: events } = await supabase
          .from("course_events")
          .select("id, kind, title, due_at, courses(code)")
          .in("course_id", courseIds)
          .not("due_at", "is", null)
          .gte("due_at", nowIso)
          .order("due_at", { ascending: true })
          .limit(6);

        if (!cancelled) {
          const mapped = (events || []).map((ev) => {
            const code = ev.courses?.code ? `${ev.courses.code} - ` : "";
            return {
              title: `${code}${ev.title}`,
              when: fmtWhen(ev.due_at, ev.kind),
            };
          });
          setUpcoming(mapped);
        }
      }

      if (!cancelled) setLoading(false);
    };

    run();
    return () => { cancelled = true; };
  }, [router]);

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;

  return (
    <PageShell role="teacher" fullName={fullName} studentId={teacherId} upcoming={upcoming}>
      {children}
    </PageShell>
  );
}
