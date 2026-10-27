import { csvSuggestionRequestSchema } from "@finance/shared";
import { prisma } from "../../lib/db.js";
import { HttpError } from "../../lib/errors.js";
import { csvRecords } from "./parser.js";
import { redact, suggest } from "../../integrations/openrouter.js";

export async function suggestCsv(body: unknown) {
  const input = csvSuggestionRequestSchema.parse(body);
  const modelId = (await prisma.setup.findUnique({ where: { id: 1 } }))
    ?.modelId;
  if (!modelId)
    throw new HttpError(400, "Choose a model in Settings → AI first.");
  const records = csvRecords(input.csv, input.hasHeaders);
  const categories = await prisma.category.findMany({
    where: { archived: false },
    select: { id: true, name: true, kind: true },
  });
  const result = await suggest(
    modelId,
    {
      headers: Object.keys(records[0] ?? {}),
      sample: records
        .slice(0, 3)
        .map((row) =>
          Object.fromEntries(
            Object.entries(row).map(([k, v]) => [k, redact(v)]),
          ),
        ),
      categories,
      rows: input.rows?.map((row) => ({
        rowNumber: row.rowNumber,
        description: redact(row.description),
        direction: row.kind
          ? row.kind === "income"
            ? "income"
            : "expense"
          : row.amountCents < 0
            ? "expense"
            : "income",
      })),
    },
    input.rows ? "categories" : "mapping",
    categories.map((category) => category.id),
  );
  const headers = Object.keys(records[0] ?? {});
  if (
    result.mapping &&
    [
      result.mapping.dateColumn,
      result.mapping.descriptionColumn,
      result.mapping.amountColumn,
      result.mapping.debitColumn,
      result.mapping.creditColumn,
    ].some((c) => c && !headers.includes(c))
  )
    throw new HttpError(502, "AI suggested a column that is not in the CSV.");
  if (input.rows) {
    const ids = new Set(input.rows.map((row) => row.rowNumber));
    const returned = new Set(result.categories.map((row) => row.rowNumber));
    if (
      ids.size !== input.rows.length ||
      returned.size !== result.categories.length ||
      returned.size !== ids.size ||
      result.categories.some((row) => !ids.has(row.rowNumber))
    )
      throw new HttpError(
        502,
        "AI did not return a suggestion for every requested row. Retry this batch; your transactions have not changed.",
      );
  }
  // One hallucinated, archived or wrong-kind ID must not discard valid suggestions.
  // These are advisory labels only; commit still validates every stored category.
  result.categories = result.categories.map((item) => {
    const row = input.rows?.find(
      (candidate) => candidate.rowNumber === item.rowNumber,
    );
    const kind = row
      ? (row.kind ?? (row.amountCents < 0 ? "expense" : "income"))
      : null;
    const category = categories.find(
      (candidate) => candidate.id === item.categoryId,
    );
    const eligible =
      category &&
      kind !== "transfer" &&
      (!kind || category.kind === (kind === "income" ? "income" : "expense"));
    return {
      rowNumber: item.rowNumber,
      categoryId: eligible ? category.id : null,
    };
  });
  return result;
}
