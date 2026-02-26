"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";

function statusColor(status) {
  const s = String(status || "").toLowerCase();
  if (s === "submitted" || s === "graded" || s === "computed") return { bg: "#dcfce7", text: "#166534" };
  if (s === "absent" || s === "missing") return { bg: "#fee2e2", text: "#991b1b" };
  if (s === "upcoming" || s === "pending") return { bg: "#fef3c7", text: "#92400e" };
  return { bg: "#e5e7eb", text: "#374151" };
}

function formatShortDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
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
        (async () => {
          const withTs = await supabase
            .from("grades")
            .select("course_id, prelim, midterm, final_exam, final_grade, updated_at, courses(code, title)")
            .eq("student_id", user.id)
            .order("course_id", { ascending: true });
          if (!withTs.error) return withTs;
          return supabase
            .from("grades")
            .select("course_id, prelim, midterm, final_exam, final_grade, courses(code, title)")
            .eq("student_id", user.id)
            .order("course_id", { ascending: true });
        })(),
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
    const source = [...fromEnroll, ...fromGrades, ...fromClick];
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

    const rows = courseCatalog.flatMap((course) => {
      const g = gradeMap.get(course.code);
      const hasPrelim = g?.prelim != null;
      const hasMidterm = g?.midterm != null;
      const hasFinalExam = g?.final_exam != null;
      const rowDate = g?.updated_at || null;

      return [
        {
          date: rowDate,
          courseCode: course.code,
          courseTitle: course.title,
          type: "Prelim",
          item: "Prelim Grade",
          status: hasPrelim ? "Graded" : "Pending",
          score: hasPrelim ? `${Number(g.prelim).toFixed(2)}%` : "-",
          note: hasPrelim ? "Score entered by teacher" : "Waiting for teacher entry",
        },
        {
          date: rowDate,
          courseCode: course.code,
          courseTitle: course.title,
          type: "Midterm",
          item: "Midterm Grade",
          status: hasMidterm ? "Graded" : "Pending",
          score: hasMidterm ? `${Number(g.midterm).toFixed(2)}%` : "-",
          note: hasMidterm ? "Score entered by teacher" : "Waiting for teacher entry",
        },
        {
          date: rowDate,
          courseCode: course.code,
          courseTitle: course.title,
          type: "Final Exam",
          item: "Final Exam Grade",
          status: hasFinalExam ? "Graded" : "Pending",
          score: hasFinalExam ? `${Number(g.final_exam).toFixed(2)}%` : "-",
          note: hasFinalExam ? "Score entered by teacher" : "Waiting for teacher entry",
        },
        {
          date: rowDate,
          courseCode: course.code,
          courseTitle: course.title,
          type: "Final Grade",
          item: "Computed Final Grade",
          status: hasPrelim || hasMidterm || hasFinalExam ? "Computed" : "Pending",
          score:
            hasPrelim || hasMidterm || hasFinalExam
              ? `${(Number(g?.prelim ?? 0) * 0.3 + Number(g?.midterm ?? 0) * 0.3 + Number(g?.final_exam ?? 0) * 0.4).toFixed(2)}%`
              : "-",
          note: hasPrelim || hasMidterm || hasFinalExam ? "Based on Grade Entry formula" : "No component grades yet",
        },
      ];
    });
    return rows.sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      if (db !== da) return db - da;
      return String(a.courseCode).localeCompare(String(b.courseCode));
    });
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
    const finals = scopedGrades
      .map((g) => Number(g?.prelim ?? 0) * 0.3 + Number(g?.midterm ?? 0) * 0.3 + Number(g?.final_exam ?? 0) * 0.4)
      .filter((x) => Number.isFinite(x) && x > 0);
    const avgFinal = finals.length ? (finals.reduce((a, b) => a + b, 0) / finals.length).toFixed(2) : "0.00";
    const componentRows = scopedFeed.filter((x) => x.type !== "Final Grade");
    const gradedEntries = componentRows.filter((x) => String(x.status).toLowerCase() === "graded").length;
    const pendingEntries = componentRows.filter((x) => String(x.status).toLowerCase() === "pending").length;
    const computedFinals = scopedFeed.filter((x) => x.type === "Final Grade" && x.score !== "-").length;

    return { avgFinal, gradedEntries, pendingEntries, computedFinals };
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
              : "Track teacher-entered prelim, midterm, and final exam scores."}
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
          <div className="label">Graded Entries</div>
          <div className="value">{summary.gradedEntries}</div>
        </div>
        <div className="perf-card">
          <div className="label">Pending Entries</div>
          <div className="value">{summary.pendingEntries}</div>
        </div>
        <div className="perf-card">
          <div className="label">Computed Finals</div>
          <div className="value">{summary.computedFinals}</div>
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
              <option value="Prelim">Prelim</option>
              <option value="Midterm">Midterm</option>
              <option value="Final Exam">Final Exam</option>
              <option value="Final Grade">Final Grade</option>
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
