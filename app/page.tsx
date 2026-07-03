"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { browserClient } from "@/lib/supabase";

interface Source {
  filename: string;
  chunk_index: number;
  similarity: number;
}

interface QueryResult {
  answer: string;
  grounded: boolean;
  sources: Source[];
  latency_ms: number;
}

interface LogRow {
  created_at: string;
  query: string;
  grounded: boolean;
  latency_ms: number;
}

export default function Home() {
  const supabase = useMemo(() => browserClient(), []);
  const [token, setToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Sign in anonymously so every row is scoped to a real auth.uid() (RLS).
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      let session = data.session;
      if (!session) {
        const { data: signIn, error } = await supabase.auth.signInAnonymously();
        if (error) {
          if (active)
            setAuthError(
              "Anonymous sign-in failed. Enable it in Supabase > Authentication > Providers.",
            );
          return;
        }
        session = signIn.session;
      }
      if (active) setToken(session?.access_token ?? null);
    })();
    return () => {
      active = false;
    };
  }, [supabase]);

  return (
    <div className="wrap">
      <header className="top">
        <h1>rag-doc-qa</h1>
        <p>
          Ingest documents → retrieve with pgvector → answer with citations →
          refuse when unsupported. Every query is logged.
        </p>
        {authError && (
          <p style={{ color: "var(--bad)" }}>{authError}</p>
        )}
      </header>

      <div className="grid">
        <UploadPanel token={token} />
        <AskPanel token={token} />
        <AuditPanel supabase={supabase} token={token} />
      </div>
    </div>
  );
}

function UploadPanel({ token }: { token: string | null }) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (file: File) => {
      if (!token) return;
      setBusy(true);
      setStatus(`Uploading ${file.name}…`);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/ingest", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Ingest failed");
        setStatus(
          `✓ Extracted ${json.chunk_count} chunks · classified as: ${json.doc_type}`,
        );
      } catch (e) {
        setStatus(`✗ ${(e as Error).message}`);
      } finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [token],
  );

  return (
    <section className="panel">
      <h2>1 · Upload</h2>
      <label className="file">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.md"
          disabled={!token || busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
        {busy ? "Working…" : "Drop or choose a .pdf / .txt / .md file"}
      </label>
      {status && <div className="status">{status}</div>}
    </section>
  );
}

function AskPanel({ token }: { token: string | null }) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(async () => {
    if (!token || !query.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Query failed");
      setResult(json);
      // Notify the audit panel to refresh.
      window.dispatchEvent(new CustomEvent("query-logged"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [token, query]);

  return (
    <section className="panel">
      <h2>2 · Ask</h2>
      <textarea
        rows={3}
        placeholder="Ask a question about your uploaded documents…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ask();
        }}
      />
      <button onClick={ask} disabled={!token || busy || !query.trim()}>
        {busy ? "Retrieving…" : "Ask (⌘/Ctrl+Enter)"}
      </button>

      {error && <div className="status">✗ {error}</div>}

      {result && (
        <>
          <div className={`answer ${result.grounded ? "" : "refused"}`}>
            <span
              className={`badge ${result.grounded ? "grounded" : "refused"}`}
            >
              {result.grounded ? "Grounded" : "Refused — not in documents"}
            </span>
            <div>{result.answer}</div>
          </div>

          {result.grounded && result.sources.length > 0 && (
            <div className="sources">
              <h3>Sources · {result.latency_ms} ms</h3>
              <ul>
                {result.sources.map((s, i) => (
                  <li key={i}>
                    <span>
                      {s.filename} · chunk #{s.chunk_index}
                    </span>
                    <span className="sim">{s.similarity.toFixed(3)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function AuditPanel({
  supabase,
  token,
}: {
  supabase: ReturnType<typeof browserClient>;
  token: string | null;
}) {
  const [rows, setRows] = useState<LogRow[]>([]);

  const refresh = useCallback(async () => {
    // RLS ensures this returns only the signed-in user's rows.
    const { data } = await supabase
      .from("query_log")
      .select("created_at, query, grounded, latency_ms")
      .order("created_at", { ascending: false })
      .limit(50);
    setRows((data as LogRow[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    if (token) refresh();
    const handler = () => refresh();
    window.addEventListener("query-logged", handler);
    return () => window.removeEventListener("query-logged", handler);
  }, [token, refresh]);

  return (
    <section className="panel full">
      <h2>3 · Audit log</h2>
      {rows.length === 0 ? (
        <div className="empty">No queries yet.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Query</th>
              <th>Grounded</th>
              <th>Latency</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{new Date(r.created_at).toLocaleTimeString()}</td>
                <td className="q">{r.query}</td>
                <td className={r.grounded ? "yes" : "no"}>
                  {r.grounded ? "yes" : "no"}
                </td>
                <td>{r.latency_ms} ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
