import { createSupabaseServerClient } from "@/app/lib/supabaseServer";
import { redirect } from "next/navigation";

export default async function TeacherProfilePage() {
  const supabase = await createSupabaseServerClient();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;

  if (!user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "teacher") redirect("/student/Dashboard");

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Profile</h1>
        <p style={{ color: "red" }}>{error.message}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 12 }}>Profile</h1>
      <p><b>Name:</b> {profile?.full_name || "(not set)"}</p>
      <p><b>Role:</b> {profile?.role}</p>
      <p><b>Email:</b> {user.email}</p>
    </div>
  );
}
