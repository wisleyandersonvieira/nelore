import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, FileWarning, Filter } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { fetchAccessibleStoreScope, formatCurrencyBRL } from "@/lib/sales";
import { PURCHASE_TYPE_LABELS, PurchaseType } from "@/lib/purchases";

const ALL_STORES = "all";

interface StoreOption {
  id: string;
  name: string;
  code: string;
}

interface ReportRow {
  id: string;
  code: number;
  supplierName: string;
  auctionNames: string;
  purchaseType: PurchaseType;
  items: string[];
  totalAmount: number;
  purchaseDate: string;
}

interface PurchaseQueryRow {
  id: string;
  code: number;
  supplier_id: string;
  purchase_type: PurchaseType;
  purchase_date: string;
  total_amount: number | string;
  item_name: string;
  item_code: string | null;
  animal_id: string | null;
  pregnancy_id: string | null;
  aspiration_id: string | null;
  recipient_id: string | null;
  semen_id: string | null;
}

/** Registros que têm leilão: animals, pregnancy_management, aspiration_management e semen. */
interface ItemRecord {
  id: string;
  code: number | string | null;
  name: string;
  auction_id: string | null;
}

const buildItemLabel = (item: ItemRecord | undefined, fallbackCode: string | null, fallbackName: string) => {
  const code = item?.code ?? fallbackCode;
  const name = item?.name ?? fallbackName;
  return code ? `${code} - ${name}` : name;
};

