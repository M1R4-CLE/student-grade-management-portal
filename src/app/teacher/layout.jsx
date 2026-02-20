"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import PageShell from "@/components/PageShell";

export default function TeacherLayout({ children }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("Teacher");

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

      if (profile.role !== "teacher") {
        router.replace("/student/Dashboard");
        return;
      }

      setFullName(profile.full_name || "Teacher");
      setLoading(false);
    };

    checkAuth();
  }, [router]);

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;

  return (
    <PageShell role="teacher" fullName={fullName} showRightPanel={true}>
      {children}
    </PageShell>
  );
}