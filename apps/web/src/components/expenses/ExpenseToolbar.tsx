import {
  categoryLabel,
  type ExpenseFilters,
  type Snapshot,
} from "@finance/shared";
import { FilterToolbar } from "../common/FilterToolbar";
import { DateRangeFilter } from "../common/DateRangeFilter";
import { SearchInput } from "../common/SearchInput";
import { MultiSelect } from "../ui/multi-select";
import { AccountIdentity } from "../accounts/AccountIdentity";
import { CategoryChip } from "../common/EntityChip";

export function ExpenseToolbar({
  data,
  filters,
  onChange,
}: {
  data: Snapshot;
  filters: ExpenseFilters;
  onChange: (change: Partial<ExpenseFilters>) => void;
}) {
  const allFrom =
    data.transactions.map((row) => row.date).sort()[0] ?? data.today;
  const active = !!(
    filters.search ||
    filters.accountIds?.length ||
    filters.owners?.length ||
    filters.categoryIds?.length ||
    filters.from !== allFrom ||
    filters.to !== data.today
  );
  return (
    <FilterToolbar
      label="Expense filters"
      active={active}
      tags={[
        ...(filters.from !== allFrom || filters.to !== data.today
          ? [
              {
                label: `${filters.from} – ${filters.to}`,
                remove: () => onChange({ from: allFrom, to: data.today }),
              },
            ]
          : []),
        ...(filters.accountIds?.length
          ? [
              {
                label: `${filters.accountIds.length} account${filters.accountIds.length === 1 ? "" : "s"}`,
                remove: () => onChange({ accountIds: [] }),
              },
            ]
          : []),
        ...(filters.categoryIds?.length
          ? [
              {
                label: `${filters.categoryIds.length} categor${filters.categoryIds.length === 1 ? "y" : "ies"}`,
                remove: () =>
                  onChange({ categoryIds: [], categoryMatch: undefined }),
              },
            ]
          : []),
        ...(filters.owners?.length
          ? [
              {
                label: `${filters.owners.length} people`,
                remove: () => onChange({ owners: [] }),
              },
            ]
          : []),
      ]}
      clear={() =>
        onChange({
          from: allFrom,
          to: data.today,
          search: "",
          accountIds: [],
          owners: [],
          categoryIds: [],
          categoryMatch: undefined,
        })
      }
    >
      <div>
        <SearchInput
          aria-label="Search expenses"
          value={filters.search ?? ""}
          onValueChange={(search) => onChange({ search })}
          placeholder="Search descriptions"
        />
      </div>
      <div>
        <DateRangeFilter
          from={filters.from}
          to={filters.to}
          today={data.today}
          allFrom={allFrom}
          onChange={onChange}
        />
      </div>
      <div>
        <MultiSelect
          aria-label="Account"
          selectionLabel="Accounts"
          value={filters.accountIds ?? []}
          onChange={(accountIds) => onChange({ accountIds })}
          allLabel="All accounts"
          options={data.accounts.map((account) => ({
            value: account.id,
            label: account.name,
            content: (
              <AccountIdentity
                account={account}
                institutions={data.institutions}
              />
            ),
          }))}
        />
      </div>
      <div>
        <MultiSelect
          aria-label="Person"
          selectionLabel="People"
          value={filters.owners ?? []}
          onChange={(owners) => onChange({ owners })}
          allLabel="Everyone"
          options={[
            { value: "household", label: "Household" },
            ...data.people.map((person) => ({
              value: person.id,
              label: person.name,
            })),
          ]}
        />
      </div>
      <div>
        <MultiSelect
          aria-label="Category"
          selectionLabel="Categories"
          value={filters.categoryIds ?? []}
          onChange={(categoryIds) =>
            onChange({
              categoryIds,
              categoryMatch: categoryIds.length
                ? filters.categoryMatch
                : undefined,
            })
          }
          onSelectAll={(categoryIds) =>
            onChange({ categoryIds, categoryMatch: "exact" })
          }
          allLabel="All categories"
          options={[
            { value: "uncategorised", label: "Uncategorised" },
            ...data.categories
              .filter((category) => category.kind === "expense")
              .map((category) => ({
                value: category.id,
                label: categoryLabel(category, data.categories),
                content: (
                  <CategoryChip
                    categoryId={category.id}
                    categories={data.categories}
                  />
                ),
              })),
          ]}
        />
      </div>
    </FilterToolbar>
  );
}
