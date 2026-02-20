"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";

export default function GradesPage() {
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErr("");

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;

      if (!user) {
        setErr("Not logged in.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("grades")
        .select("prelim, midterm, final_exam, final_grade, courses(code, title)")
        .eq("student_id", user.id)
        .order("course_id", { ascending: true });

      if (error) setErr(error.message);
      setGrades(data || []);
      setLoading(false);
    };

    load();
  }, []);

  if (loading) return <div style={{ padding: 10 }}>Loading...</div>;
  if (err) return <div style={{ padding: 10, color: "red" }}>{err}</div>;

  return (
    <>
      <h2>Gradebook</h2>

      {!grades.length ? (
        <p>No grades available yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Course</th>
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
                  <b>{g.courses?.code}</b> — {g.courses?.title}
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
    </>
  );
}