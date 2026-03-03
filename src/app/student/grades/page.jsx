"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { useRouter } from "next/navigation";

function normalizePct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n > 0 && n <= 1) return n * 100;
  return n;
}

function fmtPct(v) {
  const n = normalizePct(v);
  if (n == null) return "—";
  return `${n.toFixed(0)}%`;
}

function computeFinal(prelim, midterm, finalExam) {
  const p = normalizePct(prelim) ?? 0;
  const m = normalizePct(midterm) ?? 0;
  const f = normalizePct(finalExam) ?? 0;
  return +(p * 0.3 + m * 0.3 + f * 0.4).toFixed(2);
}

function normalizeUnsetTerm(v) {
  const n = normalizePct(v);
  if (n == null) return null;
  // In this app, term columns default to 0 in DB before teacher encodes values.
  // Treat 0 as "not encoded yet" for display.
  if (n === 0) return null;
  return v;
}

function gradeColor(val) {
  const g = normalizePct(val);
  if (g == null) return "#9ca3af";
  return g >= 75 ? "#16a34a" : "#dc2626";
}

function gradeRemark(val) {
  const g = normalizePct(val);
  if (g == null) return "Pending";
  if (g >= 90) return "Excellent";
  if (g >= 80) return "Very Good";
  if (g >= 75) return "Passed";
  return "Failed";
}

