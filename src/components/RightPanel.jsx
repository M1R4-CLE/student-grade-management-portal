"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, MapPin } from "lucide-react";
import LogoutButton from "./LogoutButton";
import NotificationsModal from "./NotificationsModal";
import AgendaCalendar from "./AgendaCalendar";

function Card({ title, children }) {
  return (
    <div
      style={{
        background: "var(--card-bg)",
        border: "1px solid rgba(0,0,0,.06)", 
        borderRadius: "var(--radius-md)",
        padding: 14,
        boxShadow: "var(--shadow-soft)",
        backdropFilter: "blur(8px)",
      }}
    >
      {title ? (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: 10,
    }}
  >
    <div style={{ fontWeight: 900, color: "#111827" }}>{title}</div>

    <div
      style={{
        flex: 1,
        height: 2,
        background: "rgba(0,0,0,0.12)",
        borderRadius: 999,
      }}
    />
  </div>
) : null}
      {children}
    </div>
  );
}

function IconBtn({ title, onClick, children, badge }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        width: 34,
        height: 34,
        borderRadius: 12,
        border: "1px solid rgba(0,0,0,.10)",
        background: "white",
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        position: "relative",
      }}
    >
      {children}

      {badge ? (
        <div
          style={{
            position: "absolute",
            top: -6,
            right: -6,
            minWidth: 18,
            height: 18,
            padding: "0 6px",
            borderRadius: 999,
            background: "var(--blue-main)",
            color: "white",
            fontSize: 11,
            fontWeight: 900,
            display: "grid",
            placeItems: "center",
            border: "2px solid white",
          }}
        >
          {badge}
        </div>
      ) : null}
    </button>
  );
}

