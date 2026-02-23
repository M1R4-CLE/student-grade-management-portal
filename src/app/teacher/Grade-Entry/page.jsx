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

        const updated = { ...r, [field]: value };
        updated.final_grade = computeFinal(
          updated.prelim,
          updated.midterm,
          updated.final_exam
        );

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


  return (
    <div style={{ padding: 24 }}>
      <h1>Grade Entry</h1>

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

      {message && <p>{message}</p>}

      {loadingStudents && courseId ? (
        <p>Loading students...</p>
      ) : visibleRows.length === 0 ? (
        <p>Select a course to load students.</p>
      ) : (
        <table border={1} cellPadding={8}>
          <thead>
            <tr>
              <th>Student</th>
              <th>Prelim</th>
              <th>Midterm</th>
              <th>Final Exam</th>
              <th>Final Grade</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => (
              <tr key={r.student_id}>
                <td>{r.full_name}</td>

                <td>
                  <input
                    type="number"
                    value={r.prelim}
                    onChange={(e) =>
                      handleChange(r.student_id, "prelim", Number(e.target.value))
                    }
                  />
                </td>

                <td>
                  <input
                    type="number"
                    value={r.midterm}
                    onChange={(e) =>
                      handleChange(r.student_id, "midterm", Number(e.target.value))
                    }
                  />
                </td>

                <td>
                  <input
                    type="number"
                    value={r.final_exam}
                    onChange={(e) =>
                      handleChange(r.student_id, "final_exam", Number(e.target.value))
                    }
                  />
                </td>

                <td>
                  <b>{r.final_grade}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
