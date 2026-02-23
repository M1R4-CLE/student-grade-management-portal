"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { useRouter } from "next/navigation";

function fmtTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function computeFolder(m, userId) {
  if (m.sender_id === userId) return m.sender_trashed_at ? "trash" : "sent";
  return m.recipient_trashed_at ? "trash" : "inbox";
}

export default function StudentMessagesPage() {
  const router = useRouter();

  const [folder, setFolder] = useState("inbox");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(20);

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");

  const [selectedIds, setSelectedIds] = useState([]);
  const [status, setStatus] = useState("");

  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    let channelA;
    let channelB;

    async function loadMessages(uid) {
      const { data, error } = await supabase
        .from("messages")
        .select(
          `
          id, created_at, sender_id, recipient_id,
          subject, body,
          sender_trashed_at, recipient_trashed_at, recipient_read_at,
          sender:profiles!messages_sender_id_fkey(full_name,email),
          recipient:profiles!messages_recipient_id_fkey(full_name,email)
        `
        )
        .or(`sender_id.eq.${uid},recipient_id.eq.${uid}`)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        setStatus(error.message);
        setMessages([]);
        return;
      }

      const mapped = (data || []).map((m) => {
        const senderName = m.sender?.full_name || m.sender?.email || "Unknown";
        const preview = (m.body || "").slice(0, 40);
        return {
          ...m,
          senderName,
          preview,
          time: fmtTime(m.created_at),
          folder: computeFolder(m, uid),
        };
      });

      setMessages(mapped);
    }

    async function boot() {
      setLoading(true);
      setStatus("");

      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!profile || profile.role !== "student") {
        router.replace("/teacher/Dashboard");
        return;
      }

      setUserId(user.id);
      await loadMessages(user.id);

      channelA = supabase
        .channel(`messages-sender-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "messages", filter: `sender_id=eq.${user.id}` },
          () => loadMessages(user.id)
        )
        .subscribe();

      channelB = supabase
        .channel(`messages-recipient-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "messages", filter: `recipient_id=eq.${user.id}` },
          () => loadMessages(user.id)
        )
        .subscribe();

      setLoading(false);
    }

    boot();

    return () => {
      if (channelA) supabase.removeChannel(channelA);
      if (channelB) supabase.removeChannel(channelB);
    };
  }, [router]);

  const visibleMessages = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = messages.filter((m) => {
      if (m.folder !== folder) return false;
      if (!q) return true;
      return (
        (m.senderName || "").toLowerCase().includes(q) ||
        (m.subject || "").toLowerCase().includes(q) ||
        (m.preview || "").toLowerCase().includes(q)
      );
    });
    return filtered.slice(0, pageSize);
  }, [messages, folder, search, pageSize]);

  const allChecked =
    visibleMessages.length > 0 && visibleMessages.every((m) => selectedIds.includes(m.id));

  const toggleSelectAll = () => {
    if (allChecked) {
      setSelectedIds((prev) => prev.filter((id) => !visibleMessages.some((m) => m.id === id)));
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      visibleMessages.forEach((m) => next.add(m.id));
      return [...next];
    });
  };

  const toggleRow = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const moveSelectedToTrash = async () => {
    if (!selectedIds.length || !userId) return;

    setStatus("Moving to Trash...");

    const { error: e1 } = await supabase
      .from("messages")
      .update({ sender_trashed_at: new Date().toISOString() })
      .eq("sender_id", userId)
      .in("id", selectedIds);

    const { error: e2 } = await supabase
      .from("messages")
      .update({ recipient_trashed_at: new Date().toISOString() })
      .eq("recipient_id", userId)
      .in("id", selectedIds);

    if (e1 || e2) {
      setStatus((e1 || e2)?.message || "Failed to move messages.");
      return;
    }

    setSelectedIds([]);
    setStatus("Selected messages moved to Trash.");
  };

  const sendMessage = async () => {
    if (!composeTo.trim()) {
      setStatus("Please enter recipient email.");
      return;
    }
    if (!userId) {
      setStatus("Not logged in.");
      return;
    }

    setStatus("Sending...");

    const { data: rec, error: recErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", composeTo.trim())
      .single();

    if (recErr || !rec?.id) {
      setStatus("Recipient not found. Make sure the email exists in profiles.");
      return;
    }

    const { error } = await supabase.from("messages").insert([
      {
        sender_id: userId,
        recipient_id: rec.id,
        subject: composeSubject.trim() || "(No Subject)",
        body: composeBody.trim(),
      },
    ]);

    if (error) {
      setStatus(error.message);
      return;
    }

    setComposeTo("");
    setComposeSubject("");
    setComposeBody("");
    setComposeOpen(false);
    setFolder("sent");
    setStatus("Message sent.");
  };

  if (loading) return <div style={{ padding: 20 }}>Loading...</div>;

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={title}>Message Inbox</div>

        {/* TOP BAR */}
        <div style={topBar}>
          <button onClick={() => setComposeOpen(true)} style={composeBtn}>
            COMPOSE
          </button>

          <label style={selectAll}>
            <input type="checkbox" checked={allChecked} onChange={toggleSelectAll} />
            <span style={{ marginLeft: 8 }}>SELECT ALL</span>
          </label>

          <div style={{ flex: 1 }} />

          <div style={searchWrap}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for.."
              style={searchInput}
            />
            <span style={searchIcon}></span>
          </div>

          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            style={pageSelect}
          >
            <option value={20}>20</option>
            <option value={10}>10</option>
            <option value={5}>5</option>
          </select>
        </div>

        {/* BODY */}
        <div style={bodyGrid}>
          {/* LEFT FOLDERS */}
          <div style={folders}>
            <Folder label="Messages inbox" active={folder === "inbox"} onClick={() => setFolder("inbox")} />
            <Folder label="Sent" active={folder === "sent"} onClick={() => setFolder("sent")} />
            <Folder label="Trash" active={folder === "trash"} onClick={() => setFolder("trash")} />
          </div>

          {/* RIGHT LIST */}
          <div style={listArea}>
            <div style={divider} />

            {visibleMessages.length === 0 ? (
              <div style={empty}>No messages in this folder.</div>
            ) : (
              visibleMessages.map((m) => (
                <div key={m.id} style={row}>
                  <div style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(m.id)}
                      onChange={() => toggleRow(m.id)}
                    />
                  </div>

                  <div style={sender}>{m.senderName}</div>

                  <div style={subjectLine}>
                    <span style={{ fontWeight: 700 }}>{m.subject || "(No Subject)"}</span>
                    {m.preview ? <span style={{ marginLeft: 10, color: "#6b7280" }}>{m.preview}</span> : null}
                  </div>

                  <div style={time}>{m.time}</div>
                </div>
              ))
            )}

            <div style={footerBar}>
              <button onClick={moveSelectedToTrash} style={trashBtn}>
                Move selected to Trash
              </button>
              <div style={shown}>{visibleMessages.length} shown</div>
            </div>

            {status ? <div style={statusText}>{status}</div> : null}
          </div>
        </div>
      </div>

      {/* COMPOSE MODAL */}
      {composeOpen && (
        <div onClick={() => setComposeOpen(false)} style={modalOverlay}>
          <div onClick={(e) => e.stopPropagation()} style={modalCard}>
            <div style={modalHeader}>
              <span>Compose</span>
              <button onClick={() => setComposeOpen(false)} style={modalClose}>
                ×
              </button>
            </div>

            <div style={{ padding: 12 }}>
              <div style={label}>To</div>
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
                style={composeTextarea}
              />

              <div style={modalBtns}>
                <button onClick={sendMessage} style={sendBtn}>
                  Send
                </button>
                <button onClick={() => setComposeOpen(false)} style={cancelBtn}>
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

function Folder({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ ...folderBtn, background: active ? "#eef3fb" : "transparent" }}>
      {label}
    </button>
  );
}

