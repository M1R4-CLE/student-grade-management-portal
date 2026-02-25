"use client";

// ============================================================
// FILE: src/app/teacher/GradeEntry/page.jsx
// ============================================================

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";

export default function TeacherGradeEntryPage() {
  const router = useRouter();

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

      if (!profile || profile.role !== "teacher") {
        router.replace("/student/Dashboard");
        return;
      }
      setTeacherId(user.id);

      const { data: coursesData } = await supabase
        .from("courses")
        .select("id, code, title")
        .eq("teacher_id", user.id)
        .order("id");
      setCourses(coursesData || []);
      setLoading(false);
    };
    run();
  }, [router]);

  // ── Load students + existing grades for selected course ─────
  const loadGrades = useCallback(async (courseId) => {
    if (!courseId) { setRows([]); return; }
    setErr("");

    // Get enrolled students
    const { data: enrollData, error: eErr } = await supabase
      .from("enrollments")
      .select(`
        student_id,
        profiles!enrollments_student_id_fkey(full_name, student_no)
      `)
      .eq("course_id", courseId)
      .order("student_id");

    if (eErr) { setErr(eErr.message); setRows([]); return; }

    const students = (enrollData || []).map(e => ({
      studentId: e.student_id,
      name:      e.profiles?.full_name  || "—",
      studentNo: e.profiles?.student_no || "—",
    }));

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

    const prelim     = parseFloat(row.prelim)     || 0;
    const midterm    = parseFloat(row.midterm)    || 0;
    const final_exam = parseFloat(row.final_exam) || 0;

    if ([prelim, midterm, final_exam].some(v => v < 0 || v > 100)) {
      setErr("Grades must be between 0 and 100.");
      return;
    }

    setSaving(prev => ({ ...prev, [row.studentId]: true }));

    const { error } = await supabase
      .from("grades")
      .upsert(
        { course_id: Number(selectedId), student_id: row.studentId, prelim, midterm, final_exam },
        { onConflict: "course_id,student_id" }
      );

    if (error) {
      setErr(error.message);
    } else {
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
      <h1 style={{ fontWeight: 900, fontSize: 26, marginBottom: 20, color: "#111827" }}>
        Grade Entry
      </h1>

      {/* Course selector */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          style={{
            height: 42, padding: "0 14px", borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.15)", fontSize: 13,
            background: "white", minWidth: 260, fontWeight: 600,
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
              fontWeight: 800, fontSize: 13, cursor: "pointer",
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
                const p  = parseFloat(row.prelim)     || 0;
                const m  = parseFloat(row.midterm)    || 0;
                const fe = parseFloat(row.final_exam) || 0;
                const fg = Math.round((p * 0.3 + m * 0.3 + fe * 0.4) * 100) / 100;
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