function parseLogScorePct(type, status, score) {
  if (type === "Attendance") {
    const s = String(status || "").toLowerCase();
    if (s === "present") return 100;
    if (s === "late") return 50;
    if (s === "absent") return 0;
    return null; // Exempted/Excused/blank = not counted
  }

  const raw = String(score || "").trim();
  if (!raw) return null;
  if (raw.includes("/")) {
    const [a, b] = raw.split("/");
    const n = Number(a);
    const d = Number(b);
    if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return null;
    return +((n / d) * 100).toFixed(2);
  }
  if (raw.endsWith("%")) {
    const n = Number(raw.replace("%", "").trim());
    return Number.isFinite(n) ? +n.toFixed(2) : null;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? +n.toFixed(2) : null;
}

function parseTermFromNote(note) {
  const txt = String(note || "").toLowerCase();
  if (txt.includes("midterm")) return "Midterm";
  if (txt.includes("final")) return "Final";
  return "Prelim";
}

function groupActivitiesByCourse(perfRows) {
  const courseMap = new Map();

  for (const row of perfRows || []) {
    const courseId = row.course_id;
    if (!courseMap.has(courseId)) courseMap.set(courseId, new Map());
    const byActivity = courseMap.get(courseId);
    const termLabel = parseTermFromNote(row.note);
    const key = `${row.event_date || ""}|${row.item || ""}|${termLabel}`;

    if (!byActivity.has(key)) {
      byActivity.set(key, {
        date: row.event_date || "",
        item: row.item || "Activity",
        term: termLabel,
        scores: { Attendance: null, Quiz: null, Activity: null, Exam: null },
      });
    }

    const entry = byActivity.get(key);
    const pct = parseLogScorePct(row.type, row.status, row.score);
    if (Object.prototype.hasOwnProperty.call(entry.scores, row.type)) {
      entry.scores[row.type] = pct;
    }
  }

  const out = new Map();
  for (const [courseId, activityMap] of courseMap.entries()) {
    const list = Array.from(activityMap.values())
      .map((x) => {
        const vals = Object.values(x.scores).filter((v) => v != null);
        const avg = vals.length ? +(vals.reduce((s, n) => s + n, 0) / vals.length).toFixed(2) : null;
        return { ...x, average: avg };
      })
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    out.set(courseId, list);
  }
  return out;
}

function buildCourseTermPresence(perfRows) {
  const out = new Map();
  for (const row of perfRows || []) {
    const courseId = row.course_id;
    if (!courseId) continue;
    if (!out.has(courseId)) {
      out.set(courseId, { prelim: false, midterm: false, final: false });
    }
    const pct = parseLogScorePct(row.type, row.status, row.score);
    if (pct == null) continue;
    const termLabel = parseTermFromNote(row.note);
    const rec = out.get(courseId);
    if (termLabel === "Prelim") rec.prelim = true;
    if (termLabel === "Midterm") rec.midterm = true;
    if (termLabel === "Final") rec.final = true;
  }
  return out;
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
      const role = String(profile.role || "").trim().toLowerCase();
      if (role !== "student") { router.replace("/teacher/dashboard"); return; }

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

      const [
        { data: courseRows, error: coursesErr },
        { data: gradeRows, error: gradesErr },
        { data: perfRows, error: perfErr },
      ] = await Promise.all([
        supabase.from("courses").select("id, code, title, teacher_id").in("id", courseIds),
        supabase
          .from("grades")
          .select("course_id, prelim, midterm, final_exam, final_grade")
          .eq("student_id", user.id)
          .in("course_id", courseIds),
        supabase
          .from("student_performance_logs")
          .select("course_id, event_date, item, type, status, score, note")
          .eq("student_id", user.id)
          .in("course_id", courseIds)
          .order("event_date", { ascending: false }),
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

      let safePerfRows = perfRows || [];
      if (perfErr) {
        const msg = String(perfErr.message || "").toLowerCase();
        if (!msg.includes("does not exist")) {
          setErr(perfErr.message);
        }
        safePerfRows = [];
      }

      const teacherIds = Array.from(new Set((courseRows || []).map((c) => c.teacher_id).filter(Boolean)));
      const { data: teacherRows } = teacherIds.length
        ? await supabase.from("profiles").select("id, full_name").in("id", teacherIds)
        : { data: [] };

      const courseMap = new Map((courseRows || []).map((c) => [c.id, c]));
      const gradeMap = new Map((gradeRows || []).map((g) => [g.course_id, g]));
      const teacherMap = new Map((teacherRows || []).map((t) => [t.id, t.full_name || "N/A"]));
      const activityMap = groupActivitiesByCourse(safePerfRows);
      const termPresenceMap = buildCourseTermPresence(safePerfRows);

      const merged = courseIds
        .map((cid) => {
          const c = courseMap.get(cid);
          const g = gradeMap.get(cid);
          const termPresence = termPresenceMap.get(cid) || { prelim: false, midterm: false, final: false };
          const prelimVal = termPresence.prelim && g?.prelim != null ? g.prelim : null;
          const midtermVal = termPresence.midterm ? normalizeUnsetTerm(g?.midterm) : null;
          const finalExamVal = termPresence.final ? normalizeUnsetTerm(g?.final_exam) : null;
          const hasComponents = prelimVal != null || midtermVal != null || finalExamVal != null;
          const final =
            g?.final_grade != null
              ? normalizePct(g.final_grade)
              : hasComponents
              ? computeFinal(prelimVal, midtermVal, finalExamVal)
              : null;
          return {
            code: c?.code || "N/A",
            name: c?.title || "N/A",
            instructor: teacherMap.get(c?.teacher_id) || "N/A",
            prelim: prelimVal,
            midterm: midtermVal,
            final_exam: finalExamVal,
            final,
            activities: activityMap.get(cid) || [],
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
  const hasAnyActivities = grades.some((g) => (g.activities || []).length > 0);

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
                      <span>P: <b>{fmtPct(g.prelim)}</b></span>
                      <span>M: <b>{fmtPct(g.midterm)}</b></span>
                      <span>F: <b>{fmtPct(g.final_exam)}</b></span>
                    </div>
                  </div>

                  <div className="grades-mobile-right" style={{ color: gradeColor(g.final) }}>
                    <div className="grades-mobile-final-label">Final:</div>
                    <div className="grades-mobile-final-value">{fmtPct(g.final)}</div>
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
                  <Td center>{fmtPct(g.prelim)}</Td>
                  <Td center>{fmtPct(g.midterm)}</Td>
                  <Td center>{fmtPct(g.final_exam)}</Td>
                  <Td center>
                    <span style={{ fontWeight: 900, fontSize: 15, color: gradeColor(g.final) }}>
                      {fmtPct(g.final)}
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

      {hasAnyActivities && (
        <div className="glassCard" style={{ marginTop: 12, padding: 14 }}>
          <div style={{ fontWeight: 900, marginBottom: 8, color: "#111827" }}>Activity Details</div>
          <div style={{ display: "grid", gap: 8 }}>
            {grades.map((g, i) => {
              const list = g.activities || [];
              if (!list.length) return null;
              return (
                <div key={`act-${i}`} style={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, padding: 10, background: "#fff" }}>
                  <div style={{ fontWeight: 800, color: "var(--blue-main)", marginBottom: 6 }}>
                    {g.code} - {g.name}
                  </div>
                  <div style={{ display: "grid", gap: 4 }}>
                    {list.slice(0, 8).map((a, idx) => (
                      <div key={idx} style={{ fontSize: 12, color: "#374151", display: "flex", flexWrap: "wrap", gap: 10 }}>
                        <span>{a.date}</span>
                        <span style={{ fontWeight: 800 }}>{a.term}</span>
                        <span>{a.item}</span>
                        <span>A: {fmtPct(a.scores.Attendance)}</span>
                        <span>Q: {fmtPct(a.scores.Quiz)}</span>
                        <span>Act: {fmtPct(a.scores.Activity)}</span>
                        <span>Ex: {fmtPct(a.scores.Exam)}</span>
                        <span style={{ fontWeight: 800, color: gradeColor(a.average) }}>Avg: {fmtPct(a.average)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
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
