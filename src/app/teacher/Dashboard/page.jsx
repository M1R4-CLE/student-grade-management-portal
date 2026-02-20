"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { useRouter } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import Link from "next/link";

export default function StudentDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;

      if (!user) {
        router.replace("/Login");
        return;
      }

      // Get profile (role + name)
      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .single();

      if (pErr || !profile) {
        router.replace("/Login");
        return;
      }

      // Guard: only student can access
      if (profile.role !== "student") {
        router.replace("/teacher/Dashboard");
        return;
      }

      setFullName(profile.full_name || "Student");

      // Load student courses
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("course_id, courses(id, code, title)")
        .eq("student_id", user.id);

      const list = (enrollments || [])
        .map((e) => e.courses)
        .filter(Boolean);

      setCourses(list);
      setLoading(false);
    };

    load();
  }, [router]);

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Student Dashboard</h1>
        <LogoutButton />
      </div>

      <p>Welcome, <b>{fullName}</b> 👋</p>

      <div style={{ marginTop: 16 }}>
        <h2>Your Courses</h2>

        {courses.length === 0 ? (
          <p>No courses found.</p>
        ) : (
          <ul>
            {courses.map((c) => (
              <li key={c.id}>
                <b>{c.code}</b> — {c.title}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        <Link href="/student/Grades">View Grades →</Link>
      </div>
    </div>
  );
}