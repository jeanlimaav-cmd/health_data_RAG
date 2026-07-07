import { NextRequest, NextResponse } from "next/server";
import { extractText } from "@/lib/pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_EXT = [".pdf", ".txt", ".md"];

// POST: extract text from an uploaded file and return it. The browser keeps the
// text in memory and includes it in the corpus for live questions. No database.
export async function POST(req: NextRequest) {
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

  return NextResponse.json({ filename: file.name, text, chars: text.length });
}
