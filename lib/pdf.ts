/**
 * Extract raw text from an uploaded file. Supports .pdf (via pdf-parse) and
 * plain .txt / .md.
 */
export async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (name.endsWith(".pdf")) {
    // Import the internal module directly — pdf-parse's index.js runs a debug
    // harness that reads a test file when required as the main module.
    // @ts-expect-error no type declarations for the internal path
    const mod = await import("pdf-parse/lib/pdf-parse.js");
    const pdfParse = (mod.default ?? mod) as (
      b: Buffer,
    ) => Promise<{ text: string }>;
    const data = await pdfParse(buffer);
    return data.text;
  }

  // .txt / .md — read as UTF-8.
  return buffer.toString("utf-8");
}
