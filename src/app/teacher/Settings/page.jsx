import { createSupabaseServerClient } from "@/app/lib/supabaseServer";
import { redirect } from "next/navigation";

export default async function TeacherSettingsPage() {
  const supabase = createSupabaseServerClient();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "teacher") redirect("/student/Dashboard");

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 12 }}>Settings</h1>
      <p>This is a placeholder settings page.</p>

      <ul style={{ marginTop: 12 }}>
        <li>Change password (optional)</li>
        <li>Notification preferences (optional)</li>
        <li>Theme (optional)</li>
      </ul>
    </div>
  );
}