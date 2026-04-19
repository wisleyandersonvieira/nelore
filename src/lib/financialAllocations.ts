import { supabase } from "@/integrations/supabase/client";
import { fetchRecipientCategoryIds as fetchRecipientCategoryIdsFromRules } from "@/lib/animalCategoryRules";

export const fetchRecipientCategoryIds = fetchRecipientCategoryIdsFromRules;

export type FinancialAllocationType =
  | "animal"
  | "pregnancy"
  | "embryo_transfer"
  | "aspiration"
  | "recipient"
  | "semen";

export const FINANCIAL_ALLOCATION_OPTIONS: Array<{
  value: FinancialAllocationType;
  label: string;
}> = [
  { value: "animal", label: "Animal" },
  { value: "pregnancy", label: "Prenhez" },
  { value: "embryo_transfer", label: "Pós Transf. Emb." },
  { value: "aspiration", label: "Aspiração" },
  { value: "recipient", label: "Receptora" },
];

export const PAYABLE_FINANCIAL_ALLOCATION_OPTIONS: Array<{
  value: FinancialAllocationType;
  label: string;
}> = [
  ...FINANCIAL_ALLOCATION_OPTIONS,
  { value: "semen", label: "Sêmen" },
];

const FINANCIAL_ALLOCATION_LABELS: Record<FinancialAllocationType, string> = {
  animal: "Animal",
  pregnancy: "Prenhez",
  embryo_transfer: "Pós Transf. Emb.",
  aspiration: "Aspiração",
  recipient: "Receptora",
  semen: "Sêmen",
};

export interface RecipientAllocationOption {
  id: string;
  name: string;
  code: number;
  ear_tag: number | null;
  registration: string | null;
}

export interface SemenAllocationOption {
  id: string;
  name: string;
  code: number;
}

export const getFinancialAllocationLabel = (type: string | null | undefined): string => {
  if (!type) return "";
  return FINANCIAL_ALLOCATION_LABELS[type as FinancialAllocationType] || type;
};

export const getFinancialAllocationTargetId = (
  allocation:
    | Partial<{
        animal_id: string | null;
        pregnancy_id: string | null;
        embryo_transfer_id: string | null;
        aspiration_id: string | null;
        recipient_id: string | null;
        semen_id: string | null;
      }>
    | null
    | undefined,
): string | undefined => {
  if (!allocation) return undefined;
  return (
    allocation.animal_id ||
    allocation.pregnancy_id ||
    allocation.embryo_transfer_id ||
    allocation.aspiration_id ||
    allocation.recipient_id ||
    allocation.semen_id ||
    undefined
  );
};

export const fetchRecipientAllocationOptions = async (): Promise<RecipientAllocationOption[]> => {
  const categoryIds = await fetchRecipientCategoryIds();
  if (categoryIds.length === 0) return [];

  const { data, error } = await supabase
    .from("animals")
    .select("id, name, code, ear_tag, registration")
    .eq("is_active", true)
    .in("category_id", categoryIds)
    .order("name");

  if (error) throw error;

  return (data || []) as RecipientAllocationOption[];
};

export const fetchSemenAllocationOptions = async (): Promise<SemenAllocationOption[]> => {
  const { data, error } = await supabase
    .from("semen" as any)
    .select("id, name, code")
    .order("code", { ascending: false });

  if (error) throw error;

  return (data || []) as SemenAllocationOption[];
};
