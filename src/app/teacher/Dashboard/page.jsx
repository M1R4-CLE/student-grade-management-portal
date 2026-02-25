"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";

// ── Helpers ────────────────────────────────────────────────────────────────────
function calcFinal(prelim, midterm, finalExam) {
  const p = parseFloat(prelim) || 0;
  const m = parseFloat(midterm) || 0;
  const f = parseFloat(finalExam) || 0;
  return Math.round((p * 0.3 + m * 0.3 + f * 0.4) * 100) / 100;
}

function gradeRemark(final) {
  if (final == null || final === "") return "—";
  const g = Number(final);
  if (g >= 90) return "Excellent";
  if (g >= 80) return "Very Good";
  if (g >= 75) return "Passed";
  return "Failed";
}

function remarkColor(final) {
  if (final == null || final === "") return { bg: "#f3f4f6", color: "#9ca3af" };
  const g = Number(final);
  if (g >= 75) return { bg: "#dcfce7", color: "#166534" };
  return { bg: "#fee2e2", color: "#991b1b" };
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function TeacherDashboardPage() {
  const router = useRouter();

  const [teacherId, setTeacherId] = useState("");
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState(""); // "success" | "error" | ""
  const [search, setSearch] = useState("");
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [addCourseErr, setAddCourseErr] = useState("");

  // ── Boot: verify teacher role, then load their courses ────────────────────
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      setLoading(true);

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

      if (cancelled) return;
      setTeacherId(user.id);
      await fetchCourses(user.id);
      if (!cancelled) setLoading(false);
    };

    boot();
    return () => { cancelled = true; };
  }, [router]);

  // ── Fetch this teacher's courses ──────────────────────────────────────────
  const fetchCourses = async (tid) => {
    const { data, error } = await supabase
      .from("courses")
      .select("id, code, title")
      .eq("teacher_id", tid)
      .order("id", { ascending: true });

    if (!error) setCourses(data || []);
  };

  // ── When a course is selected, load its enrolled students + grade rows ────
  useEffect(() => {
    if (!selectedCourse) return;
    let cancelled = false;

    const loadStudents = async () => {
      setStudentsLoading(true);
      setStudents([]);
      setStatus("");
      setStatusType("");
      setSearch("");

      // All enrolled students in this course
      const { data: enrolls, error: eErr } = await supabase
        .from("enrollments")
        .select("student_id, profiles!enrollments_student_id_fkey(id, full_name, student_no, email)")
        .eq("course_id", selectedCourse.id);

      if (eErr) {
        setStatus(eErr.message);
        setStatusType("error");
        setStudentsLoading(false);
        return;
      }
      if (cancelled) return;

      // Existing grade rows for this course
      const { data: gradesData } = await supabase
        .from("grades")
        .select("student_id, prelim, midterm, final_exam, final_grade")
        .eq("course_id", selectedCourse.id);

      const gradeMap = {};
      (gradesData || []).forEach((g) => { gradeMap[g.student_id] = g; });

      const rows = (enrolls || []).map((e) => {
        const p = e.profiles;
        const g = gradeMap[e.student_id] || {};
        return {
          student_id: e.student_id,
          full_name: p?.full_name || "Unknown",
          student_no: p?.student_no || "",
          email: p?.email || "",
          prelim: g.prelim != null ? String(g.prelim) : "",
          midterm: g.midterm != null ? String(g.midterm) : "",
          final_exam: g.final_exam != null ? String(g.final_exam) : "",
          final_grade: g.final_grade != null ? g.final_grade : null,
          dirty: false,
        };
      });

      if (!cancelled) {
        setStudents(rows);
        setStudentsLoading(false);
      }
    };

    loadStudents();
    return () => { cancelled = true; };
  }, [selectedCourse]);

  // ── Handle inline grade input change ─────────────────────────────────────
  const handleGradeChange = (student_id, field, value) => {
    // Allow only numbers and one decimal point, max 3 digits before decimal
    const cleaned = value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
    setStudents((prev) =>
      prev.map((s) => {
        if (s.student_id !== student_id) return s;
        const updated = { ...s, [field]: cleaned, dirty: true };
        const prelim = field === "prelim" ? cleaned : updated.prelim;
        const midterm = field === "midterm" ? cleaned : updated.midterm;
        const final_exam = field === "final_exam" ? cleaned : updated.final_exam;
        // Live compute final
        updated.final_grade = calcFinal(prelim, midterm, final_exam);
        return updated;
      })
    );
  };

  // ── Save all dirty rows via upsert ────────────────────────────────────────
  const saveGrades = async () => {
    if (!selectedCourse || !teacherId) return;
    const dirty = students.filter((s) => s.dirty);
    if (!dirty.length) {
      setStatus("No changes to save.");
      setStatusType("error");
      return;
    }

    setSaving(true);
    setStatus("Saving...");
    setStatusType("");

    const errors = [];

    for (const s of dirty) {
      const prelim = parseFloat(s.prelim) || 0;
      const midterm = parseFloat(s.midterm) || 0;
      const final_exam = parseFloat(s.final_exam) || 0;

      // Validate 0–100 range
      if (
        prelim < 0 || prelim > 100 ||
        midterm < 0 || midterm > 100 ||
        final_exam < 0 || final_exam > 100
      ) {
        errors.push(`${s.full_name}: All scores must be between 0 and 100.`);
        continue;
      }

      const { error } = await supabase
        .from("grades")
        .upsert(
          {
            course_id: selectedCourse.id,
            student_id: s.student_id,
            prelim,
            midterm,
            final_exam,
          },
          { onConflict: "course_id,student_id" }
        );

      if (error) errors.push(`${s.full_name}: ${error.message}`);
    }

    // Mark all as clean after saving
    setStudents((prev) => prev.map((s) => ({ ...s, dirty: false })));
    setSaving(false);

    if (errors.length) {
      setStatus(`Saved with errors:\n${errors.join("\n")}`);
      setStatusType("error");
    } else {
      setStatus(`✅ Grades saved for ${dirty.length} student${dirty.length > 1 ? "s" : ""}.`);
      setStatusType("success");
    }
  };

  // ── Add a new course ──────────────────────────────────────────────────────
  const addCourse = async () => {
    setAddCourseErr("");
    if (!newCode.trim() || !newTitle.trim()) {
      setAddCourseErr("Both course code and title are required.");
      return;
    }

    const { error } = await supabase.from("courses").insert({
      code: newCode.trim().toUpperCase(),
      title: newTitle.trim(),
      teacher_id: teacherId,
    });

    if (error) {
      setAddCourseErr(error.message);
      return;
    }

    await fetchCourses(teacherId);
    setNewCode("");
    setNewTitle("");
    setShowAddCourse(false);
    setStatus("Course created successfully.");
    setStatusType("success");
  };

  // ── Filtered student list ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        s.student_no.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
    );
  }, [students, search]);

  const dirtyCount = students.filter((s) => s.dirty).length;

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;

  return (
    <div style={{ width: "100%" }}>

      {/* ── Page Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontWeight: 900, fontSize: 20 }}>Teacher Dashboard</div>
        <button onClick={() => { setAddCourseErr(""); setShowAddCourse(true); }} style={btnBlue}>
          + Add Course
        </button>
      </div>

      {/* ── Course Selector Chips ── */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700, marginBottom: 8 }}>
          MY COURSES — click a course to manage grades
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {courses.length === 0 ? (
            <div style={{ color: "#6b7280", fontSize: 13 }}>
              No courses yet. Click <b>+ Add Course</b> to create one.
            </div>
          ) : (
            courses.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCourse(c)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 999,
                  border: selectedCourse?.id === c.id
                    ? "2px solid var(--blue-main)"
                    : "1px solid rgba(0,0,0,.12)",
                  background: selectedCourse?.id === c.id
                    ? "var(--blue-main)"
                    : "rgba(255,255,255,.85)",
                  color: selectedCourse?.id === c.id ? "white" : "#111827",
                  fontWeight: 800,
                  cursor: "pointer",
                  fontSize: 13,
                  transition: "all .15s ease",
                }}
              >
                {c.code} — {c.title}
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Grade Table Panel ── */}
      {selectedCourse ? (
        <div className="glassCard" style={{ padding: 16, marginTop: 16 }}>

          {/* Panel header */}
          <div
            style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10,
            }}
          >
            <div>
              <div style={{ fontWeight: 900, fontSize: 16 }}>
                {selectedCourse.code} — {selectedCourse.title}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                {students.length} enrolled student{students.length !== 1 ? "s" : ""}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {/* Search */}
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student..."
                style={{
                  padding: "8px 14px", borderRadius: 999,
                  border: "1px solid rgba(0,0,0,.12)",
                  background: "rgba(255,255,255,.85)",
                  outline: "none", fontSize: 13, width: 200,
                }}
              />

              {/* Save button — only shows when there are unsaved changes */}
              {dirtyCount > 0 && (
                <button
                  onClick={saveGrades}
                  disabled={saving}
                  style={{
                    ...btnBlue,
                    background: saving ? "#9ca3af" : "#16a34a",
                    cursor: saving ? "not-allowed" : "pointer",
                  }}
                >
                  {saving ? "Saving..." : `Save ${dirtyCount} Change${dirtyCount > 1 ? "s" : ""}`}
                </button>
              )}
            </div>
          </div>

          {/* Status message */}
          {status && !saving && (
            <div
              style={{
                marginBottom: 12,
                padding: "9px 14px",
                borderRadius: 8,
                background: statusType === "success" ? "#dcfce7" : "#fee2e2",
                color: statusType === "success" ? "#166534" : "#991b1b",
                fontSize: 13, fontWeight: 700, whiteSpace: "pre-wrap",
              }}
            >
              {status}
            </div>
          )}

          {/* Table */}
          {studentsLoading ? (
            <div style={{ padding: 24, color: "#6b7280" }}>Loading students...</div>
          ) : students.length === 0 ? (
            <div style={{ padding: 24, color: "#6b7280" }}>
              No students enrolled in this course yet.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <Th>Student No.</Th>
                    <Th>Name</Th>
                    <Th center>Prelim (30%)</Th>
                    <Th center>Midterm (30%)</Th>
                    <Th center>Final Exam (40%)</Th>
                    <Th center>Final Grade</Th>
                    <Th center>Remarks</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => {
                    const rc = remarkColor(s.final_grade);
                    return (
                      <tr
                        key={s.student_id}
                        style={{
                          borderBottom: "1px solid #f1f5f9",
                          background: s.dirty ? "#fffbeb" : "transparent",
                          transition: "background .15s",
                        }}
                      >
                        <Td>
                          <span style={{ fontWeight: 700 }}>{s.student_no || "—"}</span>
                        </Td>
                        <Td>
                          <div style={{ fontWeight: 800 }}>{s.full_name}</div>
                          <div style={{ fontSize: 11, color: "#9ca3af" }}>{s.email}</div>
                        </Td>
                        <Td center>
                          <GradeInput
                            value={s.prelim}
                            onChange={(v) => handleGradeChange(s.student_id, "prelim", v)}
                          />
                        </Td>
                        <Td center>
                          <GradeInput
                            value={s.midterm}
                            onChange={(v) => handleGradeChange(s.student_id, "midterm", v)}
                          />
                        </Td>
                        <Td center>
                          <GradeInput
                            value={s.final_exam}
                            onChange={(v) => handleGradeChange(s.student_id, "final_exam", v)}
                          />
                        </Td>
                        <Td center>
                          <span
                            style={{
                              fontWeight: 900,
                              fontSize: 15,
                              color:
                                s.final_grade == null
                                  ? "#9ca3af"
                                  : s.final_grade >= 75
                                  ? "#16a34a"
                                  : "#dc2626",
                            }}
                          >
                            {s.final_grade != null ? `${s.final_grade}%` : "—"}
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
                              background: rc.bg,
                              color: rc.color,
                            }}
                          >
                            {gradeRemark(s.final_grade)}
                          </span>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Formula note */}
          <div style={{ marginTop: 12, fontSize: 11, color: "#9ca3af" }}>
            Final Grade = (Prelim × 0.30) + (Midterm × 0.30) + (Final Exam × 0.40).
            Computed live as you type. Rows highlighted in yellow have unsaved changes.
          </div>
        </div>
      ) : (
        <div className="glassCard" style={{ padding: 40, textAlign: "center", color: "#6b7280", marginTop: 16 }}>
          Select a course above to view and manage student grades.
        </div>
      )}

      {/* ── Add Course Modal ── */}
      {showAddCourse && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,.32)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999,
          }}
        >
          <div
            style={{
              width: 400, background: "white", borderRadius: 14, padding: 24,
              boxShadow: "0 24px 48px rgba(0,0,0,.18)", position: "relative",
            }}
          >
            <button
              onClick={() => setShowAddCourse(false)}
              style={{
                position: "absolute", top: 14, right: 16,
                border: "none", background: "transparent",
                cursor: "pointer", fontSize: 18, opacity: 0.6,
              }}
            >
              ✕
            </button>

            <div style={{ fontWeight: 900, fontSize: 17, marginBottom: 18 }}>
              Add New Course
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Course Code *</label>
              <input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="e.g. IS 201"
                style={modalInput}
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Course Title *</label>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Data Structures and Algorithms"
                style={modalInput}
              />
            </div>

            {addCourseErr && (
              <div style={{ color: "#dc2626", fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
                {addCourseErr}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => setShowAddCourse(false)}
                style={btnGhost}
              >
                Cancel
              </button>
              <button onClick={addCourse} style={btnBlue}>
                Create Course
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function GradeInput({ value, onChange }) {
  return (
    <input
      type="number"
      min="0"
      max="100"
      step="0.01"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="—"
      style={{
        width: 76,
        padding: "6px 8px",
        borderRadius: 8,
        border: "1px solid #d1d5db",
        outline: "none",
        fontSize: 13,
        fontWeight: 700,
        textAlign: "center",
        background: "rgba(255,255,255,.9)",
        transition: "border-color .15s",
      }}
      onFocus={(e) => (e.target.style.borderColor = "#2f6fb3")}
      onBlur={(e) => (e.target.style.borderColor = "#d1d5db")}
    />
  );
}

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

function Td({ children, center }) {
  return (
    <td style={{ padding: "10px 12px", verticalAlign: "middle", textAlign: center ? "center" : "left" }}>
      {children}
    </td>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const btnBlue = {
  padding: "9px 18px",
  borderRadius: 10,
  border: "none",
  background: "var(--blue-main)",
  color: "white",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 13,
};

const btnGhost = {
  padding: "9px 18px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  background: "white",
  color: "#374151",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
};

const labelStyle = {
  display: "block",
  fontSize: 12,
  fontWeight: 800,
  color: "#374151",
  marginBottom: 4,
};

const modalInput = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  outline: "none",
  fontSize: 14,
  fontWeight: 600,
  boxSizing: "border-box",
};