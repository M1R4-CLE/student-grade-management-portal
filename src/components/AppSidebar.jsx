"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandLogo from "./BrandLogo";

import {
  Home,
  BookOpen,
  MessageSquare,
  BarChart3,
  User,
  LayoutDashboard,
  ClipboardList,
  PencilRuler,
} from "lucide-react";

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
  whiteSpace: "nowrap",
});

function NavIcon({ Icon, active }) {
  return (
    <div
      style={{
        width: 34,
        height: 34,
        borderRadius: 10,
        display: "grid",
        placeItems: "center",
        background: active ? "rgba(47,111,179,.10)" : "rgba(0,0,0,.03)",
        border: "1px solid rgba(0,0,0,.06)",
      }}
    >
      <Icon
        size={18}
        strokeWidth={2}
        color={active ? "var(--blue-main)" : "#6b7280"}
      />
    </div>
  );
}

export default function AppSidebar({ role = "student", mobile = false, onNavigate }) {
  const pathname = usePathname();

  const links =
    role === "teacher"
      ? [
          { label: "Home Page", href: "/teacher/dashboard", icon: LayoutDashboard },
          { label: "Class Management", href: "/teacher/class-management", icon: ClipboardList },
          { label: "Grade Entry", href: "/teacher/grade-entry", icon: PencilRuler },
          { label: "Messages", href: "/teacher/messages", icon: MessageSquare },
          { label: "Profile", href: "/teacher/profile", icon: User },
          
        ]
      : [
          { label: "Home Page", href: "/student/dashboard", icon: Home },
          { label: "My Courses", href: "/student/courses", icon: BookOpen },
          { label: "Messages", href: "/student/messages", icon: MessageSquare },
          { label: "My Grades", href: "/student/grades", icon: BarChart3 },
          { label: "Profile", href: "/student/profile", icon: User },
          
        ];

  return (
    <aside
      style={{
        width: mobile ? "100%" : 292,
        minWidth: mobile ? 0 : 292,
        height: "100%",
        background: "var(--sidebar-bg)",
        borderRight: mobile ? "none" : "1px solid #C9C9C9",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-soft)",
        padding: 18,
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        backdropFilter: "blur(8px)",
      }}
    >
      <div style={{ marginBottom: 18 }}>
        <BrandLogo size={48} compact={false} />
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {links.map((l) => {
          const active = pathname === l.href;
          const Icon = l.icon;

          return (
            <Link
              key={l.href}
              href={l.href}
              style={baseItemStyle(active)}
              onClick={() => onNavigate?.()}
            >
              <NavIcon Icon={Icon} active={active} />
              {l.label}
            </Link>
          );
        })}
      </nav>

      <div
        style={{
          marginTop: "auto",
          color: "#6b7280",
          fontSize: 12,
        }}
      >
        <div>Copyright © {new Date().getFullYear()}</div>
        <div style={{ color: "var(--blue-main)", fontWeight: 900 }}>
          Masapa & Villaraiz
        </div>
      </div>
    </aside>
  );
}
