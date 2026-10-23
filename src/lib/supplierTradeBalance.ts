/**
 * Relatório "Compras e Vendas por Fornecedor".
 *
 * O cadastro `suppliers` é o mesmo para fornecedor e credor/cliente, então um único id
 * filtra as compras (purchases.supplier_id) e as vendas (client_id / cliente_id).
 *
 * COMPRAS — fonte única: `purchases`.
 *   Compras migradas de contas a pagar (RPC migrate_accounts_payable_to_purchase) também
 *   ficam em `purchases` (origin_type = 'migrated_from_accounts_payable'), e a exclusão
 *   (delete_purchase_with_payable) remove a linha de `purchases`. Logo, `purchases` já cobre
 *   tudo. Contas a pagar avulsas, nunca migradas para compra, não entram neste relatório.
 *   Classificação: animal_id ou recipient_id (receptora também é um registro de `animals`)
 *   → Animais; pregnancy_id → Prenhezes; aspiration_id → Aspirações; o restante (sêmen,
 *   inclusive os vários itens de purchase_semen_items, e compras sem vínculo) → Outros.
 *
 * VENDAS — há duas famílias independentes:
 *   (a) `sales` (financeira, gera contas a receber via create_sale_with_receivable);
 *   (b) operacionais `animal_sales` / `pregnancy_sales` / `aspiration_sales`, gravadas por
 *       register_operational_sale. Essa RPC NÃO grava em `sales`: ela cria uma `entrega` e
 *       uma linha em `entrega_clientes` por comprador (com valor_venda e percentual_animal
 *       próprios). A linha operacional guarda só o PRIMEIRO cliente e o valor TOTAL, por isso
 *       o rateio correto por comprador vem de `entrega_clientes`.
 *   Quando o comprador é faturado (importação no módulo Vendas), nasce uma linha em `sales`
 *   e `entrega_clientes.venda_id` passa a apontar para ela.
 *
 *   Para não contar a mesma venda duas vezes, a união é:
 *     1. `sales` com client_id = fornecedor (valor = total_amount);
 *     2. `entrega_clientes` do fornecedor ainda NÃO faturados (venda_id IS NULL), cuja venda
 *        operacional de origem ainda existe (excluir a venda operacional não apaga a entrega);
 *     3. vendas operacionais antigas, anteriores ao módulo de Entregas, que não têm entrega
 *        (só existem nas tabelas *_sales; nesse caso o client_id é o único comprador).
 *   Além disso, 2 e 3 são descartados quando já existe em `sales` uma venda do mesmo item
 *   na mesma data para o mesmo cliente (venda financeira lançada à mão, sem importação).
 *
 *   Vendas parciais: o valor exibido/somado é o valor efetivamente negociado pelo comprador
 *   (já corresponde à fração vendida); o percentual do animal aparece ao lado como informação.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { fetchAllPaginated } from "@/utils/supabasePagination";

type Client = SupabaseClient<Database>;

export type TradeSourceTable =
  | "purchases"
  | "sales"
  | "entrega_clientes"
  | "animal_sales"
  | "pregnancy_sales"
  | "aspiration_sales";

export interface TradeItem {
  id: string;
  date: string;
  label: string;
  detail?: string;
  amount: number;
  percentage?: number;
  auctionLot?: string;
  sourceTable: TradeSourceTable;
}

export interface TradeGroup {
  animals: TradeItem[];
  pregnancies: TradeItem[];
  aspirations: TradeItem[];
  others: TradeItem[];
  total: number;
}

export interface SupplierTradeBalance {
  purchases: TradeGroup;
  sales: TradeGroup;
  balance: number;
}

export interface SupplierTradeBalanceFilters {
  supplierId: string;
  startDate?: string;
  endDate?: string;
  /** Fazenda escolhida no filtro (null/undefined = todas as permitidas). */
  storeId?: string | null;
  /** Lojas acessíveis ao usuário (fetchAccessibleStoreScope); null = sem restrição (admin). */
  accessibleStoreIds?: string[] | null;
}

export type TradeCategory = "animals" | "pregnancies" | "aspirations" | "others";

interface ItemRecord {
  id: string;
  code: number | string | null;
  name: string | null;
  store_id?: string | null;
  registration?: string | null;
  recipient_id?: string | null;
}

interface PurchaseRow {
  id: string;
  purchase_date: string;
  purchase_type: string;
  total_amount: number | string;
  item_name: string | null;
  item_code: string | null;
  description: string | null;
  animal_id: string | null;
  recipient_id: string | null;
  pregnancy_id: string | null;
  aspiration_id: string | null;
  semen_id: string | null;
}

