"use client";

// ============================================================
// FILE: src/app/teacher/Dashboard/page.jsx
// ============================================================

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";

const PAGE_SIZE = 6;

async function resolveCurrentUser() {
  const { data: sessionData } = await supabase.auth.getSession();
  let user = sessionData?.session?.user || null;
  if (user) return user;

  const { data: userData } = await supabase.auth.getUser();
  user = userData?.user || null;
  if (user) return user;

  await new Promise((resolve) => setTimeout(resolve, 220));
  const { data: retrySessionData } = await supabase.auth.getSession();
  user = retrySessionData?.session?.user || null;
  if (user) return user;

  const { data: retryUserData } = await supabase.auth.getUser();
  return retryUserData?.user || null;
}

export default function TeacherDashboardPage() {
  const router = useRouter();

  const [loading, setLoading]   = useState(true);
  const [courses, setCourses]   = useState([]);
  const [stats, setStats]       = useState({ totalStudents: 0, totalCourses: 0 });
  const [page, setPage]         = useState(1);
  const [query, setQuery]       = useState("");
  const [idx, setIdx]           = useState(0);
  const [teacherName, setTeacherName] = useState("Teacher");

  const toSignedCoverUrl = async (path, mode = "card") => {
    if (!path) return "";

    const transform =
      mode === "featured"
        ? { width: 640, height: 360, resize: "cover", quality: 72 }
        : { width: 480, height: 270, resize: "cover", quality: 68 };

    const transformed = await supabase.storage
      .from("course-covers")
      .createSignedUrl(path, 1800, { transform });

    if (!transformed.error && transformed.data?.signedUrl) {
      return transformed.data.signedUrl;
    }

    const fallback = await supabase.storage
      .from("course-covers")
      .createSignedUrl(path, 1800);

    return fallback.data?.signedUrl || "";
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);

      const user = await resolveCurrentUser();
      if (!user) { router.replace("/login"); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .single();

      const role = String(profile?.role || "").trim().toLowerCase();
      if (!profile || role !== "teacher") {
        router.replace("/student/dashboard");
        return;
      }
      if (!cancelled) setTeacherName(profile.full_name || "Teacher");

      // Load courses + cover metadata if available
      let coursesData = [];
      const withCover = await supabase
        .from("courses")
        .select("id, code, title, cover_path")
        .eq("teacher_id", user.id)
        .order("id", { ascending: true });
      if (!withCover.error) {
        coursesData = withCover.data || [];
      } else {
        const basic = await supabase
          .from("courses")
          .select("id, code, title")
          .eq("teacher_id", user.id)
          .order("id", { ascending: true });
        coursesData = (basic.data || []).map(c => ({ ...c, cover_path: "" }));
      }

      if (cancelled) return;
      const mapped = await Promise.all(
        (coursesData || []).map(async c => {
          let cover_url = "";
          let cover_feature_url = "";
          if (c.cover_path) {
            [cover_url, cover_feature_url] = await Promise.all([
              toSignedCoverUrl(c.cover_path, "card"),
              toSignedCoverUrl(c.cover_path, "featured"),
            ]);
          }
          return { ...c, cover_url, cover_feature_url };
        })
      );
      setCourses(mapped);

      // Count total students enrolled in teacher's courses
      if (mapped.length > 0) {
        const ids = mapped.map(c => c.id);
        const { count } = await supabase
          .from("enrollments")
          .select("id", { count: "exact", head: true })
          .in("course_id", ids);
        if (!cancelled) setStats({ totalStudents: count || 0, totalCourses: mapped.length });
      } else {
        if (!cancelled) setStats({ totalStudents: 0, totalCourses: 0 });
      }

      if (!cancelled) setLoading(false);
    };

    run();
    return () => { cancelled = true; };
  }, [router]);

  // Carousel auto-rotate
  useEffect(() => {
    if (courses.length < 2) return;
    const t = setInterval(() => setIdx(p => (p + 1) % Math.min(courses.length, 3)), 5000);
    return () => clearInterval(t);
  }, [courses.length]);

  const featured = courses.slice(0, 3);
  const item = featured[idx] || null;
  const prev = () => setIdx(p => (p - 1 + featured.length) % featured.length);
  const next = () => setIdx(p => (p + 1) % featured.length);

  // Search filter
  const q = query.trim().toLowerCase();
  const filtered = q
    ? courses.filter(c => c.title.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
    : courses;

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading) return <div style={{ padding: 40 }}>Loading dashboard...</div>;

  return (
    <>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 800 }}>
          Welcome, <b>{teacherName}</b> - Teacher Dashboard
        </div>
      </div>

      {/* Stat pills */}
      <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
        {[
          { label: "Total Courses",  value: stats.totalCourses  },
          { label: "Total Students", value: stats.totalStudents },
        ].map(s => (
          <div
            key={s.label}
            className="glassCard"
            style={{ padding: "10px 20px", display: "flex", flexDirection: "column", gap: 2, minWidth: 120 }}
          >
            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase" }}>
              {s.label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#2f6fb3" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Featured carousel */}
      {item && (
        <div className="glassCard" style={{ marginTop: 14, padding: 14, position: "relative" }}>
          {featured.length > 1 && (
            <button onClick={prev} aria-label="Previous" style={arrowBtn("left")}>{"<"}</button>
          )}
          {featured.length > 1 && (
            <button onClick={next} aria-label="Next" style={arrowBtn("right")}>{">"}</button>
          )}

          <div className="featuredWrap teacherFeaturedWrap">
            <div className="featuredImg">
              {item.cover_feature_url || item.cover_url ? (
                <img
                  src={item.cover_feature_url || item.cover_url}
                  alt={item.title}
                  loading="eager"
                  decoding="async"
                />
              ) : (
                <div style={noCoverFeatured}>No cover yet</div>
              )}
            </div>
            <div className="featuredMid">
              <div className="kicker">{item.code}</div>
              <div className="featuredTitle">{item.title}</div>
              <div className="featuredDesc">Your active course.</div>
              <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
                Click "Class Management" to manage students.
              </div>
            </div>
          </div>

          {featured.length > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 10 }}>
              {featured.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  style={{
                    width: 8, height: 8, borderRadius: "50%",
                    border: "none", cursor: "pointer", padding: 0,
                    background: i === idx ? "#2f6fb3" : "#d1d5db",
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Browse courses */}
      <div className="sectionTitle">Browse Courses</div>

      <div className="searchRow" style={{ marginTop: 10, display: "flex", gap: 12, alignItems: "center" }}>
        <div className="searchPill" style={{ flex: 1, maxWidth: 420 }}>
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setPage(1); }}
            placeholder="Search by Course Name, Course Code, or Course Lecturer"
            style={{ flex: 1 }}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              style={{ border: "none", background: "transparent", cursor: "pointer", opacity: 0.7, fontSize: 12 }}
            >
              Clear
            </button>
          )}
        </div>
        <select className="yearPill" defaultValue="2025-2026 COLLEGE">
          <option>2025-2026 COLLEGE</option>
        </select>
      </div>

      <div className="courseGrid">
        {visible.length === 0 ? (
          <div style={{ padding: 16, color: "#6b7280" }}>
            {courses.length === 0
              ? "No courses yet. Go to Class Management to add courses."
              : "No courses match your search."}
          </div>
        ) : (
          visible.map(c => (
            <div
              key={c.id}
              className="courseCardImg"
              onClick={() => router.push("/teacher/class-management")}
            >
              {c.cover_url ? (
                <>
                  <img src={c.cover_url} alt={c.title} loading="lazy" decoding="async" />
                  <div className="courseOverlay">
                    <div className="courseOverlayText">
                      <div style={{ fontSize: 11, opacity: 0.8, fontWeight: 700 }}>{c.code}</div>
                      {c.title}
                    </div>
                  </div>
                </>
              ) : (
                <div style={noCoverCard}>
                  <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 800 }}>{c.code}</div>
                  <div style={{ marginTop: 6, fontWeight: 900, color: "#111827" }}>{c.title}</div>
                  <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>No cover yet</div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
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
                color: page === i + 1 ? "white" : "#374151",
                fontWeight: page === i + 1 ? 800 : 600,
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
            Next →
          </button>
        </div>
      )}

      <style jsx>{`
        .teacherFeaturedWrap {
          grid-template-columns: 160px 1fr !important;
        }

        @media (max-width: 700px) {
          .teacherFeaturedWrap {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  );
}

const arrowBtn = (side) => ({
  position: "absolute", [side]: 10, top: "50%", transform: "translateY(-50%)",
  width: 34, height: 34, borderRadius: 999,
  border: "1px solid rgba(0,0,0,.12)", background: "rgba(255,255,255,.85)",
  cursor: "pointer", zIndex: 3, fontSize: 18, lineHeight: 1,
});

const pageBtn = {
  height: 34, minWidth: 34, padding: "0 10px",
  borderRadius: 8, border: "1px solid #d1d5db",
  background: "white", color: "#374151", fontSize: 13,
  cursor: "pointer", fontWeight: 600,
};

const noCoverFeatured = {
  width: "100%",
  height: "100%",
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(135deg, #f8fafc 0%, #eef2f7 100%)",
  color: "#6b7280",
  fontSize: 12,
  fontWeight: 800,
};

const noCoverCard = {
  width: "100%",
  height: "100%",
  padding: 14,
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-end",
  background: "linear-gradient(135deg, #f8fafc 0%, #eef2f7 100%)",
};
