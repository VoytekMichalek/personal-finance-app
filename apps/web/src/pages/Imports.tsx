import { AccountBanner } from "../components/accounts/AccountIdentity";
import { ImportProgress } from "../components/imports/ImportProgress";
import { ActionError } from "../components/common/ActionError";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { isCashAccount, latestTransactionDates } from "@finance/shared";
import { LastTransaction } from "../components/accounts/LastTransaction";
import { Link, useSearchParams } from "react-router-dom";
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
import { useCsvImport } from "../hooks/csv-import";

export function Imports() {
  const query = useSnapshot();
  const [search] = useSearchParams();
  const flow = useCsvImport(search.get("account") ?? "", query.data);
  if (query.isPending) return <Loading />;
  if (query.error && !query.data)
    return (
      <ErrorState
        message={query.error.message}
        retry={() => void query.refetch()}
      />
    );
  const data = query.data;
  const account = data.accounts.find((a) => a.id === flow.accountId);
  const back = account ? "/accounts/" + account.id : "/accounts";
  return (
    <>
      <Link
        to={back}
        className="mb-6 inline-flex items-center gap-2 text-xs text-muted-foreground"
      >
        <ArrowLeft size={14} />
        {account ? "Back to " + account.name : "All accounts"}
      </Link>
      <PageHeading
        eyebrow="Less typing. More living."
        title="Import bank CSV"
        description="Upload your export, match the columns and approve the transactions."
      />
      {account && (
        <AccountBanner account={account} institutions={data.institutions}>
          <LastTransaction
            date={latestTransactionDates(data.transactions).get(account.id)}
          />
        </AccountBanner>
      )}
      <ImportProgress
        label="CSV import progress"
        steps={["Upload CSV", "Map columns", "Review & approve"]}
        current={
          flow.completed !== undefined
            ? 4
            : flow.preview
              ? 3
              : flow.columns
                ? 2
                : 1
        }
      />
      <ActionError error={flow.conflictError} />
      {flow.busy && (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          {flow.busy}
        </p>
      )}
      {flow.completed !== undefined ? (
        <Card>
          <div className="mb-5 flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <Check size={24} />
          </div>
          <h2 className="text-xl font-semibold">Import complete</h2>
          <p className="mt-2 mb-6 break-all text-sm text-muted-foreground">
            {flow.completed} statement rows processed from {flow.filename}.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to={back}>
                View account <ArrowRight size={14} />
              </Link>
            </Button>
            <Button
              variant="secondary"
              disabled={Boolean(flow.busy)}
              onClick={flow.reset}
            >
              Import another file
            </Button>
          </div>
        </Card>
      ) : !data.accounts.some((a) => !a.archived && isCashAccount(a)) ? (
        <Empty
          title="Add an account first"
          description="Every CSV import belongs to an active account."
          action={
            <Button asChild>
              <Link to="/accounts">Go to accounts</Link>
            </Button>
          }
        />
      ) : flow.preview ? (
        <ReviewStage data={data} flow={flow} preview={flow.preview} />
      ) : (
        <MappingStage data={data} flow={flow} />
      )}
    </>
  );
}
