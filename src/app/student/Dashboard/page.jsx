"use client";

import LogoutButton from "@/components/LogoutButton";

export default function StudentDashboardPage() {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ margin: 0 }}>
          Welcome to your <b>Student Dashboard</b>
        </p>
        <LogoutButton />
      </div>

      <div
        style={{
          marginTop: 14,
          background: "rgba(255,255,255,.75)",
          border: "1px solid rgba(0,0,0,.06)",
          borderRadius: 18,
          padding: 14,
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 18 }}>IS 201</div>
        <div style={{ fontWeight: 800 }}>Data Structures and Algorithms</div>
        <div style={{ color: "#6b7280", marginTop: 6, fontSize: 13 }}>
          Covers fundamental data structures such as arrays, linked lists, stacks, queues, trees, and graphs.
        </div>
      </div>

      <div style={{ marginTop: 16, fontWeight: 900, color: "var(--blue-main)" }}>
        Browse Courses
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
        <input placeholder="Search by Course Name, Course Code, or Course Lecturer" style={{ flex: 1 }} />
        <select defaultValue="2025-2026 COLLEGE">
          <option>2025-2026 COLLEGE</option>
          <option>2024-2025 COLLEGE</option>
        </select>
      </div>

      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 14,
        }}
      >
        {[
          "Data Structures and Algorithms",
          "Database Management Systems",
          "Systems Analysis and Design",
          "Object-Oriented Programming",
          "Professional Ethics in IT",
          "Quantitative Methods / Statistics",
        ].map((c) => (
          <div
            key={c}
            style={{
              borderRadius: 18,
              overflow: "hidden",
              border: "1px solid rgba(0,0,0,.06)",
              background: "rgba(255,255,255,.75)",
              boxShadow: "0 10px 20px rgba(0,0,0,.06)",
              minHeight: 150,
              display: "flex",
              alignItems: "flex-end",
            }}
          >
            <div
              style={{
                width: "100%",
                padding: 14,
                fontWeight: 900,
                color: "white",
                background: "linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,0,0,.65))",
              }}
            >
              {c}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}