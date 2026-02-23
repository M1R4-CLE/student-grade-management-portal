"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { useRouter } from "next/navigation";

function computeFinal(prelim, midterm, finalExam) {
  const result = prelim * 0.3 + midterm * 0.3 + finalExam * 0.4;
  return Math.round(result * 100) / 100;
}

function getRemark(score) {
  if (score >= 90) return { letter: "A", color: "#4CAF7A" };
  if (score >= 85) return { letter: "B", color: "#66BB6A" };
  if (score >= 80) return { letter: "C", color: "#F0B44C" };
  if (score >= 75) return { letter: "D", color: "#FF8A65" };
  return { letter: "F", color: "#E57373" };
}

export default function GradeEntryPage() {
  const router = useRouter();

  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState("");
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  useEffect(() => {
    async function loadCourses() {
      setLoadingCourses(true);
      setMessage("");

      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) {
        setMessage(userErr.message);
        setLoadingCourses(false);
        return;
      }

      const user = userRes.user;
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!profile || profile.role !== "teacher") {
        router.replace("/student/Dashboard");
        return;
      }

      const { data, error } = await supabase
        .from("courses")
        .select("id, code, title")
        .eq("teacher_id", user.id);

      if (error) {
        setMessage(error.message);
        setCourses([]);
      } else {
        setCourses(data || []);
      }

      setLoadingCourses(false);
    }

    loadCourses();
  }, [router]);

  useEffect(() => {
    if (!courseId) return;

    async function loadStudents() {
      setLoadingStudents(true);
      setMessage("");
      setSelectedStudent(null);

      const { data: enrollData, error } = await supabase
        .from("enrollments")
        .select("student_id, profiles(full_name)")
        .eq("course_id", courseId);

      if (error) {
        setMessage(error.message);
        setRows([]);
        setLoadingStudents(false);
        return;
      }

      const { data: gradesData } = await supabase
        .from("grades")
        .select("student_id, prelim, midterm, final_exam, final_grade")
        .eq("course_id", courseId);

      const gradeMap = new Map();
      (gradesData || []).forEach((g) => gradeMap.set(g.student_id, g));

      const formatted = (enrollData || []).map((s) => {
        const existing = gradeMap.get(s.student_id);

        const prelim = Number(existing?.prelim || 0);
        const midterm = Number(existing?.midterm || 0);
        const final_exam = Number(existing?.final_exam || 0);

        const final_grade =
          existing?.final_grade != null
            ? Number(existing.final_grade)
            : computeFinal(prelim, midterm, final_exam);

        return {
          student_id: s.student_id,
          full_name: s.profiles?.full_name || "Unnamed",
          prelim,
          midterm,
          final_exam,
          final_grade,
        };
      });

      setRows(formatted);
      setLoadingStudents(false);
    }

    loadStudents();
  }, [courseId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, courseId]);

  const handleChange = (id, field, value) => {
    const safeValue = Number.isNaN(value) ? 0 : Math.max(0, Math.min(100, value));

    setRows((prev) =>
      prev.map((r) => {
        if (r.student_id !== id) return r;
        const updated = { ...r, [field]: safeValue };
        updated.final_grade = computeFinal(updated.prelim, updated.midterm, updated.final_exam);
        return updated;
      })
    );
  };

  const saveGrades = async () => {
    if (!courseId) {
      setMessage("Please select a course first.");
      return;
    }

    if (!rows.length) {
      setMessage("No students to save.");
      return;
    }

    setSaving(true);
    setMessage("Saving...");

    const payload = rows.map((r) => ({
      course_id: Number(courseId),
      student_id: r.student_id,
      prelim: Number(r.prelim),
      midterm: Number(r.midterm),
      final_exam: Number(r.final_exam),
    }));

    const { error } = await supabase
      .from("grades")
      .upsert(payload, { onConflict: "course_id,student_id" });

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    const { data: gradesData } = await supabase
      .from("grades")
      .select("student_id, prelim, midterm, final_exam, final_grade")
      .eq("course_id", courseId);

    if (gradesData) {
      const gradeMap = new Map();
      gradesData.forEach((g) => gradeMap.set(g.student_id, g));

      setRows((prev) =>
        prev.map((r) => {
          const dbRow = gradeMap.get(r.student_id);
          if (!dbRow) return r;

          return {
            ...r,
            prelim: Number(dbRow.prelim ?? 0),
            midterm: Number(dbRow.midterm ?? 0),
            final_exam: Number(dbRow.final_exam ?? 0),
            final_grade: Number(dbRow.final_grade ?? 0),
          };
        })
      );
    }

    setMessage("Grades saved successfully!");
    setSaving(false);
  };

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        String(r.student_id).toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totalCount = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const visibleRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, safePage]);

  const pageStart = totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const pageEnd = Math.min(safePage * pageSize, totalCount);

  return (
    <div style={{ padding: 20, background: "#f4f6fb", minHeight: "100%" }}>
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          padding: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1, minWidth: 300 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student name or student ID..."
              style={{
                flex: 1,
                height: 40,
                borderRadius: 10,
                border: "1px solid #d9deea",
                padding: "0 12px",
                background: "#f8f9fd",
                outline: "none",
                fontSize: 14,
              }}
            />

            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              disabled={loadingCourses}
              style={{
                height: 40,
                minWidth: 220,
                borderRadius: 10,
                border: "1px solid #d9deea",
                padding: "0 10px",
                background: "#fff",
                fontSize: 14,
              }}
            >
              <option value="">
                {loadingCourses ? "Loading courses..." : "Select Course"}
              </option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} - {c.title}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              style={{
                border: "1px solid #e0e5f0",
                background: "#f7f8fc",
                color: "#40485a",
                borderRadius: 10,
                height: 36,
                padding: "0 14px",
                cursor: "pointer",
              }}
            >
              Message Students
            </button>

            <button
              type="button"
              style={{
                border: "1px solid #e0e5f0",
                background: "#f7f8fc",
                color: "#40485a",
                borderRadius: 10,
                height: 36,
                padding: "0 14px",
                cursor: "pointer",
              }}
            >
              Import Grades
            </button>

            <button
              onClick={saveGrades}
              disabled={saving || !courseId || rows.length === 0}
              style={{
                border: "none",
                background: saving || !courseId || rows.length === 0 ? "#9bcaa8" : "#59b177",
                color: "#fff",
                borderRadius: 10,
                height: 36,
                padding: "0 16px",
                cursor: saving || !courseId || rows.length === 0 ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              {saving ? "Saving..." : "Save Grades"}
            </button>
          </div>
        </div>

        {message && (
          <div
            style={{
              marginBottom: 10,
              background: "#f7f9ff",
              border: "1px solid #dbe4ff",
              color: "#2f3a58",
              borderRadius: 10,
              padding: "8px 10px",
              fontSize: 13,
            }}
          >
            {message}
          </div>
        )}

        {!courseId ? (
          <div style={{ padding: 16, color: "#5b647a" }}>Select a course to load students.</div>
        ) : loadingStudents ? (
          <div style={{ padding: 16, color: "#5b647a" }}>Loading students...</div>
        ) : (
          <>
            <div style={{ overflowX: "auto", border: "1px solid #e6ebf3", borderRadius: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                <thead>
                  <tr style={{ background: "#f7f9fc", color: "#44506a" }}>
                    <th style={thStyle}>Attendee</th>
                    <th style={thStyle}>Quiz1 (30)</th>
                    <th style={thStyle}>Homework (30)</th>
                    <th style={thStyle}>Midterm (40)</th>
                    <th style={thStyle}>Finals</th>
                    <th style={thStyle}>Average Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r) => {
                    const remark = getRemark(r.final_grade);
                    return (
                      <tr
                        key={r.student_id}
                        onClick={() => setSelectedStudent(r)}
                        style={{
                          borderTop: "1px solid #edf1f7",
                          cursor: "pointer",
                          background:
                            selectedStudent?.student_id === r.student_id ? "#f5f9ff" : "#fff",
                        }}
                      >
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 600, color: "#2c3448" }}>{r.full_name}</div>
                          <div style={{ fontSize: 12, color: "#7a849d" }}>ID: {r.student_id}</div>
                        </td>

                        <td style={tdStyle}>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={r.prelim}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              handleChange(r.student_id, "prelim", Number(e.target.value))
                            }
                            style={scoreInputStyle}
                          />
                        </td>

                        <td style={tdStyle}>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={r.midterm}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              handleChange(r.student_id, "midterm", Number(e.target.value))
                            }
                            style={scoreInputStyle}
                          />
                        </td>

                        <td style={tdStyle}>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={r.final_exam}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              handleChange(r.student_id, "final_exam", Number(e.target.value))
                            }
                            style={scoreInputStyle}
                          />
                        </td>

                        <td style={{ ...tdStyle, fontWeight: 700, color: "#2f3a55" }}>
                          {r.final_grade.toFixed(2)}%
                        </td>

                        <td style={tdStyle}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 8,
                              background: remark.color,
                              color: "#fff",
                              borderRadius: 20,
                              padding: "6px 12px",
                              fontWeight: 700,
                            }}
                          >
                            {remark.letter} {Math.round(r.final_grade)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div
              style={{
                marginTop: 10,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                color: "#5f6c86",
                fontSize: 13,
              }}
            >
              <div>
                {pageStart}-{pageEnd} of {totalCount}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  style={pagerBtnStyle(safePage === 1)}
                >
                  ◀
                </button>
                <div style={{ minWidth: 74, textAlign: "center", paddingTop: 6 }}>
                  {safePage} / {totalPages}
                </div>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  style={pagerBtnStyle(safePage === totalPages)}
                >
                  ▶
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div
        style={{
          marginTop: 14,
          background: "#fff",
          borderRadius: 14,
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          minHeight: 200,
          padding: 16,
        }}
      >
        {selectedStudent ? (
          <>
            <h3 style={{ margin: "0 0 8px", color: "#2d3650" }}>
              Student Performance Profile
            </h3>
            <div style={{ color: "#4d5875", marginBottom: 10 }}>
              {selectedStudent.full_name} (ID: {selectedStudent.student_id})
            </div>
            <div
              style={{
                border: "1px dashed #cfd7e6",
                borderRadius: 12,
                minHeight: 120,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#7a849d",
                background: "#fafcff",
              }}
            >
              Blank space for Attendance, Quizzes, Exams, Activities, and other performance data.
            </div>
          </>
        ) : (
          <div style={{ color: "#6f7992" }}>
            Click a student row to open a blank performance profile space.
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle = {
  textAlign: "left",
  padding: "12px 12px",
  fontSize: 14,
  fontWeight: 600,
  borderBottom: "1px solid #e6ebf3",
};

const tdStyle = {
  padding: "10px 12px",
  fontSize: 15,
};

const scoreInputStyle = {
  width: 90,
  height: 34,
  borderRadius: 8,
  border: "1px solid #d8deea",
  background: "#fff",
  padding: "0 8px",
  outline: "none",
  fontSize: 15,
};

const pagerBtnStyle = (disabled) => ({
  width: 32,
  height: 32,
  borderRadius: 8,
  border: "1px solid #d7deeb",
  background: disabled ? "#f2f4f8" : "#fff",
  color: disabled ? "#a7b0c3" : "#4d5873",
  cursor: disabled ? "not-allowed" : "pointer",
});