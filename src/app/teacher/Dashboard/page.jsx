"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export default function TeacherDashboardPage() {
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [direction, setDirection] = useState(1); // 1 = next, -1 = previous
  const pageSize = 3;

  const classes = [
    { id: 1, name: "Class Name", subject: "Mathematics", code: "CLS-001" },
    { id: 2, name: "Class Name", subject: "Science", code: "CLS-002" },
    { id: 3, name: "Class Name", subject: "English", code: "CLS-003" },
    { id: 4, name: "Class Name", subject: "History", code: "CLS-004" },
    { id: 5, name: "Class Name", subject: "Biology", code: "CLS-005" },
    { id: 6, name: "Class Name", subject: "Chemistry", code: "CLS-006" },
    { id: 7, name: "Class Name", subject: "Physics", code: "CLS-007" },
    { id: 8, name: "Class Name", subject: "Filipino", code: "CLS-008" },
  ];

  const stats = [
    { label: "Classes", value: classes.length },
    { label: "Students", value: 120 },
    { label: "Pending", value: 2 },
  ];

  const filteredClasses = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter((item) =>
      [item.name, item.subject, item.code].some((value) =>
        String(value).toLowerCase().includes(q)
      )
    );
  }, [classes, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredClasses.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const visibleClasses = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredClasses.slice(start, start + pageSize);
  }, [filteredClasses, page]);

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

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}

    ["token", "authToken", "accessToken", "refreshToken", "user", "teacherUser"].forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });

    document.cookie.split(";").forEach((cookiePart) => {
      const eqPos = cookiePart.indexOf("=");
      const name = (eqPos > -1 ? cookiePart.slice(0, eqPos) : cookiePart).trim();
      if (!name) return;
      document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    });

    router.replace("/login");
    router.refresh();
  };

  return (
    <div
      style={{
        minHeight: "100%",
        background: "#f3f4f6",
        padding: "18px 18px 28px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <p style={{ margin: 0, fontSize: 36, color: "#1f1f1f" }}>
          Welcome to your <b>Teacher Dashboard</b>
        </p>

        <button
          onClick={handleLogout}
          style={{
            border: "none",
            background: "#ffffff",
            boxShadow: "0 1px 6px rgba(0,0,0,0.10)",
            borderRadius: 8,
            padding: "8px 14px",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
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

      <div
        style={{
          border: "none",
          borderRadius: 12,
          background: "#ffffff",
          boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          marginBottom: 14,
        }}
      >
        {stats.map((item) => (
          <div
            key={item.label}
            style={{
              minHeight: 56,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              color: "#2f2f2f",
            }}
          >
            <span>{item.label}:&nbsp;</span>
            <span>{item.value}</span>
          </div>
        ))}
      </div>

      <div
        key={page}
        style={{
          animation: `${direction === 1 ? "slideInFromRight" : "slideInFromLeft"} 280ms ease`,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          {visibleClasses.map((item) => (
            <div
              key={item.id}
              style={{
                border: "none",
                borderRadius: 14,
                background: "#ffffff",
                boxShadow: "0 3px 14px rgba(0,0,0,0.10)",
                overflow: "hidden",
                height: 430,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  height: 210,
                  borderBottom: "1px solid rgba(0,0,0,0.10)",
                  position: "relative",
                  background: "#f5f5f5",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: "100%",
                    height: "100%",
                    background:
                      "linear-gradient(to bottom right, transparent calc(50% - 1px), rgba(0,0,0,0.18) 50%, transparent calc(50% + 1px)), linear-gradient(to top right, transparent calc(50% - 1px), rgba(0,0,0,0.18) 50%, transparent calc(50% + 1px))",
                  }}
                />
              </div>

              <div
                style={{
                  padding: "12px",
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 22,
                      lineHeight: 1.2,
                      color: "#3a3a3a",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {item.name}
                  </div>

                  <div
                    style={{
                      fontSize: 16,
                      color: "#4a4a4a",
                      marginTop: 6,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    Class Code: {item.code}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button
                    style={{
                      border: "none",
                      background: "#f1f1f1",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                      borderRadius: 8,
                      minHeight: 36,
                      minWidth: 120,
                      fontSize: 14,
                      color: "#4a4a4a",
                      cursor: "pointer",
                    }}
                  >
                    Enter Class
                  </button>

                  <button
                    style={{
                      border: "none",
                      background: "#f1f1f1",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                      borderRadius: 8,
                      minHeight: 36,
                      minWidth: 120,
                      fontSize: 14,
                      color: "#4a4a4a",
                      cursor: "pointer",
                    }}
                  >
                    Edit Class
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={goPrev}
            disabled={page === 1}
            style={{
              border: "none",
              background: "#ffffff",
              boxShadow: "0 1px 5px rgba(0,0,0,0.12)",
              borderRadius: 8,
              minHeight: 32,
              minWidth: 92,
              fontSize: 20,
              color: "#4a4a4a",
              cursor: page === 1 ? "not-allowed" : "pointer",
              opacity: page === 1 ? 0.55 : 1,
            }}
          >
            Previous
          </button>

          <button
            style={{
              border: "none",
              background: "#ffffff",
              boxShadow: "0 1px 5px rgba(0,0,0,0.12)",
              borderRadius: 8,
              minHeight: 32,
              minWidth: 42,
              fontSize: 20,
              color: "#4a4a4a",
            }}
          >
            {page}
          </button>

          <button
            onClick={goNext}
            disabled={page === totalPages}
            style={{
              border: "none",
              background: "#ffffff",
              boxShadow: "0 1px 5px rgba(0,0,0,0.12)",
              borderRadius: 8,
              minHeight: 32,
              minWidth: 72,
              fontSize: 20,
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