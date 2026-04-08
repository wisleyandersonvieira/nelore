import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { addDays, addMonths, endOfMonth, format, startOfMonth, startOfToday } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowRight,
  Baby,
  Beef,
  CalendarDays,
  CircleDollarSign,
  CreditCard,
  Dna,
  HandCoins,
  Landmark,
  Plus,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchRecipientCategoryIds } from "@/lib/animalCategoryRules";

const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const PIE_COLORS = ["hsl(142, 72%, 38%)", "hsl(28, 89%, 58%)", "hsl(198, 74%, 48%)", "hsl(340, 76%, 55%)"];

interface DashboardIndicatorsProps {
  userId?: string;
}

interface DashboardUserScope {
  matrixId: string | null;
  storeId: string | null;
  storeIds: string[];
}

interface NestedItem {
  total_price: number | string | null;
}

interface PayableAccountSummary {
  id: string;
  due_date: string | null;
  payment_date: string | null;
  status: string | null;
  accounts_payable_items?: NestedItem[] | null;
}

interface ReceivableAccountSummary {
  id: string;
  due_date: string | null;
  payment_date: string | null;
  status: string | null;
  accounts_receivable_items?: NestedItem[] | null;
}

interface PayableInstallmentSummary {
  amount: number | string | null;
  due_date: string | null;
  payment_date: string | null;
  status?: string | null;
}

interface ReceivableInstallmentSummary {
  amount: number | string | null;
  due_date: string | null;
  payment_date: string | null;
}

interface PayableFinancialAccountSummary {
  id: string;
  amount: number | string | null;
  due_date: string | null;
  payment_date: string | null;
  status: string | null;
  accounts_payable_installments?: PayableInstallmentSummary[] | null;
}

interface ReceivableFinancialAccountSummary {
  id: string;
  amount: number | string | null;
  due_date: string | null;
  payment_date: string | null;
  status: string | null;
  accounts_receivable_installments?: ReceivableInstallmentSummary[] | null;
}

interface SummaryCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  route?: string;
  loading?: boolean;
}

interface AttentionCardProps {
  title: string;
  count: number;
  description: string;
  amount?: number;
  onClick: () => void;
}

interface FinanceMetricCardProps {
  title: string;
  value: number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "neutral" | "success" | "danger";
}

interface QuickActionCardProps {
  title: string;
  description: string;
  route?: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
}

interface WeeklyFinancialEntry {
  due_date: string | null;
  amount: number;
}

interface AttentionPregnancyItem {
  id: string;
  name: string;
  expected_birth_month: string | null;
  farm_name: string;
}

interface AttentionFinancialItem {
  id: string;
  partner_name: string;
  amount: number;
  due_date: string | null;
  allocation_names: string[];
}

type AttentionModalType = "pregnancies" | "payables" | "receivables" | null;

const formatCurrencyBR = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });

const formatDateBR = (date: string | null | undefined) => {
  if (!date) return "—";
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("pt-BR");
};

const sumNestedItems = (items: NestedItem[] | null | undefined) =>
  (items || []).reduce((total, item) => total + Number(item.total_price || 0), 0);

