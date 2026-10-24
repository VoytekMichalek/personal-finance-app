import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FileText, ArrowLeft, LoaderCircle } from "lucide-react";
import { api } from "../lib/api";
import { useSnapshot } from "../hooks/data";
import { useStatementUpload, useStatement } from "../hooks/statements";
import {
  Card,
  PageHeading,
  Field,
  Input,
  Loading,
  ErrorState,
} from "../components/common/primitives";
import { StatementReview } from "../components/statements/StatementReview";
import { StatementProcessing } from "../components/statements/StatementProcessing";
export function StatementImport() {
  const { id, statementId } = useParams();
  const query = useSnapshot();
  const navigate = useNavigate();
  const saved = useStatement(statementId);
  const upload = useStatementUpload();
  const [useAi, setUseAi] = useState(false);
  const integrations = useQuery({
    queryKey: ["integrations"],
    queryFn: () =>
      api<{ openrouterConfigured: boolean; modelId: string | null }>(
        "/integrations",
      ),
  });
  const [year, setYear] = useState("");
  const [error, setError] = useState("");
  if (query.isPending || (statementId && saved.isPending)) return <Loading />;
  if (query.error || saved.error)
    return (
      <ErrorState
        message={(query.error || saved.error)!.message}
        retry={() => {
          void query.refetch();
          if (statementId) void saved.refetch();
        }}
      />
    );
  const data = query.data,
    account = data.accounts.find((a) => a.id === id);
  if (!account) return <Card>Account not found.</Card>;
  const preview = saved.data;
  return (
    <>
      <Link
        to={"/accounts/" + id}
        className="mb-5 inline-flex items-center gap-2 text-xs text-muted-foreground"
      >
        <ArrowLeft size={14} />
        {account.name}
      </Link>
      <PageHeading
        eyebrow={account.name}
        title={preview ? "Review statement" : "Upload statement"}
        description=""
      />
      {preview && preview.status !== "ready" ? (
        <StatementProcessing statement={preview} />
      ) : preview ? (
        <StatementReview
          key={preview.id}
          preview={preview}
          data={data}
          account={account}
        />
      ) : (
        <Card className="mx-auto max-w-2xl">
          <div className="mb-5 inline-flex rounded-2xl bg-blue-50 p-4 text-primary">
            <FileText size={28} />
          </div>
          <h2 className="mb-2 text-xl font-semibold">Choose your PDF</h2>
          <p className="mb-6 text-sm leading-6 text-muted-foreground">
            Bank or credit card statements · up to 20 MB. Review before
            importing.
          </p>
          <details className="mb-5 text-sm">
            <summary className="cursor-pointer text-muted-foreground">
              Reading options
            </summary>
            <div className="mt-3">
              <Field label="Statement year (only if dates omit it)">
                <Input
                  type="number"
                  placeholder="Auto-detect"
                  min={1900}
                  max={2200}
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                />
              </Field>
            </div>
          </details>
          <label className="mb-5 flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={useAi}
              disabled={
                !integrations.data?.openrouterConfigured ||
                !integrations.data?.modelId
              }
              onChange={(e) => setUseAi(e.target.checked)}
            />
            <span>
              Use AI to understand this bank’s layout
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                Shares statement text with your selected OpenRouter model.
                <details>
                  <summary className="cursor-pointer">Privacy details</summary>
                  Email addresses and long numeric references are masked.
                  Merchant names and financial details are included; providers
                  must support no retention.
                </details>
                {!integrations.data?.modelId && (
                  <Link className="text-primary" to="/settings/ai">
                    Configure AI in Settings → AI.
                  </Link>
                )}
              </span>
            </span>
          </label>
          <Field label="PDF statement">
            <Input
              type="file"
              accept="application/pdf,.pdf"
              disabled={upload.isPending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 20 * 1024 * 1024) {
                  setError("Choose a PDF up to 20 MB.");
                  return;
                }
                setError("");
                upload.mutate(
                  { accountId: account.id, file, year, useAi },
                  {
                    onSuccess: (result) =>
                      navigate(
                        "/accounts/" + account.id + "/statement/" + result.id,
                        { replace: true },
                      ),
                  },
                );
              }}
            />
          </Field>
          {upload.isPending && (
            <p
              role="status"
              className="mt-5 flex items-center gap-2 text-sm text-primary"
            >
              <LoaderCircle className="animate-spin" size={16} />
              Uploading your PDF… Processing will continue in the background
              once it is saved.
            </p>
          )}
          {(error || upload.error) && (
            <p role="alert" className="mt-5 text-sm text-destructive">
              {error || upload.error?.message}
            </p>
          )}
          <p className="mt-6 text-xs leading-5 text-muted-foreground">
            Prefer a spreadsheet?{" "}
            <Link className="text-primary" to="/imports">
              import a CSV
            </Link>
            .
          </p>
        </Card>
      )}
    </>
  );
}
