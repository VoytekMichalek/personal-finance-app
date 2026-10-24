import { useState } from "react";
import type { Account, Person } from "@finance/shared";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { AccountForm } from "./AccountForm";
export function EditAccountButton({
  account,
  people,
}: {
  account: Account;
  people: Person[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Fix {account.name} opening balance
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title={"Edit " + account.name}>
        <AccountForm
          account={account}
          people={people}
          done={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}
