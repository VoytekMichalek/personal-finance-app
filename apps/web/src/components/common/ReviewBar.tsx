import type { ReactNode } from "react";
export function ReviewBar({
  children,
  summary,
}: {
  children: ReactNode;
  summary: string;
}) {
  return (
    <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white/95 p-3 shadow-sm backdrop-blur-sm lg:bottom-3">
      <p className="text-xs text-muted-foreground">{summary}</p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
