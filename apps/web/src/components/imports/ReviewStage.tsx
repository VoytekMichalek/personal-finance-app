import {
  type ImportPreview,
  type ImportRow,
  type Mapping,
  type Snapshot,
} from "@finance/shared";
import { FileSpreadsheet, Sparkles } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";
import { send } from "../../lib/api";
import { ImportRows } from "./ImportRows";
import { Card } from "../common/primitives";
import { Button } from "../ui/button";
type Suggestion = {
  mapping?: Mapping;
  categories: { rowNumber: number; categoryId: string | null }[];
};
type Props = {
  data: Snapshot;
  accountId: string;
  csv: string;
  filename: string;
  preview: ImportPreview;
  busy: string;
  selected: ImportRow[];
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
  setCompleted: (v: number) => void;
  setPreview: Dispatch<SetStateAction<ImportPreview | undefined>>;
  integrations: { data?: { modelId: string | null } };
  query: { refetch: () => Promise<unknown> };
  updateRow: (n: number, patch: Partial<ImportRow>) => void;
  task: (label: string, operation: () => Promise<void>) => Promise<void>;
};
export function ReviewStage({
  data,
  accountId,
  csv,
  filename,
  preview,
  busy,
  selected,
  page,
  setPage,
  setCompleted,
  setPreview,
  integrations,
  query,
  updateRow,
  task,
}: Props) {
  return (
    <>
      <Card className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold">
              <FileSpreadsheet size={17} />
              {filename}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {preview.validCount} valid · {preview.invalidCount} need
              correction · {preview.rows.filter((r) => r.duplicate).length}{" "}
              possible duplicates
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={Boolean(busy) || !integrations.data?.modelId}
              onClick={() =>
                void task("Suggesting categories…", async () => {
                  for (
                    let offset = 0;
                    offset < preview.rows.length;
                    offset += 100
                  ) {
                    const rows = preview.rows
                      .slice(offset, offset + 100)
                      .filter(
                        (r) =>
                          !r.error &&
                          !r.categoryId &&
                          !r.categoryChosen &&
                          r.kind !== "transfer",
                      );
                    if (!rows.length) continue;
                    const suggestions = await send<Suggestion>(
                      "/imports/suggest",
                      {
                        csv,
                        rows: rows.map(
                          ({ rowNumber, description, amountCents, kind }) => ({
                            rowNumber,
                            description,
                            amountCents,
                            kind,
                          }),
                        ),
                      },
                    );
                    setPreview((current) =>
                      current
                        ? {
                            ...current,
                            rows: current.rows.map((row) => {
                              const suggestion = suggestions.categories.find(
                                (s) => s.rowNumber === row.rowNumber,
                              );
                              return suggestion &&
                                !row.categoryId &&
                                !row.categoryChosen &&
                                row.kind !== "transfer"
                                ? {
                                    ...row,
                                    categoryId: suggestion.categoryId,
                                  }
                                : row;
                            }),
                          }
                        : current,
                    );
                  }
                })
              }
            >
              <Sparkles size={14} />
              Suggest categories
            </Button>
            <Button
              variant="secondary"
              disabled={Boolean(busy)}
              onClick={() => setPreview(undefined)}
            >
              Change mapping
            </Button>
            <Button
              disabled={!selected.length || Boolean(busy)}
              onClick={() =>
                void task("Importing…", async () => {
                  const result = await send<{
                    imported: number;
                    alreadyImported: boolean;
                  }>("/imports/" + preview.id + "/commit", {
                    rows: preview.rows
                      .filter((r) => !r.error)
                      .map(
                        ({
                          rowNumber,
                          date,
                          description,
                          amountCents,
                          kind,
                          counterAccountId,
                          categoryId,
                          owner,
                          include,
                          allowDuplicate,
                        }) => ({
                          rowNumber,
                          date,
                          description,
                          amountCents,
                          kind,
                          counterAccountId,
                          categoryId,
                          owner,
                          include,
                          allowDuplicate,
                        }),
                      ),
                  });
                  setCompleted(result.imported);
                  await query.refetch();
                  toast.success(
                    result.alreadyImported
                      ? "This file was already imported."
                      : "Import complete",
                  );
                })
              }
            >
              {busy || "Confirm import (" + selected.length + ")"}
            </Button>
          </div>
        </div>
      </Card>
      <ImportRows
        {...{ data, accountId, preview, page, setPage, busy, updateRow }}
      />
      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        Amounts and dates remain tied to your source rows. Correct their mapping
        if needed. Mark refunds and transfers before confirming. Transfers
        create both linked account entries; a later statement will flag the
        other entry as a possible duplicate. Identical legitimate payments can
        be retained explicitly.
      </p>
    </>
  );
}
