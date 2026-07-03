import type { Metadata } from "next";
import "./globals.css";

// This is a fully interactive, per-user app — render on demand, don't
// statically prerender at build time (where public env vars may be absent).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "rag-doc-qa — Grounded Document Q&A",
  description:
    "Ingest documents, retrieve with pgvector, answer with citations, refuse when unsupported.",
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
