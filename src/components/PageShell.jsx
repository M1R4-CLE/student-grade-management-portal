"use client";

import AppSidebar from "./AppSidebar";
import RightPanel from "./RightPanel";
import ToastCenter from "./ToastCenter";
import { useRealtimeNotifications } from "./useRealtimeNotifications";
import { ChevronLeft, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
  const [mobileMenuClosing, setMobileMenuClosing] = useState(false);
  const [mobileRightOpen, setMobileRightOpen] = useState(false);
  const [mobileRightClosing, setMobileRightClosing] = useState(false);
  const mobileMenuTimerRef = useRef(null);
  const mobileRightTimerRef = useRef(null);
  const drawerAnimationMs = 200;

  // 🔔 realtime notifications + toast popups
  const {
    items,
    lastNew,
    markOneAsRead,
    markAllAsRead,
    deleteOne,
    deleteAllRead,
  } = useRealtimeNotifications({ limit: 10 });

  const rightPanelProps = {
    fullName: fullName || (role === "teacher" ? "Teacher" : "Student"),
    studentId,
    upcoming,
    notifications: items,
    onMarkNotificationRead: markOneAsRead,
    onMarkAllNotificationsRead: markAllAsRead,
    onDeleteNotification: deleteOne,
    onDeleteReadNotifications: deleteAllRead,
  };

  const closeMobileMenu = () => {
    if (!mobileMenuOpen && !mobileMenuClosing) return;
    if (mobileMenuTimerRef.current) clearTimeout(mobileMenuTimerRef.current);
    setMobileMenuClosing(true);
    mobileMenuTimerRef.current = setTimeout(() => {
      setMobileMenuOpen(false);
      setMobileMenuClosing(false);
      mobileMenuTimerRef.current = null;
    }, drawerAnimationMs);
  };

  const openMobileMenu = () => {
    if (mobileMenuTimerRef.current) clearTimeout(mobileMenuTimerRef.current);
    setMobileMenuClosing(false);
    setMobileMenuOpen(true);
  };

  const closeMobileRight = () => {
    if (!mobileRightOpen && !mobileRightClosing) return;
    if (mobileRightTimerRef.current) clearTimeout(mobileRightTimerRef.current);
    setMobileRightClosing(true);
    mobileRightTimerRef.current = setTimeout(() => {
      setMobileRightOpen(false);
      setMobileRightClosing(false);
      mobileRightTimerRef.current = null;
    }, drawerAnimationMs);
  };

  const openMobileRight = () => {
    if (mobileRightTimerRef.current) clearTimeout(mobileRightTimerRef.current);
    setMobileRightClosing(false);
    setMobileRightOpen(true);
  };

  useEffect(
    () => () => {
      if (mobileMenuTimerRef.current) clearTimeout(mobileMenuTimerRef.current);
      if (mobileRightTimerRef.current) clearTimeout(mobileRightTimerRef.current);
    },
    []
  );

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
        aria-label={mobileMenuOpen ? "Hide menu" : "Open menu"}
        className={`mobile-menu-btn ${mobileMenuOpen && !mobileMenuClosing ? "open" : ""}`}
        aria-expanded={mobileMenuOpen && !mobileMenuClosing}
        onClick={() =>
          mobileMenuOpen && !mobileMenuClosing ? closeMobileMenu() : openMobileMenu()
        }
      >
        {mobileMenuOpen ? (
          <X size={18} />
        ) : (
          <Menu size={20} />
        )}
      </button>

      {showRightPanel && (
        <button
          type="button"
          aria-label={mobileRightOpen ? "Hide right panel" : "Open right panel"}
          className={`mobile-right-btn ${mobileRightOpen && !mobileRightClosing ? "open" : ""}`}
          aria-expanded={mobileRightOpen && !mobileRightClosing}
          onClick={() =>
            mobileRightOpen && !mobileRightClosing ? closeMobileRight() : openMobileRight()
          }
        >
          {mobileRightOpen ? (
            <X size={18} />
          ) : (
            <ChevronLeft size={20} />
          )}
        </button>
      )}

      {(mobileMenuOpen || mobileMenuClosing) && (
        <div
          className={`mobile-drawer-backdrop ${mobileMenuClosing ? "closing" : ""}`}
          onClick={closeMobileMenu}
        >
          <div
            className={`mobile-drawer ${mobileMenuClosing ? "closing" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <AppSidebar role={role} mobile onNavigate={closeMobileMenu} />
          </div>
        </div>
      )}

      {showRightPanel && (mobileRightOpen || mobileRightClosing) && (
        <div
          className={`mobile-right-drawer-backdrop ${mobileRightClosing ? "closing" : ""}`}
          onClick={closeMobileRight}
        >
          <div
            className={`mobile-right-drawer ${mobileRightClosing ? "closing" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <RightPanel {...rightPanelProps} />
          </div>
        </div>
      )}

      <div className="shell-body" style={{ display: "flex", gap: 18, alignItems: "stretch", height: "100%", minHeight: 0 }}>
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
          <RightPanel {...rightPanelProps} />
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

        .shell-right-panel {
          min-height: 0;
          height: 100%;
          overflow-y: auto;
          overflow-x: hidden;
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .shell-right-panel::-webkit-scrollbar {
          width: 0;
          height: 0;
        }

        .mobile-menu-btn {
          display: none;
          position: fixed;
          top: 12px;
          left: 12px;
          z-index: 100001;
          width: 42px;
          height: 38px;
          border-radius: 10px;
          border: 1px solid rgba(0, 0, 0, 0.12);
          background: white;
          color: #111827;
          cursor: pointer;
          align-items: center;
          justify-content: center;
          transition:
            background-color 180ms ease,
            border-color 180ms ease,
            color 180ms ease,
            box-shadow 180ms ease,
            transform 140ms ease;
        }

        .mobile-menu-btn.open {
          background: #ffffff;
          border-color: rgba(0, 0, 0, 0.12);
          color: #111827;
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.14);
        }

        .mobile-menu-btn:active {
          transform: scale(0.98);
        }

        .mobile-right-btn {
          display: none;
          position: fixed;
          top: 12px;
          right: 12px;
          z-index: 100001;
          width: 42px;
          height: 38px;
          border-radius: 10px;
          border: 1px solid rgba(0, 0, 0, 0.12);
          background: white;
          color: #111827;
          cursor: pointer;
          align-items: center;
          justify-content: center;
          transition:
            background-color 180ms ease,
            border-color 180ms ease,
            color 180ms ease,
            box-shadow 180ms ease,
            transform 140ms ease;
        }

        .mobile-right-btn.open {
          background: #ffffff;
          border-color: rgba(0, 0, 0, 0.12);
          color: #111827;
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.14);
        }

        .mobile-right-btn:active {
          transform: scale(0.98);
        }

        .mobile-drawer-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.35);
          z-index: 100000;
          animation: fadeInBackdrop 200ms ease-out;
        }

        .mobile-right-drawer-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.35);
          z-index: 100000;
          animation: fadeInBackdrop 200ms ease-out;
        }

        .mobile-drawer-backdrop.closing,
        .mobile-right-drawer-backdrop.closing {
          animation: fadeOutBackdrop 200ms ease-in forwards;
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

        .mobile-drawer.closing {
          animation: slideOutMenu 200ms ease-in forwards;
        }

        .mobile-right-drawer {
          margin-left: auto;
          width: min(340px, 92vw);
          height: 100%;
          padding: 10px;
          box-sizing: border-box;
          background: #f5f5f5;
          border-left: 1px solid rgba(0, 0, 0, 0.12);
          animation: slideInRight 200ms ease-out;
        }

        .mobile-right-drawer.closing {
          animation: slideOutRight 200ms ease-in forwards;
        }

        @keyframes fadeInBackdrop {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes fadeOutBackdrop {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }

        @keyframes slideInMenu {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(0);
          }
        }

        @keyframes slideOutMenu {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-100%);
          }
        }

        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }

        @keyframes slideOutRight {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(100%);
          }
        }

        @media (max-width: 980px) {
          .mobile-menu-btn,
          .mobile-right-btn {
            display: grid;
          }

          .mobile-drawer-backdrop,
          .mobile-right-drawer-backdrop {
            box-sizing: border-box;
          }

          .mobile-drawer,
          .mobile-right-drawer {
            height: 100%;
            padding-top: 0;
            padding-bottom: 0;
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
