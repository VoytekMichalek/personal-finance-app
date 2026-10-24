import { SelectItem } from "../ui/select";
import { useRef } from "react";
import {
  mappingSchema,
  type ImportPreview,
  type Mapping,
  type Snapshot,
} from "@finance/shared";
import { ArrowRight, Sparkles, Upload } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { api, send } from "../../lib/api";
import { Card, Field, SectionTitle, Select } from "../common/primitives";
import { Button } from "../ui/button";
type Suggestion = {
  mapping?: Mapping;
  categories: { rowNumber: number; categoryId: string | null }[];
};
type Props = {
  data: Snapshot;
  accountId: string;
  setAccount: (v: string) => void;
  csv: string;
  filename: string;
  headers: string[];
  sample: Record<string, string>[];
  mapping: Mapping;
  setMapping: (v: Mapping) => void;
  busy: string;
  setError: (v: string) => void;
  setPreview: Dispatch<SetStateAction<ImportPreview | undefined>>;
  setPage: Dispatch<SetStateAction<number>>;
  integrations: {
    data?: { openrouterConfigured: boolean; modelId: string | null };
  };
  task: (label: string, operation: () => Promise<void>) => Promise<void>;
  fileSelected: (file: File) => Promise<void>;
};
export function MappingStage({
  data,
  accountId,
  setAccount,
  csv,
  filename,
  headers,
  sample,
  mapping,
  setMapping,
  busy,
  setError,
  setPreview,
  setPage,
  integrations,
  task,
  fileSelected,
}: Props) {
  const chosen = useRef(new Set<keyof Mapping>());
  return (
    <Card>
      <SectionTitle>Choose an account and statement</SectionTitle>
      <div className="mb-6 max-w-md">
        <Field label="Import into">
          <Select
            disabled={Boolean(busy)}
            value={accountId}
            onValueChange={async (value) => {
              const id = value;
              setAccount(id);
              if (id) {
                try {
                  const saved = await api<Mapping | null>(
                    "/imports/mapping/" + id,
                  );
                  if (saved) setMapping(saved);
                } catch (e) {
                  setError((e as Error).message);
                }
              }
            }}
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
      <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-[#fafbfc] px-4 text-center">
        <Upload size={25} className="text-primary" />
        <span className="text-sm font-medium">
          {filename || "Choose a bank CSV"}
        </span>
        <span className="text-xs text-muted-foreground">
          Up to 5 MB · 10,000 rows · nothing is saved until you confirm
        </span>
        <input
          type="file"
          aria-label="Choose bank CSV"
          className="sr-only"
          accept=".csv,text/csv"
          disabled={Boolean(busy)}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void fileSelected(file);
            e.target.value = "";
          }}
        />
      </label>
      {csv && (
        <>
          <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
            <SectionTitle>Match your columns</SectionTitle>
            <Button
              variant="secondary"
              disabled={
                Boolean(busy) ||
                !integrations.data?.openrouterConfigured ||
                !integrations.data?.modelId
              }
              onClick={() =>
                void task("Suggesting mappings…", async () => {
                  const suggestion = await send<Suggestion>(
                    "/imports/suggest",
                    { csv },
                  );
                  if (suggestion.mapping) {
                    const next = { ...suggestion.mapping };
                    const preserved = Object.fromEntries(
                      [...chosen.current].map((key) => [key, mapping[key]]),
                    );
                    Object.assign(next, preserved);
                    setMapping(next);
                  }
                })
              }
            >
              <Sparkles size={15} />
              Suggest with AI
            </Button>
          </div>
          <p className="mb-5 text-xs leading-5 text-muted-foreground">
            AI sends redacted sample rows to OpenRouter. Suggestions are
            optional and require your review. Configure a model in Settings →
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
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <Select
                  disabled={Boolean(busy)}
                  value={mapping[key]}
                  onValueChange={(value) => {
                    chosen.current.add(key);
                    setMapping({ ...mapping, [key]: value });
                  }}
                >
                  <SelectItem value="">Choose column</SelectItem>
                  {headers.map((header) => (
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
                onValueChange={(value) => {
                  chosen.current.add("dateFormat");
                  setMapping({
                    ...mapping,
                    dateFormat: value as Mapping["dateFormat"],
                  });
                }}
              >
                <SelectItem value="DMY">Day / month / year</SelectItem>
                <SelectItem value="MDY">Month / day / year</SelectItem>
                <SelectItem value="ISO">Year-month-day (ISO)</SelectItem>
              </Select>
            </Field>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Use a signed amount column, or both debit and credit columns. Review
            the sign and date format carefully.
          </p>
          <div className="mt-6 overflow-auto rounded-xl border">
            <table className="w-full text-left text-[10px]">
              <thead className="border-b bg-muted">
                <tr>
                  {headers.map((h) => (
                    <th key={h} className="p-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sample.map((row, i) => (
                  <tr key={i} className="border-b">
                    {headers.map((h) => (
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
            onClick={() =>
              void task("Preparing preview…", async () => {
                const checked = mappingSchema.parse(mapping);
                const result = await send<ImportPreview>("/imports/preview", {
                  accountId,
                  csv,
                  mapping: checked,
                });
                setPreview(result);
                setPage(0);
              })
            }
          >
            {busy || "Review transactions"}
            <ArrowRight size={14} />
          </Button>
        </>
      )}
    </Card>
  );
}
