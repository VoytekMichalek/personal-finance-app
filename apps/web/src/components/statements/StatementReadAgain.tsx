import { useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  useStatementReread,
  type StatementReadingOptions,
} from "../../hooks/statements";
import { ReadingOptions } from "./ReadingOptions";
import { ActionError } from "../common/ActionError";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";

export function StatementReadAgain({
  id,
  disabled,
}: {
  id: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const reread = useStatementReread();
  const [options, setOptions] = useState<StatementReadingOptions>({});
  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        disabled={disabled || reread.isPending}
        onClick={() => {
          reread.reset();
          setOpen(true);
        }}
      >
        <RefreshCw size={14} aria-hidden="true" />
        Read again
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!reread.isPending) setOpen(next);
        }}
        title="Read this statement again?"
        description="We'll read the saved source PDF again and replace this review."
      >
        <div className="space-y-3 text-sm">
          <p>
            Your review edits and selections will be discarded. Saved
            transactions and account balances stay as they are.
          </p>
          <p className="text-muted-foreground">
            The original reading options, including AI if selected, will be
            reused unless you change them below. Review the new results before
            importing.
          </p>
        </div>
        <ReadingOptions
          value={options}
          onChange={setOptions}
          disabled={reread.isPending}
        />
        <ActionError error={reread.error} />
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button
            variant="secondary"
            disabled={reread.isPending}
            onClick={() => setOpen(false)}
          >
            Keep current review
          </Button>
          <Button
            disabled={reread.isPending}
            onClick={() => reread.mutate({ id, ...options })}
          >
            {reread.isPending
              ? "Restarting reading…"
              : "Discard review & read again"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
