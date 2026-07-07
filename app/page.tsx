"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EXAMPLE_QUESTIONS, SAMPLE_QA, GITHUB_URL, UPWORK_URL } from "@/lib/sample";

type Provider = "demo" | "openai" | "anthropic";

interface Source {
  filename: string;
  chunk_index?: number;
  similarity?: number;
}

interface QueryResult {
  answer: string;
  grounded: boolean;
  sources: Source[];
  latency_ms: number;
}

interface LogRow {
  time: string;
  query: string;
  grounded: boolean;
  latency_ms: number;
  mode: string;
}

interface UploadedDoc {
  filename: string;
  text: string;
}

const PROVIDER_KEY = "hrag-provider";
const APIKEY_KEY = "hrag-apikey";

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function cannedAnswer(q: string): QueryResult | null {
  const hit = SAMPLE_QA.find((qa) => norm(qa.question) === norm(q));
  if (!hit) return null;
  return {
    answer: hit.answer,
    grounded: hit.grounded,
    sources: hit.sources,
    latency_ms: hit.latency_ms,
  };
}

export default function Home() {
  const [provider, setProvider] = useState<Provider>("demo");
  const [apiKey, setApiKey] = useState("");
  const [corpus, setCorpus] = useState<UploadedDoc[]>([]);
  const [log, setLog] = useState<LogRow[]>([]);

  // Shared "ask this now" channel so the example chips can drive the Ask panel.
  const [question, setQuestion] = useState("");
  const [askSignal, setAskSignal] = useState(0);

  useEffect(() => {
    const p = (localStorage.getItem(PROVIDER_KEY) as Provider) || "demo";
    setProvider(p);
    setApiKey(localStorage.getItem(APIKEY_KEY) || "");
  }, []);

  const saveProvider = useCallback((p: Provider) => {
    setProvider(p);
    localStorage.setItem(PROVIDER_KEY, p);
  }, []);

  const saveKey = useCallback((k: string) => {
    setApiKey(k);
    localStorage.setItem(APIKEY_KEY, k);
  }, []);

  const askExample = useCallback((q: string) => {
    setQuestion(q);
    setAskSignal((n) => n + 1);
  }, []);

  const addLog = useCallback((row: LogRow) => {
    setLog((prev) => [row, ...prev].slice(0, 50));
  }, []);

  const live = provider !== "demo" && apiKey.trim().length > 0;

  return (
    <div className="page">
      <BackgroundArt />
      <div className="wrap">
        <header className="hero">
          <div className="hero-badge">
            <span className="pulse-dot" /> Health Data RAG · grounded · cited · honest refusals
          </div>
          <h1>Ask your health records. Get answers you can trust.</h1>
          <p>
            A retrieval-augmented assistant over a clinical knowledge base. Every
            answer is drawn <strong>only</strong> from the source documents, with
            citations — and when the answer isn&apos;t there, it says so instead
            of guessing. Try it instantly below, or plug in your own AI key to ask
            anything live.
          </p>
        </header>

        <KeyPanel
          provider={provider}
          apiKey={apiKey}
          onProvider={saveProvider}
          onKey={saveKey}
          live={live}
        />

        <div className="grid">
          <AskPanel
            provider={provider}
            apiKey={apiKey}
            corpus={corpus}
            question={question}
            setQuestion={setQuestion}
            askSignal={askSignal}
            onExample={askExample}
            onLog={addLog}
          />
          <UploadPanel live={live} corpus={corpus} setCorpus={setCorpus} />
          <AuditPanel log={log} />
        </div>

        <BuiltBy />
      </div>
    </div>
  );
}

