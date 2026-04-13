"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ textAlign: "center", maxWidth: 420, padding: 32 }}>
        <h2 style={{ fontSize: 24, fontWeight: 600 }}>Something went wrong</h2>
        <p style={{ marginTop: 12, color: "#666", lineHeight: 1.6 }}>
          An unexpected error occurred. Please try again or contact support if the problem persists.
        </p>
        {error.digest ? (
          <p style={{ marginTop: 8, fontSize: 12, color: "#999" }}>Reference: {error.digest}</p>
        ) : null}
        <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "center" }}>
          <button
            onClick={unstable_retry}
            style={{ padding: "8px 20px", borderRadius: 9999, border: "1px solid #c41e3a", background: "#c41e3a", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
          >
            Retry
          </button>
          <button
            onClick={() => (window.location.href = "/")}
            style={{ padding: "8px 20px", borderRadius: 9999, border: "1px solid #222", background: "#fff", color: "#222", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
          >
            Go home
          </button>
        </div>
      </div>
    </div>
  );
}
