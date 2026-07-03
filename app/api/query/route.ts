import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import { embed } from "@/lib/embeddings";
import { generateAnswer, type RetrievedContext } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 60;

const MATCH_COUNT = 5;

interface Match {
  id: string;
  document_id: string;
  content: string;
  similarity: number;
}

// POST: embed query -> retrieve -> generate -> log -> return
export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const query: string = (body.query ?? "").toString().trim();
  if (!query) {
    return NextResponse.json({ error: "Empty query" }, { status: 400 });
  }

  const started = Date.now();
  const db = serviceClient();

  // 1. Embed the query
  const queryEmbedding = await embed(query);

  // 2. Retrieve top-K via cosine similarity RPC (pgvector). Pass the vector as its
  // text form so Postgres casts it to vector(1536).
  const { data: matches, error: rpcErr } = await db.rpc("match_chunks", {
    query_embedding: JSON.stringify(queryEmbedding),
    match_count: MATCH_COUNT,
    filter_user_id: userId,
  });

  if (rpcErr) {
    return NextResponse.json({ error: rpcErr.message }, { status: 500 });
  }

  const hits = (matches ?? []) as Match[];
  const chunkIds = hits.map((m) => m.id);

  // 3. Enrich matches with filename + chunk_index for citations.
  const metaById = new Map<
    string,
    { filename: string; chunk_index: number }
  >();
  if (chunkIds.length > 0) {
    const { data: meta } = await db
      .from("chunks")
      .select("id, chunk_index, documents(filename)")
      .in("id", chunkIds);
    for (const row of meta ?? []) {
      // documents may come back as an object or single-item array depending on join.
      const docRel = (row as any).documents;
      const filename = Array.isArray(docRel)
        ? docRel[0]?.filename
        : docRel?.filename;
      metaById.set((row as any).id, {
        filename: filename ?? "unknown",
        chunk_index: (row as any).chunk_index ?? 0,
      });
    }
  }

  const contexts: RetrievedContext[] = hits.map((m) => ({
    filename: metaById.get(m.id)?.filename ?? "unknown",
    chunkIndex: metaById.get(m.id)?.chunk_index ?? 0,
    content: m.content,
  }));

  // 4. Generate a grounded answer (or refusal).
  const { answer, grounded } = await generateAnswer(query, contexts);

  const sources = hits.map((m) => ({
    filename: metaById.get(m.id)?.filename ?? "unknown",
    chunk_index: metaById.get(m.id)?.chunk_index ?? 0,
    similarity: Number(m.similarity.toFixed(4)),
  }));

  const latencyMs = Date.now() - started;

  // 5. Audit log — every query, its retrieved chunk ids, answer, grounding, latency.
  await db.from("query_log").insert({
    user_id: userId,
    query,
    retrieved_chunk_ids: chunkIds,
    answer,
    grounded,
    latency_ms: latencyMs,
  });

  return NextResponse.json({
    answer,
    grounded,
    sources: grounded ? sources : [],
    latency_ms: latencyMs,
  });
}
