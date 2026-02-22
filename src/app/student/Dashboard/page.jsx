"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { useRouter } from "next/navigation";
import LogoutConfirmModal from "@/components/LogoutConfirmModal";

export default function StudentDashboardPage() {
  const router = useRouter();

  const courses = [
    { title: "Data Structures and Algorithms", img: "/images/dsa.jpg" },
    { title: "Database Management Systems", img: "/images/dms.jpg" },
    { title: "Systems Analysis and Design", img: "/images/sad.jpg" },
    { title: "Object-Oriented Programming", img: "/images/oop.jpg" },
    { title: "Professional Ethics in IT", img: "/images/ethics.jpg" },
    { title: "Quantitative Methods / Statistics", img: "/images/qms.jpg" },
    { title: "Web Development", img: "/images/wed.jpg" },
    { title: "Human-Computer Interaction", img: "/images/hci.jpg" },
    { title: "Software Engineering", img: "/images/soe.jpg" },
  ];

  const featured = [
    {
      code: "IS 201",
      title: "Data Structures and Algorithms",
      desc:
        "Covers fundamental data structures such as arrays, linked lists, stacks, queues, trees, and graphs. Introduces algorithm design, sorting, searching, and complexity analysis.",
      instructor: "Marzel Baste",
      leftImg: "/images/dsa.jpg",
      rightImg: "/images/dms.jpg",
    },
    {
      code: "IS 202",
      title: "Database Management Systems",
      desc:
        "Introduces relational databases, SQL, normalization, transactions, indexing, and database design for real-world applications.",
      instructor: "John Doe",
      leftImg: "/images/dms.jpg",
      rightImg: "/images/sad.jpg",
    },
    {
      code: "IS 203",
      title: "Systems Analysis and Design",
      desc:
        "Focuses on requirements gathering, modeling, UML, and designing information systems based on user needs and constraints.",
      instructor: "Jane Smith",
      leftImg: "/images/sad.jpg",
      rightImg: "/images/oop.jpg",
    },
  ];

  const [query, setQuery] = useState("");
  const [schoolYear, setSchoolYear] = useState("2025-2026 COLLEGE");

  const [idx, setIdx] = useState(0);
  const item = featured[idx];

  // ✅ LOGOUT MODAL STATE
  const [showLogout, setShowLogout] = useState(false);

  const MAX_LEN = 20;

  // ✅ CLEAN + LIMIT INPUT
  const handleSearch = (e) => {
    let value = e.target.value;

    value = value.replace(/[^a-zA-Z0-9\s]/g, "");
    value = value.replace(/\s+/g, " ");
    value = value.replace(/(.)\1{3,}/g, "$1$1$1");
    value = value.trimStart().slice(0, MAX_LEN);

    setQuery(value);
  };

  // ✅ FILTER COURSES
  const filteredCourses = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) => c.title.toLowerCase().includes(q));
  }, [query]);

  // ✅ SLIDER NAV
  const next = () => setIdx((p) => (p + 1) % featured.length);
  const prev = () => setIdx((p) => (p - 1 + featured.length) % featured.length);

  useEffect(() => {
    const t = setInterval(() => {
      setIdx((p) => (p + 1) % featured.length);
    }, 5000);
    return () => clearInterval(t);
  }, [featured.length]);

  // ✅ LOGOUT FUNCTION
  const confirmLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <>
      {/* HEADER */}
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
  <div style={{ fontWeight: 800 }}>
    Welcome to your <b>Student Dashboard</b>
  </div>
</div>

      {/* Featured slider */}
      <div className="glassCard" style={{ marginTop: 14, padding: 14, position: "relative" }}>
        <button
          onClick={prev}
          aria-label="Previous"
          style={{
            position: "absolute",
            left: 10,
            top: "50%",
            transform: "translateY(-50%)",
            width: 34,
            height: 34,
            borderRadius: 999,
            border: "1px solid rgba(0,0,0,.12)",
            background: "rgba(255,255,255,.85)",
            cursor: "pointer",
            zIndex: 3,
          }}
        >
          ‹
        </button>

        <button
          onClick={next}
          aria-label="Next"
          style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
            width: 34,
            height: 34,
            borderRadius: 999,
            border: "1px solid rgba(0,0,0,.12)",
            background: "rgba(255,255,255,.85)",
            cursor: "pointer",
            zIndex: 3,
          }}
        >
          ›
        </button>

        <div className="featuredWrap">
          <div className="featuredImg">
            <img src={item.leftImg} alt={item.title} />
          </div>

          <div className="featuredMid">
            <div className="kicker">{item.code}</div>
            <div className="featuredTitle">{item.title}</div>
            <div className="featuredDesc">{item.desc}</div>
            <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
              {item.instructor} · Instructor
            </div>
          </div>

          <div className="featuredImg">
            <img src={item.rightImg} alt={item.title} />
          </div>
        </div>
      </div>

      <div className="sectionTitle">Browse Courses</div>

      {/* SEARCH ROW */}
      <div
        className="searchRow"
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 10,
        }}
      >
        <div
          className="searchPill"
          style={{
            width: "100%",
            maxWidth: 420,
            display: "flex",
            alignItems: "center",
          }}
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
                border: "none",
                background: "transparent",
                cursor: "pointer",
                opacity: 0.7,
                fontSize: 12,
                fontWeight: 700,
                paddingRight: 10,
                whiteSpace: "nowrap",
              }}
            >
              Clear
            </button>
          )}
        </div>

        <select
          className="yearPill"
          value={schoolYear}
          onChange={(e) => setSchoolYear(e.target.value)}
          style={{ width: 200 }}
        >
          <option>2025-2026 COLLEGE</option>
        </select>
      </div>

      {/* Course cards */}
      <div className="courseGrid">
        {filteredCourses.length === 0 ? (
          <div style={{ padding: 16, color: "#6b7280" }}>No courses found.</div>
        ) : (
          filteredCourses.map((c) => (
            <div key={c.title} className="courseCardImg">
              <img src={c.img} alt={c.title} />
              <div className="courseOverlay">
                <div className="courseOverlayText">{c.title}</div>
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

      {/* ✅ LOGOUT PROMPT MODAL */}
      {showLogout && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
          }}
        >
          <div
            style={{
              width: 360,
              background: "white",
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 20px 40px rgba(0,0,0,.2)",
              position: "relative",
            }}
          >
            {/* Close X */}
            <button
              onClick={() => setShowLogout(false)}
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: 16,
                opacity: 0.8,
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
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid rgba(0,0,0,.15)",
                  background: "white",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Cancel
              </button>

              <button
                onClick={confirmLogout}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "none",
                  background: "var(--blue-main)",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 800,
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