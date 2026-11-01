import { FileLink } from "../common/FileLink";
import type { ImportRow, StatementPreview } from "@finance/shared";
import { Card } from "../common/primitives";
import { StatementReadAgain } from "./StatementReadAgain";

export function StatementFileHeader({
  preview,
  rows,
  busy,
}: {
  preview: StatementPreview;
  rows: ImportRow[];
  busy: boolean;
}) {
  return (
    <Card className="mb-5">
      <div className="flex flex-wrap justify-between gap-3">
        <span>
          <strong className="break-all text-sm">{preview.filename}</strong>
          <span className="mt-1 block text-xs text-muted-foreground">
            {preview.pages} pages read · {rows.length} transaction lines ·{" "}
            {
              rows.filter((row) => row.duplicate && !row.reconcileExisting)
                .length
            }{" "}
            possible duplicates
          </span>
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <FileLink
            path={"/statements/" + preview.id + "/file"}
            filename={preview.filename}
          >
            Download source PDF
          </FileLink>
          <StatementReadAgain id={preview.id} disabled={busy} />
        </div>
      </div>
    </Card>
  );
}