interface SaleRow {
  id: string;
  sale_date: string;
  sale_type: string;
  total_amount: number | string;
  item_name: string | null;
  item_code: string | null;
  description: string | null;
  animal_id: string | null;
  recipient_id: string | null;
  pregnancy_id: string | null;
  aspiration_id: string | null;
}

interface EntregaClienteRow {
  id: string;
  valor_venda: number | string;
  percentual_animal: number | string | null;
  venda_id: string | null;
  entregas: {
    id: string;
    tipo_item: string;
    registro_id: string;
    registro_nome: string | null;
    data_venda: string | null;
    store_id: string;
    origem_sale_id: string | null;
  } | null;
}

interface OperationalSaleRow {
  id: string;
  item_id: string;
  sale_date: string;
  sale_value: number | string;
  sale_percentage: number | string | null;
  auction_lot: string | null;
}

const OPERATIONAL_TABLES = [
  { table: "animal_sales", fk: "animal_id", tipo: "animal", category: "animals" },
  { table: "pregnancy_sales", fk: "pregnancy_id", tipo: "prenhez", category: "pregnancies" },
  { table: "aspiration_sales", fk: "aspiration_id", tipo: "aspiracao", category: "aspirations" },
] as const;

type OperationalTable = (typeof OPERATIONAL_TABLES)[number]["table"];

const IN_CHUNK_SIZE = 200;

const toNumber = (value: number | string | null | undefined) => Number(value || 0);

const chunk = <T,>(values: T[], size = IN_CHUNK_SIZE) => {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
};

/** Busca registros por id em lotes (evita URLs grandes demais no `.in()`). */
const fetchByIds = async <T,>(client: Client, table: string, columns: string, ids: Iterable<string>, column = "id") => {
  const unique = Array.from(new Set(Array.from(ids).filter(Boolean)));
  const rows: T[] = [];
  for (const part of chunk(unique)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela dinâmica
    const { data, error } = await (client as any).from(table).select(columns).in(column, part);
    if (error) throw error;
    rows.push(...((data || []) as T[]));
  }
  return rows;
};

const resolveStoreIds = (filters: SupplierTradeBalanceFilters): string[] | null => {
  if (filters.storeId) return [filters.storeId];
  if (filters.accessibleStoreIds && filters.accessibleStoreIds.length > 0) return filters.accessibleStoreIds;
  return null;
};

const buildItemLabel = (item: ItemRecord | undefined, fallbackCode?: string | null, fallbackName?: string | null) => {
  const code = item?.code ?? fallbackCode;
  const name = item?.name ?? fallbackName ?? "Item sem identificação";
  return code ? `${code} - ${name}` : name;
};

const emptyGroup = (): TradeGroup => ({ animals: [], pregnancies: [], aspirations: [], others: [], total: 0 });

const finalizeGroup = (group: TradeGroup): TradeGroup => {
  const byDateDesc = (a: TradeItem, b: TradeItem) => (b.date || "").localeCompare(a.date || "");
  const sorted: TradeGroup = {
    animals: [...group.animals].sort(byDateDesc),
    pregnancies: [...group.pregnancies].sort(byDateDesc),
    aspirations: [...group.aspirations].sort(byDateDesc),
    others: [...group.others].sort(byDateDesc),
    total: 0,
  };
  sorted.total = [...sorted.animals, ...sorted.pregnancies, ...sorted.aspirations, ...sorted.others].reduce(
    (acc, item) => acc + item.amount,
    0,
  );
  return sorted;
};

const fetchPurchases = async (client: Client, filters: SupplierTradeBalanceFilters, storeIds: string[] | null) =>
  fetchAllPaginated<PurchaseRow>(() => {
    let query = client
      .from("purchases")
      .select(
        "id, purchase_date, purchase_type, total_amount, item_name, item_code, description, animal_id, recipient_id, pregnancy_id, aspiration_id, semen_id",
      )
      .eq("supplier_id", filters.supplierId)
      .order("purchase_date", { ascending: false })
      .order("id");
    if (filters.startDate) query = query.gte("purchase_date", filters.startDate);
    if (filters.endDate) query = query.lte("purchase_date", filters.endDate);
    if (storeIds) query = query.in("store_id", storeIds);
    return query;
  });

const fetchFinancialSales = async (client: Client, filters: SupplierTradeBalanceFilters, storeIds: string[] | null) =>
  fetchAllPaginated<SaleRow>(() => {
    let query = client
      .from("sales")
      .select(
        "id, sale_date, sale_type, total_amount, item_name, item_code, description, animal_id, recipient_id, pregnancy_id, aspiration_id",
      )
      .eq("client_id", filters.supplierId)
      .order("sale_date", { ascending: false })
      .order("id");
    if (filters.startDate) query = query.gte("sale_date", filters.startDate);
    if (filters.endDate) query = query.lte("sale_date", filters.endDate);
    if (storeIds) query = query.in("store_id", storeIds);
    return query;
  });

