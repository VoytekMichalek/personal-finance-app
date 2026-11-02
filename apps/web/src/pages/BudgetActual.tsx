import { Loading, ErrorState } from "../components/common/primitives";
import { BudgetReport } from "../components/planning/BudgetReport";
import { useSnapshot } from "../hooks/data";

export function BudgetActual() {
  const query = useSnapshot();
  if (query.isPending) return <Loading />;
  if (query.error && !query.data)
    return (
      <ErrorState
        message={query.error.message}
        retry={() => void query.refetch()}
      />
    );
  return <BudgetReport data={query.data} />;
}
