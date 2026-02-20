import { createSupabaseServerClient } from "@/app/lib/supabaseServer";
import { redirect } from "next/navigation";

export default async function StudentCoursesPage() {
  const supabase = createSupabaseServerClient();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;

  if (!user) redirect("/Login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "teacher") redirect("/teacher/Dashboard");

  // enrolled courses (enrollments -> courses)
  const { data, error } = await supabase
    .from("enrollments")
    .select("course_id, courses(code, title)")
    .eq("student_id", user.id);

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h1>My Courses</h1>
        <p style={{ color: "red" }}>{error.message}</p>
      </div>
    );
  }

  const courses = (data || []).map((r) => r.courses).filter(Boolean);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 12 }}>My Courses</h1>

      {!courses.length ? (
        <p>No enrolled courses yet.</p>
      ) : (
        <ul>
          {courses.map((c, idx) => (
            <li key={idx}>
              <b>{c.code}</b> — {c.title}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}