import { supabase } from "@/integrations/supabase/client";

export interface AnimalCategoryOption {
  id: string;
  name: string | null;
}

interface AnimalCategoryScope {
  activeOnly?: boolean;
  matrixId?: string | null;
  storeId?: string | null;
  storeIds?: string[];
}

const RECIPIENT_CATEGORY_NAMES = new Set(["receptora", "receptoras"]);

const normalizeCategoryName = (value: string | null | undefined) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export const isRecipientCategoryName = (value: string | null | undefined) =>
  RECIPIENT_CATEGORY_NAMES.has(normalizeCategoryName(value));

export const getRecipientCategoryIds = <T extends AnimalCategoryOption>(categories: T[]) =>
  categories.filter((category) => isRecipientCategoryName(category.name)).map((category) => category.id);

export const isRecipientCategoryId = (categoryId: string | null | undefined, recipientCategoryIds: string[]) =>
  Boolean(categoryId) && recipientCategoryIds.includes(categoryId!);

export const fetchAnimalCategories = async ({
  activeOnly = true,
  matrixId,
  storeId,
  storeIds = [],
}: AnimalCategoryScope = {}) => {
  let query = supabase.from("animal_categories").select("id, name");

  if (activeOnly) {
    query = query.eq("is_active", true);
  }

  const uniqueStoreIds = Array.from(new Set(storeIds.filter(Boolean)));

  if (matrixId) {
    query = query.eq("matrix_id", matrixId);
  } else if (storeId) {
    query = query.eq("store_id", storeId);
  } else if (uniqueStoreIds.length > 0) {
    query = query.in("store_id", uniqueStoreIds);
  }

  const { data, error } = await query.order("name");
  if (error) throw error;

  return (data || []) as AnimalCategoryOption[];
};

export const fetchRecipientCategoryIds = async (scope: AnimalCategoryScope = {}) =>
  getRecipientCategoryIds(await fetchAnimalCategories(scope));