const fetchPendingEntregaClientes = async (
  client: Client,
  filters: SupplierTradeBalanceFilters,
  storeIds: string[] | null,
) =>
  fetchAllPaginated<EntregaClienteRow>(() => {
    let query = client
      .from("entrega_clientes")
      .select(
        "id, valor_venda, percentual_animal, venda_id, entregas!inner(id, tipo_item, registro_id, registro_nome, data_venda, store_id, origem_sale_id)",
      )
      .eq("cliente_id", filters.supplierId)
      .is("venda_id", null)
      .order("id");
    if (filters.startDate) query = query.gte("entregas.data_venda", filters.startDate);
    if (filters.endDate) query = query.lte("entregas.data_venda", filters.endDate);
    if (storeIds) query = query.in("entregas.store_id", storeIds);
    return query;
  });

const fetchLegacyOperationalSales = async (
  client: Client,
  table: OperationalTable,
  fk: string,
  filters: SupplierTradeBalanceFilters,
) => {
  const rows = await fetchAllPaginated<Record<string, unknown>>(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela dinâmica
    let query = (client as any)
      .from(table)
      .select(`id, ${fk}, sale_date, sale_value, sale_percentage, auction_lot`)
      .eq("client_id", filters.supplierId)
      .order("id");
    if (filters.startDate) query = query.gte("sale_date", filters.startDate);
    if (filters.endDate) query = query.lte("sale_date", filters.endDate);
    return query;
  });
  return rows.map(
    (row): OperationalSaleRow => ({
      id: row.id as string,
      item_id: row[fk] as string,
      sale_date: row.sale_date as string,
      sale_value: row.sale_value as number,
      sale_percentage: (row.sale_percentage as number | null) ?? null,
      auction_lot: (row.auction_lot as string | null) ?? null,
    }),
  );
};

