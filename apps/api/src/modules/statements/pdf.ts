import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { HttpError } from "../../lib/errors.js";
const run = promisify(execFile);
let processing = false;
export async function extractPdf(buffer: Buffer): Promise<string[]> {
  if (processing)
    throw new HttpError(
      429,
      "Another statement is processing. Please try again shortly.",
    );
  if (!buffer.subarray(0, 5).equals(Buffer.from("%PDF-")))
    throw new HttpError(400, "Choose a valid PDF statement.");
  processing = true;
  let dir: string | undefined;
  const deadline = Date.now() + 10 * 60_000;
  try {
    dir = await mkdtemp(path.join(tmpdir(), "finance-statement-"));
    const file = path.join(dir, "statement.pdf");
    await writeFile(file, buffer, { mode: 0o600 });
    const info = await run("pdfinfo", [file], {
      timeout: 30000,
      maxBuffer: 1024 * 1024,
    });
    const count = Number(info.stdout.match(/^Pages:\s+(\d+)/m)?.[1]);
    if (!count || count > 500)
      throw new HttpError(400, "Upload up to 500 pages per statement.");
    const result = await run(
      "pdftotext",
      ["-layout", "-enc", "UTF-8", file, "-"],
      { timeout: 120000, maxBuffer: 10 * 1024 * 1024 },
    );
    const pages = result.stdout.split("\f").slice(0, count);
    for (let i = 0; i < count; i++) {
      if (Date.now() > deadline)
        throw new HttpError(
          408,
          "This scan took too long to read. Split it into smaller PDFs.",
        );
      if ((pages[i]?.replace(/\s/g, "").length ?? 0) >= 40) continue;
      const prefix = path.join(dir, "page");
      await run(
        "pdftoppm",
        [
          "-f",
          String(i + 1),
          "-l",
          String(i + 1),
          "-scale-to",
          "2200",
          "-singlefile",
          "-png",
          file,
          prefix,
        ],
        { timeout: 60000, maxBuffer: 1024 * 1024 },
      );
      await run(
        "tesseract",
        [prefix + ".png", prefix, "-l", "eng", "--psm", "6"],
        { timeout: 60000, maxBuffer: 1024 * 1024 },
      );
      pages[i] = await readFile(prefix + ".txt", "utf8");
    }
    if (pages.join("").length > 5_000_000)
      throw new HttpError(
        400,
        "Statement text is too large. Split it into smaller PDFs.",
      );
    return pages;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      throw new HttpError(
        503,
        "PDF reading or scan recognition is unavailable. Ask the app owner to install Poppler and Tesseract.",
      );
    throw new HttpError(
      400,
      "Could not read this PDF. Remove password protection or export a fresh statement and try again.",
    );
  } finally {
    processing = false;
    if (dir) await rm(dir, { recursive: true, force: true });
  }
}