/* ===========================
   STYLES (matches screenshot)
=========================== */

const wrap = {
  background: "#efefef",
  minHeight: "100%",
  padding: 18,
};

const card = {
  background: "#f6f6f6",
  borderRadius: 6,
  border: "1px solid rgba(0,0,0,.10)",
  padding: 16,
  maxWidth: 980,
  margin: "0 auto",
  minHeight: 520,
};

const title = {
  fontWeight: 800,
  color: "#1f4d9c",
  marginBottom: 10,
};

const topBar = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  paddingBottom: 10,
};

const composeBtn = {
  width: 220,
  height: 36,
  border: "none",
  borderRadius: 4,
  background: "#56b446",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const selectAll = {
  display: "flex",
  alignItems: "center",
  height: 36,
  padding: "0 10px",
  border: "1px solid #d1d5db",
  borderRadius: 4,
  background: "#f7f7f7",
  color: "#6b7280",
  fontSize: 12,
};

const searchWrap = {
  width: 260,
  height: 34,
  border: "1px solid #d1d5db",
  borderRadius: 4,
  background: "white",
  display: "flex",
  alignItems: "center",
  padding: "0 8px",
};

const searchInput = {
  border: "none",
  outline: "none",
  flex: 1,
  fontSize: 12,
};

const searchIcon = { fontSize: 12, color: "#6b7280" };

const pageSelect = {
  width: 70,
  height: 34,
  border: "1px solid #d1d5db",
  borderRadius: 4,
  background: "white",
  fontSize: 12,
};

const bodyGrid = {
  display: "grid",
  gridTemplateColumns: "220px 1fr",
  gap: 14,
  marginTop: 6,
};

const folders = {
  paddingTop: 2,
};

const folderBtn = {
  width: "100%",
  height: 34,
  border: "none",
  borderRadius: 4,
  textAlign: "left",
  padding: "0 10px",
  cursor: "pointer",
  fontSize: 13,
  color: "#111827",
  marginBottom: 6,
};

const listArea = {
  background: "transparent",
  minHeight: 380,
};

const divider = {
  height: 1,
  background: "#e5e7eb",
  marginBottom: 6,
};

const empty = {
  padding: 10,
  color: "#6b7280",
  fontSize: 13,
};

const row = {
  display: "grid",
  gridTemplateColumns: "30px 180px 1fr 90px",
  alignItems: "center",
  minHeight: 36,
  padding: "6px 0",
  fontSize: 13,
  borderBottom: "1px solid rgba(0,0,0,.05)",
};

const sender = { fontWeight: 800, color: "#111827" };

const subjectLine = { color: "#111827", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" };

const time = { textAlign: "right", color: "#111827" };

const footerBar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: 10,
};

const trashBtn = {
  height: 32,
  borderRadius: 4,
  border: "1px solid #d1d5db",
  background: "#f7f7f7",
  padding: "0 10px",
  cursor: "pointer",
  fontSize: 12,
};

const shown = { fontSize: 12, color: "#6b7280" };

const statusText = { marginTop: 8, fontSize: 12, color: "#3d7f35" };

/* Modal */
const modalOverlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.25)",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  padding: "24px 18px",
  overflowY: "auto",
  zIndex: 1000,
};

