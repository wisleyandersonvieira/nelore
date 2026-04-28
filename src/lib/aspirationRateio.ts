import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface AspirationRateioSummary {
  divisor: number;
  expenseTotal: number;
  expensePaid: number;
  revenueTotal: number;
  revenuePaid: number;
}

interface SemenConsumptionSummary {
  total: number;
  paid: number;
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

const fetchSemenConsumptionSummary = async (aspirationId: string): Promise<SemenConsumptionSummary> => {
  const { data: utilizations } = await supabase
    .from("semen_utilizations" as any)
    .select("semen_id, quantity_used")
    .eq("aspiration_id", aspirationId);

  const groupedUtilization = (utilizations || []).reduce<Record<string, number>>((acc, row: any) => {
    const semenId = row.semen_id as string | null;
    if (!semenId) {
      return acc;
    }

    acc[semenId] = (acc[semenId] || 0) + Number(row.quantity_used || 0);
    return acc;
  }, {});

  const semenIds = Object.keys(groupedUtilization);
  if (semenIds.length === 0) {
    return { total: 0, paid: 0 };
  }

  const [semenRes, allocationRes] = await Promise.all([
    supabase
      .from("semen" as any)
      .select("id, quantity_initial")
      .in("id", semenIds),
    supabase
      .from("accounts_payable_item_allocations")
      .select(`
        id,
        account_payable_item_id,
        semen_id,
        accounts_payable_items!inner (
          total_price,
          account_payable_id,
          accounts_payable!inner (
            id,
            status
          )
        )
      `)
      .in("semen_id", semenIds),
  ]);

  const semenMap = new Map<string, number>(
    ((semenRes.data || []) as Array<{ id: string; quantity_initial: number | string | null }>).map((item) => [
      item.id,
      Number(item.quantity_initial || 0),
    ]),
  );

  const groupedAllocations = new Map<string, { total: number; payableIds: Set<string>; paidFallback: number }>();
  ((allocationRes.data || []) as any[]).forEach((allocation) => {
    const semenId = allocation.semen_id as string | null;
    if (!semenId) {
      return;
    }

    const item = allocation.accounts_payable_items;
    const payable = item?.accounts_payable;
    const payableId = payable?.id as string | undefined;
    const current = groupedAllocations.get(semenId) || { total: 0, payableIds: new Set<string>(), paidFallback: 0 };
    const itemPrice = Number(item?.total_price || 0);

    current.total += itemPrice;
    if (payableId) {
      current.payableIds.add(payableId);
    }
    if (payable?.status === "paid") {
      current.paidFallback += itemPrice;
    }

    groupedAllocations.set(semenId, current);
  });

  const payableIds = Array.from(
    new Set(
      Array.from(groupedAllocations.values()).flatMap((entry) => Array.from(entry.payableIds)),
    ),
  );

  const paidAmountsMap = new Map<string, number>();
  if (payableIds.length > 0) {
    const today = format(new Date(), "yyyy-MM-dd");
    const { data: payments } = await supabase
      .from("accounts_payable_payments")
      .select("account_payable_id, amount_paid")
      .in("account_payable_id", payableIds)
      .lte("payment_date", today);

    (payments || []).forEach((payment: any) => {
      paidAmountsMap.set(
        payment.account_payable_id,
        (paidAmountsMap.get(payment.account_payable_id) || 0) + Number(payment.amount_paid || 0),
      );
    });
  }

  let total = 0;
  let paid = 0;

  semenIds.forEach((semenId) => {
    const quantityInitial = semenMap.get(semenId) || 0;
    const quantityUsed = Number(groupedUtilization[semenId] || 0);

    if (quantityInitial <= 0 || quantityUsed <= 0) {
      return;
    }

    const allocationInfo = groupedAllocations.get(semenId);
    if (!allocationInfo || allocationInfo.total <= 0) {
      return;
    }

    const factor = quantityUsed / quantityInitial;
    const totalCost = allocationInfo.total * factor;

    let totalPaidForSemen = 0;
    if (allocationInfo.payableIds.size > 0) {
      allocationInfo.payableIds.forEach((payableId) => {
        totalPaidForSemen += paidAmountsMap.get(payableId) || 0;
      });
    } else {
      totalPaidForSemen = allocationInfo.paidFallback;
    }

    total += totalCost;
    paid += Math.min(totalPaidForSemen, allocationInfo.total) * factor;
  });

  return { total, paid };
};

export const fetchAspirationRateioSummary = async ({
  aspirationId,
  embryoTransferId,
  reallocateEmptyBatchSiblings = false,
}: {
  aspirationId: string;
  embryoTransferId?: string | null;
  reallocateEmptyBatchSiblings?: boolean;
}): Promise<AspirationRateioSummary> => {
  const { data: aspirationData } = await supabase
    .from("aspiration_management")
    .select("is_batch_purchase, batch_quantity, embryo_count")
    .eq("id", aspirationId)
    .single();

  const [expenseSummary, revenueSummary, semenExpenseSummary] = await Promise.all([
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
    fetchSemenConsumptionSummary(aspirationId),
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
      const [{ data: utilization }, { count: totalCount }, { count: activeCount }] = await Promise.all([
        supabase
          .from("aspiration_batch_utilizations" as any)
          .select("quantity_used")
          .eq("id", batchUtilizationId)
          .single(),
        supabase
          .from("embryo_transfer_management")
          .select("id", { count: "exact", head: true })
          .eq("batch_utilization_id", batchUtilizationId),
        supabase
          .from("embryo_transfer_management")
          .select("id", { count: "exact", head: true })
          .eq("batch_utilization_id", batchUtilizationId)
          .neq("status", "finalized_empty"),
      ]);

      const quantityUsed = Number((utilization as any)?.quantity_used || 0);
      const divisor = Math.max(
        Number(reallocateEmptyBatchSiblings ? activeCount || totalCount || 0 : totalCount || 0),
        1,
      );
      const factor = quantityUsed > 0 ? quantityUsed / batchQuantity : 0;

      return {
        divisor,
        expenseTotal: (expenseSummary.total + semenExpenseSummary.total) * factor,
        expensePaid: (expenseSummary.paid + semenExpenseSummary.paid) * factor,
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
    expenseTotal: expenseSummary.total + semenExpenseSummary.total,
    expensePaid: expenseSummary.paid + semenExpenseSummary.paid,
    revenueTotal: revenueSummary.total,
    revenuePaid: revenueSummary.paid,
  };
};
