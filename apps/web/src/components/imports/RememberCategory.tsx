import { matchesRule, rememberedRule, type ImportRow } from "@finance/shared";
import { Input } from "../common/primitives";
import { Select, SelectItem } from "../ui/select";

export function RememberCategory({
  row,
  count,
  busy,
  patch,
}: {
  row: ImportRow;
  count: number;
  busy: boolean;
  patch: (value: Partial<ImportRow>) => void;
}) {
  const rule = rememberedRule(row);
  const valid = !!rule.pattern && matchesRule(row.description, rule);
  return (
    <div className="space-y-2 text-xs">
      <label className="flex items-start gap-2 leading-5">
        <input
          type="checkbox"
          className="mt-1"
          aria-label={"Remember category row " + row.rowNumber}
          disabled={
            busy || !row.categoryId || !row.include || !row.description.trim()
          }
          checked={!!row.rememberCategory}
          onChange={(event) =>
            patch({ rememberCategory: event.target.checked })
          }
        />
        <span>
          Remember category
          <span className="block text-muted-foreground">
            Apply to matching descriptions now and save a rule when you import.
          </span>
        </span>
      </label>
      {row.rememberCategory && (
        <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
          <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
            <label className="grid gap-1">
              Match descriptions
              <Select
                aria-label={"Remember match mode row " + row.rowNumber}
                disabled={busy}
                value={rule.matchMode}
                onValueChange={(value) =>
                  patch({ rememberMatchMode: value as "exact" | "contains" })
                }
              >
                <SelectItem value="contains">Containing text</SelectItem>
                <SelectItem value="exact">Exactly matching</SelectItem>
              </Select>
            </label>
            <label className="grid gap-1">
              Remembered text
              <Input
                aria-label={"Remembered text row " + row.rowNumber}
                disabled={busy}
                maxLength={250}
                value={row.rememberPattern ?? rule.pattern}
                onChange={(event) =>
                  patch({ rememberPattern: event.target.value })
                }
              />
            </label>
          </div>
          {!valid ? (
            <p role="alert" className="text-destructive">
              Enter text that matches this transaction before importing.
            </p>
          ) : (
            <p role="status">
              {count
                ? `Updated ${count} other transaction${count === 1 ? "" : "s"} in this upload.`
                : "No other matching transactions in this upload. Adjust the text or match mode if needed."}
            </p>
          )}
          <p className="text-muted-foreground">
            The rule is saved after approval.{" "}
            <a
              href="/categories"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              View transaction rules
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
