import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";

export default async function GradesPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/Login");

  const { data } = await supabase
    .from("grades")
    .select("*, courses(title, code)")
    .eq("student_id", user.id);

  return (
    <div style={{ padding: 24 }}>
      <h1>My Grades</h1>

      {!data?.length ? (
        <p>No grades available.</p>
      ) : (
        <table border={1} cellPadding={8}>
          <thead>
            <tr>
              <th>Course</th>
              <th>Prelim</th>
              <th>Midterm</th>
              <th>Final</th>
              <th>Final Grade</th>
            </tr>
          </thead>
          <tbody>
            {data.map((g, i) => (
              <tr key={i}>
                <td>{g.courses?.code} - {g.courses?.title}</td>
                <td>{g.prelim}</td>
                <td>{g.midterm}</td>
                <td>{g.final_exam}</td>
                <td><b>{g.final_grade}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}