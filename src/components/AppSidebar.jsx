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
  Settings,
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

export default function AppSidebar({ role = "student" }) {
  const pathname = usePathname();

  const links =
    role === "teacher"
      ? [
          { label: "Home Page", href: "/teacher/Dashboard", icon: LayoutDashboard },
          { label: "Class Management", href: "/teacher/Class-Management", icon: ClipboardList },
          { label: "Grade Entry", href: "/teacher/Grade-Entry", icon: PencilRuler },
          { label: "Messages", href: "/teacher/messages", icon: MessageSquare },
          { label: "Profile", href: "/teacher/Profile", icon: User },
          { label: "Settings", href: "/teacher/Settings", icon: Settings },
        ]
      : [
          { label: "Home Page", href: "/student/Dashboard", icon: Home },
          { label: "My Courses", href: "/student/Courses", icon: BookOpen },
          { label: "Messages", href: "/student/messages", icon: MessageSquare },
          { label: "My Grades", href: "/student/Grades", icon: BarChart3 },
          { label: "Profile", href: "/student/Profile", icon: User },
          { label: "Settings", href: "/student/Settings", icon: Settings },
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
        <BrandLogo size={48} compact={false} />
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {links.map((l) => {
          const active = pathname === l.href;
          const Icon = l.icon;

          return (
            <Link key={l.href} href={l.href} style={baseItemStyle(active)}>
              <NavIcon Icon={Icon} active={active} />
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
        <div style={{ color: "var(--blue-main)", fontWeight: 900 }}>
          Masapa & Villaraiz
        </div>
      </div>
    </aside>
  );
}