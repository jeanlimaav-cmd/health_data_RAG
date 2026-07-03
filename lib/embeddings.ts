import OpenAI from "openai";

// Instantiate lazily so importing this module doesn't require the API key at
// build time (Next collects page data without env vars present).
let _openai: OpenAI | null = null;
function client(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

// 1536 dims, ~$0.02 / 1M tokens. Must match the vector(1536) column + RPC signature.
const EMBEDDING_MODEL = "text-embedding-3-small";

export async function embed(text: string): Promise<number[]> {
  const res = await client().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return res.data[0].embedding;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const res = await client().embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });
  // OpenAI preserves input order in the response.
  return res.data.map((d) => d.embedding);
}
