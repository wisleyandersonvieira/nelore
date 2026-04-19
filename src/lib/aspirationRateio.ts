import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface AspirationRateioSummary {
  divisor: number;
  expenseTotal: number;
  expensePaid: number;
  revenueTotal: number;
  revenuePaid: number;
}

const sumAllocationTotals = async (
  table: "accounts_payable_item_allocations" | "accounts_receivable_item_allocations",
  paymentTable: "accounts_payable_payments" | "accounts_receivable_payments",
  idField: "account_payable_id" | "account_receivable_id",
  statusField: "accounts_payable" | "accounts_receivable",
  aspirationId: string,
) => {
  const relation = table === "accounts_payable_item_allocations"
    ? `
      id, allocation_type, account_payable_item_id,
      accounts_payable_items!inner (
        total_price, account_payable_id,
        accounts_payable!inner (
          id, status
        )
      )
    `
    : `
      id, allocation_type, account_receivable_item_id,
      accounts_receivable_items!inner (
        total_price, account_receivable_id,
        accounts_receivable!inner (
          id, status
        )
      )
    `;

  const { data } = await supabase
    .from(table)
    .select(relation)
    .eq("aspiration_id", aspirationId);

  let total = 0;
  let paid = 0;

  const grouped = new Map<string, { totalItemPrice: number; status: string }>();
  (data || []).forEach((allocation: any) => {
    const item = table === "accounts_payable_item_allocations"
      ? allocation.accounts_payable_items
      : allocation.accounts_receivable_items;
    const parent = item?.[statusField];
    const parentId = item?.[idField];
    const itemPrice = Number(item?.total_price || 0);

    total += itemPrice;

    if (parentId) {
      const existing = grouped.get(parentId);
      if (existing) {
        existing.totalItemPrice += itemPrice;
      } else {
        grouped.set(parentId, {
          totalItemPrice: itemPrice,
          status: parent?.status || "",
        });
      }
    }
  });

  const ids = Array.from(grouped.keys());
  if (ids.length > 0) {
    const today = format(new Date(), "yyyy-MM-dd");
    const { data: payments } = await supabase
      .from(paymentTable)
      .select(`${idField}, amount_paid`)
      .in(idField, ids)
      .lte("payment_date", today);

    const paymentsMap = new Map<string, number>();
    (payments || []).forEach((payment: any) => {
      paymentsMap.set(
        payment[idField],
        (paymentsMap.get(payment[idField]) || 0) + Number(payment.amount_paid || 0),
      );
    });

    grouped.forEach((info, parentId) => {
      const paymentSum = paymentsMap.get(parentId) || 0;
      if (paymentSum > 0) {
        paid += paymentSum;
      } else if (info.status === "paid") {
        paid += info.totalItemPrice;
      }
    });
  }

  return { total, paid };
};

export const fetchAspirationRateioSummary = async ({
  aspirationId,
  embryoTransferId,
}: {
  aspirationId: string;
  embryoTransferId?: string | null;
}): Promise<AspirationRateioSummary> => {
  const { data: aspirationData } = await supabase
    .from("aspiration_management")
    .select("is_batch_purchase, batch_quantity, embryo_count")
    .eq("id", aspirationId)
    .single();

  const [expenseSummary, revenueSummary] = await Promise.all([
    sumAllocationTotals(
      "accounts_payable_item_allocations",
      "accounts_payable_payments",
      "account_payable_id",
      "accounts_payable",
      aspirationId,
    ),
    sumAllocationTotals(
      "accounts_receivable_item_allocations",
      "accounts_receivable_payments",
      "account_receivable_id",
      "accounts_receivable",
      aspirationId,
    ),
  ]);

  const isBatchPurchase = Boolean((aspirationData as any)?.is_batch_purchase);
  const batchQuantity = Math.max(Number((aspirationData as any)?.batch_quantity || 0), 1);

  if (isBatchPurchase && embryoTransferId) {
    const { data: embryoTransfer } = await supabase
      .from("embryo_transfer_management")
      .select("batch_utilization_id")
      .eq("id", embryoTransferId)
      .single();

    const batchUtilizationId = (embryoTransfer as any)?.batch_utilization_id as string | null;
    if (batchUtilizationId) {
      const [{ data: utilization }, { count }] = await Promise.all([
        supabase
          .from("aspiration_batch_utilizations" as any)
          .select("quantity_used")
          .eq("id", batchUtilizationId)
          .single(),
        supabase
          .from("embryo_transfer_management")
          .select("id", { count: "exact", head: true })
          .eq("batch_utilization_id", batchUtilizationId),
      ]);

      const quantityUsed = Number((utilization as any)?.quantity_used || 0);
      const divisor = Math.max(Number(count || 0), 1);
      const factor = quantityUsed > 0 ? quantityUsed / batchQuantity : 0;

      return {
        divisor,
        expenseTotal: expenseSummary.total * factor,
        expensePaid: expenseSummary.paid * factor,
        revenueTotal: revenueSummary.total * factor,
        revenuePaid: revenueSummary.paid * factor,
      };
    }
  }

  const totalEmbryoCount = Math.max(Number((aspirationData as any)?.embryo_count || 0), 1);
  const { count: emptyCount } = await supabase
    .from("embryo_transfer_management")
    .select("id", { count: "exact", head: true })
    .eq("aspiration_id", aspirationId)
    .eq("status", "finalized_empty");

  const divisor = Math.max(totalEmbryoCount - Number(emptyCount || 0), 1);

  return {
    divisor,
    expenseTotal: expenseSummary.total,
    expensePaid: expenseSummary.paid,
    revenueTotal: revenueSummary.total,
    revenuePaid: revenueSummary.paid,
  };
};
