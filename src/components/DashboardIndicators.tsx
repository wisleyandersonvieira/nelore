import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bug, Baby, Calendar, Users, Landmark, Home, Clock } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface DashboardIndicatorsProps {
  userId?: string;
}

const DashboardIndicators = ({ userId }: DashboardIndicatorsProps) => {
  // Get user store IDs - only stores linked via user_stores (respects matrix isolation)
  const { data: storeIds = [] } = useQuery({
    queryKey: ['dashboard-store-ids', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      // Get user's matrix_id for additional filtering
      const { data: profile } = await supabase
        .from("profiles")
        .select("store_id, matrix_id")
        .eq("id", user.id)
        .single();
      
      const matrixId = profile?.matrix_id;
      
      // Get stores from user_stores
      const { data: userStores } = await supabase
        .from("user_stores")
        .select("store_id")
        .eq("user_id", user.id);
      
      const ids = new Set<string>();
      
      // Add profile store_id only if it belongs to the user's matrix
      if (profile?.store_id && matrixId) {
        const { data: profileStore } = await supabase
          .from("stores")
          .select("id")
          .eq("id", profile.store_id)
          .eq("matrix_id", matrixId)
          .maybeSingle();
        if (profileStore) ids.add(profileStore.id);
      }
      
      // Add user_stores entries, filtering by matrix
      if (userStores && matrixId) {
        // Verify each store belongs to user's matrix
        const storeIdsFromUser = userStores.map(us => us.store_id);
        if (storeIdsFromUser.length > 0) {
          const { data: validStores } = await supabase
            .from("stores")
            .select("id")
            .in("id", storeIdsFromUser)
            .eq("matrix_id", matrixId);
          validStores?.forEach(s => ids.add(s.id));
        }
      } else if (userStores) {
        userStores.forEach(us => ids.add(us.store_id));
      }
      
      return Array.from(ids);
    },
    staleTime: 10 * 60 * 1000,
  });

  // 1. Active animals count
  const { data: activeAnimalsCount = 0, isLoading: animalsLoading } = useQuery({
    queryKey: ['dashboard-active-animals', userId, storeIds],
    queryFn: async () => {
      if (storeIds.length === 0) return 0;
      const { count } = await supabase
        .from("animals")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .in("store_id", storeIds);
      return count || 0;
    },
    enabled: storeIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // 2. Pregnancies in progress count
  const { data: pregnancyInProgressCount = 0, isLoading: pregnancyCountLoading } = useQuery({
    queryKey: ['dashboard-pregnancy-in-progress', userId, storeIds],
    queryFn: async () => {
      if (storeIds.length === 0) return 0;
      const { count } = await supabase
        .from("pregnancy_management")
        .select("id", { count: "exact", head: true })
        .eq("status", "in_progress")
        .in("store_id", storeIds);
      return count || 0;
    },
    enabled: storeIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // 2b. Embryo transfers awaiting pregnancy validation
  const { data: awaitingValidationCount = 0, isLoading: awaitingValidationLoading } = useQuery({
    queryKey: ['dashboard-awaiting-validation', userId, storeIds],
    queryFn: async () => {
      if (storeIds.length === 0) return 0;
      const { count } = await supabase
        .from("embryo_transfer_management")
        .select("id", { count: "exact", head: true })
        .eq("status", "in_progress")
        .in("store_id", storeIds);
      return count || 0;
    },
    enabled: storeIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // 3. Next 3 upcoming births
  const { data: upcomingBirths = [], isLoading: birthsLoading } = useQuery({
    queryKey: ['dashboard-upcoming-births', userId, storeIds],
    queryFn: async () => {
      if (storeIds.length === 0) return [];
      const { data } = await supabase
        .from("pregnancy_management")
        .select("id, name, expected_birth_month")
        .eq("status", "in_progress")
        .not("expected_birth_month", "is", null)
        .in("store_id", storeIds)
        .order("expected_birth_month", { ascending: true })
        .limit(3);
      return data || [];
    },
    enabled: storeIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // 4. Employees count (keep existing)
  const { data: employeesData, isLoading: employeesLoading } = useQuery({
    queryKey: ['dashboard-employees', userId, storeIds],
    queryFn: async () => {
      if (storeIds.length === 0) return { active: 0, unregistered: 0 };
      const [activeResult, unregisteredResult] = await Promise.all([
        supabase.from("employees").select("id", { count: "exact" }).eq("is_active", true).is("dismissal_date", null).in("store_id", storeIds),
        supabase.from("employees").select("id", { count: "exact" }).eq("is_active", true).eq("is_registered", false).is("dismissal_date", null).in("store_id", storeIds)
      ]);
      return { active: activeResult.count || 0, unregistered: unregisteredResult.count || 0 };
    },
    enabled: storeIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // 6. Animals by farm type (own vs third-party)
  const { data: farmTypeData = [], isLoading: farmTypeLoading } = useQuery({
    queryKey: ['dashboard-farm-type', userId, storeIds],
    queryFn: async () => {
      if (storeIds.length === 0) return [];
      const { data } = await supabase
        .from("animals")
        .select("farm_type")
        .eq("is_active", true)
        .in("store_id", storeIds);
      if (!data) return [];
      let own = 0;
      let thirdParty = 0;
      data.forEach(a => {
        if (a.farm_type === 'third_party') thirdParty++;
        else own++;
      });
      return [
        { name: "Fazenda Própria", value: own },
        { name: "Fazenda Terceira", value: thirdParty },
      ];
    },
    enabled: storeIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // 7. Births per month (animals born from pregnancies)
  const { data: birthsPerMonth = [], isLoading: birthsChartLoading } = useQuery({
    queryKey: ['dashboard-births-per-month', storeIds],
    queryFn: async () => {
      if (storeIds.length === 0) return [];
      const { data } = await supabase
        .from("animals")
        .select("birth_date")
        .not("pregnancy_id", "is", null)
        .not("birth_date", "is", null)
        .in("store_id", storeIds);
      if (!data) return [];
      const monthCounts: { [key: string]: number } = {};
      data.forEach(a => {
        if (a.birth_date) {
          const month = a.birth_date.substring(0, 7); // YYYY-MM
          monthCounts[month] = (monthCounts[month] || 0) + 1;
        }
      });
      // Get last 12 months
      const result: { name: string; nascimentos: number }[] = [];
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        result.push({
          name: `${MONTHS_SHORT[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
          nascimentos: monthCounts[key] || 0,
        });
      }
      return result;
    },
    enabled: storeIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const loading = animalsLoading || pregnancyCountLoading || birthsLoading || employeesLoading || awaitingValidationLoading;

  const PIE_COLORS = ["hsl(142, 76%, 36%)", "hsl(24, 100%, 50%)"];

  return (
    <div className="space-y-6">
      {/* Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Active Employees */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Funcionários Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : employeesData?.active || 0}</div>
            {!loading && (employeesData?.unregistered || 0) > 0 && (
              <p className="text-xs text-muted-foreground mt-1">{employeesData?.unregistered} sem registro</p>
            )}
          </CardContent>
        </Card>

        {/* Active Animals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Animais</CardTitle>
            <Bug className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : activeAnimalsCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Animais ativos cadastrados</p>
          </CardContent>
        </Card>

        {/* Pregnancy in Progress */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Prenhez em Andamento</CardTitle>
            <Baby className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : pregnancyInProgressCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Gestações em andamento</p>
          </CardContent>
        </Card>

        {/* Upcoming Births */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Próximos Nascimentos</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-2xl font-bold">...</div>
            ) : upcomingBirths.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum nascimento previsto</p>
            ) : (
              <div className="space-y-1.5">
                {upcomingBirths.map((birth) => (
                  <div key={birth.id} className="flex justify-between items-center text-sm">
                    <span className="truncate font-medium">{birth.name}</span>
                    <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">{birth.expected_birth_month || "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Awaiting Pregnancy Validation */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Aguardando Validação</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : awaitingValidationCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Pós transferência em andamento</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart - Animals by Farm Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Animais por Tipo de Fazenda</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {farmTypeLoading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">Carregando...</div>
              ) : farmTypeData.every(d => d.value === 0) ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">Sem dados</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={farmTypeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {farmTypeData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bar Chart - Births per Month */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Nascimentos por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {birthsChartLoading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">Carregando...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={birthsPerMonth}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="name"
                      className="text-xs"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    />
                    <YAxis
                      className="text-xs"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }}
                    />
                    <Bar dataKey="nascimentos" name="Nascimentos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardIndicators;
