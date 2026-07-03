# rag-doc-qa — Grounded Document Q&A

Upload documents, ask questions, and get answers **grounded in the source with
citations** — with an honest "the documents don't contain this" when they don't.
Built on Supabase (Postgres + pgvector + Row-Level Security) and deployed on Vercel.

> **Live demo:** _add your Vercel URL here_
> **Walkthrough (90s):** _add your Loom link here_

Retrieval-augmented generation over a document knowledge base: metadata
classification, secure per-user isolation at the database layer, and an audit log
of every retrieval. Everything the README claims is verifiable by clicking around
the live app.

---

## Architecture

```
        ┌─────────┐   extract    ┌────────┐  embed   ┌──────────────┐
 file → │ /ingest │ ──────────→  │ chunk  │ ───────→ │  pgvector     │
        └─────────┘   classify   └────────┘          │  (chunks tbl) │
                                                      └──────┬───────┘
                                                             │ cosine
 question → ┌────────┐  embed → match_chunks() top-5 ────────┘
            │ /query │ → grounded generation w/ citations → answer + sources
            └───┬────┘
                └──────────────→ query_log (audit: query, chunk ids, latency)
```

**Flow:** ingest → chunk (~500 tokens, 50 overlap) → embed → store in pgvector →
cosine retrieval via a Postgres RPC → grounded generation with citations → refuse
when unsupported → log every query.

---

## Stack

- **Next.js 14 (App Router) + TypeScript** — deploys natively to Vercel
- **Supabase** — Postgres, pgvector, Auth, Row-Level Security
- **Embeddings** — OpenAI `text-embedding-3-small` (1536 dims)
- **Generation** — OpenAI `gpt-4o-mini` (swappable behind `lib/llm.ts`)
- **PDF parsing** — `pdf-parse`

---

## How retrieval works

Each chunk is embedded into a 1536-dimension vector and stored in a `vector` column
indexed with pgvector's IVFFlat index. At query time the question is embedded with
the same model, and the `match_chunks` RPC ranks chunks by cosine distance
(`embedding <=> query_embedding`), returning the top 5 for the asking user only.
Those chunks — and nothing else — are handed to the model with a strict instruction
to answer **only** from them and cite the source filename. If the answer isn't in
the retrieved context, the model returns the exact string
`The documents don't contain this.` rather than inventing one. That refusal is the
point: the system won't answer beyond its evidence.

---

## Setup

### 1. Supabase
1. Create a project at [supabase.com](https://supabase.com) (free tier).
2. Open **SQL Editor** → paste and run [`supabase/schema.sql`](supabase/schema.sql).
   This enables pgvector, creates the tables, RLS policies, and the `match_chunks`
   RPC.
3. Enable **Authentication → Providers → Anonymous sign-ins** (the demo signs users
   in anonymously so every row has a real `auth.uid()` for RLS).

### 2. Environment
Copy [`.env.example`](.env.example) to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server only — never exposed to the client
OPENAI_API_KEY=
```

### 3. Run

```bash
npm install
npm run dev
```

Open http://localhost:3000, upload [`sample-docs/acme-msa.md`](sample-docs/acme-msa.md),
and try:
- _"What are the payment terms?"_ → grounded answer with a citation.
- _"What is the CEO's salary?"_ → `The documents don't contain this.`

### 4. Deploy
Push to GitHub, import into [Vercel](https://vercel.com), add the same four env
vars, and deploy. Put the live URL at the top of this README.

---

## Security

- **Row-Level Security** isolates every user's documents, chunks, and logs at the
  database layer — policies restrict all reads/writes to `auth.uid() = user_id`, so
  one user can never see another's data even if the app layer has a bug.
- **Service-role key stays server-side** (ingest/query routes only) and always
  scopes writes by the authenticated user id.
- **Audit log** — `query_log` records every query, the chunk ids retrieved, the
  answer, whether it was grounded, and latency. It's visible in the UI.

---

## Project structure

```
app/
  page.tsx              upload + ask + audit-log panels
  api/ingest/route.ts   file → extract → chunk → classify → embed → store
  api/query/route.ts    embed → retrieve → generate → log → return
lib/
  supabase.ts           service / user / browser clients
  auth.ts               resolve user id from bearer token
  embeddings.ts         embed() / embedBatch()
  chunking.ts           recursive splitter (~500 tokens, 50 overlap)
  pdf.ts                extractText()
  llm.ts                generateAnswer() / classifyDocument()
supabase/schema.sql     tables, RLS policies, match_chunks RPC
sample-docs/            a document to test with
```
