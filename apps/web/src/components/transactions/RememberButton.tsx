import { BookmarkPlus } from "lucide-react";
import { useIsMutating } from "@tanstack/react-query";
import type { Transaction } from "@finance/shared";
import { Button } from "../ui/button";

export function RememberButton({
  row,
  disabled,
  onClick,
}: {
  row: Transaction;
  disabled?: boolean;
  onClick: () => void;
}) {
  const saving = useIsMutating({ mutationKey: ["transaction", row.id] }) > 0;
  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1 px-2 text-primary"
      disabled={disabled || saving}
      aria-label={`Remember ${row.description}`}
      onClick={onClick}
    >
      <BookmarkPlus size={14} aria-hidden="true" />
      Remember
    </Button>
  );
}
