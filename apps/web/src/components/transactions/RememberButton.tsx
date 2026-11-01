import { BookmarkCheck, BookmarkPlus } from "lucide-react";
import { useIsMutating } from "@tanstack/react-query";
import type { Transaction } from "@finance/shared";
import { Button } from "../ui/button";

export function RememberButton({
  row,
  disabled,
  matchesRule = false,
  onClick,
}: {
  row: Transaction;
  disabled?: boolean;
  matchesRule?: boolean;
  onClick: () => void;
}) {
  const saving = useIsMutating({ mutationKey: ["transaction", row.id] }) > 0;
  const Icon = matchesRule ? BookmarkCheck : BookmarkPlus;
  return (
    <Button
      variant="ghost"
      size="sm"
      className={`max-w-full gap-1 px-2 ${matchesRule ? "h-auto min-h-11 w-28 py-1.5 text-xs whitespace-normal sm:w-40 text-emerald-700 hover:bg-emerald-100 md:min-h-9" : "text-primary"}`}
      disabled={disabled || saving}
      aria-label={`${matchesRule ? "Matches saved rule for" : "Remember"} ${row.description}`}
      title={matchesRule ? "Review matching transactions" : undefined}
      onClick={onClick}
    >
      <Icon size={14} className="shrink-0" aria-hidden="true" />
      <span>{matchesRule ? "Matches saved rule" : "Remember"}</span>
    </Button>
  );
}
