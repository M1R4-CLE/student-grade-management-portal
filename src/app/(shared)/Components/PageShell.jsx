export default function PageShell({ title, children }) {
  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>{title}</h1>
      <div style={{ background: "#111", border: "1px solid #222", padding: 16, borderRadius: 12 }}>
        {children}
      </div>
    </div>
  );
}