const modalCard = {
  width: "100%",
  maxWidth: 920,
  background: "#fff",
  border: "1px solid #d4d8de",
  borderRadius: 8,
  overflow: "hidden",
};

const modalHeader = {
  height: 44,
  borderBottom: "1px solid #e5e7eb",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 12px",
  fontSize: 20,
  color: "#222",
};

const modalClose = {
  border: "none",
  background: "transparent",
  fontSize: 24,
  cursor: "pointer",
};

const label = { fontSize: 13, color: "#4b5563", marginBottom: 6 };

const composeInput = {
  width: "100%",
  height: 38,
  border: "1px solid #d9dde3",
  borderRadius: 6,
  padding: "0 10px",
  outline: "none",
  fontSize: 14,
};

const composeTextarea = {
  marginTop: 10,
  width: "100%",
  minHeight: 180,
  border: "1px solid #d9dde3",
  borderRadius: 6,
  padding: 10,
  outline: "none",
  resize: "vertical",
  fontSize: 14,
};

const modalBtns = { marginTop: 10, display: "flex", justifyContent: "flex-end", gap: 8 };

const sendBtn = {
  height: 34,
  border: "none",
  background: "#56b446",
  color: "#fff",
  borderRadius: 6,
  padding: "0 16px",
  fontSize: 14,
  cursor: "pointer",
};

const cancelBtn = {
  height: 34,
  border: "1px solid #d4d8de",
  background: "#fff",
  color: "#6b7280",
  borderRadius: 6,
  padding: "0 14px",
  fontSize: 14,
  cursor: "pointer",
};