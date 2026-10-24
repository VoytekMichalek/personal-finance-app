import {
  type ImportPreview,
  type ImportRow,
  type Mapping,
} from "@finance/shared";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check } from "lucide-react";
import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import {
  Card,
  Empty,
  ErrorState,
  Loading,
  PageHeading,
} from "../components/common/primitives";
import { MappingStage } from "../components/imports/MappingStage";
import { ReviewStage } from "../components/imports/ReviewStage";
import { Button } from "../components/ui/button";
import { useSnapshot } from "../hooks/data";
import { api, send } from "../lib/api";
const initialMapping: Mapping = {
  dateColumn: "",
  descriptionColumn: "",
  amountColumn: "",
  debitColumn: "",
  creditColumn: "",
  dateFormat: "DMY",
};
export function Imports() {
  const query = useSnapshot();
  const [accountId, setAccount] = useState("");
  const [csv, setCsv] = useState("");
  const [filename, setFilename] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [sample, setSample] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Mapping>(initialMapping);
  const [preview, setPreview] = useState<ImportPreview>();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState<number>();
  const [page, setPage] = useState(0);
  const integrations = useQuery({
    queryKey: ["integrations"],
    queryFn: () =>
      api<{ openrouterConfigured: boolean; modelId: string | null }>(
        "/integrations",
      ),
  });
  const updateRow = useCallback(
    (rowNumber: number, patch: Partial<ImportRow>) => {
      setPreview((current) =>
        current
          ? {
              ...current,
              rows: current.rows.map((row) =>
                row.rowNumber === rowNumber
                  ? {
                      ...row,
                      ...patch,
                      ...(Object.hasOwn(patch, "categoryId")
                        ? { categoryChosen: true }
                        : {}),
                    }
                  : row,
              ),
            }
          : current,
      );
    },
    [],
  );
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <ErrorState
        message={query.error.message}
        retry={() => void query.refetch()}
      />
    );
  const data = query.data;
  async function task(label: string, operation: () => Promise<void>) {
    setBusy(label);
    setError("");
    try {
      await operation();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function fileSelected(file: File) {
    if (file.size > 5_000_000) {
      setError("Choose a CSV up to 5 MB.");
      return;
    }
    await task("Reading CSV…", async () => {
      const text = await file.text();
      const result = await send<{
        headers: string[];
        sample: Record<string, string>[];
        rowCount: number;
      }>("/imports/headers", { csv: text });
      setCsv(text);
      setFilename(file.name);
      setHeaders(result.headers);
      setSample(result.sample);
      setPreview(undefined);
      setCompleted(undefined);
      const saved = accountId
        ? await api<Mapping | null>("/imports/mapping/" + accountId)
        : null;
      const guessed = { ...initialMapping };
      for (const header of result.headers) {
        const key = header.toLowerCase();
        if (key.includes("date")) guessed.dateColumn = header;
        else if (/description|narrative|merchant|details/.test(key))
          guessed.descriptionColumn = header;
        else if (/debit|withdrawal/.test(key)) guessed.debitColumn = header;
        else if (/credit|deposit/.test(key)) guessed.creditColumn = header;
        else if (/amount/.test(key)) guessed.amountColumn = header;
      }
      setMapping(saved ?? guessed);
    });
  }
  const selected =
    preview?.rows.filter((row) => row.include && !row.error) ?? [];
  return (
    <>
      <PageHeading
        eyebrow="Less typing. More living."
        title="Bring your activity together."
        description="Import a bank CSV, check the details and make it yours."
      />
      <div className="mb-7 flex gap-6 text-xs">
        {[
          ["1", "Choose a file", !csv],
          ["2", "Map columns", Boolean(csv && !preview)],
          ["3", "Review & import", Boolean(preview)],
        ].map(([n, label, active]) => (
          <span
            key={String(n)}
            className={
              "flex items-center gap-2 " +
              (active ? "font-semibold text-primary" : "text-muted-foreground")
            }
          >
            <span
              className={
                "flex size-6 items-center justify-center rounded-full border " +
                (active ? "border-primary bg-blue-50" : "")
              }
            >
              {String(n)}
            </span>
            {String(label)}
          </span>
        ))}
      </div>
      {error && (
        <p
          role="alert"
          className="mb-5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {completed !== undefined ? (
        <Card>
          <div className="mb-5 flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <Check size={24} />
          </div>
          <h2 className="text-xl font-semibold">A little admin, done.</h2>
          <p className="mt-2 mb-6 text-sm text-muted-foreground">
            {completed} transactions imported from {filename}.
          </p>
          <div className="flex gap-3">
            <Button asChild>
              <Link to="/transactions">
                See transactions <ArrowRight size={14} />
              </Link>
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setCompleted(undefined);
                setCsv("");
                setPreview(undefined);
              }}
            >
              Import another file
            </Button>
          </div>
        </Card>
      ) : !preview ? (
        <MappingStage
          data={data}
          accountId={accountId}
          setAccount={setAccount}
          csv={csv}
          filename={filename}
          headers={headers}
          sample={sample}
          mapping={mapping}
          setMapping={setMapping}
          busy={busy}
          setError={setError}
          setPreview={setPreview}
          setPage={setPage}
          integrations={integrations}
          task={task}
          fileSelected={fileSelected}
        />
      ) : (
        <ReviewStage
          data={data}
          accountId={accountId}
          csv={csv}
          filename={filename}
          preview={preview}
          busy={busy}
          selected={selected}
          page={page}
          setPage={setPage}
          setCompleted={setCompleted}
          setPreview={setPreview}
          integrations={integrations}
          query={query}
          updateRow={updateRow}
          task={task}
        />
      )}
      {!data.accounts.length && (
        <div className="mt-5">
          <Empty
            title="Add an account first"
            description="Every import belongs to an account."
            action={
              <Button asChild>
                <Link to="/accounts">Go to accounts</Link>
              </Button>
            }
          />
        </div>
      )}
    </>
  );
}
