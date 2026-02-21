export default function BrandLogo({ size = 70, compact = false }) {
  const titleSize = size * 0.55;   // scales main text
  const subtitleSize = size * 0.22; // scales subtitle

  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.25 }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        aria-label="Student Grade logo"
      >
        <rect
          x="8"
          y="12"
          width="48"
          height="32"
          rx="4"
          fill="none"
          stroke="var(--blue-main)"
          strokeWidth="3"
        />
        <rect x="16" y="30" width="6" height="10" rx="1" fill="var(--blue-light)" />
        <rect x="26" y="26" width="6" height="14" rx="1" fill="var(--blue-light)" />
        <rect x="36" y="22" width="6" height="18" rx="1" fill="var(--blue-light)" />
        <rect x="46" y="18" width="6" height="22" rx="1" fill="var(--green-main)" />
        <path
          d="M6 46h52c0 6-6 10-12 10H18C12 56 6 52 6 46z"
          fill="var(--blue-dark)"
          opacity="0.95"
        />
      </svg>

      {!compact && (
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ fontSize: titleSize, fontWeight: 900 }}>
            <span style={{ color: "var(--blue-main)" }}>Student </span>
            <span style={{ color: "var(--green-main)" }}>Grade</span>
          </div>
          <div
            style={{
              fontSize: subtitleSize,
              letterSpacing: 2,
              color: "var(--gray-text)",
            }}
          >
            MANAGEMENT PORTAL
          </div>
        </div>
      )}
    </div>
  );
}