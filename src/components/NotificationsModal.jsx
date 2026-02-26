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
        style={{
          width: "min(560px, 95vw)",
          background: "white",
          borderRadius: 18,
          boxShadow: "0 20px 60px rgba(0,0,0,.25)",
          padding: 18,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Notifications</div>
            <div style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
              Unread: <b>{unreadCount}</b>
            </div>
          </div>

          <button
            onClick={onClose}
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

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
          <button
            onClick={async () => {
              setBusy(true);
              await onMarkAllRead?.();
              setBusy(false);
            }}
            disabled={busy || unreadCount === 0}
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

        <div style={{ marginTop: 12, maxHeight: "60vh", overflow: "auto" }}>
          {!items?.length ? (
            <div style={{ padding: 14, color: "#6b7280" }}>No notifications.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {items.map((n) => (
                <div
                  key={n.id}
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
                    borderRadius: 14,
                    border: "1px solid rgba(0,0,0,.08)",
                    background: n.read_at ? "white" : "rgba(47,111,179,.08)",
                    padding: 12,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900 }}>{n.title}</div>
                      {n.body && (
                        <div style={{ color: "#374151", fontSize: 13, marginTop: 4 }}>
                          {n.body}
                        </div>
                      )}
                      <div style={{ color: "#6b7280", fontSize: 12, marginTop: 6 }}>
                        {fmtDate(n.created_at)} {n.read_at ? "- Read" : "- Unread"}
                      </div>
                    </div>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        await onDeleteOne?.(n.id);
                      }}
                      style={{
                        alignSelf: "flex-start",
                        border: "1px solid rgba(220,38,38,.25)",
                        background: "#fff5f5",
                        color: "#b91c1c",
                        borderRadius: 8,
                        padding: "6px 8px",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}