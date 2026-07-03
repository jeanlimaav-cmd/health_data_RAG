export interface TextChunk {
  content: string;
  index: number;
  tokenCount: number;
}

// ~500 tokens with ~50 token overlap. We work in characters and use a ~4 chars/token
// heuristic, which is close enough for splitting (no tiktoken dependency needed).
const TARGET_CHARS = 2000; // ~500 tokens
const OVERLAP_CHARS = 200; // ~50 tokens
const SEPARATORS = ["\n\n", "\n", ". ", " ", ""];

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

/**
 * Recursively split on the coarsest separator that keeps pieces under TARGET_CHARS,
 * falling back to finer separators for anything still too large.
 */
function recursiveSplit(text: string, separators: string[]): string[] {
  if (text.length <= TARGET_CHARS || separators.length === 0) {
    return text.trim() ? [text] : [];
  }
  const [sep, ...rest] = separators;
  const parts = sep === "" ? Array.from(text) : text.split(sep);
  const out: string[] = [];
  for (const part of parts) {
    if (!part.trim()) continue;
    if (part.length > TARGET_CHARS) {
      out.push(...recursiveSplit(part, rest));
    } else {
      out.push(part);
    }
  }
  return out;
}

/**
 * Split text into overlapping chunks. Pieces are greedily packed up to TARGET_CHARS;
 * each new chunk carries the tail of the previous one for OVERLAP_CHARS of context.
 */
export function chunkText(text: string): TextChunk[] {
  const pieces = recursiveSplit(text.trim(), SEPARATORS);
  const chunks: string[] = [];
  let current = "";

  for (const piece of pieces) {
    const candidate = current ? `${current} ${piece}` : piece;
    if (candidate.length > TARGET_CHARS && current) {
      chunks.push(current.trim());
      const tail = current.slice(Math.max(0, current.length - OVERLAP_CHARS));
      current = `${tail} ${piece}`;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks.map((content, index) => ({
    content,
    index,
    tokenCount: estimateTokens(content),
  }));
}
