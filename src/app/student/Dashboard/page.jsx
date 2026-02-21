"use client";
import LogoutButton from "@/components/LogoutButton";

export default function StudentDashboardPage() {
  const courses = [
    { title: "Data Structures and Algorithms", img: "/courses/ds.jpg" },
    { title: "Database Management Systems", img: "/courses/db.jpg" },
    { title: "Systems Analysis and Design", img: "/courses/sad.jpg" },
    { title: "Object-Oriented Programming", img: "/courses/oop.jpg" },
    { title: "Professional Ethics in IT", img: "/courses/ethics.jpg" },
    { title: "Quantitative Methods / Statistics", img: "/courses/stats.jpg" },
  ];

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 800 }}>
          Welcome to your <b>Student Dashboard</b>
        </div>
        <LogoutButton />
      </div>

      {/* Featured / Carousel-like */}
      <div className="glassCard" style={{ marginTop: 14, padding: 14 }}>
        <div className="featuredWrap">
          <div className="featuredImg">
            <img src="/courses/ds.jpg" alt="course" />
          </div>

          <div className="featuredMid">
            <div className="kicker">IS 201</div>
            <div className="featuredTitle">Data Structures and Algorithms</div>
            <div className="featuredDesc">
              Covers fundamental data structures such as arrays, linked lists, stacks, queues, trees,
              and graphs. Introduces algorithm design, sorting, searching, and complexity analysis.
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
              👤 Marzel Baste · Instructor
            </div>
          </div>

          <div className="featuredImg">
            <img src="/courses/db.jpg" alt="course" />
          </div>
        </div>
      </div>

      <div className="sectionTitle">Browse Courses</div>

      {/* Search row */}
      <div className="searchRow">
        <div className="searchPill">
          <span style={{ opacity: 0.7 }}>🔍</span>
          <input placeholder="Search by Course Name, Course Code, or Course Lecturer" />
          <span style={{ opacity: 0.7 }}>🎙️</span>
        </div>

        <select className="yearPill" defaultValue="2025-2026 COLLEGE">
          <option>2025-2026 COLLEGE</option>
          <option>2024-2025 COLLEGE</option>
        </select>
      </div>

      {/* Course cards */}
      <div className="courseGrid">
        {courses.map((c) => (
          <div key={c.title} className="courseCardImg">
            <img src={c.img} alt={c.title} />
            <div className="courseOverlay">
              <div className="courseOverlayText">{c.title}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", color: "#111827" }}>
        <button className="ghost" style={{ fontWeight: 800 }}>
          Next →
        </button>
      </div>
    </>
  );
}