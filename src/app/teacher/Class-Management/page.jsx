"use client";

// ============================================================
// FILE: src/app/teacher/ClassManagement/page.jsx
// ============================================================

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";

function getCourseImg(title = "") {
  const t = title.toLowerCase();
  if (t.includes("data struct") || t.includes("algorithm")) return "/images/dsa.jpg";
  if (t.includes("database") || t.includes("dbms")) return "/images/dms.jpg";
  if (t.includes("systems analysis") || t.includes("sad")) return "/images/sad.jpg";
  if (t.includes("object") || t.includes("oop")) return "/images/oop.jpg";
  if (t.includes("ethics")) return "/images/ethics.jpg";
  if (t.includes("quantitative") || t.includes("statistic")) return "/images/qms.jpg";
  if (t.includes("web")) return "/images/wed.jpg";
  if (t.includes("human") || t.includes("hci")) return "/images/hci.jpg";
  if (t.includes("software")) return "/images/soe.jpg";
  return "/images/dsa.jpg";
}

const PAGE_SIZE = 4;

export default function TeacherClassManagementPage() {
  const router = useRouter();

  const [loading, setLoading]       = useState(true);
  const [teacherId, setTeacherId]   = useState(null);

  // Courses
  const [courses, setCourses]       = useState([]);
  const [page, setPage]             = useState(1);

  // Add-course form
  const [newCode, setNewCode]       = useState("");
  const [newTitle, setNewTitle]     = useState("");
  const [addErr, setAddErr]         = useState("");
  const [addBusy, setAddBusy]       = useState(false);

  // Selected course + roster
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [roster, setRoster]                 = useState([]);
  const [rosterLoading, setRosterLoading]   = useState(false);

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
      await fetchCourses(user.id);
      setLoading(false);
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // ── Fetch courses ───────────────────────────────────────────
  const fetchCourses = useCallback(async (tid) => {
    const id = tid || teacherId;
    if (!id) return;
    const { data } = await supabase
      .from("courses")
      .select("id, code, title")
      .eq("teacher_id", id)
      .order("id", { ascending: true });
    setCourses(data || []);
  }, [teacherId]);

  // ── Add course ──────────────────────────────────────────────
  const handleAddCourse = async () => {
    const code  = newCode.trim();
    const title = newTitle.trim();
    if (!code || !title) { setAddErr("Please fill in both Course Code and Course Title."); return; }
    if (!teacherId) return;

    setAddBusy(true);
    setAddErr("");

    const { error } = await supabase
      .from("courses")
      .insert({ code, title, teacher_id: teacherId });

    if (error) {
      setAddErr(
        error.message.includes("duplicate") || error.message.includes("unique")
          ? "A course with that code already exists."
          : error.message
      );
    } else {
      setNewCode("");
      setNewTitle("");
      await fetchCourses();
    }
    setAddBusy(false);
  };

  // ── Load roster ─────────────────────────────────────────────
  const loadRoster = async (course) => {
    if (selectedCourse?.id === course.id) {
      setSelectedCourse(null);
      setRoster([]);
      return;
    }
    setSelectedCourse(course);
    setRosterLoading(true);
    setRoster([]);

    const { data, error } = await supabase
      .from("enrollments")
      .select(`
        id, enrolled_at,
        profiles!enrollments_student_id_fkey(id, full_name, student_no, email)
      `)
      .eq("course_id", course.id)
      .order("enrolled_at", { ascending: true });

    if (!error) {
      setRoster(
        (data || []).map(e => ({
          enrollId:   e.id,
          studentId:  e.profiles?.id,
          name:       e.profiles?.full_name  || "—",
          studentNo:  e.profiles?.student_no || "—",
          email:      e.profiles?.email      || "—",
          enrolledAt: new Date(e.enrolled_at).toLocaleDateString(),
        }))
      );
    }
    setRosterLoading(false);
  };

  // ── Pagination ──────────────────────────────────────────────
  const totalPages     = Math.max(1, Math.ceil(courses.length / PAGE_SIZE));
  const visibleCourses = courses.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading) return <div style={{ padding: 40 }}>Loading Class Management…</div>;

  // ── Render ──────────────────────────────────────────────────
  return (
    <div style={{ width: "100%" }}>

      {/* Title */}
      <h1 style={{ fontWeight: 900, fontSize: 26, marginBottom: 20, color: "#111827" }}>
        Class Management
      </h1>

      {/* Add Course Bar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 24, flexWrap: "wrap" }}>
        <input
          value={newCode}
          onChange={e => { setNewCode(e.target.value); setAddErr(""); }}
          placeholder="Course Code (e.g., IT101)"
          style={inputStyle}
          maxLength={20}
        />
        <input
          value={newTitle}
          onChange={e => { setNewTitle(e.target.value); setAddErr(""); }}
          placeholder="Course Title (e.g., Programming 1)"
          style={{ ...inputStyle, minWidth: 220 }}
          maxLength={80}
          onKeyDown={e => e.key === "Enter" && handleAddCourse()}
        />
        <button onClick={handleAddCourse} disabled={addBusy} style={addBtn}>
          {addBusy ? "Adding…" : "Add Course"}
        </button>
        {addErr && (
          <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 700 }}>{addErr}</span>
        )}
      </div>

      {/* Course Cards */}
      <div style={sectionCard}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16, color: "#111827" }}>
          Select Course
        </div>

        {courses.length === 0 ? (
          <div style={{ color: "#6b7280", fontSize: 14, padding: "20px 0" }}>
            No courses yet. Add your first course above.
          </div>
        ) : (
          <>
            {/* Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 18,
              }}
            >
              {visibleCourses.map(c => {
                const active = selectedCourse?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => loadRoster(c)}
                    style={{
                      cursor: "pointer",
                      borderRadius: 12,
                      overflow: "hidden",
                      border: active ? "2px solid #2f6fb3" : "2px solid transparent",
                      boxShadow: active
                        ? "0 6px 20px rgba(47,111,179,0.25)"
                        : "0 4px 12px rgba(0,0,0,0.10)",
                      background: "white",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
                  >
                    {/* Book cover */}
                    <div style={{ height: 200, overflow: "hidden" }}>
                      <img
                        src={getCourseImg(c.title)}
                        alt={c.title}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    </div>
                    {/* Info below cover */}
                    <div style={{ padding: "10px 12px 12px" }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: "#111827", lineHeight: 1.3 }}>
                        {c.title}
                      </div>
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3, fontWeight: 600 }}>
                        Class Code: {c.code}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 18 }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={pageBtn}
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setPage(i + 1)}
                  style={{
                    ...pageBtn,
                    background: page === i + 1 ? "#2f6fb3" : "white",
                    color:      page === i + 1 ? "white"   : "#374151",
                    fontWeight: page === i + 1 ? 800       : 600,
                  }}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={pageBtn}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>

      {/* Roster */}
      <div style={{ ...sectionCard, marginTop: 18, minHeight: 60 }}>
        {!selectedCourse ? (
          <div style={{ color: "#6b7280", fontSize: 13 }}>
            Select a course above to view the roster list.
          </div>
        ) : rosterLoading ? (
          <div style={{ color: "#6b7280", fontSize: 13 }}>Loading roster…</div>
        ) : (
          <>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>
              Roster —{" "}
              <span style={{ color: "#2f6fb3" }}>{selectedCourse.title}</span>{" "}
              <span style={{ fontWeight: 600, color: "#6b7280", fontSize: 13 }}>
                ({selectedCourse.code})
              </span>
            </div>

            {roster.length === 0 ? (
              <div style={{ color: "#6b7280", fontSize: 13 }}>
                No students enrolled in this course yet.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {["#", "Student No.", "Full Name", "Email", "Enrolled"].map(h => (
                        <th key={h} style={th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((s, i) => (
                      <tr key={s.enrollId} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={td}>{i + 1}</td>
                        <td style={{ ...td, fontWeight: 700, color: "#2f6fb3" }}>{s.studentNo}</td>
                        <td style={td}>{s.name}</td>
                        <td style={{ ...td, color: "#6b7280" }}>{s.email}</td>
                        <td style={{ ...td, color: "#6b7280" }}>{s.enrolledAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────
const sectionCard = {
  background:    "rgba(255,255,255,0.75)",
  border:        "1px solid rgba(0,0,0,0.08)",
  borderRadius:  16,
  padding:       20,
  boxShadow:     "0 8px 20px rgba(0,0,0,0.06)",
};

const inputStyle = {
  height:       40,
  padding:      "0 12px",
  borderRadius: 8,
  border:       "1px solid rgba(0,0,0,0.15)",
  background:   "white",
  fontSize:     13,
  outline:      "none",
  minWidth:     160,
};

const addBtn = {
  height:       40,
  padding:      "0 18px",
  borderRadius: 8,
  border:       "none",
  background:   "#2f6fb3",
  color:        "white",
  fontWeight:   800,
  fontSize:     13,
  cursor:       "pointer",
};

const pageBtn = {
  height:    34,
  minWidth:  34,
  padding:   "0 10px",
  borderRadius: 8,
  border:    "1px solid #d1d5db",
  background:"white",
  color:     "#374151",
  fontSize:  13,
  cursor:    "pointer",
  fontWeight:600,
};

const th = {
  padding:      "9px 12px",
  textAlign:    "left",
  fontWeight:   800,
  color:        "#374151",
  borderBottom: "2px solid #e5e7eb",
  whiteSpace:   "nowrap",
  background:   "#f8fafc",
};

const td = {
  padding:       "9px 12px",
  verticalAlign: "middle",
};