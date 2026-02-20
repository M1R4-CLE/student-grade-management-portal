import { createSupabaseServerClient } from "@/app/lib/supabaseServer";
import { redirect } from "next/navigation";

export default async function TeacherMessagesPage() {
  const supabase = createSupabaseServerClient();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;

  if (!user) redirect("/Login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "teacher") redirect("/student/Dashboard");

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 12 }}>Messages</h1>
      <p>This is a placeholder. You can connect this to a Supabase messages table later.</p>

      <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd" }}>
        <p><b>Sample:</b> “A student requested a grade clarification.”</p>
      </div>
    </div>
  );
}