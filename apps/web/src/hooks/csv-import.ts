import { useCallback, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  mappingSchema,
  updateImportRows,
  type ImportPreview,
  type ImportRow,
  type Mapping,
} from "@finance/shared";
import { toast } from "sonner";
import { api, send, ApiError } from "../lib/api";
import { suggestCsvBatch } from "./csv-suggestions";

const emptyMapping: Mapping = {
  dateColumn: "",
  descriptionColumn: "",
  amountColumn: "",
  debitColumn: "",
  creditColumn: "",
  dateFormat: "DMY",
};
type Headers = {
  hasHeaders: boolean;
  headers: string[];
  sample: Record<string, string>[];
  rowCount: number;
  mapping: Mapping;
};
type Suggestion = {
  mapping?: Mapping;
  categories: { rowNumber: number; categoryId: string | null }[];
};

export function useCsvImport(initialAccountId: string) {
  const client = useQueryClient();
  const [accountId, setAccountId] = useState(initialAccountId);
  const [csv, setCsv] = useState("");
  const [filename, setFilename] = useState("");
  const [hasHeaders, setHasHeaders] = useState(true);
  const [columns, setColumns] = useState<Headers>();
  const [mapping, setMapping] = useState<Mapping>(emptyMapping);
  const [preview, setPreview] = useState<ImportPreview>();
  const [completed, setCompleted] = useState<number>();
  const [page, setPage] = useState(0);
  const suggested = useRef(new Set<number>());
  const [aiProgress, setAiProgress] = useState<{
    done: number;
    total: number;
    failed: boolean;
  }>();
  const chosen = useRef(new Set<keyof Mapping>());
  const running = useRef(false);
  const mutation = useMutation({
    mutationFn: ({ run }: { label: string; run: () => Promise<void> }) => run(),
    onError: (error) => {
      if (
        error instanceof ApiError &&
        error.details?.type === "import-conflicts"
      )
        void client.invalidateQueries({ queryKey: ["snapshot"] });
    },
  });
  const integrations = useQuery({
    queryKey: ["integrations"],
    queryFn: () =>
      api<{ openrouterConfigured: boolean; modelId: string | null }>(
        "/integrations",
      ),
  });
  const aiAvailable = Boolean(
    integrations.data?.openrouterConfigured && integrations.data.modelId,
  );
  const busy = mutation.isPending ? mutation.variables.label : "";
  async function task(label: string, run: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    try {
      await mutation.mutateAsync({ label, run });
    } catch {
      /* The mutation error is rendered next to the workflow. */
    } finally {
      running.current = false;
    }
  }
  async function readColumns(
    text: string,
    headerRow: boolean | undefined,
    account: string,
  ) {
    const result = await send<Headers>("/imports/headers", {
      csv: text,
      hasHeaders: headerRow,
      accountId: account || undefined,
    });
    setColumns(result);
    setHasHeaders(result.hasHeaders);
    setMapping(result.mapping);
    chosen.current.clear();
  }
  const fileSelected = (file: File) =>
    task("Reading CSV…", async () => {
      if (file.size > 5_000_000) throw new Error("Choose a CSV up to 5 MB.");
      const text = await file.text();
      setCsv(text);
      setFilename(file.name);
      setColumns(undefined);
      setPreview(undefined);
      setCompleted(undefined);
      await readColumns(text, undefined, accountId);
    });
  const changeHeaders = (value: boolean) =>
    task("Reading CSV…", async () => {
      setHasHeaders(value);
      setColumns(undefined);
      if (csv) await readColumns(csv, value, accountId);
    });
  const changeAccount = (value: string) =>
    task("Loading mapping…", async () => {
      if (csv) await readColumns(csv, hasHeaders, value);
      setAccountId(value);
    });
  function changeMapping<K extends keyof Mapping>(key: K, value: Mapping[K]) {
    chosen.current.add(key);
    setMapping((current) => ({ ...current, [key]: value }));
  }
  const suggestColumns = () =>
    task("Suggesting mappings…", async () => {
      const suggestion = await send<Suggestion>("/imports/suggest", {
        csv,
        hasHeaders,
      });
      if (suggestion.mapping)
        setMapping((current) => ({
          ...current,
          ...suggestion.mapping,
          ...Object.fromEntries(
            [...chosen.current].map((key) => [key, current[key]]),
          ),
        }));
    });
  const review = () =>
    task("Preparing preview…", async () => {
      const checked = mappingSchema.safeParse(mapping);
      if (!checked.success)
        throw new Error(
          "Check your column mapping. " + checked.error.issues[0]!.message,
        );
      const result = await send<ImportPreview>("/imports/preview", {
        accountId,
        csv,
        hasHeaders,
        mapping: checked.data,
      });
      suggested.current.clear();
      setAiProgress(undefined);
      setPreview(result);
      setPage(0);
    });
  const clearError = mutation.reset;
  const updateRow = useCallback(
    (rowNumber: number, patch: Partial<ImportRow>) => {
      clearError();
      suggested.current.delete(rowNumber);
      setPreview((current) =>
        current
          ? {
              ...current,
              rows: updateImportRows(current.rows, rowNumber, patch),
            }
          : current,
      );
    },
    [clearError],
  );
  const suggestCategories = () =>
    task("Suggesting categories…", async () => {
      if (!preview) return;
      const pending = preview.rows.filter(
        (row) =>
          !row.error &&
          !row.categoryId &&
          !row.categoryChosen &&
          row.kind !== "transfer" &&
          !suggested.current.has(row.rowNumber),
      );
      let done = 0;
      setAiProgress({ done, total: pending.length, failed: false });
      for (let offset = 0; offset < pending.length; offset += 25) {
        const rows = pending.slice(offset, offset + 25);
        try {
          const categories = await suggestCsvBatch(csv, hasHeaders, rows);
          for (const row of rows) suggested.current.add(row.rowNumber);
          setPreview((current) =>
            current
              ? {
                  ...current,
                  rows: current.rows.map((row) => {
                    const category = categories.find(
                      (item) => item.rowNumber === row.rowNumber,
                    );
                    return category &&
                      !row.categoryId &&
                      !row.categoryChosen &&
                      row.kind !== "transfer"
                      ? { ...row, categoryId: category.categoryId }
                      : row;
                  }),
                }
              : current,
          );
          done += rows.length;
          setAiProgress({ done, total: pending.length, failed: false });
        } catch (error) {
          setAiProgress({ done, total: pending.length, failed: true });
          throw new Error(
            `AI checked ${done} of ${pending.length} remaining transactions. All ${preview.rows.length} source rows are still in the review. Retry suggestions to continue, or review the uncategorised rows manually. ${error instanceof Error ? error.message : ""}`,
            { cause: error },
          );
        }
      }
    });
  const approve = () =>
    task("Importing…", async () => {
      if (!preview) return;
      const result = await send<{ imported: number; alreadyImported: boolean }>(
        "/imports/" + preview.id + "/commit",
        {
          rows: preview.rows.filter((row) => !row.error),
        },
      );
      setCompleted(result.imported);
      await client.invalidateQueries({ queryKey: ["snapshot"] });
      toast.success(
        result.alreadyImported
          ? "This file was already imported."
          : "Import complete",
      );
    });
  function reset() {
    setCompleted(undefined);
    suggested.current.clear();
    setAiProgress(undefined);
    setCsv("");
    setFilename("");
    setColumns(undefined);
    setPreview(undefined);
    setHasHeaders(true);
    setMapping(emptyMapping);
    mutation.reset();
  }
  return {
    accountId,
    csv,
    filename,
    hasHeaders,
    columns,
    mapping,
    preview,
    completed,
    page,
    setPage,
    busy,
    error: mutation.error?.message,
    conflictError: mutation.error,
    aiAvailable,
    aiProgress,
    fileSelected,
    changeHeaders,
    changeAccount,
    changeMapping,
    suggestColumns,
    review,
    updateRow,
    suggestCategories,
    approve,
    reset,
    changePreview: () => {
      setPreview(undefined);
      mutation.reset();
    },
  };
}
export type CsvImport = ReturnType<typeof useCsvImport>;
