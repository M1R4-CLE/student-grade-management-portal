"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandLogo from "./BrandLogo";

const baseItemStyle = (active) => ({
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "10px 14px",
  borderRadius: 12,
  textDecoration: "none",
  color: active ? "var(--blue-main)" : "#6b7280",
  background: active ? "rgba(47,111,179,.10)" : "transparent",
  fontWeight: active ? 800 : 700,
});

function IconDot({ active }) {
  return (
    <div
      style={{
        width: 34,
        height: 34,
        borderRadius: 10,
        display: "grid",
        placeItems: "center",
        background: "rgba(0,0,0,.03)",
        border: "1px solid rgba(0,0,0,.06)",
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 99,
          background: active ? "var(--blue-main)" : "#9ca3af",
          display: "inline-block",
        }}
      />
    </div>
  );
}

export default function AppSidebar({ role = "student" }) {
  const pathname = usePathname();

  const links =
    role === "teacher"
      ? [
          { label: "Home Page", href: "/teacher/Dashboard" },
          { label: "Class Management", href: "/teacher/Class-Management" },
          { label: "Grade Entry", href: "/teacher/Grade-Entry" },
          { label: "Messages", href: "/teacher/messages" },
          { label: "Profile", href: "/teacher/Profile" },
          { label: "Settings", href: "/teacher/Settings" },
        ]
      : [
          { label: "Home Page", href: "/student/Dashboard" },
          { label: "My Courses", href: "/student/Courses" },
          { label: "Messages", href: "/student/messages" },
          { label: "My Grades", href: "/student/Grades" },
          { label: "Profile", href: "/student/Profile" },
          { label: "Settings", href: "/student/Settings" },
        ];

  return (
    <aside
      style={{
        width: 260,
        minHeight: "calc(100vh - 40px)",
        background: "var(--sidebar-bg)",
        border: "1px solid var(--border-light)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-soft)",
        padding: 18,
        position: "sticky",
        top: 20,
        backdropFilter: "blur(8px)",
      }}
    >
      <div style={{ marginBottom: 18 }}>
        <BrandLogo />
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {links.map((l) => {
          const active = pathname === l.href;
          return (
            <Link key={l.href} href={l.href} style={baseItemStyle(active)}>
              <IconDot active={active} />
              {l.label}
            </Link>
          );
        })}
      </nav>

      <div
        style={{
          position: "absolute",
          bottom: 18,
          left: 18,
          right: 18,
          color: "#6b7280",
          fontSize: 12,
        }}
      >
        <div>Copyright © {new Date().getFullYear()}</div>
        <div style={{ color: "var(--blue-main)", fontWeight: 900 }}>Masapa & Villaraiz</div>
      </div>
    </aside>
  );
}