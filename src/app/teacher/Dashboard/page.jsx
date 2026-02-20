import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";

export default async function TeacherDashboard() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/Login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "teacher") {
    redirect("/student/Dashboard");
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Teacher Dashboard</h1>
      <p>Welcome! You can manage classes and enter grades.</p>
    </div>
  );
}