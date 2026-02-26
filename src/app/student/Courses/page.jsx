"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { useRouter } from "next/navigation";

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

export default function StudentCoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [schoolYear, setSchoolYear] = useState("2025-2026 COLLEGE");
  const [page, setPage] = useState(1);
  const [direction, setDirection] = useState(1); // 1 = next, -1 = previous
  const [brokenCoverKeys, setBrokenCoverKeys] = useState({});

  const pageSize = 6;
  const toCoverUrl = useCallback(async (path) => {
    if (!path) return "";
    const bucket = supabase.storage.from("course-covers");
    const { data, error } = await bucket.createSignedUrl(path, 1800);
    if (!error && data?.signedUrl) return data.signedUrl;
    const { data: publicData } = bucket.getPublicUrl(path);
    return publicData?.publicUrl || "";
  }, []);
  const getCoverKey = (course) => `${course?.id || "no-id"}|${course?.img || ""}`;
  const markCoverBroken = (course) => {
    const key = getCoverKey(course);
    setBrokenCoverKeys((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  };
  const renderCourseCover = (course) =>
    course?.img && !brokenCoverKeys[getCoverKey(course)] ? (
      <img
        src={course.img}
        alt={course?.title || "Course cover"}
        onError={() => markCoverBroken(course)}
        style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 14 }}
      />
    ) : (
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 14,
          background: "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#64748b",
          fontWeight: 800,
          fontSize: 14,
        }}
      >
        No Cover
      </div>
    );

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setErr("");

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) { router.replace("/login"); return; }

      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (pErr || !profile) { router.replace("/login"); return; }
      if (profile.role !== "student") { router.replace("/teacher/Dashboard"); return; }

      const withCover = await supabase
        .from("enrollments")
        .select("course_id, courses(id, code, title, cover_path)")
        .eq("student_id", user.id);

      let data = withCover.data || [];
      const missingCoverColumn = String(withCover.error?.message || "").toLowerCase().includes("cover_path");
      if (withCover.error && missingCoverColumn) {
        const basic = await supabase
          .from("enrollments")
          .select("course_id, courses(id, code, title)")
          .eq("student_id", user.id);
        data = basic.data || [];
      } else if (withCover.error) {
        setErr(withCover.error.message);
        setCourses([]);
      }

      if (!withCover.error || missingCoverColumn) {
        const fromDb = (data || []).map((r) => r.courses).filter(Boolean);

        const seen = new Set();
        const uniqueBase = fromDb.filter((course) => {
          const key = `${String(course?.id || "")}|${String(course?.code || "").trim().toLowerCase()}|${String(course?.title || "")
            .trim()
            .toLowerCase()}`;
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        const withImages = await Promise.all(
          uniqueBase.map(async (course) => ({
            ...course,
            img: await toCoverUrl(course?.cover_path || ""),
          }))
        );

        setCourses(withImages);
      }

      setLoading(false);
    };

    run();
  }, [router, toCoverUrl]);

  const filteredCourses = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return courses;

    return courses.filter((course) => {
      const title = String(course?.title || "").toLowerCase();
      const code = String(course?.code || "").toLowerCase();
      return title.includes(q) || code.includes(q);
    });
  }, [courses, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredCourses.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const visibleCourses = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCourses.slice(start, start + pageSize);
  }, [filteredCourses, page]);

  const goPrev = () => {
    if (page === 1) return;
    setDirection(-1);
    setPage((prev) => Math.max(1, prev - 1));
  };

  const goNext = () => {
    if (page === totalPages) return;
    setDirection(1);
    setPage((prev) => Math.min(totalPages, prev + 1));
  };

  if (loading) return <div style={{ padding: 24 }}>Loading courses...</div>;

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 40, lineHeight: 1.1, fontWeight: 800, color: "#111827" }}>
            My Courses
          </h1>

          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search course"
            style={{
              width: 280,
              maxWidth: "100%",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 999,
              background: "#ffffff",
              minHeight: 40,
              padding: "0 14px",
              fontSize: 26,
              color: "#222",
              outline: "none",
            }}
          />
        </div>

        <select
          value={schoolYear}
          onChange={(e) => setSchoolYear(e.target.value)}
          style={{
            minHeight: 40,
            borderRadius: 999,
            border: "1px solid rgba(0,0,0,0.08)",
            padding: "0 12px",
            fontSize: 13,
            background: "#ffffff",
            color: "#3f3f46",
          }}
        >
          <option>2025-2026 COLLEGE</option>
        </select>
      </div>

      {err && <p style={{ color: "#b91c1c", marginTop: 0 }}>{err}</p>}

      <div
        style={{
          borderRadius: 20,
          background: "rgba(245, 245, 245, 0.95)",
          border: "1px solid rgba(0,0,0,0.05)",
          padding: 14,
          flex: 1,
        }}
      >
        <div
          key={page}
          style={{
            animation: `${direction === 1 ? "slideInFromRight" : "slideInFromLeft"} 280ms ease`,
          }}
        >
          <div className="student-courses-grid">
            {!visibleCourses.length ? (
              <div
                style={{
                  gridColumn: "1 / -1",
                  minHeight: 120,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#6b7280",
                  fontWeight: 600,
                  fontSize: 16,
                }}
              >
                No courses found.
              </div>
            ) : (
              visibleCourses.map((course, idx) => (
                <div
                  key={`${course?.code || "course"}-${idx}`}
                  style={{
                    borderRadius: 18,
                    background: "#fafafa",
                    border: "1px solid rgba(0,0,0,0.04)",
                    minHeight: 320,
                    display: "flex",
                    flexDirection: "column",
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      borderRadius: 14,
                      background: "#f0f0f0",
                      border: "1px solid rgba(0,0,0,0.03)",
                      minHeight: 200,
                      overflow: "hidden",
                    }}
                  >
                    {renderCourseCover(course)}
                  </div>

                  <div style={{ marginTop: 12, color: "#2f2f2f" }}>
                    <div
                      style={{
                        fontSize: 28,
                        fontWeight: 600,
                        lineHeight: 1.2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {course?.title || "Class Name"}
                    </div>
                    <div style={{ fontSize: 25, marginTop: 4 }}>
                      Class Code: {course?.code || "CLS-001"}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, marginTop: "auto", paddingTop: 10 }}>
                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/student/Grades?course=${encodeURIComponent(course?.code || "")}&title=${encodeURIComponent(
                            course?.title || ""
                          )}`
                        )
                      }
                      style={{
                        border: "none",
                        background: "#ececec",
                        borderRadius: 999,
                        minHeight: 30,
                        minWidth: 96,
                        padding: "0 12px",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#4b5563",
                        cursor: "pointer",
                      }}
                      aria-label={`View grades for ${course?.title || "course"}`}
                    >
                      View Grades
                    </button>

                    <button
                      type="button"
                      onClick={() => router.push("/student/messages")}
                      style={{
                        border: "none",
                        background: "#ececec",
                        borderRadius: 999,
                        minHeight: 30,
                        minWidth: 96,
                        padding: "0 12px",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#4b5563",
                        cursor: "pointer",
                      }}
                      aria-label={`Message teacher for ${course?.title || "course"}`}
                    >
                      Message Teacher
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={goPrev}
            disabled={page === 1}
            style={{
              border: "1px solid rgba(0,0,0,0.08)",
              background: "#ffffff",
              borderRadius: 8,
              minHeight: 32,
              minWidth: 86,
              fontSize: 13,
              color: "#4a4a4a",
              cursor: page === 1 ? "not-allowed" : "pointer",
              opacity: page === 1 ? 0.55 : 1,
            }}
          >
            Previous
          </button>

          <button
            style={{
              border: "1px solid rgba(0,0,0,0.08)",
              background: "#ffffff",
              borderRadius: 8,
              minHeight: 32,
              minWidth: 38,
              fontSize: 13,
              color: "#4a4a4a",
            }}
          >
            {page}
          </button>

          <button
            onClick={goNext}
            disabled={page === totalPages}
            style={{
              border: "1px solid rgba(0,0,0,0.08)",
              background: "#ffffff",
              borderRadius: 8,
              minHeight: 32,
              minWidth: 62,
              fontSize: 13,
              color: "#4a4a4a",
              cursor: page === totalPages ? "not-allowed" : "pointer",
              opacity: page === totalPages ? 0.55 : 1,
            }}
          >
            Next
          </button>
        </div>
      </div>

      <style jsx>{`
        .student-courses-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        @media (max-width: 1100px) {
          .student-courses-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .student-courses-grid {
            grid-template-columns: 1fr;
          }
        }

        @keyframes slideInFromRight {
          from {
            opacity: 0;
            transform: translateX(28px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slideInFromLeft {
          from {
            opacity: 0;
            transform: translateX(-28px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
