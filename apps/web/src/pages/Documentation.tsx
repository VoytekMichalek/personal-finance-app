import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  Card,
  PageHeading,
  Loading,
  ErrorState,
} from "../components/common/primitives";
export function Documentation() {
  const query = useQuery({
    queryKey: ["documentation"],
    queryFn: () => api<{ content: string }>("/documentation"),
  });
  return (
    <>
      <PageHeading
        eyebrow="A little guidance"
        title="Feel right at home."
        description="Simple guides for your everyday financial routines."
      />
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState
          message={query.error.message}
          retry={() => void query.refetch()}
        />
      ) : (
        <Card className="max-w-4xl">
          {query.data.content.split("\n").map((line, index) =>
            line.startsWith("# ") ? (
              <h2 key={index} className="mb-6 text-2xl font-semibold">
                {line.slice(2)}
              </h2>
            ) : line.startsWith("## ") ? (
              <h3
                id={"guide-" + index}
                key={index}
                className="mt-8 mb-3 text-lg font-semibold tracking-tight"
              >
                {line.slice(3)}
              </h3>
            ) : line.startsWith("- ") ? (
              <p
                key={index}
                className="mb-2 pl-3 text-sm leading-7 text-muted-foreground"
              >
                • {line.slice(2)}
              </p>
            ) : line.trim() ? (
              <p
                key={index}
                className="mb-3 text-sm leading-7 text-muted-foreground"
              >
                {line}
              </p>
            ) : null,
          )}
        </Card>
      )}
    </>
  );
}
