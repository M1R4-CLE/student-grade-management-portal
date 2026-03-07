"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function fmtDate(d) {
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "";
  }
}

export default function NotificationsModal({
  open,
  onClose,
  items = [],
  onMarkOneRead,
  onMarkAllRead,
  onDeleteOne,
  onDeleteAllRead,
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const unreadCount = useMemo(
    () => (items || []).filter((x) => !x.read_at).length,
    [items]
  );

  if (!open) return null;

  const handleOpenNotif = async (n) => {
    if (!n) return;

    if (!n.read_at) await onMarkOneRead?.(n.id);

    if (n.type === "message") {
      let openId = null;

      if (typeof n.link === "string" && n.link.includes("?")) {
        try {
          const qs = n.link.split("?")[1];
          openId = new URLSearchParams(qs).get("open");
        } catch {}
      }

      const path = window.location.pathname;
      const base = path.startsWith("/teacher")
        ? "/teacher/messages"
        : path.startsWith("/student")
        ? "/student/messages"
        : "/student/messages";

      router.push(openId ? `${base}?open=${openId}` : base);
      onClose?.();
      return;
    }

    if (n.link) router.push(n.link);
    onClose?.();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.35)",
        display: "grid",
        placeItems: "center",
        zIndex: 99999,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="notifications-modal"
        style={{
          width: "min(700px, 96vw)",
          background: "white",
          borderRadius: 18,
          boxShadow: "0 20px 60px rgba(0,0,0,.25)",
          padding: 18,
        }}
      >
        <div className="notifications-header" style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Notifications</div>
            <div style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
              Unread: <b>{unreadCount}</b>
            </div>
          </div>

          <button
            onClick={onClose}
            className="notifications-close-btn"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,.08)",
              background: "transparent",
              cursor: "pointer",
              fontSize: 18,
            }}
            type="button"
          >
            x
          </button>
        </div>

        <div className="notifications-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
          <button
            onClick={async () => {
              setBusy(true);
              await onMarkAllRead?.();
              setBusy(false);
            }}
            disabled={busy || unreadCount === 0}
            className="notifications-action-btn"
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid rgba(0,0,0,.12)",
              background: "white",
              cursor: unreadCount === 0 ? "not-allowed" : "pointer",
              fontWeight: 800,
            }}
            type="button"
          >
            {busy ? "Marking..." : "Mark all as read"}
          </button>
          <button
            onClick={async () => {
              setBusy(true);
              await onDeleteAllRead?.();
              setBusy(false);
            }}
            disabled={busy}
            className="notifications-action-btn notifications-delete-all-btn"
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid rgba(220,38,38,.25)",
              background: "#fff5f5",
              color: "#b91c1c",
              cursor: "pointer",
              fontWeight: 800,
            }}
            type="button"
          >
            Delete read
          </button>
        </div>

        <div className="notifications-list" style={{ marginTop: 12, maxHeight: "68vh", overflowY: "auto", overflowX: "hidden" }}>
          {!items?.length ? (
            <div style={{ padding: 14, color: "#6b7280" }}>No notifications.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {items.map((n) => (
                <div
                  key={n.id}
                  className="notification-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleOpenNotif(n)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleOpenNotif(n);
                    }
                  }}
                  style={{
                    textAlign: "left",
                    width: "100%",
                    boxSizing: "border-box",
                    borderRadius: 14,
                    border: "1px solid rgba(0,0,0,.08)",
                    background: n.read_at ? "white" : "rgba(47,111,179,.08)",
                    padding: 12,
                    cursor: "pointer",
                  }}
                >
                  <div className="notification-card-inner" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div
                      className="notification-card-top"
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 900 }}>{n.title}</div>
                      </div>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          await onDeleteOne?.(n.id);
                        }}
                        className="notification-delete-btn"
                        style={{
                          alignSelf: "flex-start",
                          border: "1px solid rgba(220,38,38,.25)",
                          background: "#fff5f5",
                          color: "#b91c1c",
                          borderRadius: 999,
                          padding: "6px 10px",
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      {n.body && (
                        <div className="notification-body" style={{ color: "#374151", fontSize: 13, marginTop: 4 }}>
                          {n.body}
                        </div>
                      )}
                      <div
                        className="notification-meta-row"
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 8 }}
                      >
                        <div className="notification-meta" style={{ color: "#6b7280", fontSize: 12 }}>
                          {fmtDate(n.created_at)}
                        </div>
                        <div
                          className={`notification-status ${n.read_at ? "read" : "unread"}`}
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            borderRadius: 999,
                            padding: "4px 8px",
                            background: n.read_at ? "rgba(107,114,128,.12)" : "rgba(47,111,179,.12)",
                            color: n.read_at ? "#6b7280" : "#2f6fb3",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {n.read_at ? "Read" : "Unread"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <style jsx>{`
          .notifications-modal {
            max-height: min(760px, calc(100dvh - 32px));
            display: flex;
            flex-direction: column;
          }

          .notifications-list {
            flex: 1;
          }

          @media (max-width: 640px) {
            .notifications-modal {
              width: 100vw;
              max-height: 100dvh;
              min-height: 100dvh;
              border-radius: 0;
              padding: 16px 14px 14px;
            }

            .notifications-header {
              align-items: flex-start;
              padding-right: 44px;
              position: relative;
              min-height: 36px;
              padding-bottom: 12px;
              border-bottom: 1px solid rgba(0, 0, 0, 0.08);
            }

            .notifications-close-btn {
              position: absolute;
              top: 0;
              right: 0;
              background: #f8fafc !important;
            }

            .notifications-actions {
              justify-content: stretch !important;
              flex-direction: column;
              gap: 10px !important;
              margin-top: 12px !important;
            }

            .notifications-action-btn {
              width: 100%;
              min-height: 44px;
            }

            .notifications-list {
              max-height: none !important;
              padding-right: 0;
              margin-top: 14px !important;
            }

            .notification-card {
              padding: 14px !important;
              border-radius: 16px !important;
              background: #ffffff !important;
              box-shadow: 0 8px 20px rgba(15, 23, 42, 0.05);
            }

            .notification-card-top {
              gap: 8px !important;
            }

            .notification-card-inner {
              gap: 8px !important;
            }

            .notification-body {
              line-height: 1.5;
              word-break: break-word;
              font-size: 14px !important;
            }

            .notification-meta {
              line-height: 1.4;
            }

            .notification-meta-row {
              align-items: center !important;
              flex-wrap: wrap;
              gap: 8px !important;
            }

            .notification-delete-btn {
              width: auto;
              min-height: 32px;
              padding: 0 12px !important;
              border-radius: 999px !important;
              text-align: center;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
