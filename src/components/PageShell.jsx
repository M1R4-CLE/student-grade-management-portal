"use client";

import AppSidebar from "./AppSidebar";
import RightPanel from "./RightPanel";
import ToastCenter from "./ToastCenter";
import { useRealtimeNotifications } from "./useRealtimeNotifications";
import { Menu } from "lucide-react";
import { useState } from "react";

export default function PageShell({
  title,
  children,
  role = "student",
  fullName = "",
  studentId = "",
  showRightPanel = true,
  upcoming = [],
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // 🔔 realtime notifications + toast popups
  const {
    items,
    lastNew,
    markOneAsRead,
    markAllAsRead,
    deleteOne,
    deleteAllRead,
  } = useRealtimeNotifications({ limit: 10 });

  return (
    <div
      style={{
        padding: 20,
        height: "100dvh",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <ToastCenter lastNotification={lastNew} />

      <button
        type="button"
        aria-label="Open menu"
        className="mobile-menu-btn"
        onClick={() => setMobileMenuOpen(true)}
      >
        <Menu size={20} />
      </button>

      {mobileMenuOpen && (
        <div
          className="mobile-drawer-backdrop"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="mobile-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <AppSidebar role={role} mobile onNavigate={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="shell-body" style={{ display: "flex", gap: 18, alignItems: "stretch", height: "100%" }}>
        <div className="shell-sidebar">
          <AppSidebar role={role} />
        </div>

        <main
          className="shell-main"
          style={{
            flex: 1,
            minHeight: 0,
            height: "100%",
            background: "var(--card-bg)",
            border: "1px solid var(--border-light)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-soft)",
            padding: 18,
            backdropFilter: "blur(8px)",
            overflowY: "auto",
            boxSizing: "border-box",
          }}
        >
          {title && (
            <div style={{ fontWeight: 900, color: "var(--blue-main)", marginBottom: 12 }}>
              {title}
            </div>
          )}

          {children}
        </main>

        {showRightPanel && (
          <div className="shell-right-panel">
          <RightPanel
            fullName={fullName || (role === "teacher" ? "Teacher" : "Student")}
            studentId={studentId}
            upcoming={upcoming}
            notifications={items}
            onMarkNotificationRead={markOneAsRead}
            onMarkAllNotificationsRead={markAllAsRead}
            onDeleteNotification={deleteOne}
            onDeleteReadNotifications={deleteAllRead}
          />
          </div>
        )}
      </div>

      <style jsx>{`
        .shell-main {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .shell-main::-webkit-scrollbar {
          width: 0;
          height: 0;
        }

        .mobile-menu-btn {
          display: none;
          position: fixed;
          top: 12px;
          left: 12px;
          z-index: 100001;
          width: 38px;
          height: 38px;
          border-radius: 10px;
          border: 1px solid rgba(0, 0, 0, 0.12);
          background: white;
          color: #111827;
          cursor: pointer;
          place-items: center;
        }

        .mobile-drawer-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.35);
          z-index: 100000;
        }

        .mobile-drawer {
          width: min(320px, 88vw);
          height: 100%;
          padding: 10px;
          box-sizing: border-box;
          background: #f5f5f5;
          border-right: 1px solid rgba(0, 0, 0, 0.12);
          animation: slideInMenu 200ms ease-out;
        }

        @keyframes slideInMenu {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(0);
          }
        }

        @media (max-width: 980px) {
          .mobile-menu-btn {
            display: grid;
          }

          .mobile-drawer-backdrop {
            padding-top: 56px;
            box-sizing: border-box;
          }

          .mobile-drawer {
            height: calc(100% - 56px);
          }

          .shell-sidebar,
          .shell-right-panel {
            display: none;
          }

          .shell-main {
            width: 100%;
            margin-top: 36px;
            padding: 14px !important;
          }
        }
      `}</style>
    </div>
  );
}
