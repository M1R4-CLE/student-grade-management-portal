"use client";

// ============================================================
// FILE: src/app/teacher/Messages/page.jsx
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";

function fmtTime(ts) {
  try { return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }
  catch { return ""; }
}

function computeFolder(m, userId) {
  const isSender = m.sender_id === userId;
  if (isSender && m.sender_deleted_at) return "hidden";
  if (!isSender && m.recipient_deleted_at) return "hidden";
  if (isSender) return m.sender_trashed_at ? "trash" : "sent";
  return m.recipient_trashed_at ? "trash" : "inbox";
}

export default function TeacherMessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isMobile, setIsMobile] = useState(false);

  const [folder, setFolder]         = useState("inbox");
  const [search, setSearch]         = useState("");
  const [pageSize, setPageSize]     = useState(20);

  const [composeOpen, setComposeOpen]       = useState(false);
  const [composeRecipientId, setComposeRecipientId] = useState("");
  const [recipientOptions, setRecipientOptions] = useState([]);
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody]       = useState("");
  const [openMsg, setOpenMsg]               = useState(null);

  const [selectedIds, setSelectedIds] = useState([]);
  const [status, setStatus]           = useState("");
  const [sending, setSending]         = useState(false);
  const [toast, setToast]             = useState("");

  const [userId, setUserId]   = useState("");
  const [myRole, setMyRole]   = useState("");
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const openId = searchParams.get("open");

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 700px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    let channelA, channelB, alive = true;

    async function loadMessages(uid) {
      const { data } = await supabase
        .from("messages")
        .select(`
          id, created_at, sender_id, recipient_id,
          subject, body,
          sender_trashed_at, recipient_trashed_at, recipient_read_at,
          sender_deleted_at, recipient_deleted_at,
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
      const role = String(profile?.role || "").trim().toLowerCase();
      if (!profile || role !== "teacher") { router.replace("/student/dashboard"); return; }

      if (alive) {
        setUserId(user.id);
        setMyRole(role);
        setLoading(false);
      }
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

  const loadRecipients = async () => {
    setRecipientOptions([]);
    setComposeRecipientId("");

    if (!userId || !myRole) return;

    if (myRole === "teacher") {
      const { data, error } = await supabase
        .from("enrollments")
        .select(`
          student_id,
          courses!inner ( teacher_id )
        `)
        .eq("courses.teacher_id", userId);

      if (error) {
        console.error(error);
        setStatus(error.message);
        return;
      }

      const studentIds = [...new Set((data || []).map((r) => r.student_id))];
      if (studentIds.length === 0) {
        setRecipientOptions([]);
        return;
      }

      const { data: students, error: stuErr } = await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .in("id", studentIds)
        .order("full_name", { ascending: true });

      if (stuErr) {
        console.error(stuErr);
        setStatus(stuErr.message);
        return;
      }

      setRecipientOptions(students || []);
      return;
    }

    if (myRole === "student") {
      const { data, error } = await supabase
        .from("enrollments")
        .select(`
          courses!inner ( teacher_id )
        `)
        .eq("student_id", userId);

      if (error) {
        console.error(error);
        setStatus(error.message);
        return;
      }

      const teacherIds = [...new Set((data || []).map((r) => r.courses.teacher_id))];
      if (teacherIds.length === 0) {
        setRecipientOptions([]);
        return;
      }

      const { data: teachers, error: tErr } = await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .in("id", teacherIds)
        .order("full_name", { ascending: true });

      if (tErr) {
        console.error(tErr);
        setStatus(tErr.message);
        return;
      }

      setRecipientOptions(teachers || []);
    }
  };

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("realtime-messages-teacher")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const m = payload.new;
          if (m.recipient_id === userId) {
            setToast("New message received!");
            setTimeout(() => setToast(""), 3000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return messages
      .filter(m => computeFolder(m, userId) !== "hidden")
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

  const deleteForeverSelected = async () => {
    if (!selectedIds.length) return;
  
    const ids = [...selectedIds];
  
    // remove from UI instantly
    setMessages((prev) => prev.filter((m) => !ids.includes(m.id)));
    setSelectedIds([]);
  
    for (const id of ids) {
      const { error } = await supabase.rpc("delete_message_forever", {
        p_message_id: id,
      });
  
      if (error) {
        console.error("Delete forever failed:", error);
        setStatus("Delete forever failed.");
        setTimeout(() => setStatus(""), 3000);
      }
    }
  
    setStatus("Deleted forever (only for you).");
    setTimeout(() => setStatus(""), 3000);
  }; 

  const replyToMessage = async (msg) => {
    if (!msg) return;

    await loadRecipients();

    const originalSubject = msg.subject?.trim() || "(No Subject)";
    const subject = originalSubject.toLowerCase().startsWith("re:")
      ? originalSubject
      : `Re: ${originalSubject}`;

    setComposeRecipientId(msg.sender_id);
    setComposeSubject(subject);
    setComposeBody("");
    setComposeOpen(true);
  };

  const sendMessage = async () => {
    if (sending) return;

    console.log("sendMessage fired", new Date().toISOString());

    if (!composeRecipientId) {
      setStatus("Please select a recipient.");
      return;
    }
    if (!userId) {
      setStatus("Not logged in.");
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    const senderId = authData?.user?.id;
    if (!senderId) {
      setStatus("Not logged in.");
      return;
    }

    if (senderId !== userId) setUserId(senderId);

    setSending(true);
    setStatus("Sending...");

    const { data: msg, error } = await supabase.from("messages").insert([
      {
        sender_id: senderId,
        recipient_id: composeRecipientId,
        subject: composeSubject.trim() || "(No Subject)",
        body: composeBody.trim(),
      },
    ]).select("id").single();

    if (error) {
      setStatus(error.message);
      setSending(false);
      return;
    }
    if (msg?.id) {
      const recipient = recipientOptions.find((p) => p.id === composeRecipientId);
      const recipientRole = recipient?.role;
      const notifLink =
        recipientRole === "teacher"
          ? `/teacher/messages?open=${msg.id}`
          : `/student/messages?open=${msg.id}`;

      await supabase.from("notifications").insert({
        user_id: composeRecipientId,
        type: "message",
        title: "New message",
        body: composeSubject.trim() || "(No Subject)",
        link: notifLink,
      });
    }

    setComposeRecipientId("");
    setComposeSubject("");
    setComposeBody("");
    setComposeOpen(false);
    setFolder("sent");
    setStatus("Message sent.");
    setSending(false);
  };

  const markAsRead = async (msgId) => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("messages")
      .update({ recipient_read_at: now })
      .eq("id", msgId);
    if (error) {
      console.error(error);
      return;
    }
    setMessages((prev) =>
      prev.map((x) => (x.id === msgId ? { ...x, recipient_read_at: now } : x))
    );
    setOpenMsg((prev) => (prev?.id === msgId ? { ...prev, recipient_read_at: now } : prev));
  };

  useEffect(() => {
    if (!openId) return;
    if (!userId) return;

    const msg = messages.find((m) => String(m.id) === String(openId));

    if (msg) {
      const f = computeFolder(msg, userId);
      setFolder(f);
      setOpenMsg(msg);
      if (msg.recipient_id === userId && !msg.recipient_read_at) {
        markAsRead(msg.id);
      }
      return;
    }

    const fetchOne = async () => {
      const { data } = await supabase
        .from("messages")
        .select(`
          id, created_at, sender_id, recipient_id,
          subject, body,
          sender_trashed_at, recipient_trashed_at, recipient_read_at,
          sender_deleted_at, recipient_deleted_at,
          sender:profiles!messages_sender_id_fkey(full_name,email),
          recipient:profiles!messages_recipient_id_fkey(full_name,email)
        `)
        .eq("id", openId)
        .single();

      if (!data) return;

      setOpenMsg(data);
      setFolder(computeFolder(data, userId));

      if (data.recipient_id === userId && !data.recipient_read_at) {
        markAsRead(data.id);
      }
    };

    fetchOne();
  }, [openId, userId, messages]);

  if (loading) return <div style={{ padding: 40 }}>Loading Messages</div>;

  const wrapStyle = isMobile ? { ...wrap, padding: 10 } : wrap;
  const titleStyleLocal = isMobile ? { ...titleStyle, fontSize: 42, marginBottom: 10 } : titleStyle;
  const cardStyle = isMobile
    ? { ...card, padding: 12, borderRadius: 12, maxWidth: "100%", minHeight: 0, overflow: "hidden" }
    : card;
  const topBarStyle = isMobile
    ? {
        ...topBar,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(118px, 0.9fr)",
        columnGap: 8,
        rowGap: 8,
        alignItems: "stretch",
      }
    : topBar;
  const composeBtnStyle = isMobile ? { ...composeBtn, width: "100%", minWidth: 0, height: 38, boxSizing: "border-box" } : composeBtn;
  const selectAllStyle = isMobile
    ? {
        ...selectAll_,
        width: "100%",
        minWidth: 0,
        justifyContent: "center",
        fontSize: 10,
        padding: "0 8px",
        gap: 6,
        whiteSpace: "nowrap",
        overflow: "hidden",
        boxSizing: "border-box",
      }
    : selectAll_;
  const selectAllTextStyle = isMobile
    ? { marginLeft: 0, overflow: "hidden", textOverflow: "ellipsis" }
    : { marginLeft: 6, fontSize: 12 };
  const searchWrapStyle = isMobile
    ? { ...searchWrap, width: "100%", minWidth: 0, maxWidth: "100%", gridColumn: "1 / -1", height: 36, boxSizing: "border-box" }
    : searchWrap;
  const searchInputStyle = isMobile ? { ...searchInput, fontSize: 13, minWidth: 0 } : searchInput;
  const pageSelectStyle = isMobile
    ? { ...pageSelect, width: "100%", minWidth: 0, height: 36, gridColumn: "1 / -1" }
    : pageSelect;
  const bodyGridStyle = isMobile ? { ...bodyGrid, gridTemplateColumns: "1fr", gap: 10 } : bodyGrid;
  const foldersStyleLocal = isMobile
    ? { ...foldersStyle, display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8, paddingTop: 0 }
    : foldersStyle;
  const folderBtnStyle = isMobile
    ? { ...folderBtn, marginBottom: 0, height: 36, textAlign: "center", padding: "0 8px", fontSize: 13 }
    : folderBtn;
  const listAreaStyle = isMobile
    ? { ...listArea, minHeight: 300, border: "1px solid #e5e7eb", borderRadius: 10, padding: 8, background: "#fff", overflowX: "hidden" }
    : listArea;
  const rowStyle = isMobile
    ? { ...row, gridTemplateColumns: "28px 1fr", gap: 8, minHeight: 56, padding: "8px 0" }
    : row;
  const senderStyle = isMobile ? { ...sender, fontSize: 13 } : sender;
  const subjectLineStyle = isMobile
    ? {
        ...subjectLine,
        fontSize: 12,
        gridColumn: "2 / 3",
        whiteSpace: "normal",
        overflow: "hidden",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
      }
    : subjectLine;
  const footerBarStyle = isMobile ? { ...footerBar, flexDirection: "column", alignItems: "stretch", gap: 8 } : footerBar;
  const trashBtnStyle = isMobile ? { ...trashBtn, width: "100%", height: 34 } : trashBtn;
  const shownStyle = isMobile ? { ...shown, textAlign: "center" } : shown;

  return (
    <div style={wrapStyle}>
      {toast && (
        <div style={toastStyle}>
          {toast}
        </div>
      )}
      <div style={titleStyleLocal}>Messages</div>

      <div style={cardStyle}>
        {/* Top bar */}
        <div style={topBarStyle}>
          <button
            onClick={async () => {
              setComposeSubject("");
              setComposeBody("");
              setComposeOpen(true);
              await loadRecipients();
            }}
            style={composeBtnStyle}
            type="button"
          >
            Compose
          </button>
          <div style={selectAllStyle}>
            <input type="checkbox"
              checked={selectedIds.length === filtered.length && filtered.length > 0}
              onChange={selectAll}
            />
            <span style={selectAllTextStyle}>Select All</span>
          </div>
          <div style={searchWrapStyle}>
            <span style={searchIcon}>Search</span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search mail" style={searchInputStyle} />
          </div>
          <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} style={pageSelectStyle}>
            {[10, 20, 50, 100].map(n => <option key={n}>{n}</option>)}
          </select>
        </div>

        {/* Body */}
        <div style={bodyGridStyle}>
          {/* Folders */}
          <div style={foldersStyleLocal}>
            <Folder label="Inbox" active={folder === "inbox"} onClick={() => setFolder("inbox")} buttonStyle={folderBtnStyle} />
            <Folder label="Sent"  active={folder === "sent"}  onClick={() => setFolder("sent")} buttonStyle={folderBtnStyle} />
            <Folder label="Trash" active={folder === "trash"} onClick={() => setFolder("trash")} buttonStyle={folderBtnStyle} />
          </div>

          {/* Message list */}
          <div style={listAreaStyle}>
            <div style={divider} />
            {filtered.length === 0 ? (
              <div style={empty}>No messages in this folder.</div>
            ) : (
              filtered.map(m => {
                const isMe = m.sender_id === userId;
                const name = isMe
                  ? (m.recipient?.full_name || m.recipient?.email || "")
                  : (m.sender?.full_name || m.sender?.email || "");
                const unread = !isMe && !m.recipient_read_at;
                return (
                  <div
                    key={m.id}
                    style={{ ...rowStyle, background: unread ? "rgba(47,111,179,0.05)" : "transparent", cursor: "pointer" }}
                    onClick={async () => {
                      setOpenMsg(m);
                      if (m.recipient_id === userId && !m.recipient_read_at) {
                        await markAsRead(m.id);
                      }
                    }}
                  >
                    <div style={{ paddingLeft: 6 }}>
                      <input type="checkbox"
                        checked={selectedIds.includes(m.id)}
                        onChange={() => toggleSelect(m.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div style={{ ...senderStyle, fontWeight: unread ? 900 : 700 }}>
                      {isMe ? `To: ${name}` : name}
                    </div>
                    <div style={subjectLineStyle}>
                      <span style={{ fontWeight: unread ? 800 : 500 }}>{m.subject || "(no subject)"}</span>
                      {m.body ? <span style={{ color: "#6b7280", marginLeft: isMobile ? 0 : 6 }}> {m.body.slice(0, 60)}</span> : null}
                    </div>
                    {!isMobile && <div style={time}>{fmtTime(m.created_at)}</div>}
                  </div>
                );
              })
            )}

            {/* Footer */}
            <div style={footerBarStyle}>
              {folder === "trash" ? (
                <button onClick={deleteForeverSelected} disabled={!selectedIds.length} style={trashBtnStyle}>
                  Delete Forever
                </button>
              ) : (
                <button onClick={trashSelected} disabled={!selectedIds.length} style={trashBtnStyle}>
                  Move to Trash
                </button>
              )}
              <span style={shownStyle}>Showing {filtered.length} messages</span>
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
              <button onClick={() => setComposeOpen(false)} style={modalClose}>x</button>
            </div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <div style={label}>To</div>
                <select
                  value={composeRecipientId}
                  onChange={(e) => setComposeRecipientId(e.target.value)}
                  style={composeInput}
                >
                  <option value="">Select recipient...</option>
                  {recipientOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name || "(No name)"} ({p.email})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div style={label}>Subject</div>
                <input value={composeSubject} onChange={e => setComposeSubject(e.target.value)}
                  placeholder="Subject" style={composeInput} />
              </div>
              <textarea
                value={composeBody}
                onChange={e => setComposeBody(e.target.value)}
                placeholder="Write your message"
                style={composeTextarea}
              />
              <div style={modalBtns}>
                <button onClick={sendMessage} style={sendBtn} type="button" disabled={sending}>
                  {sending ? "Sending..." : "Send"}
                </button>
                <button onClick={() => setComposeOpen(false)} style={cancelBtn} type="button">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {openMsg && (
        <div style={modalBackdrop}>
          <div style={openModalCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Message</h3>
              <button onClick={() => setOpenMsg(null)} style={closeBtn} type="button">X</button>
            </div>

            <div style={{ marginTop: 10 }}>
              <div><b>Subject:</b> {openMsg.subject || "(No Subject)"}</div>
              <div><b>From:</b> {openMsg.sender?.full_name || openMsg.sender?.email || openMsg.sender_id}</div>
              <div><b>To:</b> {openMsg.recipient?.full_name || openMsg.recipient?.email || openMsg.recipient_id}</div>
            </div>

            <div style={messageBodyBox}>
              {openMsg.body || ""}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button
                onClick={async () => {
                  await replyToMessage(openMsg);
                  setOpenMsg(null);
                }}
                style={sendBtn}
                type="button"
              >
                Reply
              </button>
              <button onClick={() => setOpenMsg(null)} style={btnSecondary} type="button">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Folder({ label, active, onClick, buttonStyle }) {
  return (
    <button onClick={onClick}
      style={{ ...folderBtn, ...buttonStyle, background: active ? "#eef3fb" : "transparent" }}
      type="button">
      {label}
    </button>
  );
}

const toastStyle = {
  position: "fixed",
  top: 16,
  right: 16,
  zIndex: 1200,
  background: "#1f2937",
  color: "#fff",
  padding: "10px 12px",
  borderRadius: 8,
  fontSize: 12,
  boxShadow: "0 6px 18px rgba(0,0,0,0.2)",
};

const wrap = {
  background: "#efefef",
  minHeight: "100%",
  padding: 18,
};

const card = {
  background: "#f6f6f6",
  borderRadius: 6,
  border: "1px solid rgba(0,0,0,.10)",
  padding: 18,
  maxWidth: 1120,
  margin: "0 auto",
  minHeight: 600,
};

const title = {
  fontWeight: 800,
  color: "#1f4d9c",
  marginBottom: 12,
  fontSize: 22,
};
const titleStyle = title;

const topBar = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  paddingBottom: 12,
};

const composeBtn = {
  width: 240,
  height: 40,
  border: "none",
  borderRadius: 6,
  background: "#56b446",
  color: "white",
  fontWeight: 800,
  fontSize: 14,
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
const selectAll_ = selectAll;

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
  gridTemplateColumns: "250px 1fr",
  gap: 16,
  marginTop: 8,
};

const folders = {
  paddingTop: 2,
};
const foldersStyle = folders;

const folderBtn = {
  width: "100%",
  height: 40,
  border: "none",
  borderRadius: 6,
  textAlign: "left",
  padding: "0 12px",
  cursor: "pointer",
  fontSize: 14,
  color: "#111827",
  marginBottom: 8,
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
  gridTemplateColumns: "36px 220px 1fr 110px",
  alignItems: "center",
  minHeight: 46,
  padding: "8px 0",
  fontSize: 14,
  borderBottom: "1px solid rgba(0,0,0,.05)",
};

const sender = { fontWeight: 800, color: "#111827", fontSize: 14 };

const subjectLine = {
  color: "#111827",
  fontSize: 14,
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
};

const time = { textAlign: "right", color: "#111827", fontSize: 13 };

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
  maxWidth: 1040,
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
  height: 42,
  border: "1px solid #d9dde3",
  borderRadius: 6,
  padding: "0 12px",
  outline: "none",
  fontSize: 15,
};

const composeTextarea = {
  marginTop: 10,
  width: "100%",
  minHeight: 220,
  border: "1px solid #d9dde3",
  borderRadius: 6,
  padding: 12,
  outline: "none",
  resize: "vertical",
  fontSize: 15,
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

const modalBackdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1100,
  padding: 16,
};

const openModalCard = {
  width: "100%",
  maxWidth: 760,
  background: "#fff",
  borderRadius: 10,
  border: "1px solid #d4d8de",
  padding: 16,
  boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
};

const closeBtn = {
  width: 30,
  height: 30,
  borderRadius: 6,
  border: "1px solid #d1d5db",
  background: "#fff",
  cursor: "pointer",
  fontWeight: 700,
};

const messageBodyBox = {
  marginTop: 12,
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  background: "#f9fafb",
  padding: 12,
  minHeight: 120,
  whiteSpace: "pre-wrap",
};

const btnSecondary = {
  height: 34,
  border: "1px solid #d4d8de",
  background: "#fff",
  color: "#374151",
  borderRadius: 6,
  padding: "0 14px",
  fontSize: 14,
  cursor: "pointer",
};