export default function RightPanel({
  fullName = "Student",
  studentId = "",
  upcoming = [],
  notifications = [],
}) {
  // date display
  const now = useMemo(() => new Date(), []);
  const dateStr = now.toLocaleString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  // notifications modal
  const [notifOpen, setNotifOpen] = useState(false);
  const unread = useMemo(
    () => (notifications || []).filter((n) => !n.read_at).length,
    [notifications]
  );

  // WEATHER (Open-Meteo)
  const [weather, setWeather] = useState({
    loading: true,
    error: "",
    temp: null,
    place: "",
  });

  useEffect(() => {
    let canceled = false;

    async function loadWeather() {
      try {
        setWeather({ loading: true, error: "", temp: null, place: "" });

        const pos = await new Promise((resolve, reject) => {
          if (!navigator.geolocation) reject(new Error("no geo"));
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 5000,
          });
        }).catch(() => null);

        const lat = pos?.coords?.latitude ?? 14.5995; // Manila fallback
        const lon = pos?.coords?.longitude ?? 120.9842;

        const url =
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&current=temperature_2m,weather_code&timezone=auto`;

        const r = await fetch(url);
        const j = await r.json();
        const t = j?.current?.temperature_2m;

        if (canceled) return;

        setWeather({
          loading: false,
          error: "",
          temp: typeof t === "number" ? t : null,
          place: pos ? "Your area" : "Manila (fallback)",
        });
      } catch {
        if (canceled) return;
        setWeather({
          loading: false,
          error: "Weather unavailable.",
          temp: null,
          place: "",
        });
      }
    }

    loadWeather();
    return () => {
      canceled = true;
    };
  }, []);

  return (
    <>
      {/* Notifications modal */}
      <NotificationsModal
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        items={notifications}
      />

      <aside
  style={{
    width: 320,
    display: "flex",
    flexDirection: "column",
    gap: 14,
    borderLeft: "1px solid #C9C9C9",
    paddingLeft: 14, // optional: keeps spacing nice after the line
  }}
>
        {/* Header card */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 900,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {fullName}
              </div>

              <div style={{ color: "#6b7280", fontSize: 12 }}>
                {studentId ? `Student ID: ${studentId}` : "Student"}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <IconBtn
                title="Notifications"
                onClick={() => setNotifOpen(true)}
                badge={unread ? String(unread) : null}
              >
                <Bell size={18} />
              </IconBtn>

              {/* ✅ ONLY logout confirm modal */}
              <LogoutButton />
            </div>
          </div>

          <div
            style={{
              marginTop: 12,
              background: "rgba(0,0,0,.03)",
              border: "1px solid rgba(0,0,0,.06)",  
              padding: "8px 10px",
              borderRadius: 12,
              fontSize: 12,
              color: "#111827",
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <span style={{ display: "grid", placeItems: "center" }}></span>
            <span>{dateStr}</span>
          </div>
        </Card>

        {/* Weather */}
        <Card title="Weather">
          {weather.loading ? (
            <div style={{ color: "#6b7280", fontSize: 13 }}>Loading weather...</div>
          ) : weather.error ? (
            <div style={{ color: "red", fontSize: 13 }}>{weather.error}</div>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 22 }}>
                  {weather.temp ?? "—"}°C
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#6b7280",
                    marginTop: 4,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <MapPin size={14} />
                  {weather.place}
                </div>
              </div>

              {/* animated orb */}
              <div
                className="wxOrb"
                title="Weather"
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 18,
                  position: "relative",
                  border: "1px solid rgba(0,0,0,.06)",
                  overflow: "hidden",
                  transformStyle: "preserve-3d",
                  boxShadow:
                    "0 18px 30px rgba(0,0,0,.12), inset 0 1px 0 rgba(255,255,255,.6)",
                  background:
                    "radial-gradient(circle at 30% 25%, rgba(255,255,255,.95), rgba(47,111,179,.18) 40%, rgba(87,180,71,.12) 78%)",
                }}
              >
                <div
                  className="wxShine"
                  style={{
                    position: "absolute",
                    inset: -20,
                    background:
                      "conic-gradient(from 180deg, rgba(255,255,255,.0), rgba(255,255,255,.55), rgba(255,255,255,.0))",
                    filter: "blur(2px)",
                    opacity: 0.55,
                  }}
                />
                <div
                  className="wxCloud"
                  style={{
                    position: "absolute",
                    bottom: 10,
                    left: 10,
                    width: 34,
                    height: 18,
                    borderRadius: 999,
                    background: "rgba(255,255,255,.9)",
                    boxShadow:
                      "0 10px 20px rgba(0,0,0,.10), inset 0 1px 0 rgba(255,255,255,.8)",
                  }}
                />
                <div
                  className="wxCloud2"
                  style={{
                    position: "absolute",
                    bottom: 16,
                    left: 18,
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    background: "rgba(255,255,255,.92)",
                    boxShadow:
                      "0 10px 20px rgba(0,0,0,.08), inset 0 1px 0 rgba(255,255,255,.8)",
                  }}
                />
              </div>
            </div>
          )}

          <style jsx>{`
            .wxOrb {
              animation: wxFloat 2.6s ease-in-out infinite;
            }
            .wxShine {
              animation: wxSpin 3.2s linear infinite;
            }
            .wxCloud {
              animation: wxDrift 3.6s ease-in-out infinite;
            }
            .wxCloud2 {
              animation: wxDrift2 3.6s ease-in-out infinite;
            }

            @keyframes wxFloat {
              0% {
                transform: perspective(700px) rotateX(10deg) rotateY(-12deg)
                  translateY(0px);
              }
              50% {
                transform: perspective(700px) rotateX(16deg) rotateY(12deg)
                  translateY(-3px);
              }
              100% {
                transform: perspective(700px) rotateX(10deg) rotateY(-12deg)
                  translateY(0px);
              }
            }
            @keyframes wxSpin {
              from {
                transform: rotate(0deg);
              }
              to {
                transform: rotate(360deg);
              }
            }
            @keyframes wxDrift {
              0%,
              100% {
                transform: translateX(0px);
              }
              50% {
                transform: translateX(3px);
              }
            }
            @keyframes wxDrift2 {
              0%,
              100% {
                transform: translateX(0px);
              }
              50% {
                transform: translateX(-3px);
              }
            }
          `}</style>
        </Card>

        {/* Agenda */}
        <Card title="Agenda">
          <AgendaCalendar />

          <div style={{ marginTop: 12 }}>
            {upcoming.length === 0 ? (
              <div style={{ fontSize: 12, color: "#6b7280" }}>No upcoming items.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {upcoming.map((u, idx) => (
                  <div
                    key={idx}
                    style={{
                      borderTop: "1px solid rgba(0,0,0,.06)",
                      paddingTop: 10,
                    }}
                  >
                    <div style={{ fontWeight: 900, fontSize: 12 }}>{u.title}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{u.when}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </aside>
    </>
  );
}