const parseDate = (date: string | null | undefined) => {
  if (!date) return null;
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isSameMonth = (date: Date | null, reference: Date) =>
  !!date &&
  date.getFullYear() === reference.getFullYear() &&
  date.getMonth() === reference.getMonth();

const buildPayableEntries = (accounts: PayableFinancialAccountSummary[]) =>
  accounts.flatMap((account) => {
    const installments = account.accounts_payable_installments || [];

    if (installments.length > 0) {
      return installments.map((installment) => ({
        amount: Number(installment.amount || 0),
        dueDate: parseDate(installment.due_date),
        paymentDate: parseDate(installment.payment_date),
        status: installment.status || account.status || null,
      }));
    }

    return [
      {
        amount: Number(account.amount || 0),
        dueDate: parseDate(account.due_date),
        paymentDate: parseDate(account.payment_date),
        status: account.status || null,
      },
    ];
  });

const buildReceivableEntries = (accounts: ReceivableFinancialAccountSummary[]) =>
  accounts.flatMap((account) => {
    const installments = account.accounts_receivable_installments || [];

    if (installments.length > 0) {
      return installments.map((installment) => ({
        amount: Number(installment.amount || 0),
        dueDate: parseDate(installment.due_date),
        paymentDate: parseDate(installment.payment_date),
        status: account.status || null,
      }));
    }

    return [
      {
        amount: Number(account.amount || 0),
        dueDate: parseDate(account.due_date),
        paymentDate: parseDate(account.payment_date),
        status: account.status || null,
      },
    ];
  });

const SectionHeader = ({ title, description }: { title: string; description: string }) => (
  <div className="space-y-1">
    <h2 className="text-lg font-semibold text-foreground">{title}</h2>
    <p className="text-sm text-muted-foreground">{description}</p>
  </div>
);

const SummaryCard = ({ title, value, description, icon: Icon, accent, route, loading }: SummaryCardProps) => {
  const navigate = useNavigate();

  return (
    <Card
      onClick={() => route && navigate(route)}
      className={`border transition-all ${route ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md" : ""} ${accent}`}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-semibold tracking-tight text-foreground">{loading ? "..." : value}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <div className="rounded-xl bg-background/80 p-3 shadow-sm">
            <Icon className="h-5 w-5 text-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const AttentionCard = ({ title, count, description, amount, onClick }: AttentionCardProps) => {
  return (
    <Card className="border-amber-200 bg-amber-50/80 shadow-sm">
      <CardContent className="p-5">
        <div className="flex h-full flex-col gap-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-amber-900">{title}</p>
            <p className="text-3xl font-semibold text-amber-950">{count}</p>
            <p className="text-sm text-amber-900/80">{description}</p>
            {typeof amount === "number" && (
              <p className="text-xs font-medium text-amber-900/70">Valor envolvido: {formatCurrencyBR(amount)}</p>
            )}
          </div>
          <Button
            variant="outline"
            className="mt-auto w-full justify-between border-amber-300 bg-white/70 text-amber-950 hover:bg-white"
            onClick={onClick}
          >
            Ver listagem
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const FinanceMetricCard = ({ title, value, description, icon: Icon, tone }: FinanceMetricCardProps) => {
  const toneClasses =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50/70 text-emerald-900"
      : tone === "danger"
        ? "border-rose-200 bg-rose-50/70 text-rose-900"
        : "border-slate-200 bg-white";

  return (
    <Card className={toneClasses}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-2xl font-semibold tracking-tight">{formatCurrencyBR(value)}</p>
            <p className="text-xs opacity-80">{description}</p>
          </div>
          <div className="rounded-xl bg-background/80 p-3 shadow-sm">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const QuickActionCard = ({ title, description, route, icon: Icon, onClick }: QuickActionCardProps) => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => {
        if (onClick) {
          onClick();
          return;
        }
        if (route) navigate(route);
      }}
      className="text-left rounded-2xl border bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-base font-semibold text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="rounded-xl bg-slate-100 p-3">
          <Icon className="h-5 w-5 text-slate-700" />
        </div>
      </div>
    </button>
  );
};

const DashboardIndicators = ({ userId }: DashboardIndicatorsProps) => {
  const navigate = useNavigate();
  const [attentionModal, setAttentionModal] = useState<AttentionModalType>(null);

  const { data: userScope = { matrixId: null, storeId: null, storeIds: [] } } = useQuery({
    queryKey: ["dashboard-user-scope", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) {
        return { matrixId: null, storeId: null, storeIds: [] } as DashboardUserScope;
      }

      const [{ data: profile }, { data: userStores }] = await Promise.all([
        supabase.from("profiles").select("store_id, matrix_id").eq("id", userId).single(),
        supabase.from("user_stores").select("store_id").eq("user_id", userId),
      ]);

      const candidateStoreIds = new Set<string>();
      if (profile?.store_id) candidateStoreIds.add(profile.store_id);
      userStores?.forEach((store) => candidateStoreIds.add(store.store_id));

      if (candidateStoreIds.size === 0) {
        return {
          matrixId: profile?.matrix_id || null,
          storeId: profile?.store_id || null,
          storeIds: [],
        } as DashboardUserScope;
      }

      if (profile?.matrix_id) {
        const { data: validStores } = await supabase
          .from("stores")
          .select("id")
          .eq("matrix_id", profile.matrix_id)
          .in("id", Array.from(candidateStoreIds));

        return {
          matrixId: profile.matrix_id,
          storeId: profile?.store_id || null,
          storeIds: (validStores || []).map((store) => store.id),
        } as DashboardUserScope;
      }

      return {
        matrixId: null,
        storeId: profile?.store_id || null,
        storeIds: Array.from(candidateStoreIds),
      } as DashboardUserScope;
    },
    staleTime: 10 * 60 * 1000,
  });

  const { matrixId, storeId, storeIds } = userScope;

  const { data: recipientCategoryIds = [] } = useQuery({
    queryKey: ["dashboard-recipient-category-ids", userId, matrixId, storeId, storeIds],
    enabled: storeIds.length > 0,
    queryFn: async () => fetchRecipientCategoryIds({ matrixId, storeId, storeIds }),
    staleTime: 10 * 60 * 1000,
  });

  const { data: executiveSummary, isLoading: executiveSummaryLoading } = useQuery({
    queryKey: ["dashboard-executive-summary", userId, storeIds, recipientCategoryIds],
    enabled: storeIds.length > 0,
    queryFn: async () => {
      const today = startOfToday();
      const next30Days = addDays(today, 30);
      const todayIso = format(today, "yyyy-MM-dd");

      const animalsBaseQuery = supabase
        .from("animals")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .in("store_id", storeIds);

      const [animalsRes, recipientsRes, pregnanciesRes, embryoTransferRes, pregnanciesWithBirthDateRes] = await Promise.all([
        recipientCategoryIds.length > 0
          ? animalsBaseQuery.not("category_id", "in", `("${recipientCategoryIds.join('","')}")`)
          : animalsBaseQuery,
        recipientCategoryIds.length > 0
          ? supabase
              .from("animals")
              .select("id", { count: "exact", head: true })
              .eq("is_active", true)
              .in("store_id", storeIds)
              .in("category_id", recipientCategoryIds)
          : Promise.resolve({ count: 0 }),
        supabase
          .from("pregnancy_management")
          .select("id", { count: "exact", head: true })
          .eq("status", "in_progress")
          .in("store_id", storeIds),
        supabase
          .from("embryo_transfer_management")
          .select("id", { count: "exact", head: true })
          .eq("status", "in_progress")
          .in("store_id", storeIds),
        supabase
          .from("pregnancy_management")
          .select("id, name, expected_birth_month")
          .eq("status", "in_progress")
          .not("expected_birth_month", "is", null)
          .gte("expected_birth_month", todayIso)
          .in("store_id", storeIds)
          .order("expected_birth_month", { ascending: true }),
      ]);

      const births = (pregnanciesWithBirthDateRes.data || []).filter((item) => {
        const birthDate = parseDate(item.expected_birth_month);
        return birthDate && birthDate <= next30Days;
      });

      return {
        animals: animalsRes.count || 0,
        recipients: recipientsRes.count || 0,
        pregnancies: pregnanciesRes.count || 0,
        awaitingValidation: embryoTransferRes.count || 0,
        upcomingBirths: births.length,
        nearestBirth: births[0] || null,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: attentionData, isLoading: attentionLoading } = useQuery({
    queryKey: ["dashboard-attention", userId, storeIds],
    enabled: storeIds.length > 0,
    queryFn: async () => {
      const today = startOfToday();
      const weekEnd = addDays(today, 6);
      const next30Days = addDays(today, 30);
      const todayIso = format(today, "yyyy-MM-dd");
      const weekEndIso = format(weekEnd, "yyyy-MM-dd");
      const next30DaysIso = format(next30Days, "yyyy-MM-dd");

      const buildAccountAllocationMap = async (
        allocationTable: "accounts_payable_item_allocations" | "accounts_receivable_item_allocations",
        itemColumn: "account_payable_item_id" | "account_receivable_item_id",
        accountItems: Array<{ account_id: string; item_ids: string[] }>,
      ) => {
        const itemToAccount = new Map<string, string>();
        accountItems.forEach((account) => {
          account.item_ids.forEach((itemId) => itemToAccount.set(itemId, account.account_id));
        });

        const allItemIds = Array.from(itemToAccount.keys());
        if (allItemIds.length === 0) return new Map<string, string[]>();

        const { data: allocations } = await supabase
          .from(allocationTable)
          .select(`
            ${itemColumn},
            animal_id,
            aspiration_id,
            pregnancy_id,
            embryo_transfer_id,
            recipient_id,
            animals:animal_id(name, code),
            aspiration_management:aspiration_id(name, code),
            pregnancy_management:pregnancy_id(name, code),
            embryo_transfer_management:embryo_transfer_id(name, code)
          `)
          .in(itemColumn, allItemIds);

        const recipientIds = Array.from(
          new Set((allocations || []).map((allocation: any) => allocation.recipient_id).filter(Boolean)),
        ) as string[];

        const { data: recipients } = recipientIds.length > 0
          ? await supabase.from("animals").select("id, name, code").in("id", recipientIds)
          : { data: [] as any[] };

        const recipientMap = new Map(
          (recipients || []).map((recipient: any) => [recipient.id, `${recipient.code} - ${recipient.name}`]),
        );

        const accountAllocations = new Map<string, Set<string>>();

        (allocations || []).forEach((allocation: any) => {
          const accountId = itemToAccount.get(allocation[itemColumn]);
          if (!accountId) return;

          if (!accountAllocations.has(accountId)) {
            accountAllocations.set(accountId, new Set());
          }

          let label = "";
          if (allocation.animal_id && allocation.animals) {
            label = `Animal: ${allocation.animals.code} - ${allocation.animals.name}`;
          } else if (allocation.aspiration_id && allocation.aspiration_management) {
            label = `Aspiração: ${allocation.aspiration_management.code} - ${allocation.aspiration_management.name}`;
          } else if (allocation.pregnancy_id && allocation.pregnancy_management) {
            label = `Prenhez: ${allocation.pregnancy_management.code} - ${allocation.pregnancy_management.name}`;
          } else if (allocation.embryo_transfer_id && allocation.embryo_transfer_management) {
            label = `Pós TE: ${allocation.embryo_transfer_management.code} - ${allocation.embryo_transfer_management.name}`;
          } else if (allocation.recipient_id && recipientMap.has(allocation.recipient_id)) {
            label = `Receptora: ${recipientMap.get(allocation.recipient_id)}`;
          }

          if (label) {
            accountAllocations.get(accountId)!.add(label);
          }
        });

        const result = new Map<string, string[]>();
        accountAllocations.forEach((labels, accountId) => {
          result.set(accountId, Array.from(labels));
        });

        return result;
      };

      const [pregnanciesRes, payablesRes, receivablesRes] = await Promise.all([
        supabase
          .from("pregnancy_management")
          .select("id, name, expected_birth_month, farm_id, farm_type")
          .eq("status", "in_progress")
          .not("expected_birth_month", "is", null)
          .gte("expected_birth_month", todayIso)
          .lte("expected_birth_month", next30DaysIso)
          .in("store_id", storeIds)
          .order("expected_birth_month", { ascending: true }),
        supabase
          .from("accounts_payable")
          .select("id, amount, due_date, payment_date, status, supplier_id, accounts_payable_installments(id, amount, due_date, payment_date, status), accounts_payable_items(id)")
          .in("store_id", storeIds),
        supabase
          .from("accounts_receivable")
          .select("id, amount, due_date, payment_date, status, creditor_id, accounts_receivable_installments(id, amount, due_date, payment_date), accounts_receivable_items(id)")
          .in("store_id", storeIds),
      ]);

      const pregnanciesRaw = (pregnanciesRes.data || []) as Array<{
        id: string;
        name: string;
        expected_birth_month: string | null;
        farm_id: string | null;
        farm_type: string | null;
      }>;

      const ownFarmIds = Array.from(
        new Set(
          pregnanciesRaw
            .filter((item) => item.farm_type === "own")
            .map((item) => item.farm_id)
            .filter(Boolean),
        ),
      ) as string[];
      const thirdFarmIds = Array.from(
        new Set(
          pregnanciesRaw
            .filter((item) => item.farm_type === "third_party")
            .map((item) => item.farm_id)
            .filter(Boolean),
        ),
      ) as string[];

      const [ownFarmsRes, thirdFarmsRes] = await Promise.all([
        ownFarmIds.length > 0
          ? supabase.from("stores").select("id, name").in("id", ownFarmIds)
          : Promise.resolve({ data: [] as any[] }),
        thirdFarmIds.length > 0
          ? supabase.from("third_party_farms").select("id, name").in("id", thirdFarmIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const ownFarmMap = new Map((ownFarmsRes.data || []).map((farm: any) => [farm.id, farm.name]));
      const thirdFarmMap = new Map((thirdFarmsRes.data || []).map((farm: any) => [farm.id, farm.name]));

      const pregnancies = pregnanciesRaw.map((item) => ({
        id: item.id,
        name: item.name,
        expected_birth_month: item.expected_birth_month,
        farm_name:
          item.farm_type === "third_party"
            ? thirdFarmMap.get(item.farm_id || "") || "-"
            : ownFarmMap.get(item.farm_id || "") || "-",
      })) as AttentionPregnancyItem[];

      const payableAccounts = (payablesRes.data || []) as Array<
        PayableFinancialAccountSummary & {
          supplier_id?: string | null;
          accounts_payable_items?: Array<{ id: string }>;
          accounts_payable_installments?: Array<{
            id: string;
            amount: number | string | null;
            due_date: string | null;
            payment_date: string | null;
            status?: string | null;
          }>;
        }
      >;

      const receivableAccounts = (receivablesRes.data || []) as Array<
        ReceivableFinancialAccountSummary & {
          creditor_id?: string | null;
          accounts_receivable_items?: Array<{ id: string }>;
          accounts_receivable_installments?: Array<{
            id: string;
            amount: number | string | null;
            due_date: string | null;
            payment_date: string | null;
          }>;
        }
      >;

      const [payableAllocationMap, receivableAllocationMap] = await Promise.all([
        buildAccountAllocationMap(
          "accounts_payable_item_allocations",
          "account_payable_item_id",
          payableAccounts.map((account) => ({
            account_id: account.id,
            item_ids: (account.accounts_payable_items || []).map((item) => item.id),
          })),
        ),
        buildAccountAllocationMap(
          "accounts_receivable_item_allocations",
          "account_receivable_item_id",
          receivableAccounts.map((account) => ({
            account_id: account.id,
            item_ids: (account.accounts_receivable_items || []).map((item) => item.id),
          })),
        ),
      ]);

      const supplierIds = Array.from(
        new Set(payableAccounts.map((account) => account.supplier_id).filter(Boolean)),
      ) as string[];
      const creditorIds = Array.from(
        new Set(receivableAccounts.map((account) => account.creditor_id).filter(Boolean)),
      ) as string[];

      const [suppliersRes, creditorsRes] = await Promise.all([
        supplierIds.length > 0
          ? supabase.from("suppliers").select("id, name").in("id", supplierIds)
          : Promise.resolve({ data: [] as any[] }),
        creditorIds.length > 0
          ? supabase.from("suppliers").select("id, name").in("id", creditorIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const supplierMap = new Map((suppliersRes.data || []).map((supplier: any) => [supplier.id, supplier.name]));
      const creditorMap = new Map((creditorsRes.data || []).map((creditor: any) => [creditor.id, creditor.name]));

      const payables = payableAccounts
        .flatMap((account) => {
          const baseItem = {
            partner_name: supplierMap.get(account.supplier_id || "") || "-",
            allocation_names: payableAllocationMap.get(account.id) || [],
          };

          if ((account.accounts_payable_installments || []).length > 0) {
            return (account.accounts_payable_installments || [])
              .filter((installment) => {
                const dueDate = parseDate(installment.due_date);
                return (
                  dueDate &&
                  dueDate >= today &&
                  dueDate <= weekEnd &&
                  !installment.payment_date &&
                  installment.status !== "paid" &&
                  installment.status !== "pagamento_suspenso"
                );
              })
              .map((installment) => ({
                id: `${account.id}-${installment.id}`,
                partner_name: baseItem.partner_name,
                allocation_names: baseItem.allocation_names,
                due_date: installment.due_date,
                amount: Number(installment.amount || 0),
              }));
          }

          const dueDate = parseDate(account.due_date);
          if (
            dueDate &&
            dueDate >= today &&
            dueDate <= weekEnd &&
            !account.payment_date &&
            account.status !== "paid" &&
            account.status !== "pagamento_suspenso"
          ) {
            return [{
              id: account.id,
              partner_name: baseItem.partner_name,
              allocation_names: baseItem.allocation_names,
              due_date: account.due_date,
              amount: Number(account.amount || 0),
            }];
          }

          return [];
        })
        .sort((a, b) => (parseDate(a.due_date)?.getTime() || 0) - (parseDate(b.due_date)?.getTime() || 0)) as AttentionFinancialItem[];

      const receivables = receivableAccounts
        .flatMap((account) => {
          const baseItem = {
            partner_name: creditorMap.get(account.creditor_id || "") || "-",
            allocation_names: receivableAllocationMap.get(account.id) || [],
          };

          if ((account.accounts_receivable_installments || []).length > 0) {
            return (account.accounts_receivable_installments || [])
              .filter((installment) => {
                const dueDate = parseDate(installment.due_date);
                return dueDate && dueDate >= today && dueDate <= weekEnd && !installment.payment_date;
              })
              .map((installment) => ({
                id: `${account.id}-${installment.id}`,
                partner_name: baseItem.partner_name,
                allocation_names: baseItem.allocation_names,
                due_date: installment.due_date,
                amount: Number(installment.amount || 0),
              }));
          }

          const dueDate = parseDate(account.due_date);
          if (dueDate && dueDate >= today && dueDate <= weekEnd && !account.payment_date && account.status !== "paid") {
            return [{
              id: account.id,
              partner_name: baseItem.partner_name,
              allocation_names: baseItem.allocation_names,
              due_date: account.due_date,
              amount: Number(account.amount || 0),
            }];
          }

          return [];
        })
        .sort((a, b) => (parseDate(a.due_date)?.getTime() || 0) - (parseDate(b.due_date)?.getTime() || 0)) as AttentionFinancialItem[];

      return {
        pregnancies,
        payables,
        receivables,
        totalPayablesWeek: payables.reduce((sum, entry) => sum + entry.amount, 0),
        totalReceivablesWeek: receivables.reduce((sum, entry) => sum + entry.amount, 0),
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: financialSnapshot, isLoading: financialLoading } = useQuery({
    queryKey: ["dashboard-financial-snapshot", userId, storeIds],
    enabled: storeIds.length > 0,
    queryFn: async () => {
      const today = startOfToday();
      const monthEnd = endOfMonth(today);
      const trendStart = startOfMonth(addMonths(today, -5));

      const [
        payablesRes,
        receivablesRes,
      ] = await Promise.all([
        supabase
          .from("accounts_payable")
          .select("id, amount, due_date, payment_date, status, accounts_payable_installments(amount, due_date, payment_date, status)")
          .in("store_id", storeIds),
        supabase
          .from("accounts_receivable")
          .select("id, amount, due_date, payment_date, status, accounts_receivable_installments(amount, due_date, payment_date)")
          .in("store_id", storeIds)
      ]);

      const payables = buildPayableEntries((payablesRes.data || []) as PayableFinancialAccountSummary[]);
      const receivables = buildReceivableEntries((receivablesRes.data || []) as ReceivableFinancialAccountSummary[]);

      const months = Array.from({ length: 6 }, (_, index) => startOfMonth(addMonths(today, index - 5)));
      const trendMap = new Map(
        months.map((month) => [
          format(month, "yyyy-MM"),
          {
            name: `${MONTHS_SHORT[month.getMonth()]}/${String(month.getFullYear()).slice(2)}`,
            custo: 0,
            receita: 0,
          },
        ]),
      );

      payables.forEach((entry) => {
        if (!entry.dueDate || entry.status === "pagamento_suspenso") return;
        if (entry.dueDate < trendStart || entry.dueDate > monthEnd) return;
        const key = format(entry.dueDate, "yyyy-MM");
        const bucket = trendMap.get(key);
        if (!bucket) return;
        bucket.custo += entry.amount;
      });

      receivables.forEach((entry) => {
        if (!entry.dueDate) return;
        if (entry.dueDate < trendStart || entry.dueDate > monthEnd) return;
        const key = format(entry.dueDate, "yyyy-MM");
        const bucket = trendMap.get(key);
        if (!bucket) return;
        bucket.receita += entry.amount;
      });

      const totalPayableMonth = payables.reduce(
        (sum, entry) =>
          isSameMonth(entry.dueDate, today) &&
          !entry.paymentDate &&
          entry.status !== "paid" &&
          entry.status !== "pagamento_suspenso"
            ? sum + entry.amount
            : sum,
        0,
      );
      const totalReceivableMonth = receivables.reduce(
        (sum, entry) =>
          isSameMonth(entry.dueDate, today) &&
          !entry.paymentDate &&
          entry.status !== "paid"
            ? sum + entry.amount
            : sum,
        0,
      );
      const costMonth = payables.reduce(
        (sum, entry) =>
          isSameMonth(entry.dueDate, today) && entry.status !== "pagamento_suspenso"
            ? sum + entry.amount
            : sum,
        0,
      );
      const revenueMonth = receivables.reduce(
        (sum, entry) => (isSameMonth(entry.dueDate, today) ? sum + entry.amount : sum),
        0,
      );

      return {
        totalPayableMonth,
        totalReceivableMonth,
        costMonth,
        revenueMonth,
        resultMonth: revenueMonth - costMonth,
        trend: Array.from(trendMap.values()).map((item) => ({
          ...item,
          resultado: item.receita - item.custo,
        })),
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ["dashboard-analytics", userId, matrixId, storeId, storeIds, recipientCategoryIds],
    enabled: storeIds.length > 0,
    queryFn: async () => {
      const [farmTypeRes, birthsRes, categoriesRes] = await Promise.all([
        supabase
          .from("animals")
          .select("farm_type, category_id")
          .eq("is_active", true)
          .in("store_id", storeIds),
        supabase
          .from("animals")
          .select("birth_date")
          .not("pregnancy_id", "is", null)
          .not("birth_date", "is", null)
          .in("store_id", storeIds),
        supabase
          .from("animal_categories")
          .select("id, name, matrix_id, store_id")
          .eq("is_active", true)
          .order("name"),
      ]);

      let filteredCategories = categoriesRes.data || [];
      if (matrixId) {
        filteredCategories = filteredCategories.filter((category: any) => category.matrix_id === matrixId);
      } else if (storeId) {
        filteredCategories = filteredCategories.filter((category: any) => category.store_id === storeId);
      } else if (storeIds.length > 0) {
        filteredCategories = filteredCategories.filter((category: any) => storeIds.includes(category.store_id));
      }

      const farmAnimals = (farmTypeRes.data || []).filter((animal) => {
        if (recipientCategoryIds.length === 0) return true;
        return !animal.category_id || !recipientCategoryIds.includes(animal.category_id);
      });

      let own = 0;
      let thirdParty = 0;
      farmAnimals.forEach((animal) => {
        if (animal.farm_type === "third_party") thirdParty += 1;
        else own += 1;
      });

      const monthCounts: Record<string, number> = {};
      (birthsRes.data || []).forEach((animal) => {
        if (!animal.birth_date) return;
        const key = animal.birth_date.substring(0, 7);
        monthCounts[key] = (monthCounts[key] || 0) + 1;
      });

      const birthsPerMonth = Array.from({ length: 12 }, (_, index) => {
        const monthDate = new Date();
        monthDate.setMonth(monthDate.getMonth() - (11 - index), 1);
        const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
        return {
          name: `${MONTHS_SHORT[monthDate.getMonth()]}/${String(monthDate.getFullYear()).slice(2)}`,
          nascimentos: monthCounts[key] || 0,
        };
      });

      const categories = filteredCategories;
      const categoryIds = categories.map((category) => category.id);
      const { data: animalsByCategory } =
        categoryIds.length > 0
          ? await supabase
              .from("animals")
              .select("category_id")
              .eq("is_active", true)
              .in("store_id", storeIds)
              .in("category_id", categoryIds)
          : { data: [] as Array<{ category_id: string | null }> };

      const countsByCategory = new Map<string, number>();
      (animalsByCategory || []).forEach((animal) => {
        if (!animal.category_id) return;
        countsByCategory.set(animal.category_id, (countsByCategory.get(animal.category_id) || 0) + 1);
      });

      return {
        farmTypeData: [
          { name: "Fazenda Própria", value: own },
          { name: "Fazenda Terceira", value: thirdParty },
        ],
        birthsPerMonth,
        categoryDistribution: categories.map((category) => ({
          name: category.name,
          quantidade: countsByCategory.get(category.id) || 0,
        })),
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const summaryCards = [
    {
      title: "Animais",
      value: executiveSummary?.animals || 0,
      description: "Animais ativos na operação",
      icon: Beef,
      accent: "border-emerald-200 bg-emerald-50/70",
      route: "/animais/cadastro",
    },
    {
      title: "Receptoras",
      value: executiveSummary?.recipients || 0,
      description: "Base exclusiva de receptoras",
      icon: Users,
      accent: "border-cyan-200 bg-cyan-50/70",
      route: "/animais/receptoras",
    },
    {
      title: "Prenhez em andamento",
      value: executiveSummary?.pregnancies || 0,
      description: "Gestações ativas acompanhadas",
      icon: Baby,
      accent: "border-sky-200 bg-sky-50/70",
      route: "/animais/prenhez",
    },
    {
      title: "Pós-transferência aguardando validação",
      value: executiveSummary?.awaitingValidation || 0,
      description: "Registros em andamento no pós-TE",
      icon: Dna,
      accent: "border-violet-200 bg-violet-50/70",
      route: "/animais/transferencia-embriao",
    },
    {
      title: "Próximos nascimentos",
      value: executiveSummary?.upcomingBirths || 0,
      description: executiveSummary?.nearestBirth
        ? `Mais próximo: ${executiveSummary.nearestBirth.name} em ${formatDateBR(executiveSummary.nearestBirth.expected_birth_month)}`
        : "Partos previstos nos próximos 30 dias",
      icon: CalendarDays,
      accent: "border-amber-200 bg-amber-50/70",
      route: "/animais/prenhez",
    },
  ];

  const quickActions = [
    { title: "Novo Animal", description: "Abrir cadastro de animais", route: "/animais/cadastro", icon: Beef },
    { title: "Nova Receptora", description: "Abrir módulo de receptoras", route: "/animais/receptoras", icon: Users },
    { title: "Nova Prenhez", description: "Registrar nova prenhez", route: "/animais/prenhez", icon: Baby },
    { title: "Nova Aspiração", description: "Registrar nova aspiração", route: "/animais/aspiracoes", icon: Plus },
    {
      title: "Novo Contas a Pagar",
      description: "Abrir Financeiro > Contas a Pagar",
      icon: CreditCard,
      onClick: () => window.dispatchEvent(new CustomEvent("dashboard-open-accounts-payable")),
    },
    {
      title: "Novo Contas a Receber",
      description: "Abrir Financeiro > Contas a Receber",
      icon: HandCoins,
      onClick: () => window.dispatchEvent(new CustomEvent("dashboard-open-accounts-receivable")),
    },
  ];

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <SectionHeader
          title="Resumo Geral"
          description="Leitura rápida da operação para começar o dia com visão clara do negócio."
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {summaryCards.map((card) => (
            <SummaryCard key={card.title} {...card} loading={executiveSummaryLoading} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Atenção Imediata"
          description="Itens que exigem acompanhamento agora, com acesso direto para a listagem correspondente."
        />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <AttentionCard
            title="Prenhezes próximas do parto"
            count={attentionLoading ? 0 : attentionData?.pregnancies.length || 0}
            description={
              attentionLoading
                ? "Carregando alertas..."
                : attentionData?.pregnancies[0]
                  ? `Próximo parto previsto em ${formatDateBR(attentionData.pregnancies[0].expected_birth_month)}`
                  : "Nenhuma prenhez prevista para os próximos 30 dias"
            }
            onClick={() => setAttentionModal("pregnancies")}
          />
          <AttentionCard
            title="Contas a pagar vencendo na semana"
            count={attentionLoading ? 0 : attentionData?.payables.length || 0}
            description={
              attentionLoading
                ? "Carregando compromissos..."
                : attentionData?.payables[0]
                  ? `Primeiro vencimento em ${formatDateBR(attentionData.payables[0].due_date)}`
                  : "Nenhum vencimento pendente nesta semana"
            }
            amount={attentionData?.totalPayablesWeek}
            onClick={() => setAttentionModal("payables")}
          />
          <AttentionCard
            title="Contas a receber da semana"
            count={attentionLoading ? 0 : attentionData?.receivables.length || 0}
            description={
              attentionLoading
                ? "Carregando recebimentos..."
                : attentionData?.receivables[0]
                  ? `Primeiro recebimento em ${formatDateBR(attentionData.receivables[0].due_date)}`
                  : "Nenhum recebimento previsto nesta semana"
            }
            amount={attentionData?.totalReceivablesWeek}
            onClick={() => setAttentionModal("receivables")}
          />
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Bloco Financeiro"
          description="Visão executiva do mês para leitura rápida de compromisso, entrada e resultado."
        />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Card className="border-slate-200 bg-slate-950 text-white shadow-sm xl:col-span-4">
            <CardContent className="flex h-full flex-col justify-between p-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-300">Resultado do mês</p>
                <p className="text-4xl font-semibold tracking-tight">
                  {financialLoading ? "..." : formatCurrencyBR(financialSnapshot?.resultMonth || 0)}
                </p>
                <p className="text-sm text-slate-300">
                  {financialLoading
                    ? "Apurando desempenho financeiro..."
                    : (financialSnapshot?.resultMonth || 0) >= 0
                      ? "Receita do mês acima dos custos realizados."
                      : "Custos do mês acima da receita realizada."}
                </p>
              </div>
              <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                <span className="text-slate-300">Visão consolidada do mês atual</span>
                {(financialSnapshot?.resultMonth || 0) >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-emerald-300" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-rose-300" />
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:col-span-8">
            <FinanceMetricCard
              title="Total a pagar no mês"
              value={financialSnapshot?.totalPayableMonth || 0}
              description="Compromissos pendentes com vencimento no mês"
              icon={CreditCard}
              tone="danger"
            />
            <FinanceMetricCard
              title="Total a receber no mês"
              value={financialSnapshot?.totalReceivableMonth || 0}
              description="Recebimentos pendentes previstos no mês"
              icon={HandCoins}
              tone="success"
            />
            <FinanceMetricCard
              title="Custo total do mês"
              value={financialSnapshot?.costMonth || 0}
              description="Saídas realizadas com pagamento no mês"
              icon={Landmark}
              tone="neutral"
            />
            <FinanceMetricCard
              title="Receita total do mês"
              value={financialSnapshot?.revenueMonth || 0}
              description="Entradas realizadas com recebimento no mês"
              icon={CircleDollarSign}
              tone="neutral"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Análises"
          description="Leituras visuais de apoio, posicionadas em segundo plano para complementar a operação."
        />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <Card className="xl:col-span-7">
            <CardHeader>
              <CardTitle className="text-lg">Custo x Receita nos últimos 6 meses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                {financialLoading ? (
                  <div className="flex h-full items-center justify-center text-muted-foreground">Carregando...</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={financialSnapshot?.trend || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip
                        formatter={(value: number) => formatCurrencyBR(Number(value || 0))}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "12px",
                        }}
                      />
                      <Legend />
                      <Bar dataKey="receita" name="Receita" fill="hsl(142, 72%, 38%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="custo" name="Custo" fill="hsl(12, 76%, 58%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="xl:col-span-5">
            <CardHeader>
              <CardTitle className="text-lg">Animais por tipo de fazenda</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                {analyticsLoading ? (
                  <div className="flex h-full items-center justify-center text-muted-foreground">Carregando...</div>
                ) : analyticsData?.farmTypeData.every((item) => item.value === 0) ? (
                  <div className="flex h-full items-center justify-center text-muted-foreground">Sem dados</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analyticsData?.farmTypeData || []}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={4}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {(analyticsData?.farmTypeData || []).map((_, index) => (
                          <Cell key={`farm-type-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => `${value} animais`}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "12px",
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="xl:col-span-6">
            <CardHeader>
              <CardTitle className="text-lg">Nascimentos por mês</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                {analyticsLoading ? (
                  <div className="flex h-full items-center justify-center text-muted-foreground">Carregando...</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData?.birthsPerMonth || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip
                        formatter={(value: number) => `${value} nascimento(s)`}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "12px",
                        }}
                      />
                      <Bar dataKey="nascimentos" name="Nascimentos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="xl:col-span-6">
            <CardHeader>
              <CardTitle className="text-lg">Distribuição por categoria</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                {analyticsLoading ? (
                  <div className="flex h-full items-center justify-center text-muted-foreground">Carregando...</div>
                ) : !analyticsData?.categoryDistribution.some((item) => item.quantidade > 0) ? (
                  <div className="flex h-full items-center justify-center text-muted-foreground">Sem categorias em destaque</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData?.categoryDistribution || []} layout="vertical" margin={{ left: 12, right: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                      <XAxis type="number" allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={110}
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(value: number) => `${value} animais`}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "12px",
                        }}
                      />
                      <Bar dataKey="quantidade" name="Animais" fill="hsl(210, 86%, 54%)" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Acessos Rápidos"
          description="Entradas diretas para as ações mais usadas no dia a dia."
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {quickActions.map((action) => (
            <QuickActionCard key={action.title} {...action} />
          ))}
        </div>
      </section>

      <Dialog open={attentionModal !== null} onOpenChange={(open) => !open && setAttentionModal(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {attentionModal === "pregnancies" && "Prenhezes próximas do parto"}
              {attentionModal === "payables" && "Contas a pagar vencendo na semana"}
              {attentionModal === "receivables" && "Contas a receber vencendo na semana"}
            </DialogTitle>
          </DialogHeader>

          {attentionModal === "pregnancies" && (
            <div className="max-h-[70vh] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Data prevista</TableHead>
                    <TableHead>Fazenda</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(attentionData?.pregnancies || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                        Nenhuma prenhez prevista para os próximos 30 dias.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (attentionData?.pregnancies || []).map((item: AttentionPregnancyItem) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{formatDateBR(item.expected_birth_month)}</TableCell>
                        <TableCell>{item.farm_name}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {(attentionModal === "payables" || attentionModal === "receivables") && (
            <div className="max-h-[70vh] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Valor da parcela</TableHead>
                    <TableHead>Vínculo</TableHead>
                    <TableHead>Data de vencimento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((attentionModal === "payables" ? attentionData?.payables : attentionData?.receivables) || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        {attentionModal === "payables"
                          ? "Nenhuma conta a pagar vencendo nesta semana."
                          : "Nenhuma conta a receber vencendo nesta semana."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    ((attentionModal === "payables" ? attentionData?.payables : attentionData?.receivables) || []).map(
                      (item: AttentionFinancialItem) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.partner_name}</TableCell>
                          <TableCell>{formatCurrencyBR(item.amount)}</TableCell>
                          <TableCell className="whitespace-pre-line">
                            {item.allocation_names.length > 0 ? item.allocation_names.join("\n") : "-"}
                          </TableCell>
                          <TableCell>{formatDateBR(item.due_date)}</TableCell>
                        </TableRow>
                      ),
                    )
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DashboardIndicators;
