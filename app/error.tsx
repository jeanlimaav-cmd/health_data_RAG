"use client";

// Route-level error boundary. Replaces Next.js's bare "Application error: a
// client-side exception has occurred" with the actual message, so any runtime
// failure (including on Vercel) is visible instead of a blank screen.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        maxWidth: 640,
        margin: "80px auto",
        padding: "0 24px",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        color: "#0c1c2b",
      }}
    >
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
  );
}
