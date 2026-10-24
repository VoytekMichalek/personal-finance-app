import {
  addDays,
  scheduleDates,
  type Category,
  type ImportRow,
  type RecurringSuggestion,
  type Rule,
  type Schedule,
} from "@finance/shared";
const merchants: [RegExp, string][] = [
  [/woolworths|coles|aldi|iga\b/i, "Groceries"],
  [/netflix|spotify|disney|prime video|apple.com\/bill/i, "Subscriptions"],
  [/salary|payroll|wages/i, "Salary"],
  [/energ|electric|water|telstra|optus|internet/i, "Utilities"],
  [/uber|translink|petrol|caltex|ampol|bp\b/i, "Transport"],
  [/cafe|restaurant|mcdonald|coffee/i, "Dining"],
  [/pharmacy|chemist|medical|dental/i, "Health"],
  [/rent|mortgage/i, "Home"],
  [/insurance|allianz|suncorp|bupa|medibank|nib\b|aami|nrma/i, "Insurance"],
];
export function categorise(
  rows: ImportRow[],
  categories: Category[],
  rules: Rule[],
  history: ImportRow[] = [],
) {
  for (const row of rows) {
    if (row.error || row.kind === "transfer") continue;
    const eligible = categories.filter(
      (c) =>
        !c.archived &&
        c.kind === (row.kind === "income" ? "income" : "expense"),
    );
    const rule = [...rules]
      .sort((a, b) => a.priority - b.priority)
      .find(
        (r) =>
          r.enabled &&
          row.description.toLowerCase().includes(r.pattern.toLowerCase()) &&
          eligible.some((c) => c.id === r.categoryId),
      );
    const previous = history.find(
      (r) =>
        r.description.toLowerCase() === row.description.toLowerCase() &&
        eligible.some((c) => c.id === r.categoryId),
    );
    const hint = merchants.find(([pattern]) => pattern.test(row.description));
    row.categoryId =
      rule?.categoryId ??
      previous?.categoryId ??
      eligible.find((c) => c.name.toLowerCase() === hint?.[1].toLowerCase())
        ?.id ??
      (eligible.some((c) => c.id === row.categoryId) ? row.categoryId : null);
  }
}
export function recurringMerchant(description: string) {
  return description
    .toLowerCase()
    .replace(
      /\b(?:visa|mastercard|debit card|direct debit|purchase|payment|pos|eftpos)\b/g,
      " ",
    )
    .replace(
      /\b(?:ref(?:erence)?|receipt|auth|card)\s*[:#-]?\s*[a-z0-9-]+/g,
      " ",
    )
    .replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g, " ")
    .replace(/\b[a-z0-9]*\d[a-z0-9]*\b/g, " ")
    .replace(/[^a-z]+/g, " ")
    .trim();
}
export function recurringSuggestions(
  rows: ImportRow[],
  accountId: string,
  today: string,
): RecurringSuggestion[] {
  const groups = new Map<string, ImportRow[]>();
  for (const row of rows.filter(
    (r) => !r.error && r.kind !== "transfer" && r.kind !== "refund",
  )) {
    const merchant = recurringMerchant(row.description);
    if (!merchant) continue;
    const key = row.kind + ":" + merchant;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const result: RecurringSuggestion[] = [];
  for (const [key, group] of groups) {
    const sorted = group.sort((a, b) => a.date.localeCompare(b.date));
    if (
      sorted.length < 2 ||
      new Set(sorted.map((r) => r.date)).size !== sorted.length
    )
      continue;
    const gaps = sorted
      .slice(1)
      .map(
        (r, i) => (Date.parse(r.date) - Date.parse(sorted[i]!.date)) / 86400000,
      );
    const frequencies = [
      ["weekly", 7, 2],
      ["fortnightly", 14, 3],
      ["monthly", 30, 5],
      ["quarterly", 91, 8],
      ["annually", 365, 10],
    ] as const;
    const frequency = frequencies.find(([, days, tolerance]) => {
      const direct = gaps.filter(
        (gap) => Math.abs(gap - days) <= tolerance,
      ).length;
      // Two observations are a candidate only for a recognisable recurring provider.
      if (
        sorted.length === 2 &&
        !/insurance|allianz|suncorp|bupa|medibank|nib\b|aami|nrma|netflix|spotify|subscription|disney|prime video|telstra|optus|energ|electric|water|internet|salary|payroll|wages/i.test(
          key,
        )
      )
        return false;
      return (
        direct >= Math.ceil(gaps.length / 2) &&
        gaps.every((gap) => {
          const multiple = Math.round(gap / days);
          return (
            multiple >= 1 &&
            multiple <= 3 &&
            Math.abs(gap - days * multiple) <= tolerance
          );
        })
      );
    })?.[0];
    if (!frequency) continue;
    const last = sorted.at(-1)!;
    const amounts = sorted
      .map((r) => Math.abs(r.amountCents))
      .sort((a, b) => a - b);
    const median = amounts[Math.floor(amounts.length / 2)]!;
    if (amounts.some((a) => a < median * 0.5 || a > median * 1.5)) continue;
    const schedule = {
      name: last.description.slice(0, 100),
      accountId,
      kind: last.amountCents > 0 ? ("income" as const) : ("expense" as const),
      amountCents: median,
      categoryId: last.categoryId,
      owner: last.owner,
      startDate: last.date,
      frequency,
      subscription: /netflix|spotify|subscription|disney|prime video/i.test(
        last.description,
      ),
      provider: last.description.slice(0, 100),
      cancelled: false,
      endDate: null,
    };
    const next = scheduleDates(
      { ...schedule, id: "suggestion" } as Schedule,
      addDays(last.date, 1),
      addDays(today, 400),
    ).find((d) => d > today);
    if (!next) continue;
    result.push({
      key,
      evidence: sorted.map((r) => r.rowNumber),
      reason: `${sorted.length} payments, ${frequency}${sorted.length === 2 ? " — check this possible pattern" : ""}. ${new Set(amounts).size > 1 ? "Amounts vary; the median is suggested." : "The amount is consistent."}`,
      schedule: { ...schedule, startDate: next },
    });
  }
  return result;
}
