import { useSnapshot } from "../hooks/data";
import { Categories } from "../components/categories/Categories";
import {
  Loading,
  ErrorState,
  PageHeading,
} from "../components/common/primitives";
export function CategoriesPage() {
  const query = useSnapshot();
  if (query.isPending) return <Loading />;
  if (query.error && !query.data)
    return (
      <ErrorState
        message={query.error.message}
        retry={() => void query.refetch()}
      />
    );
  return (
    <>
      <PageHeading
        eyebrow="Organise your spending"
        title="Categories & rules"
        description="Categories, subcategories and merchant rules."
      />
      <Categories data={query.data} />
    </>
  );
}
