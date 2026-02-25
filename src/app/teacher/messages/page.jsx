"use client";

// ============================================================
// FILE: src/app/teacher/Messages/page.jsx
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { useRouter } from "next/navigation";

function fmtTime(ts) {
  try { return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }
  catch { return ""; }
}

function computeFolder(m, userId) {
  if (m.sender_id === userId) return m.sender_trashed_at ? "trash" : "sent";
  return m.recipient_trashed_at ? "trash" : "inbox";
}

export default function TeacherMessagesPage() {
  const router = useRouter();

  const [folder, setFolder]         = useState("inbox");
  const [search, setSearch]         = useState("");
  const [pageSize, setPageSize]     = useState(20);

  const [composeOpen, setComposeOpen]       = useState(false);
  const [composeTo, setComposeTo]           = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody]       = useState("");

  const [selectedIds, setSelectedIds] = useState([]);
  const [status, setStatus]           = useState("");

  const [userId, setUserId]   = useState("");
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    let channelA, channelB, alive = true;

    async function loadMessages(uid) {
      const { data } = await supabase
        .from("messages")
        .select(`
          id, created_at, sender_id, recipient_id,
          subject, body,
          sender_trashed_at, recipient_trashed_at, recipient_read_at,
          sender:profiles!messages_sender_id_fkey(full_name,email),
          recipient:profiles!messages_recipient_id_fkey(full_name,email)
        `)
        .or(`sender_id.eq.${uid},recipient_id.eq.${uid}`)
        .order("created_at", { ascending: false })
        .limit(200);

      if (alive) setMessages(data || []);
    }

    const run = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) { router.replace("/login"); return; }

      const { data: profile } = await supabase
        .from("profiles").select("role").eq("id", user.id).single();
      if (!profile || profile.role !== "teacher") { router.replace("/student/Dashboard"); return; }

      if (alive) { setUserId(user.id); setLoading(false); }
      await loadMessages(user.id);

      channelA = supabase.channel("teacher-msg-in")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${user.id}` },
          () => loadMessages(user.id))
        .subscribe();
      channelB = supabase.channel("teacher-msg-out")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `sender_id=eq.${user.id}` },
          () => loadMessages(user.id))
        .subscribe();
    };

    run();
    return () => {
      alive = false;
      if (channelA) supabase.removeChannel(channelA);
      if (channelB) supabase.removeChannel(channelB);
    };
  }, [router]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return messages
      .filter(m => computeFolder(m, userId) === folder)
      .filter(m => !q || m.subject?.toLowerCase().includes(q) || m.body?.toLowerCase().includes(q)
        || m.sender?.full_name?.toLowerCase().includes(q)
        || m.recipient?.full_name?.toLowerCase().includes(q))
      .slice(0, pageSize);
  }, [messages, folder, search, pageSize, userId]);

  const toggleSelect = (id) => setSelectedIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );
  const selectAll = () =>
    setSelectedIds(filtered.length === selectedIds.length ? [] : filtered.map(m => m.id));

  const trashSelected = async () => {
    if (!selectedIds.length) return;
    const now = new Date().toISOString();
    for (const id of selectedIds) {
      const msg = messages.find(m => m.id === id);
      if (!msg) continue;
      const isSender = msg.sender_id === userId;
      await supabase.from("messages").update(
        isSender ? { sender_trashed_at: now } : { recipient_trashed_at: now }
      ).eq("id", id);
    }
    setMessages(prev =>
      prev.map(m => {
        if (!selectedIds.includes(m.id)) return m;
        const isSender = m.sender_id === userId;
        return isSender ? { ...m, sender_trashed_at: new Date().toISOString() }
          : { ...m, recipient_trashed_at: new Date().toISOString() };
      })
    );
    setSelectedIds([]);
    setStatus("Moved to Trash.");
    setTimeout(() => setStatus(""), 3000);
  };

  const sendMessage = async () => {
    if (!composeTo.trim() || !composeBody.trim()) {
      setStatus("Recipient email and message body are required.");
      return;
    }
    const { data: recipient } = await supabase
      .from("profiles").select("id").eq("email", composeTo.trim()).single();
    if (!recipient) { setStatus("Recipient not found."); return; }

    const { error } = await supabase.from("messages").insert({
      sender_id: userId,
      recipient_id: recipient.id,
      subject: composeSubject.trim() || "(no subject)",
      body: composeBody.trim(),
    });

    if (error) { setStatus(error.message); return; }
    setComposeOpen(false);
    setComposeTo(""); setComposeSubject(""); setComposeBody("");
    setStatus("Message sent!");
    setTimeout(() => setStatus(""), 3000);
  };

  if (loading) return <div style={{ padding: 40 }}>Loading Messages…</div>;

  return (
    <div style={wrap}>
      <div style={{ ...titleStyle }}>Messages</div>

      <div style={card}>
        {/* Top bar */}
        <div style={topBar}>
          <button onClick={() => setComposeOpen(true)} style={composeBtn}>✏ Compose</button>
          <div style={selectAll_}>
            <input type="checkbox"
              checked={selectedIds.length === filtered.length && filtered.length > 0}
              onChange={selectAll}
            />
            <span style={{ marginLeft: 6, fontSize: 12 }}>Select All</span>
          </div>
          <div style={searchWrap}>
            <span style={searchIcon}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search mail" style={searchInput} />
          </div>
          <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} style={pageSelect}>
            {[10, 20, 50, 100].map(n => <option key={n}>{n}</option>)}
          </select>
        </div>

        {/* Body */}
        <div style={bodyGrid}>
          {/* Folders */}
          <div style={foldersStyle}>
            <Folder label="📥 Inbox" active={folder === "inbox"} onClick={() => setFolder("inbox")} />
            <Folder label="📤 Sent"  active={folder === "sent"}  onClick={() => setFolder("sent")} />
            <Folder label="🗑 Trash" active={folder === "trash"} onClick={() => setFolder("trash")} />
          </div>

          {/* Message list */}
          <div style={listArea}>
            <div style={divider} />
            {filtered.length === 0 ? (
              <div style={empty}>No messages in this folder.</div>
            ) : (
              filtered.map(m => {
                const isMe = m.sender_id === userId;
                const name = isMe
                  ? (m.recipient?.full_name || m.recipient?.email || "—")
                  : (m.sender?.full_name || m.sender?.email || "—");
                const unread = !isMe && !m.recipient_read_at;
                return (
                  <div key={m.id} style={{ ...row, background: unread ? "rgba(47,111,179,0.05)" : "transparent" }}>
                    <div style={{ paddingLeft: 6 }}>
                      <input type="checkbox"
                        checked={selectedIds.includes(m.id)}
                        onChange={() => toggleSelect(m.id)}
                      />
                    </div>
                    <div style={{ ...sender, fontWeight: unread ? 900 : 700 }}>
                      {isMe ? `To: ${name}` : name}
                    </div>
                    <div style={subjectLine}>
                      <span style={{ fontWeight: unread ? 800 : 500 }}>{m.subject || "(no subject)"}</span>
                      {m.body ? <span style={{ color: "#6b7280", marginLeft: 6 }}>— {m.body.slice(0, 60)}</span> : null}
                    </div>
                    <div style={time}>{fmtTime(m.created_at)}</div>
                  </div>
                );
              })
            )}

            {/* Footer */}
            <div style={footerBar}>
              <button onClick={trashSelected} disabled={!selectedIds.length} style={trashBtn}>
                🗑 Move to Trash
              </button>
              <span style={shown}>Showing {filtered.length} messages</span>
            </div>
            {status && <div style={statusText}>{status}</div>}
          </div>
        </div>
      </div>

      {/* Compose modal */}
      {composeOpen && (
        <div style={modalOverlay}>
          <div style={modalCard}>
            <div style={modalHeader}>
              <span>New Message</span>
              <button onClick={() => setComposeOpen(false)} style={modalClose}>✕</button>
            </div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <div style={label}>To (recipient email)</div>
                <input value={composeTo} onChange={e => setComposeTo(e.target.value)}
                  placeholder="student@school.edu" style={composeInput} />
              </div>
              <div>
                <div style={label}>Subject</div>
                <input value={composeSubject} onChange={e => setComposeSubject(e.target.value)}
                  placeholder="Subject" style={composeInput} />
              </div>
              <textarea
                value={composeBody}
                onChange={e => setComposeBody(e.target.value)}
                placeholder="Write your message…"
                style={composeTextarea}
              />
              <div style={modalBtns}>
                <button onClick={sendMessage} style={sendBtn} type="button">Send</button>
                <button onClick={() => setComposeOpen(false)} style={cancelBtn} type="button">Cancel</button>
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
    <button onClick={onClick}
      style={{ ...folderBtn, background: active ? "#eef3fb" : "transparent" }}
      type="button">
      {label}
    </button>
  );
}

// ── Styles ───────────────────────────────────────────────────
const wrap        = { background: "#efefef", minHeight: "100%", padding: 18 };
const titleStyle  = { fontWeight: 800, color: "#1f4d9c", marginBottom: 10, fontSize: 20 };
const card        = { background: "#f6f6f6", borderRadius: 6, border: "1px solid rgba(0,0,0,.10)", padding: 16, maxWidth: 1100, margin: "0 auto", minHeight: 560 };
const topBar      = { display: "flex", alignItems: "center", gap: 12, paddingBottom: 10 };
const composeBtn  = { width: 220, height: 36, border: "none", borderRadius: 4, background: "#56b446", color: "white", fontWeight: 800, cursor: "pointer" };
const selectAll_  = { display: "flex", alignItems: "center", height: 36, padding: "0 10px", border: "1px solid #d1d5db", borderRadius: 4, background: "#f7f7f7", color: "#6b7280", fontSize: 12 };
const searchWrap  = { width: 260, height: 34, border: "1px solid #d1d5db", borderRadius: 4, background: "white", display: "flex", alignItems: "center", padding: "0 8px" };
const searchInput = { border: "none", outline: "none", flex: 1, fontSize: 12 };
const searchIcon  = { fontSize: 12, color: "#6b7280" };
const pageSelect  = { width: 70, height: 34, border: "1px solid #d1d5db", borderRadius: 4, background: "white", fontSize: 12 };
const bodyGrid    = { display: "grid", gridTemplateColumns: "220px 1fr", gap: 14, marginTop: 6 };
const foldersStyle= { paddingTop: 2 };
const folderBtn   = { width: "100%", height: 38, border: "none", borderRadius: 4, textAlign: "left", padding: "0 12px", cursor: "pointer", fontSize: 14, color: "#111827", marginBottom: 8 };
const listArea    = { background: "transparent", minHeight: 380 };
const divider     = { height: 1, background: "#e5e7eb", marginBottom: 6 };
const empty       = { padding: 10, color: "#6b7280", fontSize: 13 };
const row         = { display: "grid", gridTemplateColumns: "36px 220px 1fr 110px", alignItems: "center", minHeight: 46, padding: "8px 0", fontSize: 14, borderBottom: "1px solid rgba(0,0,0,.05)" };
const sender      = { fontWeight: 800, color: "#111827", fontSize: 14 };
const subjectLine = { color: "#111827", fontSize: 14, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" };
const time        = { textAlign: "right", color: "#111827", fontSize: 13 };
const footerBar   = { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 };
const trashBtn    = { height: 32, borderRadius: 4, border: "1px solid #d1d5db", background: "#f7f7f7", padding: "0 10px", cursor: "pointer", fontSize: 12 };
const shown       = { fontSize: 12, color: "#6b7280" };
const statusText  = { marginTop: 8, fontSize: 12, color: "#3d7f35" };
const modalOverlay= { position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 18px", overflowY: "auto", zIndex: 1000 };
const modalCard   = { width: "100%", maxWidth: 920, background: "#fff", border: "1px solid #d4d8de", borderRadius: 8, overflow: "hidden" };
const modalHeader = { height: 44, borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", fontSize: 20, color: "#222" };
const modalClose  = { border: "none", background: "transparent", fontSize: 24, cursor: "pointer" };
const label       = { fontSize: 13, color: "#4b5563", marginBottom: 6 };
const composeInput= { width: "100%", height: 38, border: "1px solid #d9dde3", borderRadius: 6, padding: "0 10px", outline: "none", fontSize: 14 };
const composeTextarea = { marginTop: 10, width: "100%", minHeight: 180, border: "1px solid #d9dde3", borderRadius: 6, padding: 10, outline: "none", resize: "vertical", fontSize: 14 };
const modalBtns   = { marginTop: 10, display: "flex", justifyContent: "flex-end", gap: 8 };
const sendBtn     = { height: 34, border: "none", background: "#56b446", color: "#fff", borderRadius: 6, padding: "0 16px", fontSize: 14, cursor: "pointer" };
const cancelBtn   = { height: 34, border: "1px solid #d4d8de", background: "#fff", color: "#6b7280", borderRadius: 6, padding: "0 14px", fontSize: 14, cursor: "pointer" };