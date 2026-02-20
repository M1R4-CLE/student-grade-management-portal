"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { useRouter } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";

export default function StudentDashboardPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/Login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .single();

      if (!profile || profile.role !== "student") {
        router.replace("/Login");
        return;
      }

      setFullName(profile.full_name || "Student");

      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("courses(id, code, title)")
        .eq("student_id", user.id);

      const list = (enrollments || [])
        .map((e) => e.courses)
        .filter(Boolean);

      setCourses(list);
    };

    loadData();
  }, [router]);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>Student Dashboard</h1>
        <LogoutButton />
      </div>

      <p>Welcome, <b>{fullName}</b></p>

      <h2>Your Courses</h2>
      <ul>
        {courses.map((c) => (
          <li key={c.id}>
            {c.code} — {c.title}
          </li>
        ))}
      </ul>
    </div>
  );
}