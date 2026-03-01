"use client";

// ============================================================
// FILE: src/app/teacher/GradeEntry/page.jsx
// ============================================================

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";

function normalizePct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  if (n > 0 && n <= 1) return n * 100;
  return n;
}

function computeFinal(prelim, midterm, finalExam) {
  const p = normalizePct(prelim);
  const m = normalizePct(midterm);
  const f = normalizePct(finalExam);
  return +(p * 0.3 + m * 0.3 + f * 0.4).toFixed(2);
}

export default function TeacherGradeEntryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isMobile, setIsMobile] = useState(false);

  const [loading, setLoading]     = useState(true);
  const [teacherId, setTeacherId] = useState(null);

  // Courses dropdown
  const [courses, setCourses]     = useState([]);
  const [selectedId, setSelectedId] = useState("");

  // Grade rows
  const [rows, setRows]           = useState([]);    // { studentId, name, studentNo, prelim, midterm, final_exam }
  const [saving, setSaving]       = useState({});    // { [studentId]: bool }
  const [saved, setSaved]         = useState({});    // { [studentId]: bool }
  const [err, setErr]             = useState("");
  const initialCourseId = searchParams.get("courseId") || "";

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 700px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // ── Auth ────────────────────────────────────────────────────
  useEffect(() => {
    const run = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) { router.replace("/login"); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      const role = String(profile?.role || "").trim().toLowerCase();
      if (!profile || role !== "teacher") {
        router.replace("/student/dashboard");
        return;
      }
      setTeacherId(user.id);

      const { data: coursesData } = await supabase
        .from("courses")
        .select("id, code, title")
        .eq("teacher_id", user.id)
        .order("id");
      setCourses(coursesData || []);
      if (initialCourseId && (coursesData || []).some(c => String(c.id) === String(initialCourseId))) {
        setSelectedId(String(initialCourseId));
      }
      setLoading(false);
    };
    run();
  }, [router, initialCourseId]);

  // ── Load students + existing grades for selected course ─────
  const loadGrades = useCallback(async (courseId) => {
    if (!courseId) { setRows([]); return; }
    setErr("");

    // Get enrolled students
    const { data: enrollData, error: eErr } = await supabase
      .from("enrollments")
      .select("student_id")
      .eq("course_id", courseId)
      .order("student_id");

    if (eErr) { setErr(eErr.message); setRows([]); return; }

    const studentIds = [...new Set((enrollData || []).map(e => e.student_id).filter(Boolean))];
    const { data: profileRows, error: pErr } = studentIds.length
      ? await supabase.from("profiles").select("id, full_name, student_no").in("id", studentIds)
      : { data: [], error: null };
    if (pErr) { setErr(pErr.message); setRows([]); return; }
    const profileMap = new Map((profileRows || []).map(p => [p.id, p]));

    const students = (enrollData || []).map(e => {
      const p = profileMap.get(e.student_id);
      return {
        studentId: e.student_id,
        name:      p?.full_name  || "-",
        studentNo: p?.student_no || "-",
      };
    });

    // Get existing grades
    const { data: gradesData } = await supabase
      .from("grades")
      .select("student_id, prelim, midterm, final_exam")
      .eq("course_id", courseId);

    const gradeMap = {};
    (gradesData || []).forEach(g => { gradeMap[g.student_id] = g; });

    setRows(
      students.map(s => ({
        ...s,
        prelim:     String(gradeMap[s.studentId]?.prelim    ?? ""),
        midterm:    String(gradeMap[s.studentId]?.midterm   ?? ""),
        final_exam: String(gradeMap[s.studentId]?.final_exam ?? ""),
      }))
    );
    setSaving({});
    setSaved({});
  }, []);

  useEffect(() => {
    loadGrades(selectedId);
  }, [selectedId, loadGrades]);

  // ── Update a field in a row ─────────────────────────────────
  const updateRow = (studentId, field, value) => {
    // Allow only numbers 0-100
    const clean = value.replace(/[^0-9.]/g, "");
    setRows(prev =>
      prev.map(r => r.studentId === studentId ? { ...r, [field]: clean } : r)
    );
    setSaved(prev => ({ ...prev, [studentId]: false }));
  };

  // ── Save one student's grades ───────────────────────────────
  const saveRow = async (row) => {
    if (!selectedId) return;

    const prelim     = normalizePct(row.prelim);
    const midterm    = normalizePct(row.midterm);
    const final_exam = normalizePct(row.final_exam);

    if ([prelim, midterm, final_exam].some(v => v < 0 || v > 100)) {
      setErr("Grades must be between 0 and 100.");
      return;
    }

    setSaving(prev => ({ ...prev, [row.studentId]: true }));

    const gradePayload = {
      course_id: Number(selectedId),
      student_id: row.studentId,
      prelim,
      midterm,
      final_exam,
    };

    let { error } = await supabase
      .from("grades")
      .upsert(gradePayload, { onConflict: "course_id,student_id" });

    // Fallback for broken DB trigger referencing NEW.updated_at on updates.
    // This path rewrites the row using delete+insert so teachers can still edit grades.
    if (error && String(error.message || "").toLowerCase().includes('record "new" has no field "updated_at"')) {
      const { error: delErr } = await supabase
        .from("grades")
        .delete()
        .eq("course_id", Number(selectedId))
        .eq("student_id", row.studentId);

      if (!delErr) {
        const { error: insErr } = await supabase.from("grades").insert(gradePayload);
        error = insErr || null;
      }
    }

    if (error) {
      setErr(error.message);
    } else {
      const selectedCourse = courses.find(c => String(c.id) === String(selectedId));
      const finalGrade = computeFinal(prelim, midterm, final_exam);
      const notifPayload = {
        user_id: row.studentId,
        type: "grade",
        title: "Grade updated",
        body: `${selectedCourse?.code || "Course"}: ${selectedCourse?.title || "Course"} - Final Grade: ${finalGrade}%`,
        link: `/student/grades?course=${encodeURIComponent(selectedCourse?.code || "")}`,
      };
      const { error: notifError } = await supabase.from("notifications").insert(notifPayload);
      if (notifError) {
        console.error("Grade saved but notification failed:", notifError.message);
      }
      setSaved(prev => ({ ...prev, [row.studentId]: true }));
    }
    setSaving(prev => ({ ...prev, [row.studentId]: false }));
  };

  // ── Save All ────────────────────────────────────────────────
  const saveAll = async () => {
    for (const row of rows) {
      await saveRow(row);
    }
  };

  if (loading) return <div style={{ padding: 40 }}>Loading Grade Entry…</div>;

  return (
    <div style={{ width: "100%" }}>

      {/* Title */}
      <h1 style={{ fontWeight: 900, fontSize: isMobile ? 22 : 26, marginBottom: 20, color: "#111827" }}>
        Grade Entry
      </h1>

      {/* Course selector */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
          flexDirection: isMobile ? "column" : "row",
          alignContent: isMobile ? "stretch" : "initial",
        }}
      >
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          style={{
            height: 42, padding: "0 14px", borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.15)", fontSize: 13,
            background: "white", minWidth: isMobile ? 0 : 260, width: isMobile ? "100%" : "auto", fontWeight: 600,
          }}
        >
          <option value="">— Select a Course —</option>
          {courses.map(c => (
            <option key={c.id} value={c.id}>
              [{c.code}] {c.title}
            </option>
          ))}
        </select>

        {rows.length > 0 && (
          <button
            onClick={saveAll}
            style={{
              height: 42, padding: "0 20px", borderRadius: 10,
              border: "none", background: "#57b447", color: "white",
              fontWeight: 800, fontSize: 13, cursor: "pointer", width: isMobile ? "100%" : "auto",
            }}
          >
            Save All Grades
          </button>
        )}
      </div>

      {err && (
        <div style={{
          padding: "10px 14px", borderRadius: 8, background: "#fee2e2",
          color: "#991b1b", marginBottom: 14, fontWeight: 700, fontSize: 13,
        }}>
          {err}
        </div>
      )}

      {/* Grade table */}
      {!selectedId ? (
        <div style={emptyBox}>
          Select a course above to enter grades.
        </div>
      ) : rows.length === 0 ? (
        <div style={emptyBox}>
          No students enrolled in this course yet.
        </div>
      ) : isMobile ? (
        <div style={{
          background: "rgba(255,255,255,0.78)",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 16,
          padding: 12,
          boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
        }}>
          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((row, i) => {
              const fg = computeFinal(row.prelim, row.midterm, row.final_exam);
              const hasGrade = row.prelim !== "" || row.midterm !== "" || row.final_exam !== "";
              const isSaved = saved[row.studentId];
              const isSaving = saving[row.studentId];

              return (
                <div
                  key={row.studentId}
                  style={{
                    border: "1px solid rgba(0,0,0,0.08)",
                    borderRadius: 12,
                    background: "#fff",
                    padding: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>#{i + 1}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#2f6fb3", lineHeight: 1.2 }}>{row.studentNo}</div>
                      <div style={{ fontSize: 14, color: "#111827", lineHeight: 1.25 }}>{row.name}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>Final</div>
                      <div style={{
                        fontWeight: 900,
                        fontSize: 18,
                        color: hasGrade ? (fg >= 75 ? "#16a34a" : "#dc2626") : "#9ca3af",
                      }}>
                        {hasGrade ? `${fg}%` : "—"}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 10 }}>
                    {[
                      ["Prelim", "prelim"],
                      ["Midterm", "midterm"],
                      ["Final Exam", "final_exam"],
                    ].map(([label, field]) => (
                      <div key={field}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>{label}</div>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={row[field]}
                          onChange={e => updateRow(row.studentId, field, e.target.value)}
                          style={{
                            width: "100%",
                            textAlign: "center",
                            padding: "6px 6px",
                            borderRadius: 6,
                            border: "1px solid rgba(0,0,0,0.15)",
                            fontSize: 13,
                            outline: "none",
                            boxSizing: "border-box",
                          }}
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => saveRow(row)}
                    disabled={isSaving}
                    style={{
                      marginTop: 10,
                      width: "100%",
                      height: 34,
                      borderRadius: 8,
                      border: "none",
                      background: isSaved ? "#dcfce7" : "#2f6fb3",
                      color: isSaved ? "#166534" : "white",
                      fontWeight: 800,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    {isSaving ? "Saving…" : isSaved ? "✓ Saved" : "Save"}
                  </button>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 10, fontSize: 11, color: "#9ca3af" }}>
            Final Grade = (Prelim × 0.30) + (Midterm × 0.30) + (Final Exam × 0.40). Computed automatically.
          </div>
        </div>
      ) : (
        <div style={{
          background: "rgba(255,255,255,0.78)",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 16,
          padding: 20,
          boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
          overflowX: "auto",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["#", "Student No.", "Name", "Prelim (30%)", "Midterm (30%)", "Final Exam (40%)", "Final Grade", "Action"].map(h => (
                  <th key={h} style={{
                    padding: "10px 12px",
                    textAlign: h === "#" || h === "Action" || h.includes("%") || h.includes("Final") ? "center" : "left",
                    fontWeight: 800,
                    color: "#374151",
                    borderBottom: "2px solid #e5e7eb",
                    whiteSpace: "nowrap",
                    background: "#f8fafc",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const fg = computeFinal(row.prelim, row.midterm, row.final_exam);
                const hasGrade = row.prelim !== "" || row.midterm !== "" || row.final_exam !== "";
                const isSaved  = saved[row.studentId];
                const isSaving = saving[row.studentId];

                return (
                  <tr key={row.studentId} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ ...tdC }}>{i + 1}</td>
                    <td style={{ padding: "8px 12px", fontWeight: 700, color: "#2f6fb3", whiteSpace: "nowrap" }}>
                      {row.studentNo}
                    </td>
                    <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{row.name}</td>

                    {["prelim", "midterm", "final_exam"].map(field => (
                      <td key={field} style={tdC}>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={row[field]}
                          onChange={e => updateRow(row.studentId, field, e.target.value)}
                          style={{
                            width: 70, textAlign: "center",
                            padding: "4px 6px", borderRadius: 6,
                            border: "1px solid rgba(0,0,0,0.15)",
                            fontSize: 13, outline: "none",
                          }}
                          placeholder="0"
                        />
                      </td>
                    ))}

                    <td style={tdC}>
                      <span style={{
                        fontWeight: 900, fontSize: 14,
                        color: hasGrade ? (fg >= 75 ? "#16a34a" : "#dc2626") : "#9ca3af",
                      }}>
                        {hasGrade ? `${fg}%` : "—"}
                      </span>
                    </td>

                    <td style={tdC}>
                      <button
                        onClick={() => saveRow(row)}
                        disabled={isSaving}
                        style={{
                          padding: "5px 12px", borderRadius: 6, border: "none",
                          background: isSaved ? "#dcfce7" : "#2f6fb3",
                          color: isSaved ? "#166534" : "white",
                          fontWeight: 800, fontSize: 12, cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {isSaving ? "Saving…" : isSaved ? "✓ Saved" : "Save"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ marginTop: 10, fontSize: 11, color: "#9ca3af" }}>
            Final Grade = (Prelim × 0.30) + (Midterm × 0.30) + (Final Exam × 0.40). Computed automatically.
          </div>
        </div>
      )}
    </div>
  );
}

const emptyBox = {
  padding: "40px 20px",
  textAlign: "center",
  color: "#6b7280",
  background: "rgba(255,255,255,0.78)",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 16,
  fontSize: 13,
};

const tdC = {
  padding:       "8px 12px",
  verticalAlign: "middle",
  textAlign:     "center",
};
