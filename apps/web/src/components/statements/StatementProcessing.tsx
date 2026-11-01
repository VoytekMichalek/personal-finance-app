import { FileLink } from "../common/FileLink";
import { Link } from "react-router-dom";
import { useState } from "react";
import { ReadingOptions } from "./ReadingOptions";
import { ActionError } from "../common/ActionError";
import type { StatementReadingOptions } from "../../hooks/statements";
import { LoaderCircle, AlertCircle } from "lucide-react";
import {
  statementStatusLabel,
  type StatementProcessing as Processing,
} from "@finance/shared";
import { useStatementRetry } from "../../hooks/statements";
import { Button } from "../ui/button";
import { Card } from "../common/primitives";
export function StatementProcessing({ statement }: { statement: Processing }) {
  const retry = useStatementRetry();
  const failed = statement.status === "failed";
  const [options, setOptions] = useState<StatementReadingOptions>({});
  return (
    <Card className="mx-auto max-w-2xl">
      <div role="status" className="mb-4 flex items-center gap-3 text-primary">
        {failed ? (
          <AlertCircle size={24} />
        ) : (
          <LoaderCircle
            className="animate-spin motion-reduce:animate-none"
            size={24}
          />
        )}
        <h2 className="text-xl font-semibold">
          {statementStatusLabel(statement)}
        </h2>
      </div>
      <p className="mb-3 break-all text-sm font-medium">{statement.filename}</p>
      <p className="mb-6 text-sm leading-6 text-muted-foreground">
        {failed
          ? statement.error
          : "Your statement is saved. You can leave this page or close the app while we process it. Find the result in this account’s Statements tab when you return."}
      </p>
      {failed && (
        <ReadingOptions
          value={options}
          onChange={setOptions}
          disabled={retry.isPending}
        />
      )}
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link to={"/accounts/" + statement.accountId + "?tab=statements"}>
            Back to account
          </Link>
        </Button>
        {failed && (
          <Button
            variant="secondary"
            disabled={retry.isPending}
            onClick={() => retry.mutate({ id: statement.id, ...options })}
          >
            {retry.isPending ? "Restarting…" : "Try again"}
          </Button>
        )}
        <FileLink
          path={"/statements/" + statement.id + "/file"}
          filename={statement.filename}
        >
          Download PDF
        </FileLink>
      </div>
      <ActionError error={retry.error} />
      <p className="mt-6 text-xs text-muted-foreground">
        Nothing is added to your finances until you review and accept the
        results.
      </p>
    </Card>
  );
}
