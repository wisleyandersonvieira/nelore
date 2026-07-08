import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { SaleInstallmentDraft } from "@/lib/sales";

export type PurchaseType = "animal" | "pregnancy" | "aspiration" | "recipient" | "semen";
export type PurchaseInstallmentDraft = SaleInstallmentDraft;
export type PurchaseOriginType = "manual" | "migrated_from_accounts_payable";

export interface PurchaseSemenItemDraft {
  semen_id: string;
  amount: number;
}

export const PURCHASE_TYPE_OPTIONS: Array<{ value: PurchaseType; label: string }> = [
  { value: "animal", label: "Animal" },
  { value: "pregnancy", label: "Prenhez" },
  { value: "aspiration", label: "Aspiração" },
  { value: "recipient", label: "Receptora" },
  { value: "semen", label: "Sêmen" },
];

export const PURCHASE_TYPE_LABELS: Record<PurchaseType, string> = {
  animal: "Animal",
  pregnancy: "Prenhez",
  aspiration: "Aspiração",
  recipient: "Receptora",
  semen: "Sêmen",
};

export const createPurchaseWithPayable = async (input: {
  supplierId: string;
  purchaseType: PurchaseType;
  itemId: string;
  productId: string;
  purchaseDate: string;
  issueDate: string;
  competenceDate: string;
  firstDueDate: string;
  totalAmount: number;
  documentType?: string;
  documentNumber?: string;
  description?: string;
  notes?: string;
  negotiationMethod?: string;
  installments: PurchaseInstallmentDraft[];
}) => {
  const { data, error } = await supabase.rpc("create_purchase_with_payable", {
    p_supplier_id: input.supplierId,
    p_purchase_type: input.purchaseType,
    p_item_id: input.itemId,
    p_product_id: input.productId,
    p_purchase_date: input.purchaseDate,
    p_issue_date: input.issueDate,
    p_competence_date: input.competenceDate,
    p_first_due_date: input.firstDueDate,
    p_total_amount: input.totalAmount,
    p_document_type: input.documentType || null,
    p_document_number: input.documentNumber || null,
    p_description: input.description || null,
    p_notes: input.notes || null,
    p_negotiation_method: input.negotiationMethod || null,
    p_installments: input.installments as unknown as Json,
  });

  if (error) {
    throw error;
  }

  return data?.[0] || null;
};

export const updatePurchaseWithPayable = async (input: {
  purchaseId: string;
  supplierId: string;
  purchaseType: PurchaseType;
  itemId: string;
  productId: string;
  purchaseDate: string;
  issueDate: string;
  competenceDate: string;
  firstDueDate: string;
  totalAmount: number;
  documentType?: string;
  documentNumber?: string;
  description?: string;
  notes?: string;
  negotiationMethod?: string;
  installments: PurchaseInstallmentDraft[];
}) => {
  const { data, error } = await supabase.rpc("update_purchase_with_payable", {
    p_purchase_id: input.purchaseId,
    p_supplier_id: input.supplierId,
    p_purchase_type: input.purchaseType,
    p_item_id: input.itemId,
    p_product_id: input.productId,
    p_purchase_date: input.purchaseDate,
    p_issue_date: input.issueDate,
    p_competence_date: input.competenceDate,
    p_first_due_date: input.firstDueDate,
    p_total_amount: input.totalAmount,
    p_document_type: input.documentType || null,
    p_document_number: input.documentNumber || null,
    p_description: input.description || null,
    p_notes: input.notes || null,
    p_negotiation_method: input.negotiationMethod || null,
    p_installments: input.installments as unknown as Json,
  });

  if (error) {
    throw error;
  }

  return data?.[0] || null;
};

export const migrateAccountsPayableToPurchase = async (input: {
  accountPayableIds: string[];
  purchaseType: PurchaseType;
  itemId: string;
  productId: string;
  purchaseDate: string;
  issueDate?: string;
  competenceDate?: string;
  firstDueDate?: string;
  documentType?: string;
  documentNumber?: string;
  description?: string;
  notes?: string;
  negotiationMethod?: string;
}) => {
  const { data, error } = await supabase.rpc("migrate_accounts_payable_to_purchase", {
    p_account_payable_ids: input.accountPayableIds,
    p_purchase_type: input.purchaseType,
    p_item_id: input.itemId,
    p_product_id: input.productId,
    p_purchase_date: input.purchaseDate,
    p_issue_date: input.issueDate || null,
    p_competence_date: input.competenceDate || null,
    p_first_due_date: input.firstDueDate || null,
    p_document_type: input.documentType || null,
    p_document_number: input.documentNumber || null,
    p_description: input.description || null,
    p_notes: input.notes || null,
    p_negotiation_method: input.negotiationMethod || null,
  });

  if (error) {
    throw error;
  }

  return data?.[0] || null;
};

export const deletePurchaseWithPayable = async (purchaseId: string) => {
  const { data, error } = await supabase.rpc("delete_purchase_with_payable", {
    p_purchase_id: purchaseId,
  });

  if (error) {
    throw error;
  }

  return data?.[0] || null;
};
