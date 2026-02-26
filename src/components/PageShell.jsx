"use client";

import AppSidebar from "./AppSidebar";
import RightPanel from "./RightPanel";
import ToastCenter from "./ToastCenter";
import { useRealtimeNotifications } from "./useRealtimeNotifications";

export default function PageShell({
  title,
  children,
  role = "student",
  fullName = "",
  studentId = "",
  showRightPanel = true,
  upcoming = [],
}) {
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
    <div style={{ padding: 20 }}>
      <ToastCenter lastNotification={lastNew} />

      <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
        <AppSidebar role={role} />

        <main
          style={{
            flex: 1,
            minHeight: "calc(100vh - 40px)",
            background: "var(--card-bg)",
            border: "1px solid var(--border-light)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-soft)",
            padding: 18,
            backdropFilter: "blur(8px)",
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
        )}
      </div>
    </div>
  );
}
