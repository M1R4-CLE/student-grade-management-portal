"use client";

import { useMemo, useState } from "react";

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function TeacherMessagesPage() {
  const [folder, setFolder] = useState("inbox");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(20);

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");

  const [selectedIds, setSelectedIds] = useState([]);
  const [status, setStatus] = useState("");

  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "Daryll Masapa",
      to: "teacher@school.edu",
      subject: "Sir",
      preview: "In re..",
      time: "5:13 PM",
      folder: "inbox",
    },
    {
      id: 2,
      sender: "Princess Jelyn Mae Villariz",
      to: "teacher@school.edu",
      subject: "Good Morn..",
      preview: "",
      time: "10:10 AM",
      folder: "inbox",
    },
  ]);

  const visibleMessages = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = messages.filter((m) => {
      if (m.folder !== folder) return false;
      if (!q) return true;
      return (
        (m.sender || "").toLowerCase().includes(q) ||
        (m.subject || "").toLowerCase().includes(q) ||
        (m.preview || "").toLowerCase().includes(q)
      );
    });
    return filtered.slice(0, pageSize);
  }, [messages, folder, search, pageSize]);

  const allChecked =
    visibleMessages.length > 0 &&
    visibleMessages.every((m) => selectedIds.includes(m.id));

  const toggleSelectAll = () => {
    if (allChecked) {
      setSelectedIds((prev) =>
        prev.filter((id) => !visibleMessages.some((m) => m.id === id))
      );
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      visibleMessages.forEach((m) => next.add(m.id));
      return [...next];
    });
  };

  const toggleRow = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const moveSelectedToTrash = () => {
    if (!selectedIds.length) return;
    setMessages((prev) =>
      prev.map((m) => (selectedIds.includes(m.id) ? { ...m, folder: "trash" } : m))
    );
    setSelectedIds([]);
    setStatus("Selected messages moved to Trash.");
  };

  const sendMessage = () => {
    if (!composeTo.trim()) {
      setStatus("Please enter recipient email.");
      return;
    }

    const newMsg = {
      id: Date.now(),
      sender: "You",
      to: composeTo.trim(),
      subject: composeSubject.trim() || "(No Subject)",
      preview: composeBody.trim().slice(0, 32),
      time: nowTime(),
      folder: "sent",
    };

    setMessages((prev) => [newMsg, ...prev]);
    setComposeTo("");
    setComposeSubject("");
    setComposeBody("");
    setComposeOpen(false);
    setFolder("sent");
    setStatus("Message sent.");
  };

  return (
    <div style={{ padding: 20, background: "#f4f5f7", minHeight: "100%" }}>
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          padding: 16,
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#1f4d9c",
            marginBottom: 14,
          }}
        >
          Message Inbox
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "230px 1fr",
            gap: 16,
          }}
        >
          <div>
            <button
              onClick={() => setComposeOpen(true)}
              style={{
                width: "100%",
                height: 40,
                border: "none",
                borderRadius: 6,
                background: "#56b446",
                color: "#fff",
                fontSize: 18,
                fontWeight: 700,
                cursor: "pointer",
                marginBottom: 12,
              }}
            >
              COMPOSE
            </button>

            <FolderButton
              label="📨 Messages inbox"
              active={folder === "inbox"}
              onClick={() => setFolder("inbox")}
            />
            <FolderButton
              label="✉️ Sent"
              active={folder === "sent"}
              onClick={() => setFolder("sent")}
            />
            <FolderButton
              label="🗑️ Trash"
              active={folder === "trash"}
              onClick={() => setFolder("trash")}
            />
          </div>

          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
                gap: 10,
              }}
            >
              <label
                style={{
                  height: 38,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  border: "1px solid #d9dde3",
                  borderRadius: 6,
                  padding: "0 10px",
                  color: "#666",
                  fontSize: 14,
                }}
              >
                <input type="checkbox" checked={allChecked} onChange={toggleSelectAll} />
                SELECT ALL
              </label>

              <div style={{ display: "flex", gap: 8 }}>
                <div
                  style={{
                    width: 280,
                    height: 38,
                    border: "1px solid #d9dde3",
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                    padding: "0 10px",
                  }}
                >
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search for.."
                    style={{ border: "none", outline: "none", flex: 1, fontSize: 14 }}
                  />
                  <span style={{ fontSize: 14, color: "#777" }}>🔍</span>
                </div>

                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  style={{
                    width: 78,
                    height: 38,
                    border: "1px solid #d9dde3",
                    borderRadius: 6,
                    fontSize: 14,
                    color: "#444",
                  }}
                >
                  <option value={20}>20</option>
                  <option value={10}>10</option>
                  <option value={5}>5</option>
                </select>
              </div>
            </div>

            <div style={{ borderTop: "1px solid #eceff3" }}>
              {visibleMessages.length === 0 ? (
                <div style={{ padding: 12, color: "#7a7a7a", fontSize: 14 }}>
                  No messages in this folder.
                </div>
              ) : (
                visibleMessages.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "36px 1.2fr 1fr 90px",
                      alignItems: "center",
                      minHeight: 52,
                      borderBottom: "1px solid #f0f2f5",
                      fontSize: 16,
                      color: "#1f2937",
                    }}
                  >
                    <div style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(m.id)}
                        onChange={() => toggleRow(m.id)}
                      />
                    </div>
                    <div style={{ paddingRight: 10 }}>{m.sender}</div>
                    <div style={{ color: "#111827" }}>
                      {m.subject} {m.preview}
                    </div>
                    <div style={{ textAlign: "right", color: "#111827" }}>{m.time}</div>
                  </div>
                ))
              )}
            </div>

            <div
              style={{
                marginTop: 10,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <button
                onClick={moveSelectedToTrash}
                style={{
                  height: 32,
                  border: "1px solid #d4d8de",
                  background: "#fff",
                  borderRadius: 6,
                  padding: "0 10px",
                  fontSize: 13,
                  color: "#4b5563",
                  cursor: "pointer",
                }}
              >
                Move selected to Trash
              </button>
              <div style={{ fontSize: 13, color: "#8a8f98" }}>
                {visibleMessages.length} shown
              </div>
            </div>

            {status && <div style={{ marginTop: 8, fontSize: 13, color: "#3d7f35" }}>{status}</div>}
          </div>
        </div>
      </div>

      {composeOpen && (
        <div
          onClick={() => setComposeOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.25)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "24px 18px",
            overflowY: "auto",
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 920,
              background: "#fff",
              border: "1px solid #d4d8de",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: 44,
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 12px",
                fontSize: 24,
                color: "#222",
              }}
            >
              <span>Compose</span>
              <button
                onClick={() => setComposeOpen(false)}
                style={{ border: "none", background: "transparent", fontSize: 24, cursor: "pointer" }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: 12 }}>
              <div style={{ fontSize: 14, color: "#4b5563", marginBottom: 6 }}>To</div>
              <input
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                placeholder="Start typing an email.."
                style={composeInput}
              />

              <input
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                placeholder="Subject"
                style={{ ...composeInput, marginTop: 8 }}
              />

              <textarea
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                placeholder="Write your message..."
                style={{
                  marginTop: 10,
                  width: "100%",
                  minHeight: 180,
                  border: "1px solid #d9dde3",
                  borderRadius: 6,
                  padding: 10,
                  outline: "none",
                  resize: "vertical",
                  fontSize: 14,
                }}
              />

              <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  onClick={sendMessage}
                  style={{
                    height: 34,
                    border: "none",
                    background: "#56b446",
                    color: "#fff",
                    borderRadius: 6,
                    padding: "0 16px",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  Send
                </button>
                <button
                  onClick={() => setComposeOpen(false)}
                  style={{
                    height: 34,
                    border: "1px solid #d4d8de",
                    background: "#fff",
                    color: "#6b7280",
                    borderRadius: 6,
                    padding: "0 14px",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FolderButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        height: 38,
        border: "none",
        borderRadius: 6,
        background: active ? "#eef3fb" : "transparent",
        textAlign: "left",
        padding: "0 10px",
        fontSize: 16,
        color: "#1f2937",
        cursor: "pointer",
        marginBottom: 4,
      }}
    >
      {label}
    </button>
  );
}

const composeInput = {
  width: "100%",
  height: 38,
  border: "1px solid #d9dde3",
  borderRadius: 6,
  padding: "0 10px",
  outline: "none",
  fontSize: 14,
};