"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function LogoutConfirmModal({ open, onClose, onConfirm }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prev || "auto";
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,.35)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2147483647, // 🔥 max safe z-index
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(680px, 95vw)",
          background: "white",
          borderRadius: 18,
          boxShadow: "0 30px 80px rgba(0,0,0,.25)",
          padding: 22,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 20 }}>Are you sure?</div>
            <div style={{ color: "#6b7280", marginTop: 6, fontSize: 13 }}>
              You will no longer be logged in on selected devices.
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,.12)",
              background: "white",
              cursor: "pointer",
              fontSize: 18,
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div
          style={{
            marginTop: 18,
            display: "flex",
            justifyContent: "center",
            gap: 12,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "10px 26px",
              borderRadius: 999,
              border: "1px solid rgba(0,0,0,.18)",
              background: "white",
              fontWeight: 700,
              cursor: "pointer",
              minWidth: 130,
            }}
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            style={{
              padding: "10px 26px",
              borderRadius: 999,
              border: "none",
              background: "#2f6fb3",
              color: "white",
              fontWeight: 800,
              cursor: "pointer",
              minWidth: 130,
            }}
          >
            Log out
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}