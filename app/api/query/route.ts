import { NextRequest, NextResponse } from "next/server";
import { SAMPLE_DOCS } from "@/lib/sample";
import { generateGrounded, type Provider } from "@/lib/providers";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST: answer a question live over the demo corpus using the visitor's own key.
// The provider + key arrive as headers (never stored server-side). Demo-mode
// (canned) questions are handled entirely in the browser and never reach here.
export async function POST(req: NextRequest) {
  const provider = (req.headers.get("x-provider") || "").toLowerCase();
  const apiKey = (req.headers.get("x-api-key") || "").trim();

  if (provider !== "openai" && provider !== "anthropic") {
    return NextResponse.json(
      { error: "Select OpenAI or Anthropic and enter a key to ask live questions." },
      { status: 400 },
    );
  }
  if (!apiKey) {
    return NextResponse.json(
      { error: `Enter your ${provider} API key to ask live questions.` },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const query: string = (body.query ?? "").toString().trim();
  if (!query) {
    return NextResponse.json({ error: "Empty question" }, { status: 400 });
  }

  // Optional documents the visitor uploaded in the browser, added to the corpus.
  const extraDocs = Array.isArray(body.extraDocs)
    ? body.extraDocs
        .filter((d: any) => d && d.filename && d.text)
        .map((d: any) => ({
          filename: String(d.filename),
          text: String(d.text).slice(0, 20000),
        }))
    : [];

  const contexts = [...SAMPLE_DOCS, ...extraDocs];
  const started = Date.now();

  try {
    const { answer, grounded } = await generateGrounded(
      provider as Provider,
      apiKey,
      query,
      contexts,
    );
    const latency_ms = Date.now() - started;
    // Context-stuffing has no per-chunk score; cite the corpus filenames used.
    const sources = grounded
      ? contexts.map((c) => ({ filename: c.filename }))
      : [];
    return NextResponse.json({ answer, grounded, sources, latency_ms });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
