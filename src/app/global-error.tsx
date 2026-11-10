"use client";

/** Last-resort boundary for errors in the root layout. Renders its own document, so styles are inline. */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#080808", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
        <title>Something went wrong · On The Sol Sports Academy</title>
        <main style={{ maxWidth: 440, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 40, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "-0.01em" }}>Out of bounds.</h1>
          <p style={{ margin: "0 0 24px", color: "#bdbdbd" }}>
            Something went wrong on our side{error.digest ? ` (ref ${error.digest})` : ""}. Please try again.
          </p>
          <button
            onClick={() => retry()}
            style={{ font: "inherit", fontWeight: 700, padding: "12px 24px", borderRadius: 999, border: 0, background: "#b7ff00", color: "#080808", cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
