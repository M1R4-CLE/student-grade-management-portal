"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import PageShell from "@/components/PageShell";

export default function StudentLayout({ children }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("Student");
  const [studentId, setStudentId] = useState("2024130839");

  useEffect(() => {
    const checkAuth = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .single();

      if (!profile) {
        router.replace("/login");
        return;
      }

      if (profile.role !== "student") {
        router.replace("/teacher/Dashboard");
        return;
      }

      setFullName(profile.full_name || "Student");
      setLoading(false);
    };

    checkAuth();
  }, [router]);

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;

  return (
    <PageShell
      role="student"
      fullName={fullName}
      studentId={studentId}
      upcoming={[
        { title: "IS 205 - IT Infrastructure and Networking", when: "Feb 30 • EXAM • Online" },
        { title: "IS 203 - Systems Analysis and Design", when: "Mar 02 • QUIZ • Room 301" },
      ]}
    >
      {children}
    </PageShell>
  );
}