const PurchasesWithoutInvoiceReport = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>(ALL_STORES);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [reportData, setReportData] = useState<ReportRow[]>([]);

  useEffect(() => {
    const loadStores = async () => {
      try {
        const { storeIds } = await fetchAccessibleStoreScope();

        let query = supabase.from("stores").select("id, name, code").order("name");
        if (storeIds && storeIds.length > 0) {
          query = query.in("id", storeIds);
        }

        const { data, error } = await query;
        if (error) throw error;

        setStores((data || []) as StoreOption[]);
      } catch (error) {
        console.error("Erro ao carregar fazendas:", error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar as fazendas.",
          variant: "destructive",
        });
      }
    };

    void loadStores();
  }, [toast]);

  const generateReport = async () => {
    if (startDate && endDate && startDate > endDate) {
      toast({
        title: "Período inválido",
        description: "A data inicial não pode ser maior que a data final.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { storeIds } = await fetchAccessibleStoreScope();

      let query = supabase
        .from("purchases")
        .select(
          "id, code, supplier_id, purchase_type, purchase_date, total_amount, item_name, item_code, animal_id, pregnancy_id, aspiration_id, recipient_id, semen_id",
        )
        .is("invoice_file_path", null)
        .order("purchase_date", { ascending: false });

      if (selectedStore !== ALL_STORES) {
        query = query.eq("store_id", selectedStore);
      } else if (storeIds && storeIds.length > 0) {
        query = query.in("store_id", storeIds);
      }

      if (startDate) query = query.gte("purchase_date", startDate);
      if (endDate) query = query.lte("purchase_date", endDate);

      const { data, error } = await query;
      if (error) throw error;

      const purchases = (data || []) as unknown as PurchaseQueryRow[];

      if (purchases.length === 0) {
        setReportData([]);
        setGenerated(true);
        return;
      }

      // Compras de sêmen podem ter vários registros no filho purchase_semen_items.
      const semenPurchaseIds = purchases.filter((p) => p.purchase_type === "semen").map((p) => p.id);
      const semenItemsByPurchase = new Map<string, string[]>();

      if (semenPurchaseIds.length > 0) {
        const { data: semenItems, error: semenItemsError } = await supabase
          .from("purchase_semen_items" as any)
          .select("purchase_id, semen_id")
          .in("purchase_id", semenPurchaseIds);

        if (semenItemsError) throw semenItemsError;

        for (const row of ((semenItems as unknown) || []) as Array<{ purchase_id: string; semen_id: string }>) {
          const current = semenItemsByPurchase.get(row.purchase_id) || [];
          current.push(row.semen_id);
          semenItemsByPurchase.set(row.purchase_id, current);
        }
      }

      // Cada compra aponta para os ids dos registros comprados (sêmen pode ter vários).
      const itemIdsByPurchase = new Map<string, string[]>();
      const animalIds = new Set<string>();
      const pregnancyIds = new Set<string>();
      const aspirationIds = new Set<string>();
      const semenIds = new Set<string>();

      for (const purchase of purchases) {
        let ids: string[] = [];

        switch (purchase.purchase_type) {
          case "animal":
            ids = purchase.animal_id ? [purchase.animal_id] : [];
            ids.forEach((id) => animalIds.add(id));
            break;
          case "recipient":
            ids = purchase.recipient_id ? [purchase.recipient_id] : [];
            ids.forEach((id) => animalIds.add(id));
            break;
          case "pregnancy":
            ids = purchase.pregnancy_id ? [purchase.pregnancy_id] : [];
            ids.forEach((id) => pregnancyIds.add(id));
            break;
          case "aspiration":
            ids = purchase.aspiration_id ? [purchase.aspiration_id] : [];
            ids.forEach((id) => aspirationIds.add(id));
            break;
          case "semen":
            ids = semenItemsByPurchase.get(purchase.id) || (purchase.semen_id ? [purchase.semen_id] : []);
            ids.forEach((id) => semenIds.add(id));
            break;
        }

        itemIdsByPurchase.set(purchase.id, ids);
      }

      const supplierIds = Array.from(new Set(purchases.map((purchase) => purchase.supplier_id)));

      const fetchItems = async (table: string, ids: Set<string>) => {
        if (ids.size === 0) return [] as ItemRecord[];
        const { data: rows, error: itemsError } = await supabase
          .from(table as any)
          .select("id, code, name, auction_id")
          .in("id", Array.from(ids));
        if (itemsError) throw itemsError;
        return ((rows as unknown) || []) as ItemRecord[];
      };

      const [suppliersRes, animals, pregnancies, aspirations, semens] = await Promise.all([
        supabase.from("suppliers").select("id, name").in("id", supplierIds),
        fetchItems("animals", animalIds),
        fetchItems("pregnancy_management", pregnancyIds),
        fetchItems("aspiration_management", aspirationIds),
        fetchItems("semen", semenIds),
      ]);

      if (suppliersRes.error) throw suppliersRes.error;

      const supplierMap = new Map((suppliersRes.data || []).map((supplier) => [supplier.id, supplier.name]));
      const itemMap = new Map<string, ItemRecord>();
      [...animals, ...pregnancies, ...aspirations, ...semens].forEach((item) => itemMap.set(item.id, item));

      const auctionIds = Array.from(
        new Set(Array.from(itemMap.values()).map((item) => item.auction_id).filter((id): id is string => Boolean(id))),
      );

      const auctionMap = new Map<string, string>();
      if (auctionIds.length > 0) {
        const { data: auctions, error: auctionsError } = await supabase
          .from("leiloes")
          .select("id, name")
          .in("id", auctionIds);
        if (auctionsError) throw auctionsError;
        (auctions || []).forEach((auction) => auctionMap.set(auction.id, auction.name));
      }

      const rows: ReportRow[] = purchases.map((purchase) => {
        const ids = itemIdsByPurchase.get(purchase.id) || [];
        const items = ids.map((id) => itemMap.get(id));

        const labels =
          items.length > 0
            ? items.map((item, index) =>
                buildItemLabel(item, index === 0 ? purchase.item_code : null, purchase.item_name),
              )
            : [buildItemLabel(undefined, purchase.item_code, purchase.item_name)];

        const auctionNames = Array.from(
          new Set(
            items
              .map((item) => (item?.auction_id ? auctionMap.get(item.auction_id) : null))
              .filter((name): name is string => Boolean(name)),
          ),
        );

        return {
          id: purchase.id,
          code: purchase.code,
          supplierName: supplierMap.get(purchase.supplier_id) || "Fornecedor não encontrado",
          auctionNames: auctionNames.length > 0 ? auctionNames.join(", ") : "-",
          purchaseType: purchase.purchase_type,
          items: labels,
          totalAmount: Number(purchase.total_amount || 0),
          purchaseDate: purchase.purchase_date,
        };
      });

      setReportData(rows);
      setGenerated(true);
    } catch (error: any) {
      console.error("Erro ao gerar relatório de compras sem NF:", error);
      toast({
        title: "Erro ao gerar relatório",
        description: error?.message || "Não foi possível carregar as compras sem nota fiscal.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = useMemo(
    () => reportData.reduce((acc, row) => acc + row.totalAmount, 0),
    [reportData],
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center space-x-4 px-4 py-4">
          <Button onClick={() => navigate("/reports")} variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-primary">Compras sem NF</h1>
            <p className="text-sm text-muted-foreground">
              Compras registradas que ainda não possuem nota fiscal anexada
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
            <CardDescription>Filtre por fazenda e pelo período da data da compra</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="store">Fazenda</Label>
                <Select value={selectedStore} onValueChange={setSelectedStore}>
                  <SelectTrigger id="store">
                    <SelectValue placeholder="Selecione uma fazenda" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_STORES}>Todas as fazendas</SelectItem>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.code} - {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="startDate">Data da compra (inicial)</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">Data da compra (final)</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </div>
            </div>

            <Button onClick={generateReport} disabled={loading}>
              {loading ? "Gerando..." : "Gerar Relatório"}
            </Button>
          </CardContent>
        </Card>

        {generated && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileWarning className="h-5 w-5 text-amber-600" />
                Compras sem nota fiscal
              </CardTitle>
              <CardDescription>
                {reportData.length === 0
                  ? "Nenhuma compra sem nota fiscal no período selecionado."
                  : `${reportData.length} compra(s) sem NF — total de ${formatCurrencyBRL(totalAmount)}`}
              </CardDescription>
            </CardHeader>
            {reportData.length > 0 && (
              <CardContent>
                <div className="overflow-x-auto">
                  <Table className="table-sticky-first">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Compra</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead>Leilão</TableHead>
                        <TableHead>Tipo do item</TableHead>
                        <TableHead>Registros comprados</TableHead>
                        <TableHead className="text-right">Valor da compra</TableHead>
                        <TableHead>Data da compra</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">#{row.code}</TableCell>
                          <TableCell>{row.supplierName}</TableCell>
                          <TableCell>{row.auctionNames}</TableCell>
                          <TableCell>{PURCHASE_TYPE_LABELS[row.purchaseType]}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              {row.items.map((item, index) => (
                                <span key={`${row.id}-${index}`}>{item}</span>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrencyBRL(row.totalAmount)}</TableCell>
                          <TableCell>
                            {format(parseISO(row.purchaseDate), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell colSpan={5} className="font-bold">
                          TOTAL
                        </TableCell>
                        <TableCell className="text-right font-bold">{formatCurrencyBRL(totalAmount)}</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            )}
          </Card>
        )}
      </main>
    </div>
  );
};

export default PurchasesWithoutInvoiceReport;
