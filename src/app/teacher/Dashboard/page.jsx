import { createSupabaseServerClient } from "@/app/lib/supabaseServer";
import LogoutButton from "@/app/components/LogoutButton";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function TeacherDashboardPage() {
  const supabase = createSupabaseServerClient();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;

  if (!user) redirect("/Login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "teacher") {
    redirect("/student/Dashboard");
  }

  return (
    <div style={{ padding: 24 }}>

      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16
      }}>
        <h1>Teacher Dashboard</h1>
        <LogoutButton />
      </div>

      <p style={{ marginBottom: 16 }}>
        Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}!
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/teacher/Class-Management"><button>Class Management</button></Link>
        <Link href="/teacher/Grade-Entry"><button>Grade Entry</button></Link>
        <Link href="/teacher/messages"><button>Messages</button></Link>
        <Link href="/teacher/Profile"><button>Profile</button></Link>
        <Link href="/teacher/Settings"><button>Settings</button></Link>
      </div>

    </div>
  );
}