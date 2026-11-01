import { FileLink } from "../common/FileLink";
import { Link } from "react-router-dom";
import type { Snapshot } from "@finance/shared";
import { Card } from "../common/primitives";
import { Button } from "../ui/button";
import { SavedRecurring } from "./SavedRecurring";
export function StatementImported({
  id,
  accountId,
  imported,
  data,
}: {
  id: string;
  accountId: string;
  imported?: number;
  data: Snapshot;
}) {
  return (
    <>
      <Card>
        <h2 className="text-xl font-semibold">Statement imported</h2>
        <p className="my-4 text-sm text-muted-foreground">
          {imported === undefined
            ? ""
            : `${imported} statement rows processed. `}
          Your account activity and accepted recurring items are ready.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Button asChild>
            <Link to={"/accounts/" + accountId}>View account</Link>
          </Button>
          <FileLink
            path={"/statements/" + id + "/file"}
            filename={"Statement.pdf"}
          >
            Download original PDF
          </FileLink>
        </div>
      </Card>
      <SavedRecurring id={id} accountId={accountId} data={data} />
    </>
  );
}
