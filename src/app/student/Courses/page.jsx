"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { useRouter } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";

export default function StudentCoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setErr("");

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("role")
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

      const { data, error } = await supabase
        .from("enrollments")
        .select("course_id, courses(code, title)")
        .eq("student_id", user.id);

      if (error) {
        setErr(error.message);
        setCourses([]);
      } else {
        setCourses((data || []).map((r) => r.courses).filter(Boolean));
      }

      setLoading(false);
    };

    run();
  }, [router]);

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ marginBottom: 12 }}>My Courses</h1>
        <LogoutButton />
      </div>

      {err && <p style={{ color: "red" }}>{err}</p>}

      {!courses.length ? (
        <p>No enrolled courses yet.</p>
      ) : (
        <ul>
          {courses.map((c, idx) => (
            <li key={idx}>
              <b>{c.code}</b> — {c.title}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}