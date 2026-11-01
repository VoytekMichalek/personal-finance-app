import {
  filterTransactions,
  type Snapshot,
  type Transaction,
} from "@finance/shared";
import { useTransactionFilters } from "../../hooks/transaction-filters";
import { TransactionFilters } from "./TransactionFilters";
import { TransactionTable } from "./TransactionTable";

export function TransactionBrowser({
  data,
  accountId,
  onOpen,
}: {
  data: Snapshot;
  accountId?: string;
  onOpen: (row: Transaction) => void;
}) {
  const { filters, update } = useTransactionFilters(accountId);
  const rows = filterTransactions(data.transactions, filters);
  return (
    <>
      <TransactionFilters
        data={data}
        filters={filters}
        update={update}
        accountId={accountId}
      />
      <TransactionTable
        key={JSON.stringify(filters)}
        data={data}
        rows={rows}
        filters={filters}
        onOpen={onOpen}
      />
    </>
  );
}
