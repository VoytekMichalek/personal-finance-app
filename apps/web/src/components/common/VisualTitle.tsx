import type { ReactNode } from "react";
import { ContextTip } from "./ContextTip";
export function VisualTitle({
  title,
  context,
  action,
}: {
  title: string;
  context?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex min-h-9 flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <div className="flex min-w-0 items-center gap-1">
        <h2 className="font-semibold">{title}</h2>
        {context && <ContextTip label={title}>{context}</ContextTip>}
      </div>
      {action}
    </div>
  );
}
