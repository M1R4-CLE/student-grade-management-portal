"use client";

import { useMemo, useState } from "react";

const styles = {
  card: {
    borderRadius: 18,
    border: "1px solid var(--border)",
    background: "var(--card)",
  },
  btn: {
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,.10)",
    background: "white",
    cursor: "pointer",
    fontWeight: 800,
    fontFamily: "var(--font-main)",
  },
};

export default function StudentMessagesPage() {
  const [folder, setFolder] = useState("inbox"); // inbox | sent | trash
  const [query, setQuery] = useState("");

  const allMessages = useMemo(
    () => [
      {
        id: 1,
        from: "Clyde Balamgnan",
        subject: "Hello",
        time: "7:13 PM",
        folder: "inbox",
        body: "Hi! Just checking in.",
      },
    ],
    []
  );

  const messages = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allMessages
      .filter((m) => m.folder === folder)
      .filter(
        (m) =>
          !q ||
          m.from.toLowerCase().includes(q) ||
          m.subject.toLowerCase().includes(q) ||
          m.body.toLowerCase().includes(q)
      );
  }, [allMessages, folder, query]);

  return (
    <div style={{ fontFamily: "var(--font-main)" }}>
      {/* Header / Title Card */}
      <div
        style={{
          ...styles.card,
          padding: 14,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontWeight: 900,
            fontSize: 20,
            color: "var(--blue-dark)",
            letterSpacing: 0.2,
          }}
        >
          Message Inbox
        </div>

        <div style={{ marginTop: 6, color: "var(--gray-brand)", fontSize: 13 }}>
          View announcements and messages from your instructors.
        </div>
      </div>

      {/* Main grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "260px 1fr",
          gap: 14,
        }}
      >
        {/* Left mailbox actions */}
        <div style={{ ...styles.card, padding: 14, height: "fit-content" }}>
          <button
            type="button"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "none",
              background: "var(--green-main)",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
              marginBottom: 12,
              boxShadow: "0 10px 20px rgba(0,0,0,.08)",
            }}
            onClick={() => alert("Compose UI can be added later")}
          >
            COMPOSE
          </button>

          <NavButton
            active={folder === "inbox"}
            onClick={() => setFolder("inbox")}
            label="Messages inbox"
          />
          <NavButton
            active={folder === "sent"}
            onClick={() => setFolder("sent")}
            label="Sent"
          />
          <NavButton
            active={folder === "trash"}
            onClick={() => setFolder("trash")}
            label="Trash"
          />
        </div>

        {/* Right message list */}
        <div style={{ ...styles.card, overflow: "hidden" }}>
          {/* toolbar */}
          <div
            style={{
              padding: 12,
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "var(--gray-brand)",
                fontWeight: 700,
              }}
            >
              <input type="checkbox" />
              SELECT ALL
            </label>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Search */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  border: "1px solid rgba(0,0,0,.12)",
                  borderRadius: 12,
                  padding: "6px 10px",
                  background: "white",
                  boxShadow: "0 6px 14px rgba(0,0,0,.05)",
                }}
              >
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search for..."
                  style={{
                    border: "none",
                    outline: "none",
                    width: 220,
                    fontFamily: "var(--font-main)",
                    fontWeight: 600,
                  }}
                />
                <span style={{ opacity: 0.6, color: "var(--blue-main)" }}>
                  🔎
                </span>
              </div>

              {/* Page size */}
              <select
                defaultValue="20"
                style={{
                  border: "1px solid rgba(0,0,0,.12)",
                  borderRadius: 12,
                  padding: "6px 10px",
                  background: "white",
                  fontFamily: "var(--font-main)",
                  fontWeight: 700,
                  color: "var(--blue-dark)",
                }}
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
            </div>
          </div>

          {/* list */}
          <div>
            {!messages.length ? (
              <div style={{ padding: 16, color: "var(--gray-brand)" }}>
                No messages in this folder.
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "28px 220px 1fr 90px",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    borderBottom: "1px solid var(--border)",
                    background: "white",
                  }}
                >
                  <input type="checkbox" />

                  <div style={{ fontWeight: 900, color: "var(--blue-dark)" }}>
                    {m.from}
                  </div>

                  <div style={{ color: "var(--text)", fontWeight: 700 }}>
                    {m.subject}
                  </div>

                  <div
                    style={{
                      textAlign: "right",
                      color: "var(--gray-brand)",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {m.time}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NavButton({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: active ? "white" : "transparent",
        fontWeight: 900,
        cursor: "pointer",
        marginBottom: 8,
        color: active ? "var(--blue-main)" : "var(--blue-dark)",
        boxShadow: active ? "0 10px 20px rgba(0,0,0,.06)" : "none",
        fontFamily: "var(--font-main)",
      }}
    >
      {/* little accent dot */}
      <span
        style={{
          display: "inline-block",
          width: 10,
          height: 10,
          borderRadius: 999,
          marginRight: 10,
          background: active ? "var(--green-main)" : "var(--blue-light)",
          verticalAlign: "middle",
        }}
      />
      {label}
    </button>
  );
}