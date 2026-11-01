import { FileLink } from "../common/FileLink";
import { hasStatementDateError, type ImportRow } from "@finance/shared";
import { StatementReadAgain } from "./StatementReadAgain";
export function StatementRowIssue({
  row,
  id,
  busy,
}: {
  row: ImportRow;
  id: string;
  busy: boolean;
}) {
  if (!row.error || hasStatementDateError(row)) return null;
  return (
    <div className="space-y-2 text-xs">
      <p>
        This row is excluded. Check its printed values, then read the PDF again
        with corrected reading options. You can continue importing the other
        valid rows.
      </p>
      <FileLink path={"/statements/" + id + "/file"} filename={"Statement.pdf"}>
        Check source PDF
      </FileLink>
      <StatementReadAgain id={id} disabled={busy} />
    </div>
  );
}
