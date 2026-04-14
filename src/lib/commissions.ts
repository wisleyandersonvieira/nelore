import { supabase } from "@/integrations/supabase/client";
import type { SaleInstallmentDraft, SaleItemOption } from "@/lib/sales";
import { buildSaleItemLabel } from "@/lib/sales";

export type CommissionItemType = "animal" | "pregnancy" | "aspiration";
export type CommissionKind = "purchase" | "sale";

export interface CommissionItemDraft {
  local_id: string;
  item_type: CommissionItemType;
  item_id: string;
  item_name: string;
  item_code: string | null;
  store_id: string;
  store_name?: string | null;
  source_type: "auction" | "manual";
  selected: boolean;
  purchase_amount: number;
  commission_percentage: number;
  commission_amount: number;
}

export interface CommissionItemOption extends SaleItemOption {
  item_type: CommissionItemType;
}

export const COMMISSION_KIND_OPTIONS: Array<{ value: CommissionKind; label: string }> = [
  { value: "purchase", label: "Comissão de Compra" },
  { value: "sale", label: "Comissão de Venda" },
];

export const COMMISSION_KIND_LABELS: Record<CommissionKind, string> = {
  purchase: "Comissão de Compra",
  sale: "Comissão de Venda",
};

export const COMMISSION_ITEM_TYPE_OPTIONS: Array<{ value: CommissionItemType; label: string }> = [
  { value: "animal", label: "Animal" },
  { value: "pregnancy", label: "Prenhez" },
  { value: "aspiration", label: "Aspiração" },
];

export const COMMISSION_ITEM_TYPE_LABELS: Record<CommissionItemType, string> = {
  animal: "Animal",
  pregnancy: "Prenhez",
  aspiration: "Aspiração",
};

export const roundMoney = (value: number) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export const buildCommissionItemLabel = (item?: Pick<SaleItemOption, "code" | "name"> | null) =>
  buildSaleItemLabel(item);

export const calculateCommissionAmount = (purchaseAmount: number, percentage: number) =>
  roundMoney((Number(purchaseAmount || 0) * Number(percentage || 0)) / 100);

export const sumCommissionItems = (items: CommissionItemDraft[]) =>
  roundMoney(
    items
      .filter((item) => item.selected)
      .reduce((sum, item) => sum + Number(item.commission_amount || 0), 0),
  );

export const createCommissionWithPayable = async (input: {
  auctionId: string;
  supplierId: string;
  commissionKind: CommissionKind;
  defaultPercentage: number;
  productId: string;
  commissionDate: string;
  issueDate: string;
  competenceDate: string;
  firstDueDate: string;
  documentType?: string;
  documentNumber?: string;
  description?: string;
  notes?: string;
  negotiationMethod?: string;
  items: CommissionItemDraft[];
  installments: SaleInstallmentDraft[];
}) => {
  const { data, error } = await supabase.rpc("create_commission_with_payable", {
    p_auction_id: input.auctionId,
    p_supplier_id: input.supplierId,
    p_commission_kind: input.commissionKind,
    p_default_percentage: input.defaultPercentage,
    p_product_id: input.productId,
    p_commission_date: input.commissionDate,
    p_issue_date: input.issueDate,
    p_competence_date: input.competenceDate,
    p_first_due_date: input.firstDueDate,
    p_document_type: input.documentType || null,
    p_document_number: input.documentNumber || null,
    p_description: input.description || null,
    p_notes: input.notes || null,
    p_negotiation_method: input.negotiationMethod || null,
    p_items: input.items
      .filter((item) => item.selected)
      .map((item) => ({
        item_type: item.item_type,
        item_id: item.item_id,
        source_type: item.source_type,
        purchase_amount: roundMoney(item.purchase_amount),
        commission_percentage: Number(item.commission_percentage || 0),
        commission_amount: roundMoney(item.commission_amount),
      })),
    p_installments: input.installments as unknown as Json,
  });

  if (error) throw error;
  return data?.[0] || null;
};

export const updateCommissionWithPayable = async (input: {
  commissionId: string;
  auctionId: string;
  supplierId: string;
  commissionKind: CommissionKind;
  defaultPercentage: number;
  productId: string;
  commissionDate: string;
  issueDate: string;
  competenceDate: string;
  firstDueDate: string;
  documentType?: string;
  documentNumber?: string;
  description?: string;
  notes?: string;
  negotiationMethod?: string;
  items: CommissionItemDraft[];
  installments: SaleInstallmentDraft[];
}) => {
  const { data, error } = await supabase.rpc("update_commission_with_payable", {
    p_commission_id: input.commissionId,
    p_auction_id: input.auctionId,
    p_supplier_id: input.supplierId,
    p_commission_kind: input.commissionKind,
    p_default_percentage: input.defaultPercentage,
    p_product_id: input.productId,
    p_commission_date: input.commissionDate,
    p_issue_date: input.issueDate,
    p_competence_date: input.competenceDate,
    p_first_due_date: input.firstDueDate,
    p_document_type: input.documentType || null,
    p_document_number: input.documentNumber || null,
    p_description: input.description || null,
    p_notes: input.notes || null,
    p_negotiation_method: input.negotiationMethod || null,
    p_items: input.items
      .filter((item) => item.selected)
      .map((item) => ({
        item_type: item.item_type,
        item_id: item.item_id,
        source_type: item.source_type,
        purchase_amount: roundMoney(item.purchase_amount),
        commission_percentage: Number(item.commission_percentage || 0),
        commission_amount: roundMoney(item.commission_amount),
      })),
    p_installments: input.installments as unknown as Json,
  });

  if (error) throw error;
  return data?.[0] || null;
};

export const deleteCommissionWithPayable = async (commissionId: string) => {
  const { data, error } = await supabase.rpc("delete_commission_with_payable", {
    p_commission_id: commissionId,
  });

  if (error) throw error;
  return data?.[0] || null;
};
