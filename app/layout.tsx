import type { Metadata } from "next";
import "./globals.css";

// This is a fully interactive, per-user app — render on demand, don't
// statically prerender at build time (where public env vars may be absent).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Health Data RAG — Grounded Clinical Q&A",
  description:
    "Ask a clinical knowledge base. Answers are grounded in the source records with citations, and refused honestly when the records don't contain them.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
