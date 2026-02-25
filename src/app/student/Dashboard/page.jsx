"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";

// Maps course title keywords to local images already in your /public/images folder
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

export default function StudentDashboardPage() {
  const router = useRouter();

  const [courses, setCourses] = useState([]);       // enrolled courses from Supabase
  const [grades, setGrades] = useState([]);         // grade rows from Supabase
  const [query, setQuery] = useState("");
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showLogout, setShowLogout] = useState(false);

  const MAX_LEN = 20;

  // ── Load enrolled courses + grades from Supabase ─────────────────────────
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) { router.replace("/login"); return; }

      const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .single();

      if (!profile || profile.role !== "student") {
        router.replace("/teacher/Dashboard");
        return;
      }

      // Fetch enrolled courses with teacher name
      const { data: enrollData } = await supabase
        .from("enrollments")
        .select("course_id, courses(id, code, title, profiles!courses_teacher_id_fkey(full_name))")
        .eq("student_id", user.id);

      if (cancelled) return;

      const mappedCourses = (enrollData || [])
        .map((r) => r.courses)
        .filter(Boolean)
        .map((c) => ({
          id: c.id,
          code: c.code,
          title: c.title,
          instructor: c.profiles?.full_name || "Instructor",
          img: getCourseImg(c.title),
        }));

      setCourses(mappedCourses);

      // Fetch grades for this student
      const { data: gradesData } = await supabase
        .from("grades")
        .select("course_id, prelim, midterm, final_exam, final_grade, courses(code, title)")
        .eq("student_id", user.id);

      if (cancelled) return;
      setGrades(gradesData || []);
      setLoading(false);
    };

    run();
    return () => { cancelled = true; };
  }, [router]);

  // ── Auto-rotate featured carousel every 5 s ───────────────────────────────
  useEffect(() => {
    if (courses.length < 2) return;
    const t = setInterval(() => setIdx((p) => (p + 1) % Math.min(courses.length, 3)), 5000);
    return () => clearInterval(t);
  }, [courses.length]);

  const featured = courses.slice(0, 3);
  const item = featured[idx] || null;

  const prev = () => setIdx((p) => (p - 1 + featured.length) % featured.length);
  const next = () => setIdx((p) => (p + 1) % featured.length);

  // ── Search filter ─────────────────────────────────────────────────────────
  const handleSearch = (e) => {
    let v = e.target.value.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, " ").trimStart().slice(0, MAX_LEN);
    setQuery(v);
  };

  const filteredCourses = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) =>
      c.title.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [query, courses]);

  // ── Overall grade average ─────────────────────────────────────────────────
  const overallGrade = useMemo(() => {
    const valid = grades.filter((g) => g.final_grade != null);
    if (!valid.length) return null;
    const avg = valid.reduce((s, g) => s + Number(g.final_grade), 0) / valid.length;
    return avg.toFixed(2);
  }, [grades]);

  const confirmLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (loading) return <div style={{ padding: 40 }}>Loading dashboard...</div>;

  return (
    <>
      {/* ── Page Title ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 800 }}>
          Welcome to your <b>Student Dashboard</b>
        </div>
      </div>

      {/* ── Grade Summary Banner (only shown when grades exist) ── */}
      {grades.length > 0 && (
        <div
          className="glassCard"
          style={{ marginTop: 14, padding: 14, display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}
        >
          {/* Overall avg */}
          <div style={{ minWidth: 110 }}>
            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px" }}>
              Overall Average
            </div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 900,
                color: overallGrade >= 75 ? "#16a34a" : "#dc2626",
                lineHeight: 1.1,
                marginTop: 2,
              }}
            >
              {overallGrade}%
            </div>
          </div>

          {/* Per-course grade chips */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", flex: 1 }}>
            {grades.map((g, i) => (
              <div
                key={i}
                style={{
                  background: "rgba(255,255,255,0.85)",
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 12,
                  padding: "8px 12px",
                  minWidth: 120,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, color: "#2f6fb3" }}>
                  {g.courses?.code || "N/A"}
                </div>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 130 }}>
                  {g.courses?.title || "Course"}
                </div>
                <div style={{ display: "flex", gap: 6, fontSize: 11 }}>
                  <span>P: <b>{g.prelim ?? "—"}</b></span>
                  <span>M: <b>{g.midterm ?? "—"}</b></span>
                  <span>F: <b>{g.final_exam ?? "—"}</b></span>
                </div>
                <div
                  style={{
                    marginTop: 3,
                    fontSize: 13,
                    fontWeight: 900,
                    color:
                      g.final_grade == null
                        ? "#9ca3af"
                        : g.final_grade >= 75
                        ? "#16a34a"
                        : "#dc2626",
                  }}
                >
                  Final:{" "}
                  {g.final_grade != null ? `${g.final_grade}%` : "Pending"}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => router.push("/student/Grades")}
            style={{
              alignSelf: "center",
              padding: "8px 16px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,.12)",
              background: "white",
              fontWeight: 800,
              cursor: "pointer",
              fontSize: 13,
              whiteSpace: "nowrap",
            }}
          >
            Full Grades →
          </button>
        </div>
      )}

      {/* ── Featured Course Carousel ── */}
      {item && (
        <div className="glassCard" style={{ marginTop: 14, padding: 14, position: "relative" }}>
          {/* Prev button */}
          {featured.length > 1 && (
            <button
              onClick={prev}
              aria-label="Previous"
              style={{
                position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                width: 34, height: 34, borderRadius: 999,
                border: "1px solid rgba(0,0,0,.12)", background: "rgba(255,255,255,.85)",
                cursor: "pointer", zIndex: 3, fontSize: 18, lineHeight: 1,
              }}
            >
              ‹
            </button>
          )}

          {/* Next button */}
          {featured.length > 1 && (
            <button
              onClick={next}
              aria-label="Next"
              style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                width: 34, height: 34, borderRadius: 999,
                border: "1px solid rgba(0,0,0,.12)", background: "rgba(255,255,255,.85)",
                cursor: "pointer", zIndex: 3, fontSize: 18, lineHeight: 1,
              }}
            >
              ›
            </button>
          )}

          <div className="featuredWrap">
            {/* Left image */}
            <div className="featuredImg">
              <img src={item.img} alt={item.title} />
            </div>

            {/* Center text */}
            <div className="featuredMid">
              <div className="kicker">{item.code}</div>
              <div className="featuredTitle">{item.title}</div>
              <div className="featuredDesc">
                Enrolled course — taught by {item.instructor}.
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
                {item.instructor} · Instructor
              </div>
            </div>

            {/* Right image (next course preview) */}
            <div className="featuredImg">
              <img
                src={
                  featured[(idx + 1) % featured.length]?.img || item.img
                }
                alt="next"
              />
            </div>
          </div>

          {/* Dots */}
          {featured.length > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 10 }}>
              {featured.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  style={{
                    width: 8, height: 8, borderRadius: "50%", border: "none",
                    cursor: "pointer", padding: 0,
                    background: i === idx ? "#2f6fb3" : "#d1d5db",
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Browse Courses ── */}
      <div className="sectionTitle">Browse My Courses</div>

      <div
        className="searchRow"
        style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", marginTop: 10 }}
      >
        <div
          className="searchPill"
          style={{ width: "100%", maxWidth: 420, display: "flex", alignItems: "center" }}
        >
          <input
            value={query}
            onChange={handleSearch}
            placeholder="Search course"
            maxLength={MAX_LEN}
            style={{ flex: 1 }}
          />
          {query.trim() && (
            <button
              type="button"
              onClick={() => setQuery("")}
              style={{
                border: "none", background: "transparent", cursor: "pointer",
                opacity: 0.7, fontSize: 12, fontWeight: 700, paddingRight: 10, whiteSpace: "nowrap",
              }}
            >
              Clear
            </button>
          )}
        </div>

        <select
          className="yearPill"
          style={{ width: 200 }}
          defaultValue="2025-2026 COLLEGE"
        >
          <option>2025-2026 COLLEGE</option>
        </select>
      </div>

      <div className="courseGrid">
        {filteredCourses.length === 0 ? (
          <div style={{ padding: 16, color: "#6b7280" }}>
            {courses.length === 0
              ? "You are not enrolled in any courses yet."
              : "No courses match your search."}
          </div>
        ) : (
          filteredCourses.map((c) => (
            <div key={c.id || c.title} className="courseCardImg">
              <img src={c.img} alt={c.title} />
              <div className="courseOverlay">
                <div className="courseOverlayText">
                  <div style={{ fontSize: 11, opacity: 0.8, fontWeight: 700 }}>{c.code}</div>
                  {c.title}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", color: "#111827" }}>
        <button
          className="ghost"
          style={{ fontWeight: 800 }}
          onClick={() => router.push("/student/Courses")}
        >
          My Courses →
        </button>
      </div>

      {/* ── Logout Modal ── */}
      {showLogout && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999,
          }}
        >
          <div
            style={{
              width: 360, background: "white", borderRadius: 12, padding: 20,
              boxShadow: "0 20px 40px rgba(0,0,0,.2)", position: "relative",
            }}
          >
            <button
              onClick={() => setShowLogout(false)}
              style={{
                position: "absolute", top: 10, right: 10, border: "none",
                background: "transparent", cursor: "pointer", fontSize: 16, opacity: 0.8,
              }}
              aria-label="Close"
            >
              ✕
            </button>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 10 }}>Log out</div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Are you sure?</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 18 }}>
              You will no longer be logged in on selected devices.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => setShowLogout(false)}
                style={{
                  padding: "8px 14px", borderRadius: 8,
                  border: "1px solid rgba(0,0,0,.15)", background: "white",
                  cursor: "pointer", fontWeight: 700,
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                style={{
                  padding: "8px 14px", borderRadius: 8, border: "none",
                  background: "var(--blue-main)", color: "white",
                  cursor: "pointer", fontWeight: 800,
                }}
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}