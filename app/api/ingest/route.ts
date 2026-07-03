import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import { extractText } from "@/lib/pdf";
import { chunkText } from "@/lib/chunking";
import { embedBatch } from "@/lib/embeddings";
import { classifyDocument } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_EXT = [".pdf", ".txt", ".md"];

// POST: file -> extract -> chunk -> classify -> embed -> store
export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const lname = file.name.toLowerCase();
  if (!ALLOWED_EXT.some((ext) => lname.endsWith(ext))) {
    return NextResponse.json(
      { error: "Only .pdf, .txt, and .md files are supported" },
      { status: 400 },
    );
  }

  // 1. Extract
  let text: string;
  try {
    text = await extractText(file);
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to read file: ${(e as Error).message}` },
      { status: 422 },
    );
  }
  if (!text.trim()) {
    return NextResponse.json(
      { error: "No extractable text in file" },
      { status: 422 },
    );
  }

  // 2. Chunk
  const chunks = chunkText(text);
  if (chunks.length === 0) {
    return NextResponse.json({ error: "Nothing to index" }, { status: 422 });
  }

  // 3. Classify + 4. Embed (in parallel)
  const [docType, embeddings] = await Promise.all([
    classifyDocument(text),
    embedBatch(chunks.map((c) => c.content)),
  ]);

  const db = serviceClient();

  // 5. Insert document row
  const { data: doc, error: docErr } = await db
    .from("documents")
    .insert({
      user_id: userId,
      filename: file.name,
      content_type: file.type || null,
      doc_type: docType,
      metadata: { chunk_count: chunks.length },
    })
    .select("id")
    .single();

  if (docErr || !doc) {
    return NextResponse.json(
      { error: docErr?.message ?? "Failed to store document" },
      { status: 500 },
    );
  }

  // 6. Insert chunk rows with embeddings. pgvector accepts the text form "[...]".
  const rows = chunks.map((c, i) => ({
    document_id: doc.id,
    user_id: userId,
    chunk_index: c.index,
    content: c.content,
    token_count: c.tokenCount,
    embedding: JSON.stringify(embeddings[i]),
  }));

  const { error: chunkErr } = await db.from("chunks").insert(rows);
  if (chunkErr) {
    // Roll back the orphaned document so a retry starts clean.
    await db.from("documents").delete().eq("id", doc.id);
    return NextResponse.json({ error: chunkErr.message }, { status: 500 });
  }

  return NextResponse.json({
    document_id: doc.id,
    filename: file.name,
    doc_type: docType,
    chunk_count: chunks.length,
  });
}
