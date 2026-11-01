import type { ExpenseCategoryPoint } from "@finance/shared";

export type ChartCategory = { id: string; name: string; colour: string };
export type ChartGroup = ChartCategory & { indexes: number[] };

export function expenseChartGroups(
  series: ChartCategory[],
  points: ExpenseCategoryPoint[],
  expanded: boolean,
): ChartGroup[] {
  const ranked = series
    .map((item, index) => ({
      ...item,
      indexes: [index],
      activity: points.reduce(
        (total, point) => total + Math.abs(point.amounts[index] ?? 0),
        0,
      ),
    }))
    .sort((a, b) => b.activity - a.activity || a.id.localeCompare(b.id));
  if (expanded) return ranked;
  const named = ranked.filter((item) => item.id !== "uncategorised");
  const remaining = named.slice(5);
  return [
    ...named.slice(0, 5),
    ...ranked.filter((item) => item.id === "uncategorised"),
    ...(remaining.length
      ? [
          {
            id: "remaining",
            name: "Remaining categories",
            colour: "#94a3b8",
            indexes: remaining.flatMap((item) => item.indexes),
          },
        ]
      : []),
  ];
}

// Keep positive and negative stacks separate when grouping: a refund must not
// erase another category's spending just because both are in Remaining categories.
export function chartGroupAmount(
  point: ExpenseCategoryPoint,
  group: ChartGroup,
  sign?: "positive" | "negative",
) {
  return group.indexes.reduce((total, index) => {
    const amount = point.amounts[index] ?? 0;
    return (
      total +
      (sign === "positive"
        ? Math.max(0, amount)
        : sign === "negative"
          ? Math.min(0, amount)
          : amount)
    );
  }, 0);
}
