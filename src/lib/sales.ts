import { supabase } from "@/integrations/supabase/client";

export type SaleType = "animal" | "pregnancy" | "aspiration" | "recipient";

export interface SaleInstallmentDraft {
  installment_number: number;
  due_date: string;
  amount: number;
  payment_date?: string | null;
}

export interface SaleItemOption {
  id: string;
  code: string | null;
  name: string;
  store_id: string;
  store_name?: string | null;
  subtitle?: string | null;
}

export const SALE_TYPE_OPTIONS: Array<{ value: SaleType; label: string }> = [
  { value: "animal", label: "Animal" },
  { value: "pregnancy", label: "Prenhez" },
  { value: "aspiration", label: "Aspiração" },
  { value: "recipient", label: "Receptora" },
];

export const SALE_TYPE_LABELS: Record<SaleType, string> = {
  animal: "Animal",
  pregnancy: "Prenhez",
  aspiration: "Aspiração",
  recipient: "Receptora",
};

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const formatCurrencyBRL = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export const buildSaleItemLabel = (item?: Pick<SaleItemOption, "code" | "name"> | null) => {
  if (!item) return "";
  return item.code ? `${item.code} - ${item.name}` : item.name;
};

export const generateSaleInstallments = (
  totalAmount: number,
  numberOfInstallments: number,
  firstDueDate: string,
): SaleInstallmentDraft[] => {
  if (!firstDueDate || totalAmount <= 0 || numberOfInstallments < 1) {
    return [];
  }

  const safeInstallmentCount = Math.max(1, numberOfInstallments);
  const baseAmount = roundMoney(totalAmount / safeInstallmentCount);
  const installments: SaleInstallmentDraft[] = [];

  for (let index = 0; index < safeInstallmentCount; index += 1) {
    const dueDate = new Date(`${firstDueDate}T12:00:00`);
    dueDate.setMonth(dueDate.getMonth() + index);

    installments.push({
      installment_number: index + 1,
      due_date: dueDate.toISOString().split("T")[0],
      amount: baseAmount,
    });
  }

  const totalInstallments = installments.reduce((sum, installment) => sum + installment.amount, 0);
  const difference = roundMoney(totalAmount - totalInstallments);

  if (installments.length > 0 && difference !== 0) {
    installments[installments.length - 1].amount = roundMoney(
      installments[installments.length - 1].amount + difference,
    );
  }

  return installments;
};

export const sumInstallments = (installments: SaleInstallmentDraft[]) =>
  roundMoney(installments.reduce((sum, installment) => sum + Number(installment.amount || 0), 0));

export const fetchAccessibleStoreScope = async (): Promise<{
  storeIds: string[] | null;
  defaultStoreId: string | null;
}> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { storeIds: [], defaultStoreId: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, store_id")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") {
    return {
      storeIds: null,
      defaultStoreId: profile.store_id || null,
    };
  }

  const storeIds = new Set<string>();
  if (profile?.store_id) {
    storeIds.add(profile.store_id);
  }

  const { data: userStores } = await supabase
    .from("user_stores")
    .select("store_id")
    .eq("user_id", user.id);

  (userStores || []).forEach((row) => {
    if (row.store_id) {
      storeIds.add(row.store_id);
    }
  });

  return {
    storeIds: Array.from(storeIds),
    defaultStoreId: profile?.store_id || Array.from(storeIds)[0] || null,
  };
};

export const createSaleWithReceivable = async (input: {
  clientId: string;
  saleType: SaleType;
  itemId: string;
  productId: string;
  saleDate: string;
  issueDate: string;
  competenceDate: string;
  firstDueDate: string;
  totalAmount: number;
  documentType?: string;
  documentNumber?: string;
  description?: string;
  notes?: string;
  negotiationMethod?: string;
  installments: SaleInstallmentDraft[];
}) => {
  const { data, error } = await supabase.rpc("create_sale_with_receivable", {
    p_client_id: input.clientId,
    p_sale_type: input.saleType,
    p_item_id: input.itemId,
    p_product_id: input.productId,
    p_sale_date: input.saleDate,
    p_issue_date: input.issueDate,
    p_competence_date: input.competenceDate,
    p_first_due_date: input.firstDueDate,
    p_total_amount: input.totalAmount,
    p_document_type: input.documentType || null,
    p_document_number: input.documentNumber || null,
    p_description: input.description || null,
    p_notes: input.notes || null,
    p_negotiation_method: input.negotiationMethod || null,
    p_installments: input.installments,
  });

  if (error) {
    throw error;
  }

  return data?.[0] || null;
};
