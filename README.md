# Health Data RAG — Grounded Clinical Q&A

Ask a clinical knowledge base in plain language and get answers **grounded in the
source records with citations** — plus an honest *"The documents don't contain
this."* when they don't.

Built with **Next.js 14 + TypeScript**, deployable to Vercel with **zero
configuration**. The demo works with **no API key**; visitors can plug in their
own **OpenAI or Anthropic** key to ask anything live.

> **Live demo:** _add your Vercel URL here_

---

## How it works

- **Demo mode (no key).** The example questions ship with pre-written, cited
  answers, so the app is fully demoable the instant it loads — no key, no
  database, no setup.
- **Live mode (your key).** Choose **OpenAI** or **Anthropic** and paste your API
  key in the UI. It's stored only in your browser and sent per request. Questions
  are answered live over the demo corpus (and any file you upload).
- **Grounded generation.** The model is instructed to answer **only** from the
  provided records and cite the source filename. If the answer isn't there, it
  returns the exact string `The documents don't contain this.` — the refusal is
  the point: the system won't answer beyond its evidence.

The bundled corpus is two documents: a **synthetic patient health summary**
(the clinical knowledge base) and the **developer's profile** (so you can also
ask "who built this?"). Uploaded `.pdf` / `.txt` / `.md` files are added to the
corpus for live questions.

---

## Stack

- **Next.js 14 (App Router) + TypeScript** — deploys natively to Vercel
- **Providers** — OpenAI (`gpt-4o-mini`) and Anthropic (`claude-haiku-4-5`),
  called server-side so keys and raw responses never leak to the browser
- **PDF parsing** — `pdf-parse`
- **No database, no server-side keys** — the demo is fully self-contained

---

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. Click an example question to see an instant cited
answer (or the honest refusal on the "home address" question). To ask your own
questions, pick a provider and paste a key:

- **OpenAI** — `platform.openai.com/api-keys`
- **Anthropic** — `console.anthropic.com`

## Deploy

Push to GitHub and import into [Vercel](https://vercel.com). There are **no
environment variables to set** — deploy as-is and put the live URL at the top of
this README.

---

## Security & scope

- **Keys stay client-side.** A live key is entered in the browser, kept in
  `localStorage`, and sent per request to the app's API route, which forwards it
  to the provider. It is never persisted server-side.
- **Synthetic data.** The patient record is fictional, for demonstration only.
- **Not for real PHI.** This is a demo. A production health-data system needs
  authenticated access, encryption, audit trails, and a HIPAA-eligible provider
  configuration.

---

## Project structure

```
app/
  page.tsx              hero + provider/key panel + ask + upload + audit + AI background art
  api/query/route.ts    live answer over the corpus via the chosen provider (OpenAI/Anthropic)
  api/ingest/route.ts   extract text from an uploaded file (no storage)
lib/
  sample.ts             bundled corpus (patient record + Jean Lima profile) + canned example answers
  providers.ts          OpenAI + Anthropic adapters, grounded prompt, refusal detection
  pdf.ts                extractText()
sample-docs/            the documents used in the demo
```
