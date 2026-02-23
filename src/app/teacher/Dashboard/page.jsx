"use client";

import { useRouter } from "next/navigation";
import AgendaCalendar from "@/components/AgendaCalendar";

export default function TeacherDashboardPage() {
  const router = useRouter();

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <p style={{ margin: 0 }}>
          Welcome to your <b>Teacher Dashboard</b>
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.3fr",
          gap: 14,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            border: "none",
            borderRadius: 12,
            background: "#ffffff",
            boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
            minHeight: 44,
            display: "flex",
            alignItems: "center",
            padding: "0 12px",
            fontSize: 30,
            color: "#3c3c3c",
          }}
        >
          Dashboard
        </div>

        <input
          placeholder="Search Class"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            border: "none",
            borderRadius: 16,
            background: "#ffffff",
            boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
            minHeight: 44,
            padding: "0 14px",
            fontSize: 36,
            color: "#3c3c3c",
            outline: "none",
          }}
        />
      </div>

      {/* Navigation Button */}
      <div
        style={{
          marginTop: 18,
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <button
          type="button"
          onClick={() => router.push("/teacher/Class-Management")}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,.15)",
            background: "white",
            cursor: "pointer",
            fontWeight: 800,
          }}
        >
          Manage My Classes →
        </button>
      </div>
    </>
  );
}