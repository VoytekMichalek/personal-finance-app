import {
  categoryLabel,
  displayDate,
  type Snapshot,
  type TransactionFilters as Filters,
} from "@finance/shared";
import { FilterToolbar } from "../common/FilterToolbar";
import { DateRangeFilter } from "../common/DateRangeFilter";
import { SearchInput } from "../common/SearchInput";
import { MultiSelect } from "../ui/multi-select";
import { AccountIdentity } from "../accounts/AccountIdentity";
import { CategoryChip } from "../common/EntityChip";

export function TransactionFilters({
  data,
  filters,
  update,
  accountId,
}: {
  data: Snapshot;
  filters: Filters;
  update: (change: Partial<Filters>) => void;
  accountId?: string;
}) {
  const people = [
    { value: "household", label: "Household" },
    ...data.people.map((p) => ({ value: p.id, label: p.name })),
  ];
  const summary = [
    filters.from || filters.to
      ? `${filters.from ? displayDate(filters.from) : "Start"} – ${filters.to ? displayDate(filters.to) : "Today"}`
      : "All dates",
    filters.owners?.length
      ? people
          .filter((p) => filters.owners?.includes(p.value))
          .map((p) => p.label)
          .join(", ")
      : "Everyone",
    accountId
      ? data.accounts.find((a) => a.id === accountId)?.name
      : filters.accountIds?.length
        ? `${filters.accountIds.length} account${filters.accountIds.length > 1 ? "s" : ""}`
        : "All accounts",
  ];
  const active =
    filters.search ||
    filters.from ||
    filters.to ||
    filters.accountIds?.length ||
    filters.owners?.length ||
    filters.categoryIds?.length ||
    filters.kinds?.length;
  return (
    <>
      <FilterToolbar
        label="Transaction filters"
        active={!!active}
        tags={[
          ...(filters.from || filters.to
            ? [
                {
                  label: summary[0]!,
                  remove: () => update({ from: null, to: null }),
                },
              ]
            : []),
          ...(filters.accountIds?.length
            ? [
                {
                  label: `${filters.accountIds.length} account${filters.accountIds.length === 1 ? "" : "s"}`,
                  remove: () => update({ accountIds: [] }),
                },
              ]
            : []),
          ...(filters.categoryIds?.length
            ? [
                {
                  label: `${filters.categoryIds.length} categor${filters.categoryIds.length === 1 ? "y" : "ies"}`,
                  remove: () => update({ categoryIds: [] }),
                },
              ]
            : []),
          ...(filters.owners?.length
            ? [{ label: summary[1]!, remove: () => update({ owners: [] }) }]
            : []),
          ...(filters.kinds?.length
            ? [
                {
                  label: filters.kinds.join(", "),
                  remove: () => update({ kinds: [] }),
                },
              ]
            : []),
        ]}
        summary={summary.filter(Boolean).join(" · ")}
        clear={() =>
          update({
            search: "",
            from: null,
            to: null,
            accountIds: [],
            categoryIds: [],
            owners: [],
            kinds: [],
          })
        }
      >
        <div>
          <SearchInput
            aria-label="Search transactions"
            placeholder="Search descriptions"
            value={filters.search}
            onValueChange={(search) => update({ search })}
          />
        </div>
        <div>
          <DateRangeFilter
            from={filters.from ?? ""}
            to={filters.to ?? ""}
            today={data.today}
            optional
            labels={["From date", "To date"]}
            onChange={({ from, to }) =>
              update({ from: from || null, to: to || null })
            }
          />
        </div>
        {!accountId && (
          <div>
            <MultiSelect
              aria-label="Filter account"
              selectionLabel="Accounts"
              value={filters.accountIds ?? []}
              onChange={(accountIds) => update({ accountIds })}
              allLabel="All accounts"
              options={data.accounts.map((a) => ({
                value: a.id,
                label: a.name,
                content: (
                  <AccountIdentity
                    account={a}
                    institutions={data.institutions}
                  />
                ),
              }))}
            />
          </div>
        )}
        <div>
          <MultiSelect
            aria-label="Filter category"
            selectionLabel="Categories"
            value={filters.categoryIds ?? []}
            onChange={(categoryIds) => update({ categoryIds })}
            onSelectAll={(categoryIds) => update({ categoryIds })}
            allLabel="All categories"
            options={[
              { value: "none", label: "Uncategorised" },
              ...data.categories.map((c) => ({
                value: c.id,
                label: categoryLabel(c, data.categories),
                content: (
                  <CategoryChip
                    categoryId={c.id}
                    categories={data.categories}
                  />
                ),
              })),
            ]}
          />
        </div>
        <div>
          <MultiSelect
            aria-label="Ownership filter"
            selectionLabel="People"
            value={filters.owners ?? []}
            onChange={(owners) => update({ owners })}
            allLabel="All owners"
            options={people}
          />
        </div>
        <div>
          <MultiSelect
            aria-label="Filter type"
            selectionLabel="Types"
            value={filters.kinds ?? []}
            onChange={(kinds) => update({ kinds: kinds as Filters["kinds"] })}
            allLabel="All types"
            options={[
              { value: "income", label: "Income" },
              { value: "expense", label: "Expenses & refunds" },
              { value: "refund", label: "Refunds" },
              { value: "transfer", label: "Transfers" },
            ]}
          />
        </div>
      </FilterToolbar>
      {filters.from && filters.to && filters.from > filters.to && (
        <p role="alert" className="mt-2 text-sm text-amber-800">
          Choose an end date on or after the start date.
        </p>
      )}
    </>
  );
}
