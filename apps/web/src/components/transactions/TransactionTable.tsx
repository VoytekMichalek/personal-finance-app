import { useState } from "react";
import {
  displayDate,
  identityColour,
  money,
  type Snapshot,
  type Transaction,
} from "@finance/shared";
import { useAction } from "../../hooks/data";
import { Card, Pill, Select } from "../common/primitives";
import { CategoryChip, PersonChip } from "../common/EntityChip";
import { Button } from "../ui/button";
import { SelectItem } from "../ui/select";
import { BulkDelete } from "./BulkDelete";
import { TransactionCategory } from "./TransactionCategory";

export function TransactionTable({
  data,
  rows,
  onOpen,
}: {
  data: Snapshot;
  rows: Transaction[];
  onOpen: (row: Transaction) => void;
}) {
  const [selected, setSelected] = useState(new Set<string>());
  const [page, setPage] = useState(0);
  const [bulk, setBulk] = useState("");
  const action = useAction(() => setSelected(new Set()));
  // Resolve against the current filtered snapshot, including refreshed/deleted rows.
  const selection = rows.filter((row) => selected.has(row.id));
  const eligible = selection.filter((row) => row.kind !== "transfer");
  const kinds = new Set(
    eligible.map((row) => (row.kind === "income" ? "income" : "expense")),
  );
  const categories = data.categories.filter(
    (category) =>
      !category.archived && kinds.size === 1 && kinds.has(category.kind),
  );
  const categoryValid =
    !bulk || categories.some((category) => category.id === bulk);
  const all = rows.length > 0 && selection.length === rows.length;
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(rows.length / 50) - 1),
  );
  const toggleAll = () =>
    setSelected(all ? new Set() : new Set(rows.map((row) => row.id)));
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
        <p>
          {rows.length} transaction{rows.length === 1 ? "" : "s"}
        </p>
        <Button
          size="sm"
          variant="secondary"
          disabled={!rows.length}
          onClick={toggleAll}
        >
          {all
            ? "Clear selection"
            : `Select all ${rows.length} matching transactions`}
        </Button>
        <p role="status">{selection.length} selected</p>
      </div>
      {selection.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-blue-50 p-3">
          {eligible.length > 0 && (
            <>
              <Select
                aria-label="Bulk category"
                className="w-56"
                value={bulk}
                onValueChange={setBulk}
              >
                <SelectItem value="">Uncategorised</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    <CategoryChip
                      categoryId={category.id}
                      categories={data.categories}
                    />
                  </SelectItem>
                ))}
              </Select>
              <Button
                size="sm"
                disabled={
                  action.isPending || !categoryValid || eligible.length > 10000
                }
                onClick={() =>
                  action.mutate({
                    path: "/transactions/bulk-category",
                    body: {
                      categoryId: bulk || null,
                      records: eligible.map(({ id, version }) => ({
                        id,
                        version,
                      })),
                    },
                  })
                }
              >
                Apply category
              </Button>
            </>
          )}
          <BulkDelete
            data={data}
            selection={selection}
            disabled={action.isPending}
            onDeleted={() => setSelected(new Set())}
          />
          <p className="text-xs">
            {eligible.length} can be categorised
            {selection.length > eligible.length
              ? `; ${selection.length - eligible.length} transfers keep their linked transfer category.`
              : "."}
          </p>
          {kinds.size > 1 && (
            <p className="text-xs">
              Filter by type to assign a category, or choose Uncategorised to
              clear categories.
            </p>
          )}
          {!categoryValid && (
            <p role="alert" className="text-xs">
              Choose a category that matches the selected types.
            </p>
          )}
          {eligible.length > 10000 && (
            <p role="alert" className="text-xs">
              Narrow your filters to apply a category to at most 10,000
              transactions at once.
            </p>
          )}
          {action.error && (
            <p role="alert" className="text-xs text-destructive">
              {action.error.message}
            </p>
          )}
        </div>
      )}
      {rows.length ? (
        <Card className="overflow-hidden p-0!">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-[#fafafa] text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="w-10 p-3">
                    <input
                      type="checkbox"
                      aria-label="Select all matching transactions"
                      checked={all}
                      ref={(input) => {
                        if (input)
                          input.indeterminate = selection.length > 0 && !all;
                      }}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="p-3">Transaction</th>
                  <th className="hidden p-3 md:table-cell">Account</th>
                  <th className="hidden p-3 sm:table-cell">Category</th>
                  <th className="hidden p-3 xl:table-cell">Belongs to</th>
                  <th className="p-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows
                  .slice(currentPage * 50, currentPage * 50 + 50)
                  .map((row) => (
                    <tr key={row.id} className="hover:bg-[#fafbfc]">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          aria-label={"Select " + row.description}
                          checked={selected.has(row.id)}
                          onChange={(event) =>
                            setSelected((current) => {
                              const next = new Set(current);
                              if (event.target.checked) next.add(row.id);
                              else next.delete(row.id);
                              return next;
                            })
                          }
                        />
                      </td>
                      <td className="p-3">
                        <button
                          className="text-left [overflow-wrap:anywhere]"
                          onClick={() => onOpen(row)}
                        >
                          <span className="block font-medium">
                            {row.description}
                          </span>
                          <span className="mt-1 block text-[10px] text-muted-foreground">
                            {displayDate(row.date)}
                            {row.kind === "refund" ? " · Refund" : ""}
                          </span>
                        </button>
                        <div className="mt-2 flex flex-wrap gap-1 sm:hidden">
                          <TransactionCategory
                            row={row}
                            categories={data.categories}
                            disabled={action.isPending}
                          />
                          <PersonChip owner={row.owner} people={data.people} />
                        </div>
                      </td>
                      <td className="hidden p-3 md:table-cell">
                        <Pill
                          colour={identityColour("account:" + row.accountId)}
                        >
                          {
                            data.accounts.find((a) => a.id === row.accountId)
                              ?.name
                          }
                        </Pill>
                      </td>
                      <td className="hidden p-3 sm:table-cell">
                        <TransactionCategory
                          row={row}
                          categories={data.categories}
                          disabled={action.isPending}
                        />
                      </td>
                      <td className="hidden p-3 xl:table-cell">
                        <PersonChip owner={row.owner} people={data.people} />
                      </td>
                      <td
                        className={
                          "p-3 text-right font-semibold whitespace-nowrap tabular-nums " +
                          (row.kind !== "transfer" && row.amountCents > 0
                            ? "text-emerald-700"
                            : "")
                        }
                      >
                        {row.amountCents > 0 ? "+" : ""}
                        {money(row.amountCents)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-2 border-t p-3">
            <Button
              size="sm"
              variant="ghost"
              disabled={!currentPage}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous
            </Button>
            <p className="text-xs">
              {currentPage * 50 + 1}–
              {Math.min((currentPage + 1) * 50, rows.length)} of {rows.length}
            </p>
            <Button
              size="sm"
              variant="ghost"
              disabled={(currentPage + 1) * 50 >= rows.length}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-muted-foreground">
            No transactions match. Adjust your filters, add activity or upload a
            CSV.
          </p>
        </Card>
      )}
    </>
  );
}
