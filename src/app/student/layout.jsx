"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import PageShell from "@/components/PageShell";

function fmtWhen(dueAt, kind) {
  const d = new Date(dueAt);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
  const type = String(kind || "").toUpperCase();
  return `${date} - ${type}`;
}

export default function StudentLayout({ children }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("Student");
  const [studentId, setStudentId] = useState("");
  const [upcoming, setUpcoming] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("full_name, role, student_no")
        .eq("id", user.id)
        .single();

      if (pErr || !profile) {
        router.replace("/login");
        return;
      }

      if (profile.role !== "student") {
        router.replace("/teacher/Dashboard");
        return;
      }

      if (cancelled) return;

      setFullName(profile.full_name || "Student");
      setStudentId(profile.student_no || "");

      const { data: enrolls, error: eErr } = await supabase
        .from("enrollments")
        .select("course_id")
        .eq("student_id", user.id);

      if (cancelled) return;

      if (eErr) {
        setUpcoming([]);
        setLoading(false);
        return;
      }

      const courseIds = (enrolls || []).map((x) => x.course_id).filter(Boolean);

      if (!courseIds.length) {
        setUpcoming([]);
        setLoading(false);
        return;
      }

      const nowIso = new Date().toISOString();

      const { data: events, error: evErr } = await supabase
        .from("course_events")
        .select("id, kind, title, due_at, courses(code)")
        .in("course_id", courseIds)
        .not("due_at", "is", null)
        .gte("due_at", nowIso)
        .order("due_at", { ascending: true })
        .limit(6);

      if (cancelled) return;

      if (evErr) {
        setUpcoming([]);
        setLoading(false);
        return;
      }

      const mapped = (events || []).map((ev) => {
        const code = ev.courses?.code ? `${ev.courses.code} - ` : "";
        return {
          title: `${code}${ev.title}`,
          when: fmtWhen(ev.due_at, ev.kind),
        };
      });

      setUpcoming(mapped);
      setLoading(false);
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;

  return (
    <PageShell role="student" fullName={fullName} studentId={studentId} upcoming={upcoming}>
      {children}
    </PageShell>
  );
}