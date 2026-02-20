import { createSupabaseServerClient } from "@/app/lib/supabaseServer";
import { redirect } from "next/navigation";

export default async function GradesPage() {
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

  const { data: grades, error } = await supabase
    .from("grades")
    .select("prelim, midterm, final_exam, final_grade, courses(code, title)")
    .eq("student_id", user.id)
    .order("course_id", { ascending: true });

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h1>My Grades</h1>
        <p style={{ color: "red" }}>{error.message}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 12 }}>My Grades</h1>

      {!grades || grades.length === 0 ? (
        <p>No grades available yet.</p>
      ) : (
        <table
          border={1}
          cellPadding={8}
          style={{ width: "100%", borderCollapse: "collapse" }}
        >
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Course</th>
              <th>Prelim</th>
              <th>Midterm</th>
              <th>Final Exam</th>
              <th>Final Grade</th>
            </tr>
          </thead>
          <tbody>
            {grades.map((g, i) => (
              <tr key={i}>
                <td>
                  {g.courses?.code} - {g.courses?.title}
                </td>
                <td style={{ textAlign: "center" }}>{g.prelim ?? 0}</td>
                <td style={{ textAlign: "center" }}>{g.midterm ?? 0}</td>
                <td style={{ textAlign: "center" }}>{g.final_exam ?? 0}</td>
                <td style={{ textAlign: "center" }}>
                  <b>{g.final_grade ?? 0}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}