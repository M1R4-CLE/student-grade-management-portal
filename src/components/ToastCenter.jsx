"use client";

import { useEffect, useState } from "react";

export default function ToastCenter({ lastNotification }) {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    if (!lastNotification?.id) return;

    const toast = {
      id: `${lastNotification.id}-${Date.now()}`,
      title: lastNotification.title,
      body: lastNotification.body,
    };

    setToasts((prev) => [toast, ...prev].slice(0, 3));

    const t = setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== toast.id));
    }, 3500);

    return () => clearTimeout(t);
  }, [lastNotification]);

  if (!toasts.length) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 18,
        right: 18,
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            width: "min(360px, 92vw)",
            borderRadius: 14,
            border: "1px solid rgba(0,0,0,.12)",
            background: "white",
            boxShadow: "0 16px 40px rgba(0,0,0,.18)",
            padding: 12,
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 4 }}>{t.title}</div>
          <div style={{ fontSize: 13, color: "#374151" }}>{t.body}</div>
        </div>
      ))}
    </div>
  );
}