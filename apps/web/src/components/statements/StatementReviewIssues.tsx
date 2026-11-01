import { Button } from "../ui/button";

export function StatementReviewIssues({
  dateProblem,
  transferProblems,
  recurringProblems,
  openingError,
  goTo,
}: {
  dateProblem: boolean;
  transferProblems: boolean;
  recurringProblems: boolean;
  openingError: string;
  goTo: (step: number) => void;
}) {
  const issues = [
    ...(dateProblem || openingError
      ? [
          {
            message:
              openingError ||
              "The opening date is later than a selected transaction.",
            step: 0,
            label: "Fix opening balance",
          },
        ]
      : []),
    ...(transferProblems
      ? [
          {
            message:
              "Choose the other account for each transfer and check its opening date.",
            step: 1,
            label: "Fix transfers",
          },
        ]
      : []),
    ...(recurringProblems
      ? [
          {
            message:
              "Complete the type, amount and accounts for each accepted recurring item.",
            step: 2,
            label: "Fix recurring items",
          },
        ]
      : []),
  ];
  return (
    <div className="mb-4 space-y-3">
      {issues.map((issue) => (
        <div key={issue.step} className="space-y-2 rounded-xl bg-amber-50 p-3">
          <p role="alert" className="text-sm text-destructive">
            {issue.message}
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => goTo(issue.step)}
          >
            {issue.label}
          </Button>
        </div>
      ))}
    </div>
  );
}
