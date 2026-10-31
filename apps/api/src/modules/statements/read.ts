import type { Category } from "@finance/shared";
import { HttpError } from "../../lib/errors.js";
import { extractPdf } from "./pdf.js";
import { parseStatement } from "./parser.js";
import { readWithAi } from "./ai-reader.js";

export async function readStatement(
  content: Buffer,
  owner: string,
  categories: Category[],
  accountType: string,
  options: { year?: number; useAi?: boolean; modelId?: string | null },
  onExtracted: (pages: number) => Promise<void>,
) {
  if (options.useAi && !options.modelId)
    throw new HttpError(400, "Choose an AI model in Settings → AI first.");
  const read = async (pages: string[]) => {
    await onExtracted(pages.length);
    const local = () => parseStatement(pages, owner, options.year, accountType);
    if (!options.useAi) return local();
    const result = await readWithAi(
      pages,
      owner,
      categories,
      options.modelId!,
      options.year,
      accountType,
    );
    if (result.rows.length) return result;
    const fallback = local();
    if (fallback.rows.length) {
      fallback.details.warnings.push(
        "AI returned no transactions. The local reader recovered these source rows; check them against your PDF.",
      );
      return fallback;
    }
    return result;
  };
  let pages = await extractPdf(content);
  let result = await read(pages);
  // Some PDFs contain selectable headers but scanned transaction tables. The
  // text-length heuristic alone can incorrectly skip OCR on the first reading.
  if (!result.rows.length) {
    pages = await extractPdf(content, true);
    result = await read(pages);
    result.details.warnings.push(
      "Scanned pages were read automatically because the PDF text contained no transaction rows. Check the extracted values against your PDF.",
    );
  }
  if (!result.rows.length)
    throw new HttpError(
      422,
      "No transactions were found after reading the PDF text and scanning its pages. Try a clearer statement or CSV export, or check the AI reading options.",
    );
  return { ...result, pages: pages.length };
}