function KeyPanel({
  provider,
  apiKey,
  onProvider,
  onKey,
  live,
}: {
  provider: Provider;
  apiKey: string;
  onProvider: (p: Provider) => void;
  onKey: (k: string) => void;
  live: boolean;
}) {
  const options: { id: Provider; label: string }[] = [
    { id: "demo", label: "Demo (no key)" },
    { id: "openai", label: "OpenAI" },
    { id: "anthropic", label: "Anthropic" },
  ];

  const keyHint =
    provider === "openai"
      ? "sk-... — from platform.openai.com/api-keys"
      : "sk-ant-... — from console.anthropic.com";

  return (
    <section className="panel keypanel span-2">
      <div className="keypanel-head">
        <div>
          <h2>AI provider</h2>
          <p className="panel-sub">
            The demo answers the sample questions with no key. To ask your own
            questions live, choose a provider and paste your key — it&apos;s stored
            only in your browser and sent per request.
          </p>
        </div>
        <span className={`mode-pill ${live ? "on" : ""}`}>
          {live ? `Live · ${provider}` : "Demo mode"}
        </span>
      </div>

      <div className="segmented" role="tablist">
        {options.map((o) => (
          <button
            key={o.id}
            role="tab"
            aria-selected={provider === o.id}
            className={`seg ${provider === o.id ? "active" : ""}`}
            onClick={() => onProvider(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>

      {provider !== "demo" && (
        <div className="keyrow">
          <input
            type="password"
            placeholder={keyHint}
            value={apiKey}
            onChange={(e) => onKey(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          {apiKey && (
            <button className="ghost" onClick={() => onKey("")}>
              Clear
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function AskPanel({
  provider,
  apiKey,
  corpus,
  question,
  setQuestion,
  askSignal,
  onExample,
  onLog,
}: {
  provider: Provider;
  apiKey: string;
  corpus: UploadedDoc[];
  question: string;
  setQuestion: (q: string) => void;
  askSignal: number;
  onExample: (q: string) => void;
  onLog: (row: LogRow) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const live = provider !== "demo" && apiKey.trim().length > 0;

  const ask = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!q) return;
      setBusy(true);
      setError(null);
      setResult(null);
      const nowLabel = new Date().toLocaleTimeString();
      try {
        if (!live) {
          const canned = cannedAnswer(q);
          if (canned) {
            setResult(canned);
            onLog({
              time: nowLabel,
              query: q,
              grounded: canned.grounded,
              latency_ms: canned.latency_ms,
              mode: "demo",
            });
          } else {
            setError(
              "Demo mode answers the four sample questions instantly. Choose OpenAI or Anthropic above and add a key to ask your own questions live.",
            );
          }
          return;
        }

        const res = await fetch("/api/query", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-provider": provider,
            "x-api-key": apiKey,
          },
          body: JSON.stringify({ query: q, extraDocs: corpus }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Query failed");
        setResult(json);
        onLog({
          time: nowLabel,
          query: q,
          grounded: json.grounded,
          latency_ms: json.latency_ms,
          mode: provider,
        });
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [live, provider, apiKey, corpus, onLog],
  );

  const lastSignal = useRef(0);
  useEffect(() => {
    if (askSignal > 0 && askSignal !== lastSignal.current) {
      lastSignal.current = askSignal;
      ask(question);
    }
  }, [askSignal, question, ask]);

  return (
    <section className="panel span-2">
      <h2>Ask a question</h2>
      <textarea
        rows={3}
        placeholder="e.g. Which medications is the patient taking?"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ask(question);
        }}
      />

      <div className="chips">
        <span className="chips-label">Try:</span>
        {EXAMPLE_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            className="chip"
            disabled={busy}
            onClick={() => onExample(q)}
          >
            {q}
          </button>
        ))}
      </div>

      <button
        className="primary"
        onClick={() => ask(question)}
        disabled={busy || !question.trim()}
      >
        {busy ? "Retrieving…" : "Ask  ·  ⌘/Ctrl+Enter"}
      </button>

      {error && <div className="status error-text">✗ {error}</div>}

      {result && (
        <>
          <div className={`answer ${result.grounded ? "" : "refused"}`}>
            <span className={`badge ${result.grounded ? "grounded" : "refused"}`}>
              {result.grounded ? "✓ Grounded in the records" : "Not in the records"}
            </span>
            <div>{result.answer}</div>
          </div>

          {result.grounded && result.sources.length > 0 && (
            <div className="sources">
              <h3>
                Sources{result.latency_ms ? ` · answered in ${result.latency_ms} ms` : ""}
              </h3>
              <ul>
                {result.sources.map((s, i) => (
                  <li key={i}>
                    <span>
                      {s.filename}
                      {typeof s.chunk_index === "number" ? ` · chunk #${s.chunk_index}` : ""}
                    </span>
                    {typeof s.similarity === "number" && (
                      <span className="sim">{s.similarity.toFixed(3)}</span>
                    )}
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

function UploadPanel({
  live,
  corpus,
  setCorpus,
}: {
  live: boolean;
  corpus: UploadedDoc[];
  setCorpus: (fn: (prev: UploadedDoc[]) => UploadedDoc[]) => void;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (file: File) => {
      setBusy(true);
      setStatus(`Reading ${file.name}…`);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/ingest", { method: "POST", body: form });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Upload failed");
        setCorpus((prev) => [
          ...prev.filter((d) => d.filename !== json.filename),
          { filename: json.filename, text: json.text },
        ]);
        setStatus(
          `✓ Added ${json.filename} (${json.chars.toLocaleString()} chars)` +
            (live ? "" : " — add a key to ask about it live"),
        );
      } catch (e) {
        setStatus(`✗ ${(e as Error).message}`);
      } finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [setCorpus, live],
  );

  return (
    <section className="panel">
      <h2>Add a document</h2>
      <p className="panel-sub">
        Drop in your own health file to query it live (needs an API key).
      </p>
      <label className="file">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.md"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
        <span className="file-icon">＋</span>
        <span>{busy ? "Working…" : "Choose a .pdf / .txt / .md file"}</span>
      </label>

      {corpus.length > 0 && (
        <ul className="doclist">
          {corpus.map((d) => (
            <li key={d.filename}>
              <span>📄 {d.filename}</span>
              <button
                className="linklike"
                onClick={() =>
                  setCorpus((prev) => prev.filter((x) => x.filename !== d.filename))
                }
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {status && <div className="status">{status}</div>}
    </section>
  );
}

function AuditPanel({ log }: { log: LogRow[] }) {
  return (
    <section className="panel">
      <h2>Audit log</h2>
      <p className="panel-sub">Every question asked in this session.</p>
      {log.length === 0 ? (
        <div className="empty">No questions yet — ask one above.</div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Question</th>
                <th>Grounded</th>
                <th>Latency</th>
              </tr>
            </thead>
            <tbody>
              {log.map((r, i) => (
                <tr key={i}>
                  <td>{r.time}</td>
                  <td className="q">{r.query}</td>
                  <td className={r.grounded ? "yes" : "no"}>
                    {r.grounded ? "yes" : "no"}
                  </td>
                  <td>{r.latency_ms} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function BuiltBy() {
  return (
    <footer className="builtby">
      <div className="builtby-card">
        <div className="avatar" aria-hidden>
          JL
        </div>
        <div className="builtby-text">
          <strong>Built by Jean Lima</strong> — AI Automation &amp; Full-Stack
          Engineer (GoHighLevel · RAG · LLM APIs).{" "}
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
          {" · "}
          <a href={UPWORK_URL} target="_blank" rel="noreferrer">
            Upwork
          </a>
        </div>
      </div>
      <p className="disclaimer">
        Patient data shown is synthetic and for demonstration only.
      </p>
    </footer>
  );
}

// Decorative, low-opacity AI/medical background — neural nodes, a heartbeat
// line, and soft gradient orbs. Purely visual; hidden from assistive tech.
function BackgroundArt() {
  return (
    <div className="bg-art" aria-hidden>
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="orbA" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22c3c9" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#22c3c9" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="orbB" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#4f7cff" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#4f7cff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0ea5b7" stopOpacity="0" />
            <stop offset="50%" stopColor="#0ea5b7" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#0ea5b7" stopOpacity="0" />
          </linearGradient>
        </defs>

        <circle cx="180" cy="160" r="320" fill="url(#orbA)" />
        <circle cx="1280" cy="120" r="280" fill="url(#orbB)" />
        <circle cx="1180" cy="820" r="300" fill="url(#orbA)" />

        {/* heartbeat / ECG line */}
        <path
          className="ecg"
          d="M0 470 H420 l24 -70 l30 150 l28 -230 l30 300 l26 -150 H760 l24 -60 l26 120 l24 -60 H1440"
          fill="none"
          stroke="url(#line)"
          strokeWidth="3"
        />

        {/* neural network motif */}
        <g className="net" stroke="#3aa7c8" strokeWidth="1.2" opacity="0.5">
          <line x1="240" y1="640" x2="380" y2="560" />
          <line x1="240" y1="640" x2="360" y2="720" />
          <line x1="380" y1="560" x2="520" y2="620" />
          <line x1="360" y1="720" x2="520" y2="620" />
          <line x1="520" y1="620" x2="640" y2="540" />
          <line x1="1040" y1="300" x2="1160" y2="240" />
          <line x1="1040" y1="300" x2="1150" y2="380" />
          <line x1="1160" y1="240" x2="1270" y2="300" />
          <line x1="1150" y1="380" x2="1270" y2="300" />
        </g>
        <g className="nodes" fill="#0ea5b7">
          {[
            [240, 640],
            [380, 560],
            [360, 720],
            [520, 620],
            [640, 540],
            [1040, 300],
            [1160, 240],
            [1150, 380],
            [1270, 300],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="5" />
          ))}
        </g>
      </svg>
    </div>
  );
}
