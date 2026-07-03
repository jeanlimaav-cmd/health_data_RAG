import OpenAI from "openai";

// Instantiate lazily so importing this module doesn't require the API key at
// build time (Next collects page data without env vars present).
let _openai: OpenAI | null = null;
function client(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

// Swap this one constant (and the call below) to move generation to another
// provider — Anthropic claude-haiku-4-5, etc. Everything else stays the same.
const GENERATION_MODEL = "gpt-4o-mini";

// The exact string the model must emit when the context is insufficient.
export const REFUSAL = "The documents don't contain this.";

export interface RetrievedContext {
  filename: string;
  chunkIndex: number;
  content: string;
}

export interface Answer {
  answer: string;
  grounded: boolean;
}

/**
 * Grounded generation. The model may ONLY use the provided context and must cite
 * source filenames. If the context lacks the answer it returns the exact REFUSAL
 * string — which we detect to set the `grounded` flag.
 */
export async function generateAnswer(
  query: string,
  contexts: RetrievedContext[],
): Promise<Answer> {
  if (contexts.length === 0) {
    return { answer: REFUSAL, grounded: false };
  }

  const contextBlock = contexts
    .map((c) => `[Source: ${c.filename} #${c.chunkIndex}]\n${c.content}`)
    .join("\n\n---\n\n");

  const system =
    `Answer the question using ONLY the provided context. ` +
    `Cite the source filename for each claim. ` +
    `If the context does not contain the answer, reply exactly: "${REFUSAL}" ` +
    `Do not use outside knowledge.`;

  const user = `Context:\n${contextBlock}\n\nQuestion: ${query}`;

  const res = await client().chat.completions.create({
    model: GENERATION_MODEL,
    temperature: 0,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const answer = (res.choices[0]?.message?.content ?? "").trim();
  const grounded = !answer
    .toLowerCase()
    .startsWith("the documents don't contain this");

  return { answer: answer || REFUSAL, grounded: answer ? grounded : false };
}

/**
 * One cheap classification call. Falls back to "other" on any error so ingestion
 * never fails just because classification did.
 */
export async function classifyDocument(sample: string): Promise<string> {
  const allowed = ["contract", "report", "note", "invoice", "other"];
  try {
    const res = await client().chat.completions.create({
      model: GENERATION_MODEL,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "Classify the document in one word: contract, report, note, invoice, or other. Reply with only the word.",
        },
        { role: "user", content: sample.slice(0, 3000) },
      ],
    });
    const word = (res.choices[0]?.message?.content ?? "other")
      .trim()
      .toLowerCase()
      .split(/\s+/)[0]
      .replace(/[^a-z]/g, "");
    return allowed.includes(word) ? word : "other";
  } catch {
    return "other";
  }
}
