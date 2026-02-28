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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 700px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

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

      const { data: enrollRows, error: enrollErr } = await supabase
        .from("enrollments")
        .select("course_id")
        .eq("student_id", user.id);

      if (enrollErr) {
        setErr(enrollErr.message);
        setGrades([]);
        setLoading(false);
        return;
      }

      const courseIds = Array.from(new Set((enrollRows || []).map((x) => x.course_id).filter(Boolean)));
      if (!courseIds.length) {
        setGrades([]);
        setLoading(false);
        return;
      }

      const [{ data: courseRows, error: coursesErr }, { data: gradeRows, error: gradesErr }] = await Promise.all([
        supabase.from("courses").select("id, code, title, teacher_id").in("id", courseIds),
        supabase
          .from("grades")
          .select("course_id, prelim, midterm, final_exam, final_grade")
          .eq("student_id", user.id)
          .in("course_id", courseIds),
      ]);

      if (coursesErr) {
        setErr(coursesErr.message);
        setGrades([]);
        setLoading(false);
        return;
      }

      if (gradesErr) {
        setErr(gradesErr.message);
        setGrades([]);
        setLoading(false);
        return;
      }

      const teacherIds = Array.from(new Set((courseRows || []).map((c) => c.teacher_id).filter(Boolean)));
      const { data: teacherRows } = teacherIds.length
        ? await supabase.from("profiles").select("id, full_name").in("id", teacherIds)
        : { data: [] };

      const courseMap = new Map((courseRows || []).map((c) => [c.id, c]));
      const gradeMap = new Map((gradeRows || []).map((g) => [g.course_id, g]));
      const teacherMap = new Map((teacherRows || []).map((t) => [t.id, t.full_name || "N/A"]));

      const merged = courseIds
        .map((cid) => {
          const c = courseMap.get(cid);
          const g = gradeMap.get(cid);
          return {
            code: c?.code || "N/A",
            name: c?.title || "N/A",
            instructor: teacherMap.get(c?.teacher_id) || "N/A",
            prelim: g?.prelim != null ? g.prelim : null,
            midterm: g?.midterm != null ? g.midterm : null,
            final_exam: g?.final_exam != null ? g.final_exam : null,
            final: g?.final_grade != null ? g.final_grade : null,
          };
        })
        .sort((a, b) => String(a.code).localeCompare(String(b.code)));

      setGrades(merged);
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

      {/* â”€â”€ Header â”€â”€ */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: isMobile ? "stretch" : "center",
          flexDirection: isMobile ? "column" : "row",
          gap: isMobile ? 10 : 0,
          marginBottom: 14,
        }}
      >
        <div style={{ fontWeight: 900, fontSize: isMobile ? 42 : 20, lineHeight: isMobile ? 0.95 : 1.1 }}>
          My Gradebook
        </div>

        {overallAvg && (
          <div
            style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "rgba(255,255,255,.85)",
              border: "1px solid rgba(0,0,0,.08)",
              borderRadius: 12,
              padding: isMobile ? "8px 12px" : "8px 18px",
              width: isMobile ? "100%" : "auto",
              boxSizing: "border-box",
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
      ) : isMobile ? (
        <div className="glassCard grades-mobile-wrap" style={{ padding: 14 }}>
          <div className="grades-mobile-grid">
            {grades.map((g, i) => (
              <div key={i} className="grades-mobile-card">
                <div className="grades-mobile-main">
                  <div className="grades-mobile-left">
                    <div className="grades-mobile-code">{g.code}</div>
                    <div className="grades-mobile-name">{g.name}</div>
                    <div className="grades-mobile-instructor">{g.instructor}</div>

                    <div className="grades-mobile-metrics">
                      <span>P: <b>{g.prelim != null ? `${g.prelim}%` : "-"}</b></span>
                      <span>M: <b>{g.midterm != null ? `${g.midterm}%` : "-"}</b></span>
                      <span>F: <b>{g.final_exam != null ? `${g.final_exam}%` : "-"}</b></span>
                    </div>
                  </div>

                  <div className="grades-mobile-right" style={{ color: gradeColor(g.final) }}>
                    <div className="grades-mobile-final-label">Final:</div>
                    <div className="grades-mobile-final-value">{g.final != null ? `${g.final}%` : "-"}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 12, fontSize: 11, color: "#9ca3af" }}>
            Final Grade = (Prelim x 0.30) + (Midterm x 0.30) + (Final Exam x 0.40). Computed automatically by the system.
          </div>
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
                  <Td center>{g.prelim != null ? `${g.prelim}%` : "-"}</Td>
                  <Td center>{g.midterm != null ? `${g.midterm}%` : "-"}</Td>
                  <Td center>{g.final_exam != null ? `${g.final_exam}%` : "-"}</Td>
                  <Td center>
                    <span style={{ fontWeight: 900, fontSize: 15, color: gradeColor(g.final) }}>
                      {g.final != null ? `${g.final}%` : "-"}
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
            Final Grade = (Prelim x 0.30) + (Midterm x 0.30) + (Final Exam x 0.40). Computed automatically by the system.
          </div>
        </div>
      )}

      <style jsx>{`
        .grades-mobile-wrap {
          border-radius: 16px;
        }

        .grades-mobile-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }

        .grades-mobile-card {
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 12px;
          background: #ffffff;
          padding: 10px 12px;
          box-shadow: 0 4px 10px rgba(17, 24, 39, 0.04);
        }

        .grades-mobile-main {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          align-items: stretch;
        }

        .grades-mobile-left {
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .grades-mobile-right {
          min-width: 74px;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          justify-content: space-between;
        }

        .grades-mobile-code {
          color: var(--blue-main);
          font-weight: 900;
          font-size: 18px;
          line-height: 1.1;
        }

        .grades-mobile-name {
          margin-top: 2px;
          color: #111827;
          font-size: 17px;
          line-height: 1.15;
        }

        .grades-mobile-instructor {
          margin-top: 2px;
          color: #6b7280;
          font-size: 13px;
          line-height: 1.2;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .grades-mobile-metrics {
          margin-top: 10px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          font-size: 13px;
          color: #111827;
        }

        .grades-mobile-final-label {
          font-size: 22px;
          font-weight: 900;
          line-height: 1;
        }

        .grades-mobile-final-value {
          margin-top: auto;
          font-size: 60px;
          font-weight: 900;
          line-height: 0.9;
          letter-spacing: -0.03em;
        }
      `}</style>
    </div>
  );
}

// â”€â”€ Table helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
