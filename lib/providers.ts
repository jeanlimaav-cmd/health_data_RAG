// Live-answer providers for the Health Data RAG demo.
//
// The visitor supplies their own OpenAI or Anthropic API key (entered in the UI
// and sent per-request). We call the provider server-side with fetch so the raw
// provider response never touches the browser and there are no CORS issues.
//
// The demo corpus is small, so "retrieval" is context-stuffing: we hand the
// whole corpus to the model with a strict grounding instruction. This works
// identically for both providers and needs no embeddings or database.

import type { SampleDoc } from "@/lib/sample";

export type Provider = "openai" | "anthropic";

export const REFUSAL = "The documents don't contain this.";

// Cheap, fast defaults — the visitor is paying with their own key.
const OPENAI_MODEL = "gpt-4o-mini";
const ANTHROPIC_MODEL = "claude-haiku-4-5";

export interface Answer {
  answer: string;
  grounded: boolean;
}

function buildPrompt(query: string, contexts: SampleDoc[]) {
  const contextBlock = contexts
    .map((c) => `### ${c.filename}\n${c.text}`)
    .join("\n\n---\n\n");

  const system =
    `You are a careful assistant for a health-data knowledge base. ` +
    `Answer the question using ONLY the provided context documents. ` +
    `Cite the source filename(s) you used. ` +
    `If the answer is not in the context, reply exactly: "${REFUSAL}" ` +
    `Do not use outside knowledge.`;

  const user = `Context documents:\n${contextBlock}\n\nQuestion: ${query}`;
  return { system, user };
}

async function callOpenAI(apiKey: string, system: string, user: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenAI request failed (${res.status}): ${detail.slice(0, 240)}`);
  }
  const json = await res.json();
  return (json?.choices?.[0]?.message?.content ?? "").trim();
}

async function callAnthropic(apiKey: string, system: string, user: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Anthropic request failed (${res.status}): ${detail.slice(0, 240)}`);
  }
  const json = await res.json();
  const parts = (json?.content ?? []) as { type?: string; text?: string }[];
  return parts
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim();
}

/**
 * Grounded generation over the demo corpus via the chosen provider.
 */
export async function generateGrounded(
  provider: Provider,
  apiKey: string,
  query: string,
  contexts: SampleDoc[],
): Promise<Answer> {
  const { system, user } = buildPrompt(query, contexts);
  const answer =
    provider === "anthropic"
      ? await callAnthropic(apiKey, system, user)
      : await callOpenAI(apiKey, system, user);

  const grounded =
    !!answer &&
    !answer.toLowerCase().startsWith("the documents don't contain this");

  return { answer: answer || REFUSAL, grounded: answer ? grounded : false };
}
