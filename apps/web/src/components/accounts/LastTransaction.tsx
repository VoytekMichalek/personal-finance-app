import { displayDate } from "@finance/shared";

export function LastTransaction({ date }: { date?: string }) {
  return (
    <p className="mt-2 text-xs text-muted-foreground">
      {date ? (
        <>
          Last recorded transaction:{" "}
          <time dateTime={date}>{displayDate(date)}</time>
        </>
      ) : (
        "No transactions recorded"
      )}
    </p>
  );
}
