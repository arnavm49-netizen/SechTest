import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ textAlign: "center", maxWidth: 420, padding: 32 }}>
        <p style={{ fontSize: 48, fontWeight: 700, color: "#c41e3a" }}>404</p>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 8 }}>Page not found</h2>
        <p style={{ marginTop: 12, color: "#666", lineHeight: 1.6 }}>
          The page you are looking for does not exist or has been moved.
        </p>
        <div style={{ marginTop: 24 }}>
          <Link
            href="/"
            style={{ padding: "8px 20px", borderRadius: 9999, border: "1px solid #c41e3a", background: "#c41e3a", color: "#fff", fontWeight: 600, fontSize: 14, textDecoration: "none" }}
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
