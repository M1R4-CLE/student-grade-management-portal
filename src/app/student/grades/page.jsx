"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";

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
        meta: { Attendance: null, Quiz: null, Activity: null, Exam: null },
      });
    }

    const entry = byActivity.get(key);
    const pct = parseLogScorePct(row.type, row.status, row.score);
    if (Object.prototype.hasOwnProperty.call(entry.scores, row.type)) {
      entry.scores[row.type] = pct;
      entry.meta[row.type] = {
        status: row.status || "",
        score: row.score || "",
      };
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
  const searchParams = useSearchParams();
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [openActivity, setOpenActivity] = useState(null);
  const [activitySearchInput, setActivitySearchInput] = useState("");
  const [activitySearch, setActivitySearch] = useState("");
  const [activityTermFilter, setActivityTermFilter] = useState("all");
  const [selectedActivityCourseId, setSelectedActivityCourseId] = useState("");
  const requestedCourseId = String(searchParams.get("courseId") || "").trim();
  const requestedCourseCode = String(searchParams.get("course") || "").trim().toLowerCase();
  const requestedCourseTitle = String(searchParams.get("title") || "").trim().toLowerCase();
  const selectCourse = (courseId) => {
    setSelectedActivityCourseId(String(courseId || ""));
    setOpenActivity(null);
  };

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
            id: String(cid),
            code: c?.code || "N/A",
            name: c?.title || "N/A",
            instructor: teacherMap.get(c?.teacher_id) || "N/A",
            teacherId: c?.teacher_id || "",
            prelim: prelimVal,
            midterm: midtermVal,
            final_exam: finalExamVal,
            final,
            activities: activityMap.get(cid) || [],
          };
        })
        .sort((a, b) => String(a.code).localeCompare(String(b.code)));

      setGrades(merged);
      const requested = merged.find((x) => {
        const idOk = requestedCourseId && String(x.id) === requestedCourseId;
        const codeOk = requestedCourseCode && String(x.code || "").toLowerCase() === requestedCourseCode;
        const titleOk = requestedCourseTitle && String(x.name || "").toLowerCase() === requestedCourseTitle;
        return idOk || codeOk || titleOk;
      });
      if (requested) {
        setSelectedActivityCourseId(String(requested.id));
      }
      setLoading(false);
    };

    run();
  }, [router, requestedCourseId, requestedCourseCode, requestedCourseTitle]);

  // Compute overall average only over courses that have a final grade
  const gradesWith = grades.filter((g) => g.final != null);
  const overallAvg =
    gradesWith.length > 0
      ? (gradesWith.reduce((s, g) => s + Number(g.final), 0) / gradesWith.length).toFixed(2)
      : null;
  const hasAnyActivities = grades.some((g) => (g.activities || []).length > 0);
  const selectedCourse = grades.find((g) => String(g.id) === String(selectedActivityCourseId)) || null;
  const selectedCourseActivities = (selectedCourse?.activities || []).filter((a) => {
    const termKey = String(a.term || "").toLowerCase();
    if (activityTermFilter !== "all" && termKey !== activityTermFilter) return false;
    if (!activitySearch) return true;
    const hay = `${a.item || ""} ${a.date || ""} ${a.term || ""} ${selectedCourse?.code || ""} ${selectedCourse?.name || ""}`.toLowerCase();
    return hay.includes(activitySearch);
  });

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
                    <div className="grades-mobile-code">
                      <button
                        type="button"
                        onClick={() => selectCourse(g.id)}
                        style={courseSelectLinkMobile}
                      >
                        {g.code}
                      </button>
                    </div>
                    <div className="grades-mobile-name">
                      <button
                        type="button"
                        onClick={() => selectCourse(g.id)}
                        style={courseSelectNameMobile}
                      >
                        {g.name}
                      </button>
                    </div>
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
                    <button
                      type="button"
                      onClick={() => selectCourse(g.id)}
                      style={{
                        fontWeight: 800,
                        color: String(selectedActivityCourseId) === String(g.id) ? "#1d4ed8" : "var(--blue-main)",
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        textDecoration: "underline",
                        textUnderlineOffset: 2,
                      }}
                      title="Click to view activity details"
                    >
                      {g.code}
                    </button>
                  </Td>
                  <Td>
                    <button
                      type="button"
                      onClick={() => selectCourse(g.id)}
                      style={courseSelectNameDesktop}
                      title="Click to view activity details"
                    >
                      {g.name}
                    </button>
                  </Td>
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

      {selectedCourse && (
        <div className="glassCard" style={{ marginTop: 12, padding: 14 }}>
          <div style={{ fontWeight: 900, marginBottom: 6, color: "#111827" }}>Activity Details</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
            Tap/click an activity to view detailed scores and percentages.
          </div>
          {(selectedCourse.activities || []).length === 0 ? (
            <div style={noGradeWrap}>
              <div style={noGradeText}>
                You don&apos;t have grade yet. Contact your teacher.
              </div>
              <button
                type="button"
                onClick={() => router.push("/student/messages")}
                style={messageTeacherBtn}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path d="M4 6h16v12H4V6Z" stroke="currentColor" strokeWidth="2" />
                  <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="2" />
                </svg>
                <span>Message {selectedCourse.instructor || "Teacher"}</span>
              </button>
            </div>
          ) : (
            <>
              <div style={activityToolbar}>
                <input
                  type="text"
                  value={activitySearchInput}
                  onChange={(e) => setActivitySearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setActivitySearch(activitySearchInput.trim().toLowerCase());
                    }
                  }}
                  placeholder="Search date, activity, or term..."
                  style={activitySearchInputStyle}
                />
                <button
                  type="button"
                  onClick={() => setActivitySearch(activitySearchInput.trim().toLowerCase())}
                  style={activitySearchBtn}
                >
                  Search
                </button>
                <div style={activityTermBtnWrap}>
                  {[
                    { key: "prelim", label: "Prelim" },
                    { key: "midterm", label: "Midterm" },
                    { key: "final", label: "Final" },
                  ].map((term) => {
                    const active = activityTermFilter === term.key;
                    return (
                      <button
                        key={term.key}
                        type="button"
                        onClick={() => setActivityTermFilter((prev) => (prev === term.key ? "all" : term.key))}
                        style={{
                          ...activityTermBtn,
                          background: active ? "#1d4ed8" : "#ffffff",
                          color: active ? "#ffffff" : "#334155",
                          borderColor: active ? "#1d4ed8" : "#cbd5e1",
                        }}
                      >
                        {term.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {selectedCourseActivities.length === 0 ? (
                <div style={noMatchBox}>No activity matches your search/filter.</div>
              ) : (
                <div style={{ display: "grid", gap: 8, maxHeight: 460, overflowY: "auto", paddingRight: 2 }}>
                  <div style={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, padding: 10, background: "#fff" }}>
                    <div style={{ fontWeight: 800, color: "var(--blue-main)", marginBottom: 6 }}>
                      {selectedCourse.code} - {selectedCourse.name}{" "}
                      <span style={{ color: "#6b7280", fontWeight: 700 }}>({selectedCourseActivities.length})</span>
                    </div>
                    <div style={{ display: "grid", gap: 4 }}>
                      {selectedCourseActivities.map((a, idx) => {
                        const hasAttendance = a.scores.Attendance != null;
                        const hasQuiz = a.scores.Quiz != null;
                        const hasActivity = a.scores.Activity != null;
                        const hasExam = a.scores.Exam != null;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setOpenActivity({ course: selectedCourse, activity: a })}
                            style={{
                              border: "1px solid #e5e7eb",
                              background: "#f8fafc",
                              borderRadius: 8,
                              padding: "8px 10px",
                              textAlign: "left",
                              cursor: "pointer",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                              <div style={{ fontSize: 12, color: "#111827", fontWeight: 800 }}>
                                {a.item}
                              </div>
                              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>
                                {a.term}
                              </div>
                            </div>
                            <div style={{ marginTop: 2, fontSize: 11, color: "#6b7280", fontWeight: 700 }}>
                              {a.date}
                            </div>
                            <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {hasAttendance && <span style={detailChip}>Attendance {fmtPct(a.scores.Attendance)}</span>}
                              {hasQuiz && <span style={detailChip}>Quiz {fmtPct(a.scores.Quiz)}</span>}
                              {hasActivity && <span style={detailChip}>Activity {fmtPct(a.scores.Activity)}</span>}
                              {hasExam && <span style={detailChip}>Exam {fmtPct(a.scores.Exam)}</span>}
                              <span style={{ ...detailChip, fontWeight: 900, color: gradeColor(a.average) }}>Avg {fmtPct(a.average)}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {openActivity && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.35)",
            zIndex: 1100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 14,
          }}
          onClick={() => setOpenActivity(null)}
        >
          <div
            style={{
              width: "min(680px, 100%)",
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              padding: 14,
              boxShadow: "0 20px 40px rgba(0,0,0,.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div>
                <div style={{ fontWeight: 900, color: "var(--blue-main)" }}>
                  {openActivity.course.code} - {openActivity.course.name}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                  {openActivity.activity.item} • {openActivity.activity.term} • {openActivity.activity.date}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpenActivity(null)}
                style={{ border: "1px solid #d1d5db", background: "#fff", borderRadius: 8, width: 32, height: 32, cursor: "pointer" }}
              >
                ×
              </button>
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {["Attendance", "Quiz", "Activity", "Exam"].map((type) => {
                const pct = openActivity.activity.scores?.[type];
                const meta = openActivity.activity.meta?.[type];
                const hasData = pct != null || (meta && (meta.score || meta.status));
                if (!hasData) return null;
                const rawDisplay = type === "Attendance" ? (meta?.status || "—") : (meta?.score || "—");
                return (
                  <div
                    key={type}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      padding: "8px 10px",
                      display: "grid",
                      gridTemplateColumns: isMobile ? "1fr" : "140px 1fr 110px",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ fontWeight: 800, color: "#111827" }}>{type}</div>
                    <div style={{ fontSize: 12, color: "#374151" }}>
                      {type === "Attendance" ? "Status" : "Score"}: <b>{rawDisplay}</b>
                    </div>
                    <div style={{ fontWeight: 900, color: gradeColor(pct), textAlign: isMobile ? "left" : "right" }}>
                      {fmtPct(pct)}
                    </div>
                  </div>
                );
              })}
            </div>
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

const detailChip = {
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 999,
  background: "#eef2ff",
  border: "1px solid #dbeafe",
  color: "#1e3a8a",
  fontSize: 11,
  fontWeight: 700,
};

const activityToolbar = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 10,
};

const activitySearchInputStyle = {
  height: 36,
  minWidth: 220,
  flex: "1 1 240px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  padding: "0 12px",
  fontSize: 13,
  color: "#111827",
  background: "#ffffff",
};

const activitySearchBtn = {
  height: 36,
  padding: "0 14px",
  borderRadius: 10,
  border: "1px solid #1d4ed8",
  background: "#1d4ed8",
  color: "#ffffff",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const activityTermBtnWrap = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flexWrap: "wrap",
};

const activityTermBtn = {
  height: 36,
  minWidth: 82,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#334155",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const noMatchBox = {
  padding: "18px 12px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#f8fafc",
  color: "#6b7280",
  fontSize: 12,
  fontWeight: 700,
  textAlign: "center",
};

const noGradeWrap = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  background: "#f8fafc",
  padding: "14px 12px",
  display: "grid",
  justifyItems: "start",
  gap: 10,
};

const noGradeText = {
  fontSize: 13,
  fontWeight: 700,
  color: "#334155",
};

const messageTeacherBtn = {
  height: 36,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid #1d4ed8",
  background: "#eff6ff",
  color: "#1e3a8a",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const courseSelectLinkMobile = {
  border: "none",
  background: "transparent",
  padding: 0,
  color: "inherit",
  font: "inherit",
  fontWeight: "inherit",
  cursor: "pointer",
  textDecoration: "underline",
  textUnderlineOffset: 2,
};

const courseSelectNameMobile = {
  border: "none",
  background: "transparent",
  padding: 0,
  color: "#111827",
  font: "inherit",
  cursor: "pointer",
  textAlign: "left",
  textDecoration: "underline",
  textUnderlineOffset: 2,
};

const courseSelectNameDesktop = {
  border: "none",
  background: "transparent",
  padding: 0,
  color: "#111827",
  cursor: "pointer",
  textAlign: "left",
  font: "inherit",
  textDecoration: "underline",
  textUnderlineOffset: 2,
};
