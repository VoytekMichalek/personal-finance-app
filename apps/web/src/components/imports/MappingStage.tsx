import { type Mapping, type Snapshot } from "@finance/shared";
import { ArrowRight, Sparkles, Upload } from "lucide-react";
import type { CsvImport } from "../../hooks/csv-import";
import { Card, Field, SectionTitle, Select } from "../common/primitives";
import { SelectItem } from "../ui/select";
import { Button } from "../ui/button";

export function MappingStage({
  data,
  flow,
}: {
  data: Snapshot;
  flow: CsvImport;
}) {
  const { accountId, filename, hasHeaders, columns, mapping, busy } = flow;
  return (
    <Card>
      <SectionTitle>Choose an account and CSV</SectionTitle>
      <div className="mb-6 max-w-md">
        <Field label="Import into">
          <Select
            disabled={Boolean(busy)}
            value={accountId}
            onValueChange={(value) => void flow.changeAccount(value)}
          >
            <SelectItem value="">Choose account</SelectItem>
            {data.accounts
              .filter((a) => !a.archived)
              .map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
          </Select>
        </Field>
      </div>
      <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-[#fafbfc] px-4 text-center focus-within:ring-2 focus-within:ring-primary">
        <Upload size={25} className="text-primary" />
        <span className="max-w-full break-all text-sm font-medium">
          {filename || "Choose a bank CSV"}
        </span>
        <span className="text-xs text-muted-foreground">
          Up to 5 MB · 10,000 rows · transactions are saved only after approval
        </span>
        <input
          type="file"
          aria-label="Choose bank CSV"
          className="sr-only"
          accept=".csv,text/csv,text/tab-separated-values"
          disabled={Boolean(busy)}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void flow.fileSelected(file);
            event.target.value = "";
          }}
        />
      </label>
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={hasHeaders}
          disabled={Boolean(busy)}
          onChange={(event) => void flow.changeHeaders(event.target.checked)}
        />
        First row contains column names
      </label>
      {columns && !hasHeaders && (
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          No column-name row is being used. All {columns.rowCount} transaction
          rows are included, starting with the first row.
        </p>
      )}
      {columns && (
        <>
          <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
            <SectionTitle>Match your columns</SectionTitle>
            <Button
              variant="secondary"
              disabled={Boolean(busy) || !flow.aiAvailable}
              onClick={() => void flow.suggestColumns()}
            >
              <Sparkles size={15} />
              Suggest with AI
            </Button>
          </div>
          <p className="mb-3 text-sm text-muted-foreground">
            {columns.rowCount} rows found. We’ve prefilled matching columns
            where possible. Check them against the sample below.
          </p>
          <p className="mb-5 text-xs leading-5 text-muted-foreground">
            Automatic suggestions work without AI. Optional AI suggestions send
            redacted sample rows to OpenRouter; configure a model in Settings →
            AI.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ["dateColumn", "Date"],
                ["descriptionColumn", "Description"],
                ["amountColumn", "Signed amount"],
                ["debitColumn", "Debit (if separate)"],
                ["creditColumn", "Credit (if separate)"],
                ["balanceColumn", "Running balance (optional)"],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <Select
                  disabled={Boolean(busy)}
                  value={mapping[key] ?? ""}
                  onValueChange={(value) => flow.changeMapping(key, value)}
                >
                  <SelectItem value="">Choose column</SelectItem>
                  {columns.headers.map((header) => (
                    <SelectItem key={header} value={header}>
                      {header}
                    </SelectItem>
                  ))}
                </Select>
              </Field>
            ))}
            <Field label="Date format">
              <Select
                disabled={Boolean(busy)}
                value={mapping.dateFormat}
                onValueChange={(value) =>
                  flow.changeMapping(
                    "dateFormat",
                    value as Mapping["dateFormat"],
                  )
                }
              >
                <SelectItem value="DMY">Day / month / year</SelectItem>
                <SelectItem value="MDY">Month / day / year</SelectItem>
                <SelectItem value="ISO">Year-month-day (ISO)</SelectItem>
              </Select>
            </Field>
          </div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            Use a signed amount column, or clear it and choose both debit and
            credit columns. Negative amounts mean money out; positive amounts
            mean money in. Ambiguous dates default to day/month/year. Check the
            date format carefully.
          </p>
          {mapping.amountColumn && (
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={Boolean(busy)}
                checked={Boolean(mapping.invertAmounts)}
                onChange={(event) =>
                  flow.changeMapping("invertAmounts", event.target.checked)
                }
              />
              Reverse amount signs (my bank uses positive amounts for money out)
            </label>
          )}
          <div className="mt-6 overflow-auto rounded-xl border">
            <table aria-label="CSV sample" className="w-full text-left text-xs">
              <thead className="border-b bg-muted">
                <tr>
                  {columns.headers.map((h) => (
                    <th key={h} className="p-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {columns.sample.map((row, index) => (
                  <tr key={index} className="border-b">
                    {columns.headers.map((h) => (
                      <td key={h} className="p-3 whitespace-nowrap">
                        {row[h]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button
            className="mt-6"
            disabled={!accountId || Boolean(busy)}
            onClick={() => void flow.review()}
          >
            {busy || "Review transactions"}
            <ArrowRight size={14} />
          </Button>
        </>
      )}
    </Card>
  );
}
