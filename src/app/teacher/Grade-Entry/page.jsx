"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";

function computeFinal(prelim, midterm, finalExam) {
  const result = prelim * 0.3 + midterm * 0.3 + finalExam * 0.4;
  return Math.round(result * 100) / 100;
}

export default function GradeEntryPage() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState("");
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load teacher courses
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
        setMessage("Please login first.");
        setLoadingCourses(false);
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
  }, []);

  // Load enrolled students
  useEffect(() => {
    if (!courseId) {
      setRows([]);
      return;
    }

    async function loadStudents() {
      setLoadingStudents(true);
      setMessage("");

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
      (gradesData || []).forEach(g => gradeMap.set(g.student_id, g));

      const formatted = (enrollData || []).map(s => {
        const existing = gradeMap.get(s.student_id);

        const prelim = Number(existing?.prelim || 0);
        const midterm = Number(existing?.midterm || 0);
        const final_exam = Number(existing?.final_exam || 0);
        const final_grade = existing?.final_grade != null
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

  const handleChange = (id, field, value) => {
    setRows(prev =>
      prev.map(r => {
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

    const payload = rows.map(r => ({
      course_id: Number(courseId),
      student_id: r.student_id,
      prelim: Number(r.prelim),
      midterm: Number(r.midterm),
      final_exam: Number(r.final_exam),
      final_grade: Number(r.final_grade),
    }));

    const { error } = await supabase
      .from("grades")
      .upsert(payload, { onConflict: "course_id,student_id" });

    setMessage(error ? error.message : "Grades saved successfully!");
    setSaving(false);
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Grade Entry</h1>

      <div style={{ marginBottom: 12 }}>
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          disabled={loadingCourses}
        >
          <option value="">
            {loadingCourses ? "Loading courses..." : "Select Course"}
          </option>

          {courses.map(c => (
            <option key={c.id} value={c.id}>
              {c.code} - {c.title}
            </option>
          ))}
        </select>

        <button
          onClick={saveGrades}
          disabled={saving || !courseId || rows.length === 0}
          style={{ marginLeft: 10 }}
        >
          {saving ? "Saving..." : "Save Grades"}
        </button>
      </div>

      {message && <p>{message}</p>}

      {loadingStudents ? (
        <p>Loading students...</p>
      ) : rows.length === 0 ? (
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
            {rows.map(r => (
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

                <td><b>{r.final_grade}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}