import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";

export default async function StudentDashboard() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/Login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "student") {
    redirect("/teacher/Dashboard");
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Student Dashboard</h1>
      <p>View your enrolled courses and grades.</p>
    </div>
  );
}