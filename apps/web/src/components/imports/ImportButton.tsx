import { useState } from "react";
import { Link } from "react-router-dom";
import { FileSpreadsheet, FileText, Upload } from "lucide-react";
import { isCashAccount, type Snapshot } from "@finance/shared";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Field, Select } from "../common/primitives";
import { SelectItem } from "../ui/select";

export function ImportButton({
  data,
  accountId,
}: {
  data: Snapshot;
  accountId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState(accountId ?? "");
  const accounts = data.accounts.filter((a) => !a.archived && isCashAccount(a));
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Upload size={15} />
        Import transactions
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Import transactions"
        description="Choose your account and the file you have."
      >
        {!accountId && (
          <Field label="Import account">
            <Select value={chosen} onValueChange={setChosen}>
              <SelectItem value="">Choose account</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </Select>
          </Field>
        )}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Button disabled={!chosen} asChild={!!chosen} variant="secondary">
            {chosen ? (
              <Link to={`/accounts/${chosen}/statement`}>
                <FileText size={17} />
                PDF statement
              </Link>
            ) : (
              <span>PDF statement</span>
            )}
          </Button>
          <Button disabled={!chosen} asChild={!!chosen} variant="secondary">
            {chosen ? (
              <Link to={`/imports?account=${chosen}`}>
                <FileSpreadsheet size={17} />
                CSV export
              </Link>
            ) : (
              <span>CSV export</span>
            )}
          </Button>
        </div>
        {!accounts.length && (
          <p className="mt-4 text-sm">
            Add an account first.{" "}
            <Link className="text-primary underline" to="/accounts">
              Go to accounts
            </Link>
          </p>
        )}
      </Dialog>
    </>
  );
}
