"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";

function fmtTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function computeFolder(m, userId) {
  const isSender = m.sender_id === userId;
  if (isSender && m.sender_deleted_at) return "hidden";
  if (!isSender && m.recipient_deleted_at) return "hidden";
  if (isSender) return m.sender_trashed_at ? "trash" : "sent";
  return m.recipient_trashed_at ? "trash" : "inbox";
}

export default function StudentMessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [folder, setFolder] = useState("inbox");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(20);

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeRecipientId, setComposeRecipientId] = useState("");
  const [recipientOptions, setRecipientOptions] = useState([]);
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [openMsg, setOpenMsg] = useState(null);

  const [selectedIds, setSelectedIds] = useState([]);
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState("");

  const [userId, setUserId] = useState("");
  const [myRole, setMyRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const openId = searchParams.get("open");

  useEffect(() => {
    let channelA;
    let channelB;
    let alive = true;

    async function loadMessages(uid) {
      const { data, error } = await supabase
        .from("messages")
        .select(
          `
          id, created_at, sender_id, recipient_id,
          subject, body,
          sender_trashed_at, recipient_trashed_at, recipient_read_at,
          sender_deleted_at, recipient_deleted_at,
          sender:profiles!messages_sender_id_fkey(full_name,email),
          recipient:profiles!messages_recipient_id_fkey(full_name,email)
        `
        )
        .or(`sender_id.eq.${uid},recipient_id.eq.${uid}`)
        .order("created_at", { ascending: false })
        .limit(200);

      if (!alive) return;

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

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user;
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: roleErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!alive) return;

      if (roleErr) {
        setStatus(roleErr.message || "Unable to verify account role.");
        setLoading(false);
        return;
      }

      if (!profile || profile.role !== "student") {
        router.replace("/teacher/Dashboard");
        return;
      }

      setUserId(user.id);
      setMyRole(profile.role);
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

  const refreshUnreadCount = async () => {
    if (!userId) return;

    const { count, error } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .is("recipient_read_at", null)
      .is("recipient_trashed_at", null);

    if (!error) setUnreadCount(count || 0);
  };


  useEffect(() => {
    if (!userId) return;

    refreshUnreadCount();

    const channel = supabase
      .channel("realtime-messages-student")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const m = payload.new;
          if (m.recipient_id === userId) {
            setToast("New message received!");
            setTimeout(() => setToast(""), 3000);
            await refreshUnreadCount();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const visibleMessages = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = messages.filter((m) => {
      if (computeFolder(m, userId) === "hidden") return false;
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
    await refreshUnreadCount();
    setStatus("Selected messages moved to Trash.");
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
    await refreshUnreadCount();
  };

  useEffect(() => {
    const openFromQuery = async () => {
      if (!openId || !userId) return;

      const { data, error } = await supabase
        .from("messages")
        .select(
          `
          id, created_at, sender_id, recipient_id,
          subject, body,
          sender_trashed_at, recipient_trashed_at, recipient_read_at,
          sender_deleted_at, recipient_deleted_at,
          sender:profiles!messages_sender_id_fkey(full_name,email),
          recipient:profiles!messages_recipient_id_fkey(full_name,email)
        `
        )
        .eq("id", openId)
        .single();

      if (error || !data) return;

      setOpenMsg(data);
      if (data.recipient_id === userId && !data.recipient_read_at) {
        await markAsRead(data.id);
      }
    };

    openFromQuery();
  }, [openId, userId]);

  if (loading) return <div style={{ padding: 20 }}>Loading...</div>;

  return (
    <div style={wrap}>
      {toast && <div style={toastStyle}>{toast}</div>}
      <div style={card}>
        <div style={title}>Message Inbox</div>

        <div style={topBar}>
          <button
            onClick={async () => {
              setComposeSubject("");
              setComposeBody("");
              setComposeOpen(true);
              await loadRecipients();
            }}
            style={composeBtn}
            type="button"
          >
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

          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={pageSelect}>
            <option value={20}>20</option>
            <option value={10}>10</option>
            <option value={5}>5</option>
          </select>
        </div>

        <div style={bodyGrid}>
          <div style={folders}>
            <Folder
              label={
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                  <span>Inbox</span>
                  {unreadCount > 0 && <span style={badgeStyle}>{unreadCount}</span>}
                </div>
              }
              active={folder === "inbox"}
              onClick={() => setFolder("inbox")}
            />
            <Folder label="Sent" active={folder === "sent"} onClick={() => setFolder("sent")} />
            <Folder label="Trash" active={folder === "trash"} onClick={() => setFolder("trash")} />
          </div>

          <div style={listArea}>
            <div style={divider} />

            {visibleMessages.length === 0 ? (
              <div style={empty}>No messages in this folder.</div>
            ) : (
              visibleMessages.map((m) => (
                <div
                  key={m.id}
                  style={{ ...row, cursor: "pointer" }}
                  onClick={async () => {
                    setOpenMsg(m);
                    if (m.recipient_id === userId && !m.recipient_read_at) {
                      await markAsRead(m.id);
                    }
                  }}
                >
                  <div style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(m.id)}
                      onChange={() => toggleRow(m.id)}
                      onClick={(e) => e.stopPropagation()}
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
              {folder === "trash" ? (
                <button onClick={deleteForeverSelected} style={trashBtn} type="button" disabled={!selectedIds.length}>
                  Delete Forever
                </button>
              ) : (
                <button onClick={moveSelectedToTrash} style={trashBtn} type="button" disabled={!selectedIds.length}>
                  Move selected to Trash
                </button>
              )}
              <div style={shown}>{visibleMessages.length} shown</div>
            </div>

            {status ? <div style={statusText}>{status}</div> : null}
          </div>
        </div>
      </div>

      {composeOpen && (
        <div onClick={() => setComposeOpen(false)} style={modalOverlay}>
          <div onClick={(e) => e.stopPropagation()} style={modalCard}>
            <div style={modalHeader}>
              <span>Compose</span>
              <button onClick={() => setComposeOpen(false)} style={modalClose} type="button">x</button>
            </div>

            <div style={{ padding: 12 }}>
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
                <button onClick={sendMessage} style={sendBtn} type="button" disabled={sending}>
                  {sending ? "Sending..." : "Send"}
                </button>
                <button onClick={() => setComposeOpen(false)} style={cancelBtn} type="button">
                  Cancel
                </button>
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

function Folder({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ ...folderBtn, background: active ? "#eef3fb" : "transparent" }} type="button">
      {label}
    </button>
  );
}

/* ===========================
   STYLES
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
  maxWidth: 1100, // was 980
  margin: "0 auto",
  minHeight: 560, // was 520
};

const title = {
  fontWeight: 800,
  color: "#1f4d9c",
  marginBottom: 10,
  fontSize: 20, // add this
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
  height: 38, // was 34
  border: "none",
  borderRadius: 4,
  textAlign: "left",
  padding: "0 12px",
  cursor: "pointer",
  fontSize: 14, // was 13
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
  gridTemplateColumns: "36px 220px 1fr 110px", // was 30/180/1fr/90
  alignItems: "center",
  minHeight: 46, // was 36
  padding: "8px 0", // was 6px 0
  fontSize: 14, // was 13
  borderBottom: "1px solid rgba(0,0,0,.05)",
};

const sender = { fontWeight: 800, color: "#111827", fontSize: 14 };
const subjectLine = { color: "#111827", fontSize: 14, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" };
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
const modalBackdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.25)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 1100,
};
const openModalCard = {
  width: "100%",
  maxWidth: 720,
  background: "#fff",
  border: "1px solid #d4d8de",
  borderRadius: 8,
  padding: 16,
};
const closeBtn = {
  border: "1px solid #d4d8de",
  background: "#fff",
  borderRadius: 6,
  height: 32,
  padding: "0 10px",
  cursor: "pointer",
};
const btnSecondary = {
  border: "1px solid #d4d8de",
  background: "#fff",
  color: "#6b7280",
  borderRadius: 6,
  height: 34,
  padding: "0 14px",
  cursor: "pointer",
};
const messageBodyBox = {
  marginTop: 12,
  border: "1px solid #ddd",
  padding: 12,
  borderRadius: 8,
  minHeight: 180,
  whiteSpace: "pre-wrap",
};
const toastStyle = {
  position: "fixed",
  top: 20,
  right: 20,
  background: "#2e7d32",
  color: "white",
  padding: "10px 14px",
  borderRadius: 8,
  zIndex: 9999,
};
const badgeStyle = {
  background: "red",
  color: "white",
  borderRadius: 999,
  padding: "2px 8px",
  fontSize: 12,
};