export const fetchSupplierTradeBalance = async (
  client: Client,
  filters: SupplierTradeBalanceFilters,
): Promise<SupplierTradeBalance> => {
  const storeIds = resolveStoreIds(filters);

  const [purchases, financialSales, pendingClients, ...legacyByTable] = await Promise.all([
    fetchPurchases(client, filters, storeIds),
    fetchFinancialSales(client, filters, storeIds),
    fetchPendingEntregaClientes(client, filters, storeIds),
    ...OPERATIONAL_TABLES.map(({ table, fk }) => fetchLegacyOperationalSales(client, table, fk, filters)),
  ]);

  // Vendas operacionais referenciadas pelas entregas pendentes (confirma que ainda existem e traz o lote do leilão).
  const origemIdsByTipo = new Map<string, Set<string>>();
  for (const row of pendingClients) {
    const entrega = row.entregas;
    if (!entrega?.origem_sale_id) continue;
    const set = origemIdsByTipo.get(entrega.tipo_item) || new Set<string>();
    set.add(entrega.origem_sale_id);
    origemIdsByTipo.set(entrega.tipo_item, set);
  }

  const origemSales = new Map<string, { auction_lot: string | null }>();
  const legacyIds = legacyByTable.flat().map((row) => row.id);
  const [origemRows, legacyEntregas, semenItems] = await Promise.all([
    Promise.all(
      OPERATIONAL_TABLES.map(({ table, tipo }) =>
        fetchByIds<{ id: string; auction_lot: string | null }>(client, table, "id, auction_lot", origemIdsByTipo.get(tipo) || []),
      ),
    ),
    fetchByIds<{ origem_sale_id: string }>(client, "entregas", "origem_sale_id", legacyIds, "origem_sale_id"),
    fetchByIds<{ purchase_id: string; semen_id: string }>(
      client,
      "purchase_semen_items",
      "purchase_id, semen_id",
      purchases.filter((purchase) => purchase.purchase_type === "semen").map((purchase) => purchase.id),
      "purchase_id",
    ),
  ]);
  origemRows.flat().forEach((row) => origemSales.set(row.id, { auction_lot: row.auction_lot }));
  const legacyWithEntrega = new Set(legacyEntregas.map((row) => row.origem_sale_id));

  const semenIdsByPurchase = new Map<string, string[]>();
  for (const row of semenItems) {
    const list = semenIdsByPurchase.get(row.purchase_id) || [];
    list.push(row.semen_id);
    semenIdsByPurchase.set(row.purchase_id, list);
  }

  // Registros vinculados (para identificação e para o filtro de fazenda das vendas antigas).
  const animalIds = new Set<string>();
  const pregnancyIds = new Set<string>();
  const aspirationIds = new Set<string>();
  const semenIds = new Set<string>();
  const addLinks = (row: { animal_id: string | null; recipient_id: string | null; pregnancy_id: string | null; aspiration_id: string | null }) => {
    if (row.animal_id) animalIds.add(row.animal_id);
    if (row.recipient_id) animalIds.add(row.recipient_id);
    if (row.pregnancy_id) pregnancyIds.add(row.pregnancy_id);
    if (row.aspiration_id) aspirationIds.add(row.aspiration_id);
  };
  purchases.forEach((purchase) => {
    addLinks(purchase);
    (semenIdsByPurchase.get(purchase.id) || (purchase.semen_id ? [purchase.semen_id] : [])).forEach((id) => semenIds.add(id));
  });
  financialSales.forEach(addLinks);
  pendingClients.forEach((row) => {
    const entrega = row.entregas;
    if (!entrega) return;
    if (entrega.tipo_item === "animal") animalIds.add(entrega.registro_id);
    if (entrega.tipo_item === "prenhez") pregnancyIds.add(entrega.registro_id);
    if (entrega.tipo_item === "aspiracao") aspirationIds.add(entrega.registro_id);
  });
  OPERATIONAL_TABLES.forEach(({ category }, index) => {
    const target = category === "animals" ? animalIds : category === "pregnancies" ? pregnancyIds : aspirationIds;
    legacyByTable[index].forEach((row) => target.add(row.item_id));
  });

  const [animals, pregnancies, aspirations, semens] = await Promise.all([
    fetchByIds<ItemRecord>(client, "animals", "id, code, name, registration, store_id", animalIds),
    fetchByIds<ItemRecord>(client, "pregnancy_management", "id, code, name, store_id, recipient_id", pregnancyIds),
    fetchByIds<ItemRecord>(client, "aspiration_management", "id, code, name, store_id", aspirationIds),
    fetchByIds<ItemRecord>(client, "semen", "id, code, name", semenIds),
  ]);

  const itemMap = new Map<string, ItemRecord>();
  [...animals, ...pregnancies, ...aspirations, ...semens].forEach((item) => itemMap.set(item.id, item));

  // Receptoras das prenhezes (exibidas como detalhe).
  const missingRecipients = pregnancies
    .map((pregnancy) => pregnancy.recipient_id)
    .filter((id): id is string => Boolean(id) && !itemMap.has(id as string));
  (await fetchByIds<ItemRecord>(client, "animals", "id, code, name", missingRecipients)).forEach((item) =>
    itemMap.set(item.id, item),
  );

  const animalDetail = (id: string, isRecipient: boolean) => {
    const registration = itemMap.get(id)?.registration;
    const parts = [isRecipient ? "Receptora" : null, registration ? `RG ${registration}` : null].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : undefined;
  };
  const pregnancyDetail = (id: string) => {
    const recipientId = itemMap.get(id)?.recipient_id;
    const recipient = recipientId ? itemMap.get(recipientId) : undefined;
    return recipient ? `Receptora: ${buildItemLabel(recipient)}` : undefined;
  };

  /* --------------------------------- Compras -------------------------------- */
  const purchaseGroup = emptyGroup();
  for (const purchase of purchases) {
    const base = {
      id: purchase.id,
      date: purchase.purchase_date,
      amount: toNumber(purchase.total_amount),
      sourceTable: "purchases" as const,
    };
    const animalId = purchase.animal_id || purchase.recipient_id;
    if (animalId) {
      purchaseGroup.animals.push({
        ...base,
        label: buildItemLabel(itemMap.get(animalId), purchase.item_code, purchase.item_name),
        detail: animalDetail(animalId, !purchase.animal_id),
      });
    } else if (purchase.pregnancy_id) {
      purchaseGroup.pregnancies.push({
        ...base,
        label: buildItemLabel(itemMap.get(purchase.pregnancy_id), purchase.item_code, purchase.item_name),
        detail: pregnancyDetail(purchase.pregnancy_id),
      });
    } else if (purchase.aspiration_id) {
      purchaseGroup.aspirations.push({
        ...base,
        label: buildItemLabel(itemMap.get(purchase.aspiration_id), purchase.item_code, purchase.item_name),
      });
    } else {
      const semenList = semenIdsByPurchase.get(purchase.id) || (purchase.semen_id ? [purchase.semen_id] : []);
      const isSemen = purchase.purchase_type === "semen" || semenList.length > 0;
      purchaseGroup.others.push({
        ...base,
        label:
          semenList.length > 0
            ? semenList.map((id) => buildItemLabel(itemMap.get(id))).join(", ")
            : buildItemLabel(undefined, purchase.item_code, purchase.item_name || purchase.description),
        detail: isSemen ? "Sêmen" : purchase.description || undefined,
      });
    }
  }

  /* --------------------------------- Vendas --------------------------------- */
  const saleGroup = emptyGroup();
  const financialKeys = new Set<string>();
  const saleKey = (itemId: string, date: string | null | undefined) => `${itemId}|${date || ""}`;

  for (const sale of financialSales) {
    const base = {
      id: sale.id,
      date: sale.sale_date,
      amount: toNumber(sale.total_amount),
      sourceTable: "sales" as const,
    };
    const animalId = sale.animal_id || sale.recipient_id;
    const itemId = animalId || sale.pregnancy_id || sale.aspiration_id;
    if (itemId) financialKeys.add(saleKey(itemId, sale.sale_date));

    if (animalId) {
      saleGroup.animals.push({
        ...base,
        label: buildItemLabel(itemMap.get(animalId), sale.item_code, sale.item_name),
        detail: animalDetail(animalId, !sale.animal_id),
      });
    } else if (sale.pregnancy_id) {
      saleGroup.pregnancies.push({
        ...base,
        label: buildItemLabel(itemMap.get(sale.pregnancy_id), sale.item_code, sale.item_name),
        detail: pregnancyDetail(sale.pregnancy_id),
      });
    } else if (sale.aspiration_id) {
      saleGroup.aspirations.push({
        ...base,
        label: buildItemLabel(itemMap.get(sale.aspiration_id), sale.item_code, sale.item_name),
      });
    } else {
      saleGroup.others.push({
        ...base,
        label: buildItemLabel(undefined, sale.item_code, sale.item_name || sale.description),
      });
    }
  }

  const pushOperational = (category: TradeCategory, item: TradeItem, itemId: string) => {
    if (financialKeys.has(saleKey(itemId, item.date))) return;
    saleGroup[category].push(item);
  };
  const detailFor = (category: TradeCategory, itemId: string) =>
    category === "animals" ? animalDetail(itemId, false) : category === "pregnancies" ? pregnancyDetail(itemId) : undefined;
  const percentageOf = (value: number | string | null | undefined) => {
    const pct = value === null || value === undefined ? undefined : Number(value);
    return pct !== undefined && Number.isFinite(pct) && pct > 0 ? pct : undefined;
  };

  for (const row of pendingClients) {
    const entrega = row.entregas;
    if (!entrega) continue;
    const operational = OPERATIONAL_TABLES.find(({ tipo }) => tipo === entrega.tipo_item);
    if (!operational) continue;
    // Venda operacional excluída: a entrega fica órfã e não deve ser contada.
    if (entrega.origem_sale_id && !origemSales.has(entrega.origem_sale_id)) continue;

    pushOperational(
      operational.category,
      {
        id: row.id,
        date: entrega.data_venda || "",
        label: buildItemLabel(itemMap.get(entrega.registro_id), null, entrega.registro_nome),
        detail: detailFor(operational.category, entrega.registro_id),
        amount: toNumber(row.valor_venda),
        percentage: percentageOf(row.percentual_animal),
        auctionLot: (entrega.origem_sale_id && origemSales.get(entrega.origem_sale_id)?.auction_lot) || undefined,
        sourceTable: "entrega_clientes",
      },
      entrega.registro_id,
    );
  }

  OPERATIONAL_TABLES.forEach(({ table, category }, index) => {
    for (const row of legacyByTable[index]) {
      if (legacyWithEntrega.has(row.id)) continue;
      const item = itemMap.get(row.item_id);
      // As tabelas operacionais não têm store_id: o filtro de fazenda usa a fazenda do registro.
      if (storeIds && (!item?.store_id || !storeIds.includes(item.store_id))) continue;

      pushOperational(
        category,
        {
          id: row.id,
          date: row.sale_date,
          label: buildItemLabel(item),
          detail: detailFor(category, row.item_id),
          amount: toNumber(row.sale_value),
          percentage: percentageOf(row.sale_percentage),
          auctionLot: row.auction_lot || undefined,
          sourceTable: table,
        },
        row.item_id,
      );
    }
  });

  const finalPurchases = finalizeGroup(purchaseGroup);
  const finalSales = finalizeGroup(saleGroup);

  return {
    purchases: finalPurchases,
    sales: finalSales,
    balance: finalSales.total - finalPurchases.total,
  };
};
