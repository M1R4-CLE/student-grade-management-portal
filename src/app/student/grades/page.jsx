"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { useRouter } from "next/navigation";

function gradeColor(val) {
  if (val == null) return "#9ca3af";
  return Number(val) >= 75 ? "#16a34a" : "#dc2626";
}

function gradeRemark(val) {
  if (val == null) return "Pending";
  const g = Number(val);
  if (g >= 90) return "Excellent";
  if (g >= 80) return "Very Good";
  if (g >= 75) return "Passed";
  return "Failed";
}

export default function StudentGradesPage() {
  const router = useRouter();
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setErr("");

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) { router.replace("/login"); return; }

      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (pErr || !profile) { router.replace("/login"); return; }
      if (profile.role !== "student") { router.replace("/teacher/Dashboard"); return; }

      const { data, error } = await supabase
        .from("grades")
        .select(`
          prelim,
          midterm,
          final_exam,
          final_grade,
          courses!inner(
            code,
            title,
            profiles!courses_teacher_id_fkey(full_name)
          )
        `)
        .eq("student_id", user.id);

      if (error) {
        setErr(error.message);
        setGrades([]);
      } else {
        setGrades(
          (data || []).map((r) => ({
            code: r.courses?.code || "N/A",
            name: r.courses?.title || "N/A",
            instructor: r.courses?.profiles?.full_name || "N/A",
            prelim: r.prelim != null ? r.prelim : null,
            midterm: r.midterm != null ? r.midterm : null,
            final_exam: r.final_exam != null ? r.final_exam : null,
            final: r.final_grade != null ? r.final_grade : null,
          }))
        );
      }

      setLoading(false);
    };

    run();
  }, [router]);

  // Compute overall average only over courses that have a final grade
  const gradesWith = grades.filter((g) => g.final != null);
  const overallAvg =
    gradesWith.length > 0
      ? (gradesWith.reduce((s, g) => s + Number(g.final), 0) / gradesWith.length).toFixed(2)
      : null;

  if (loading) return <div style={{ padding: 24 }}>Loading grades...</div>;

  return (
    <div style={{ width: "100%" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontWeight: 900, fontSize: 20 }}>My Gradebook</div>

        {overallAvg && (
          <div
            style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "rgba(255,255,255,.85)",
              border: "1px solid rgba(0,0,0,.08)",
              borderRadius: 12, padding: "8px 18px",
            }}
          >
            <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 700 }}>
              Overall Average
            </span>
            <span style={{ fontSize: 24, fontWeight: 900, color: gradeColor(overallAvg) }}>
              {overallAvg}%
            </span>
            <span
              style={{
                fontSize: 12, fontWeight: 800, padding: "2px 10px", borderRadius: 999,
                background: overallAvg >= 75 ? "#dcfce7" : "#fee2e2",
                color: overallAvg >= 75 ? "#166534" : "#991b1b",
              }}
            >
              {gradeRemark(overallAvg)}
            </span>
          </div>
        )}
      </div>

      {err && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "#fee2e2", color: "#991b1b", marginBottom: 12, fontWeight: 700, fontSize: 13 }}>
          {err}
        </div>
      )}

      {grades.length === 0 ? (
        <div
          className="glassCard"
          style={{ padding: 40, textAlign: "center", color: "#6b7280" }}
        >
          No grades available yet. Enroll in courses and wait for your teacher to enter grades.
        </div>
      ) : (
        <div className="glassCard" style={{ padding: 16, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <Th>Course Code</Th>
                <Th>Course Name</Th>
                <Th>Instructor</Th>
                <Th center>Prelim (30%)</Th>
                <Th center>Midterm (30%)</Th>
                <Th center>Final Exam (40%)</Th>
                <Th center>Final Grade</Th>
                <Th center>Remarks</Th>
              </tr>
            </thead>
            <tbody>
              {grades.map((g, i) => (
                <tr
                  key={i}
                  style={{ borderBottom: "1px solid #f1f5f9" }}
                >
                  <Td>
                    <span style={{ fontWeight: 800, color: "var(--blue-main)" }}>
                      {g.code}
                    </span>
                  </Td>
                  <Td>{g.name}</Td>
                  <Td style={{ color: "#6b7280" }}>{g.instructor}</Td>
                  <Td center>{g.prelim != null ? `${g.prelim}%` : "—"}</Td>
                  <Td center>{g.midterm != null ? `${g.midterm}%` : "—"}</Td>
                  <Td center>{g.final_exam != null ? `${g.final_exam}%` : "—"}</Td>
                  <Td center>
                    <span style={{ fontWeight: 900, fontSize: 15, color: gradeColor(g.final) }}>
                      {g.final != null ? `${g.final}%` : "—"}
                    </span>
                  </Td>
                  <Td center>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "3px 10px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 800,
                        background:
                          g.final == null
                            ? "#f3f4f6"
                            : g.final >= 75
                            ? "#dcfce7"
                            : "#fee2e2",
                        color:
                          g.final == null
                            ? "#9ca3af"
                            : g.final >= 75
                            ? "#166534"
                            : "#991b1b",
                      }}
                    >
                      {gradeRemark(g.final)}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 12, fontSize: 11, color: "#9ca3af" }}>
            Final Grade = (Prelim × 0.30) + (Midterm × 0.30) + (Final Exam × 0.40). Computed automatically by the system.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Table helpers ──────────────────────────────────────────────────────────────
function Th({ children, center }) {
  return (
    <th
      style={{
        padding: "10px 12px",
        textAlign: center ? "center" : "left",
        fontWeight: 800,
        color: "#374151",
        borderBottom: "2px solid #e5e7eb",
        whiteSpace: "nowrap",
        background: "#f8fafc",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, center, style: extraStyle }) {
  return (
    <td style={{ padding: "10px 12px", verticalAlign: "middle", textAlign: center ? "center" : "left", ...extraStyle }}>
      {children}
    </td>
  );
}