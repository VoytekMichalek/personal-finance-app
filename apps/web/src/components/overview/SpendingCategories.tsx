import { CategoryIcon } from "../common/VisualIcon";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import {
  categoryColour,
  expenseReport,
  money,
  type Snapshot,
} from "@finance/shared";
import { Card } from "../common/primitives";
import { VisualTitle } from "../common/VisualTitle";

export function SpendingCategories({
  data,
  owner,
  from,
  to,
}: {
  data: Snapshot;
  owner: string;
  from: string;
  to: string;
}) {
  const filters = {
    from,
    to,
    owners: owner === "all" ? [] : [owner],
  };
  const report = expenseReport(data, filters);
  const categories = [...report.categories]
    .sort((a, b) => b.amountCents - a.amountCents)
    .slice(0, 5);
  const max = Math.max(1, ...categories.map((c) => Math.abs(c.amountCents)));
  const params = new URLSearchParams({
    from: filters.from,
    to: filters.to,
    ...(owner === "all" ? {} : { owner }),
  });
  return (
    <Card>
      <VisualTitle
        title="Top spending categories"
        context="The five largest categories by recorded expenses less refunds in the selected period. Transfers and income are excluded. This follows your ownership filter."
        action={
          <Link className="text-xs text-primary" to={`/expenses?${params}`}>
            All categories
          </Link>
        }
      />
      <div className="grid gap-1">
        {categories.map((c) => {
          const category = data.categories.find((item) => item.id === c.id);
          const colour = category
            ? categoryColour(category, data.categories)
            : "#8694a3";
          const detail = new URLSearchParams(params);
          detail.set("detailGroup", "categories");
          detail.set("detailId", c.id);
          return (
            <Link
              key={c.id}
              to={`/expenses?${detail}`}
              className="rounded-lg p-2.5 hover:bg-muted"
            >
              <div className="mb-2 flex items-center gap-2 text-xs">
                <CategoryIcon
                  category={category}
                  categories={data.categories}
                  small
                />
                <span className="flex-1">
                  {category?.name ?? "Uncategorised"}
                </span>
                <span className="font-medium tabular-nums">
                  {money(c.amountCents)}
                </span>
                <ChevronRight size={13} />
              </div>
              <div className="h-1 rounded-full bg-muted" aria-hidden="true">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(Math.abs(c.amountCents) / max) * 100}%`,
                    background: colour,
                  }}
                />
              </div>
            </Link>
          );
        })}
      </div>
      {!categories.length && (
        <p className="py-8 text-sm text-muted-foreground">
          No spending recorded in the selected period.
        </p>
      )}
    </Card>
  );
}
