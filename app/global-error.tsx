"use client";

// Root error boundary — catches errors in the root layout itself. Must render
// its own <html>/<body>. Shows the real message instead of a blank screen.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          color: "#0c1c2b",
          background: "#eef5fb",
        }}
      >
        <div style={{ maxWidth: 640, margin: "80px auto", padding: "0 24px" }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: "#5a7186", marginBottom: 16 }}>
            {error?.message || "An unexpected error occurred."}
            {error?.digest ? ` (ref: ${error.digest})` : ""}
          </p>
          <button
            onClick={reset}
            style={{
              background: "#0ea5b7",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "10px 18px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
