"use client";

import { useEffect, useMemo, useState } from "react";
import LogoutButton from "@/components/LogoutButton";

export default function StudentDashboardPage() {
  const courses = [
    { title: "Data Structures and Algorithms", img: "/images/dsa.jpg" },
    { title: "Database Management Systems", img: "/images/dms.jpg" },
    { title: "Systems Analysis and Design", img: "/images/sad.jpg" },
    { title: "Object-Oriented Programming", img: "/images/oop.jpg" },
    { title: "Professional Ethics in IT", img: "/images/ethics.jpg" },
    { title: "Quantitative Methods / Statistics", img: "/images/qms.jpg" },
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

const handleSearch = (e) => {
  let value = e.target.value;

  // letters, numbers, spaces only
  value = value.replace(/[^a-zA-Z0-9\s]/g, "");

  // collapse multiple spaces
  value = value.replace(/\s+/g, " ");

  // prevent spam repeats (max 3)
  value = value.replace(/(.)\1{3,}/g, "$1$1$1");

  // limit length
  value = value.trimStart().slice(0, MAX_LEN);

  setQuery(value);
};

  // ✅ NEW: Filtered list (fast + clean)
  const filteredCourses = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return courses;

    return courses.filter((c) => c.title.toLowerCase().includes(q));
  }, [query, courses]);

  // Slider logic (your existing)
  const [idx, setIdx] = useState(0);
  const item = featured[idx];

  const next = () => setIdx((p) => (p + 1) % featured.length);
  const prev = () => setIdx((p) => (p - 1 + featured.length) % featured.length);

  useEffect(() => {
    const t = setInterval(() => {
      setIdx((p) => (p + 1) % featured.length);
    }, 5000);
    return () => clearInterval(t);
  }, [featured.length]);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 800 }}>
          Welcome to your <b>Student Dashboard</b>
        </div>
        <LogoutButton />
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

        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
          {featured.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`Go to slide ${i + 1}`}
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                background: i === idx ? "var(--blue-main)" : "rgba(0,0,0,.25)",
              }}
            />
          ))}
        </div>
      </div>

      <div className="sectionTitle">Browse Courses</div>

      {/* ✅ Search row (FUNCTIONAL now) */}
      <div className="searchRow">
        <div className="searchPill">
          

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by Course Name, Course Code, or Course Lecturer"
          />

          {/* Optional clear button */}
          {query.trim() ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              title="Clear"
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                opacity: 0.7,
                fontSize: 14,
              }}
            >
              ✕
            </button>
          ) : (
            <span style={{ opacity: 0.7 }}>🎙️</span>
          )}
        </div>

        <select
          className="yearPill"
          value={schoolYear}
          onChange={(e) => setSchoolYear(e.target.value)}
        >
          <option>2025-2026 COLLEGE</option>
          <option>2024-2025 COLLEGE</option>
        </select>
      </div>

      {/* ✅ Course cards (use filteredCourses) */}
      <div className="courseGrid">
        {filteredCourses.length === 0 ? (
          <div style={{ padding: 16, color: "#6b7280" }}>
            No courses found for “{query}”.
          </div>
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
        <button className="ghost" style={{ fontWeight: 800 }}>
          Next →
        </button>
      </div>
    </>
  );
}