"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";

function fmtDate(d) {
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "";
  }
}

export default function NotificationsModal({ open, onClose, items = [] }) {
  const [busy, setBusy] = useState(false);

  const unreadCount = useMemo(
    () => (items || []).filter((x) => !x.read_at).length,
    [items]
  );

  if (!open) return null;

  const markAllRead = async () => {
    setBusy(true);
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      setBusy(false);
      return;
    }

    // mark all unread as read
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);

    setBusy(false);
  };

  const markOneRead = async (id) => {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .is("read_at", null);
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
          >
            ✕
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
          <button
            onClick={markAllRead}
            disabled={busy || unreadCount === 0}
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid rgba(0,0,0,.12)",
              background: "white",
              cursor: unreadCount === 0 ? "not-allowed" : "pointer",
              fontWeight: 800,
            }}
          >
            {busy ? "Marking..." : "Mark all as read"}
          </button>
        </div>

        <div style={{ marginTop: 12, maxHeight: "60vh", overflow: "auto" }}>
          {!items?.length ? (
            <div style={{ padding: 14, color: "#6b7280" }}>No notifications.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markOneRead(n.id)}
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
                  <div style={{ fontWeight: 900 }}>{n.title}</div>
                  {n.body && (
                    <div style={{ color: "#374151", fontSize: 13, marginTop: 4 }}>
                      {n.body}
                    </div>
                  )}
                  <div style={{ color: "#6b7280", fontSize: 12, marginTop: 6 }}>
                    {fmtDate(n.created_at)} {n.read_at ? "• Read" : "• Unread"}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}