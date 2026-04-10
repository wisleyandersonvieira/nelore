import { supabase } from "@/integrations/supabase/client";
import type { SaleInstallmentDraft, SaleType } from "@/lib/sales";
import { SALE_TYPE_LABELS, SALE_TYPE_OPTIONS } from "@/lib/sales";

export type PurchaseType = SaleType;
export type PurchaseInstallmentDraft = SaleInstallmentDraft;

export const PURCHASE_TYPE_OPTIONS = SALE_TYPE_OPTIONS;
export const PURCHASE_TYPE_LABELS = SALE_TYPE_LABELS;

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
    p_installments: input.installments,
  });

  if (error) {
    throw error;
  }

  return data?.[0] || null;
};
