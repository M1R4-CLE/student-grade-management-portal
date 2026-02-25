"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";

const seedCourses = [
  { code: "IS 201", title: "Data Structures and Algorithms" },
  { code: "IS 202", title: "Database Management Systems" },
  { code: "IS 203", title: "Systems Analysis and Design" },
  { code: "IS 204", title: "Object-Oriented Programming" },
  { code: "IS 205", title: "Professional Ethics in IT" },
  { code: "IS 206", title: "Quantitative Methods / Statistics" },
  { code: "IS 207", title: "Web Development" },
  { code: "IS 208", title: "Human-Computer Interaction" },
  { code: "IS 209", title: "Software Engineering" },
];

function statusColor(status) {
  const s = String(status || "").toLowerCase();
  if (s === "present" || s === "submitted" || s === "graded") return { bg: "#dcfce7", text: "#166534" };
  if (s === "absent" || s === "missing") return { bg: "#fee2e2", text: "#991b1b" };
  if (s === "upcoming" || s === "pending") return { bg: "#fef3c7", text: "#92400e" };
  return { bg: "#e5e7eb", text: "#374151" };
}

function formatShortDate(value) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function shiftIsoDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export default function GradesPage() {
  const params = useSearchParams();
  const clickedCode = String(params.get("course") || "").trim();
  const clickedTitle = String(params.get("title") || "").trim();

  const [grades, setGrades] = useState([]);
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [courseFilter, setCourseFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErr("");

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;

      if (!user) {
        setErr("Not logged in.");
        setLoading(false);
        return;
      }

      const [gradesRes, enrollRes] = await Promise.all([
        supabase
          .from("grades")
          .select("prelim, midterm, final_exam, final_grade, courses(code, title)")
          .eq("student_id", user.id)
          .order("course_id", { ascending: true }),
        supabase
          .from("enrollments")
          .select("course_id, courses(code, title)")
          .eq("student_id", user.id),
      ]);

      if (gradesRes.error) setErr(gradesRes.error.message);
      else setGrades(gradesRes.data || []);

      if (enrollRes.error) {
        if (!gradesRes.error) setErr(enrollRes.error.message);
      } else {
        setEnrolledCourses((enrollRes.data || []).map((r) => r.courses).filter(Boolean));
      }

      setLoading(false);
    };

    load();
  }, []);

  useEffect(() => {
    if (clickedCode) setCourseFilter(clickedCode);
  }, [clickedCode]);

  const courseCatalog = useMemo(() => {
    const fromGrades = grades
      .map((g) => ({ code: String(g?.courses?.code || "").trim(), title: String(g?.courses?.title || "").trim() }))
      .filter((x) => x.code);
    const fromEnroll = enrolledCourses
      .map((c) => ({ code: String(c?.code || "").trim(), title: String(c?.title || "").trim() }))
      .filter((x) => x.code);
    const fromClick = clickedCode ? [{ code: clickedCode, title: clickedTitle || clickedCode }] : [];
    const source = [...seedCourses, ...fromEnroll, ...fromGrades, ...fromClick];
    const seen = new Set();
    return source.filter((x) => {
      const k = x.code.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [grades, enrolledCourses, clickedCode, clickedTitle]);

  const performanceFeed = useMemo(() => {
    const gradeMap = new Map(
      grades.map((g) => [String(g?.courses?.code || "").trim(), g])
    );

    const rows = courseCatalog.flatMap((course, idx) => {
      const g = gradeMap.get(course.code);
      const prelim = Number(g?.prelim ?? 0);
      const midterm = Number(g?.midterm ?? 0);
      const finalExam = Number(g?.final_exam ?? 0);
      const hasFinal = Number(g?.final_grade ?? 0) > 0;

      const att = hasFinal ? "Present" : "Pending";
      const quiz = prelim > 0 ? "Graded" : "Missing";
      const activity = midterm > 0 ? "Submitted" : "Pending";
      const exam = finalExam > 0 ? "Graded" : "Upcoming";

      return [
        {
          date: shiftIsoDate(-4 + (idx % 2)),
          courseCode: course.code,
          courseTitle: course.title,
          type: "Attendance",
          item: "Class Meeting",
          status: att,
          score: "-",
          note: att === "Present" ? "Attendance inferred from graded standing" : "No attendance record yet",
        },
        {
          date: shiftIsoDate(-3 + (idx % 2)),
          courseCode: course.code,
          courseTitle: course.title,
          type: "Quiz",
          item: "Prelim Quiz",
          status: quiz,
          score: quiz === "Graded" ? `${prelim}%` : "-",
          note: quiz === "Missing" ? "No submission recorded" : "Score posted by teacher",
        },
        {
          date: shiftIsoDate(-2 + (idx % 2)),
          courseCode: course.code,
          courseTitle: course.title,
          type: "Activity",
          item: "Midterm Activity",
          status: activity,
          score: activity === "Submitted" ? `${midterm}%` : "-",
          note: activity === "Submitted" ? "Submitted before deadline" : "Waiting for submission",
        },
        {
          date: shiftIsoDate(-1 + (idx % 2)),
          courseCode: course.code,
          courseTitle: course.title,
          type: "Exam",
          item: "Final Exam",
          status: exam,
          score: exam === "Graded" ? `${finalExam}%` : "-",
          note: exam === "Graded" ? "Exam score recorded" : "Scheduled by teacher",
        },
      ];
    });
    return rows.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [courseCatalog, grades]);

  const scopedFeed = useMemo(() => {
    if (courseFilter === "ALL") return performanceFeed;
    return performanceFeed.filter((x) => x.courseCode === courseFilter);
  }, [performanceFeed, courseFilter]);

  const filteredFeed = useMemo(
    () => scopedFeed.filter((x) => (typeFilter === "ALL" ? true : x.type === typeFilter)),
    [scopedFeed, typeFilter]
  );

  const selectedCourse = useMemo(() => {
    if (courseFilter === "ALL") return null;
    return courseCatalog.find((x) => x.code === courseFilter) || { code: clickedCode, title: clickedTitle || clickedCode };
  }, [courseCatalog, courseFilter, clickedCode, clickedTitle]);

  const summary = useMemo(() => {
    const scopedGrades =
      courseFilter === "ALL" ? grades : grades.filter((g) => String(g?.courses?.code || "").trim() === courseFilter);
    const finals = scopedGrades.map((g) => Number(g?.final_grade ?? 0)).filter((x) => Number.isFinite(x) && x > 0);
    const avgFinal = finals.length ? (finals.reduce((a, b) => a + b, 0) / finals.length).toFixed(2) : "0.00";

    const attendanceRows = scopedFeed.filter((x) => x.type === "Attendance");
    const present = attendanceRows.filter((x) => String(x.status).toLowerCase() === "present").length;
    const attendancePct = attendanceRows.length ? Math.round((present / attendanceRows.length) * 100) : 0;
    const quizzesDone = scopedFeed.filter((x) => x.type === "Quiz" && String(x.status).toLowerCase() === "graded").length;
    const missingItems = scopedFeed.filter((x) => {
      const s = String(x.status).toLowerCase();
      return s === "missing" || s === "absent";
    }).length;

    return { avgFinal, attendancePct, quizzesDone, missingItems };
  }, [grades, scopedFeed, courseFilter]);

  if (loading) return <div style={{ padding: 12 }}>Loading...</div>;
  if (err) return <div style={{ padding: 12, color: "#b91c1c" }}>{err}</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.15, color: "#111827" }}>Academic Performance</h1>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>
            {selectedCourse
              ? `Showing stats for ${selectedCourse.code} - ${selectedCourse.title}`
              : "Track attendance, quizzes, activities, and exams with date-based status."}
          </p>
        </div>
        <div style={{ color: "#4b5563", fontSize: 12 }}>
          Last updated:{" "}
          {new Date().toLocaleString("en-US", {
            month: "short",
            day: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>

      <div className="perf-cards">
        <div className="perf-card">
          <div className="label">Average Final Grade</div>
          <div className="value">{summary.avgFinal}%</div>
        </div>
        <div className="perf-card">
          <div className="label">Attendance</div>
          <div className="value">{summary.attendancePct}%</div>
        </div>
        <div className="perf-card">
          <div className="label">Completed Quizzes</div>
          <div className="value">{summary.quizzesDone}</div>
        </div>
        <div className="perf-card">
          <div className="label">Alerts (Absent/Missing)</div>
          <div className="value">{summary.missingItems}</div>
        </div>
      </div>

      <div style={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 14, background: "rgba(255,255,255,0.9)", padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <div style={{ fontWeight: 800, color: "#111827" }}>
            {selectedCourse ? `${selectedCourse.title} Timeline` : "Performance Timeline"}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="filter-pill">
              <option value="ALL">All Courses</option>
              {courseCatalog.map((course) => (
                <option key={course.code} value={course.code}>
                  {course.code} - {course.title}
                </option>
              ))}
            </select>

            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="filter-pill">
              <option value="ALL">All Types</option>
              <option value="Attendance">Attendance</option>
              <option value="Quiz">Quiz</option>
              <option value="Activity">Activity</option>
              <option value="Exam">Exam</option>
            </select>
          </div>
        </div>

        {!filteredFeed.length ? (
          <div style={{ padding: "16px 8px", color: "#6b7280" }}>No records for this filter.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="perf-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Course</th>
                  <th>Type</th>
                  <th>Item</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {filteredFeed.map((row, i) => {
                  const color = statusColor(row.status);
                  return (
                    <tr key={`${row.courseCode}-${row.type}-${i}`}>
                      <td>{formatShortDate(row.date)}</td>
                      <td>{row.courseCode}</td>
                      <td>{row.type}</td>
                      <td>{row.item}</td>
                      <td>
                        <span
                          style={{
                            background: color.bg,
                            color: color.text,
                            borderRadius: 999,
                            padding: "4px 10px",
                            fontWeight: 700,
                            fontSize: 12,
                            display: "inline-block",
                          }}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td>{row.score}</td>
                      <td>{row.note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style jsx>{`
        .perf-cards {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }
        .perf-card {
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.9);
          padding: 12px;
        }
        .perf-card .label {
          font-size: 12px;
          color: #6b7280;
          font-weight: 700;
        }
        .perf-card .value {
          margin-top: 4px;
          font-size: 28px;
          line-height: 1.1;
          color: #111827;
          font-weight: 900;
        }
        .filter-pill {
          min-height: 34px;
          border-radius: 999px;
          border: 1px solid rgba(0, 0, 0, 0.1);
          padding: 0 12px;
          background: #fff;
          color: #374151;
          font-size: 12px;
          max-width: 240px;
        }
        .perf-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .perf-table th {
          text-align: left;
          color: #6b7280;
          font-weight: 700;
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
          padding: 10px 8px;
          white-space: nowrap;
        }
        .perf-table td {
          color: #1f2937;
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
          padding: 10px 8px;
          vertical-align: top;
        }
        @media (max-width: 1100px) {
          .perf-cards {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 640px) {
          .perf-cards {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
