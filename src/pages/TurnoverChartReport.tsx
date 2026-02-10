import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, LineChart, X, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";

interface Store {
  id: string;
  name: string;
  code: string;
}

interface ChartDataPoint {
  month: string;
  monthLabel: string;
  [key: string]: number | string;
}

interface DailyChartDataPoint {
  date: string;
  dateLabel: string;
  [key: string]: number | string;
}

const COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#3b82f6",
  "#ec4899",
  "#f97316",
  "#14b8a6",
  "#ef4444",
];

const TurnoverChartReport = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [chartConfig, setChartConfig] = useState<Record<string, { label: string; color: string }>>({});
  const [lineKeys, setLineKeys] = useState<string[]>([]);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [chartType, setChartType] = useState<'monthly' | 'accumulated' | 'daily'>('monthly');
  const chartRef = useRef<HTMLDivElement>(null);
  
  // Daily chart states
  const [dailyChartData, setDailyChartData] = useState<DailyChartDataPoint[]>([]);
  const [dailyChartConfig, setDailyChartConfig] = useState<Record<string, { label: string; color: string }>>({});
  const [dailyLineKeys, setDailyLineKeys] = useState<string[]>([]);

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('role, store_id')
          .eq('id', user.id)
          .single();

        if (profile?.role === 'admin') {
          const { data, error } = await supabase
            .from('stores')
            .select('id, name, code')
            .order('name');

          if (error) throw error;
          setStores(data || []);
        } else {
          const storeIds: string[] = [];
          if (profile?.store_id) storeIds.push(profile.store_id);
          
          const { data: userStores } = await supabase
            .from('user_stores')
            .select('store_id')
            .eq('user_id', user.id);
          
          userStores?.forEach((us: { store_id: string }) => {
            if (!storeIds.includes(us.store_id)) storeIds.push(us.store_id);
          });

          if (storeIds.length > 0) {
            const { data, error } = await supabase
              .from('stores')
              .select('id, name, code')
              .in('id', storeIds)
              .order('name');

            if (error) throw error;
            setStores(data || []);
          }
        }
      } catch (error) {
        console.error('Erro ao buscar lojas:', error);
        toast({
          title: "Erro",
          description: "Erro ao carregar lojas",
          variant: "destructive",
        });
      }
    };

    fetchStores();
  }, [toast]);

  const handleStoreToggle = (storeId: string) => {
    setSelectedStores(prev => 
      prev.includes(storeId) 
        ? prev.filter(id => id !== storeId)
        : [...prev, storeId]
    );
  };

  const removeStore = (storeId: string) => {
    setSelectedStores(prev => prev.filter(id => id !== storeId));
  };

  const generateDailyReport = async () => {
    if (selectedStores.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos uma loja",
        variant: "destructive",
      });
      return;
    }

    if (!startDate || !endDate) {
      toast({
        title: "Erro",
        description: "Selecione data inicial e final",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setChartType('daily');
    
    try {
      const { data, error } = await supabase
        .from('cash_control')
        .select(`
          date,
          store_id,
          faturamento_total
        `)
        .in('store_id', selectedStores)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date');

      if (error) throw error;

      // Group by date with store as line keys
      const dailyData: Record<string, Record<string, number>> = {};

      (data || []).forEach(item => {
        const dateKey = item.date;
        const store = stores.find(s => s.id === item.store_id);
        if (!store) return;

        const lineKey = store.code;

        if (!dailyData[dateKey]) {
          dailyData[dateKey] = {};
        }

        if (!dailyData[dateKey][lineKey]) {
          dailyData[dateKey][lineKey] = 0;
        }

        dailyData[dateKey][lineKey] += item.faturamento_total || 0;
      });

      // Sort dates
      const sortedDates = Object.keys(dailyData).sort();
      
      const allLineKeys = new Set<string>();
      Object.values(dailyData).forEach(dateData => {
        Object.keys(dateData).forEach(key => allLineKeys.add(key));
      });
      
      const lineKeysArray = Array.from(allLineKeys).sort();
      setDailyLineKeys(lineKeysArray);

      const config: Record<string, { label: string; color: string }> = {};
      lineKeysArray.forEach((key, index) => {
        const store = stores.find(s => s.code === key);
        const label = store?.name || key;
        
        config[key] = {
          label,
          color: COLORS[index % COLORS.length]
        };
      });
      setDailyChartConfig(config);

      const chartDataArray: DailyChartDataPoint[] = sortedDates.map(dateKey => {
        const dateLabel = format(parseISO(dateKey), 'dd/MM', { locale: ptBR });
        
        const dataPoint: DailyChartDataPoint = {
          date: dateKey,
          dateLabel
        };

        lineKeysArray.forEach(lineKey => {
          dataPoint[lineKey] = dailyData[dateKey]?.[lineKey] || 0;
        });

        return dataPoint;
      });

      setDailyChartData(chartDataArray);
      // Clear monthly chart data when generating daily
      setChartData([]);
    } catch (error) {
      console.error('Erro ao gerar relatório diário:', error);
      toast({
        title: "Erro",
        description: "Erro ao gerar relatório diário",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async (type: 'monthly' | 'accumulated') => {
    if (selectedStores.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos uma loja",
        variant: "destructive",
      });
      return;
    }

    if (!startDate || !endDate) {
      toast({
        title: "Erro",
        description: "Selecione data inicial e final",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setChartType(type);
    // Clear daily chart data when generating monthly
    setDailyChartData([]);
    
    try {
      // Use the filtered dates for both chart types
      const { data, error } = await supabase
        .from('cash_control')
        .select(`
          date,
          store_id,
          faturamento_total
        `)
        .in('store_id', selectedStores)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date');

      if (error) throw error;

      // Group by month number (1-12) with store+year as line keys
      const monthlyData: Record<number, Record<string, number>> = {};
      const yearsInData = new Set<number>();

      (data || []).forEach(item => {
        const date = parseISO(item.date);
        const year = date.getFullYear();
        const month = date.getMonth() + 1; // 1-12
        yearsInData.add(year);
        
        const store = stores.find(s => s.id === item.store_id);
        if (!store) return;

        // Line key is always store_year to differentiate years
        const lineKey = `${store.code}_${year}`;

        if (!monthlyData[month]) {
          monthlyData[month] = {};
        }

        if (!monthlyData[month][lineKey]) {
          monthlyData[month][lineKey] = 0;
        }

        monthlyData[month][lineKey] += item.faturamento_total || 0;
      });

      // Sort months 1-12
      const sortedMonths = Object.keys(monthlyData).map(Number).sort((a, b) => a - b);
      
      const allLineKeys = new Set<string>();
      Object.values(monthlyData).forEach(monthData => {
        Object.keys(monthData).forEach(key => allLineKeys.add(key));
      });
      
      const lineKeysArray = Array.from(allLineKeys).sort();
      setLineKeys(lineKeysArray);

      const config: Record<string, { label: string; color: string }> = {};
      lineKeysArray.forEach((key, index) => {
        const [storeCode, year] = key.split('_');
        const store = stores.find(s => s.code === storeCode);
        const label = `${store?.name || storeCode} (${year})`;
        
        config[key] = {
          label,
          color: COLORS[index % COLORS.length]
        };
      });
      setChartConfig(config);

      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

      let chartDataArray: ChartDataPoint[];
      
      if (type === 'accumulated') {
        const accumulatedValues: Record<string, number> = {};
        
        lineKeysArray.forEach(key => {
          accumulatedValues[key] = 0;
        });
        
        chartDataArray = sortedMonths.map(month => {
          const monthLabel = monthNames[month - 1];
          
          const dataPoint: ChartDataPoint = {
            month: String(month),
            monthLabel
          };

          lineKeysArray.forEach(lineKey => {
            accumulatedValues[lineKey] += monthlyData[month]?.[lineKey] || 0;
            dataPoint[lineKey] = accumulatedValues[lineKey];
          });

          return dataPoint;
        });
      } else {
        chartDataArray = sortedMonths.map(month => {
          const monthLabel = monthNames[month - 1];
          
          const dataPoint: ChartDataPoint = {
            month: String(month),
            monthLabel
          };

          lineKeysArray.forEach(lineKey => {
            dataPoint[lineKey] = monthlyData[month]?.[lineKey] || 0;
          });

          return dataPoint;
        });
      }

      setChartData(chartDataArray);
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast({
        title: "Erro",
        description: "Erro ao gerar relatório",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const exportToPdf = async () => {
    if (chartData.length === 0) return;
    
    setExportingPdf(true);
    
    try {
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Página 1 - Desenhar gráfico manualmente
      const chartTitle = chartType === 'accumulated' 
        ? "Gráfico de Faturamento Acumulado" 
        : "Gráfico de Faturamento Mensal";
      pdf.setFontSize(18);
      pdf.text(chartTitle, pageWidth / 2, 15, { align: "center" });
      
      pdf.setFontSize(10);
      pdf.text(`Período: ${startDate} a ${endDate}`, pageWidth / 2, 22, { align: "center" });
      
      // Área do gráfico
      const chartX = 50;
      const chartY = 35;
      const chartWidth = pageWidth - 70;
      const chartHeight = pageHeight - 70;
      
      // Encontrar valores máximos
      let maxValue = 0;
      chartData.forEach(d => {
        lineKeys.forEach(key => {
          const val = d[key] as number || 0;
          if (val > maxValue) maxValue = val;
        });
      });
      
      // Desenhar eixos
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.5);
      pdf.line(chartX, chartY, chartX, chartY + chartHeight);
      pdf.line(chartX, chartY + chartHeight, chartX + chartWidth, chartY + chartHeight);
      
      // Desenhar grid horizontal e labels do eixo Y
      const ySteps = 5;
      pdf.setFontSize(8);
      for (let i = 0; i <= ySteps; i++) {
        const y = chartY + chartHeight - (i / ySteps) * chartHeight;
        const value = (i / ySteps) * maxValue;
        pdf.setDrawColor(230, 230, 230);
        pdf.line(chartX, y, chartX + chartWidth, y);
        pdf.setTextColor(100, 100, 100);
        pdf.text(formatCurrency(value), chartX - 2, y + 1, { align: "right" });
      }
      
      // Desenhar labels do eixo X
      const xStep = chartWidth / (chartData.length - 1 || 1);
      chartData.forEach((d, i) => {
        const x = chartX + i * xStep;
        pdf.setTextColor(100, 100, 100);
        pdf.text(d.monthLabel, x, chartY + chartHeight + 6, { align: "center" });
      });
      
      // Desenhar linhas do gráfico
      lineKeys.forEach((key) => {
        const color = chartConfig[key]?.color || '#000000';
        const hexColor = color.replace('#', '');
        const r = parseInt(hexColor.substring(0, 2), 16);
        const g = parseInt(hexColor.substring(2, 4), 16);
        const b = parseInt(hexColor.substring(4, 6), 16);
        
        pdf.setDrawColor(r, g, b);
        pdf.setLineWidth(1.5);
        
        const points: { x: number; y: number }[] = [];
        chartData.forEach((d, i) => {
          const x = chartX + i * xStep;
          const val = d[key] as number || 0;
          const y = chartY + chartHeight - (val / maxValue) * chartHeight;
          points.push({ x, y });
        });
        
        // Desenhar linha
        for (let i = 1; i < points.length; i++) {
          pdf.line(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
        }
        
        // Desenhar pontos
        pdf.setFillColor(r, g, b);
        points.forEach(point => {
          pdf.circle(point.x, point.y, 1.5, 'F');
        });
      });
      
      // Legenda
      let legendX = chartX;
      const legendY = chartY + chartHeight + 15;
      pdf.setFontSize(8);
      lineKeys.forEach((key) => {
        const config = chartConfig[key];
        const color = config?.color || '#000000';
        const hexColor = color.replace('#', '');
        const r = parseInt(hexColor.substring(0, 2), 16);
        const g = parseInt(hexColor.substring(2, 4), 16);
        const b = parseInt(hexColor.substring(4, 6), 16);
        
        pdf.setFillColor(r, g, b);
        pdf.rect(legendX, legendY - 2, 4, 4, 'F');
        pdf.setTextColor(0, 0, 0);
        pdf.text(config?.label || key, legendX + 6, legendY + 1);
        legendX += pdf.getTextWidth(config?.label || key) + 15;
      });
      
      // Página 2 - Tabela
      pdf.addPage();
      pdf.setFontSize(18);
      pdf.text("Dados de Faturamento", pageWidth / 2, 15, { align: "center" });
      
      const months = chartData.map(d => d.monthLabel);
      const tableHead = ["Loja", ...months];
      
      const tableBody = lineKeys.map(key => {
        const config = chartConfig[key];
        const storeName = config?.label || key;
        const values = chartData.map(d => formatCurrency(d[key] as number || 0));
        return [storeName, ...values];
      });
      
      autoTable(pdf, {
        head: [tableHead],
        body: tableBody,
        startY: 25,
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245],
        },
        columnStyles: {
          0: { fontStyle: 'bold' },
        },
      });
      
      pdf.save(`grafico-faturamento-${startDate}-${endDate}.pdf`);
      
      toast({
        title: "Sucesso",
        description: "PDF exportado com sucesso",
      });
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast({
        title: "Erro",
        description: "Erro ao exportar PDF",
        variant: "destructive",
      });
    } finally {
      setExportingPdf(false);
    }
  };

  const exportDailyToPdf = async () => {
    if (dailyChartData.length === 0) return;
    
    setExportingPdf(true);
    
    try {
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Página 1 - Desenhar gráfico manualmente
      pdf.setFontSize(18);
      pdf.text("Gráfico de Faturamento Diário", pageWidth / 2, 15, { align: "center" });
      
      pdf.setFontSize(10);
      pdf.text(`Período: ${startDate} a ${endDate}`, pageWidth / 2, 22, { align: "center" });
      
      // Área do gráfico
      const chartX = 50;
      const chartY = 35;
      const chartWidth = pageWidth - 70;
      const chartHeight = pageHeight - 70;
      
      // Encontrar valores máximos
      let maxValue = 0;
      dailyChartData.forEach(d => {
        dailyLineKeys.forEach(key => {
          const val = d[key] as number || 0;
          if (val > maxValue) maxValue = val;
        });
      });
      
      // Desenhar eixos
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.5);
      pdf.line(chartX, chartY, chartX, chartY + chartHeight);
      pdf.line(chartX, chartY + chartHeight, chartX + chartWidth, chartY + chartHeight);
      
      // Desenhar grid horizontal e labels do eixo Y
      const ySteps = 5;
      pdf.setFontSize(8);
      for (let i = 0; i <= ySteps; i++) {
        const y = chartY + chartHeight - (i / ySteps) * chartHeight;
        const value = (i / ySteps) * maxValue;
        pdf.setDrawColor(230, 230, 230);
        pdf.line(chartX, y, chartX + chartWidth, y);
        pdf.setTextColor(100, 100, 100);
        pdf.text(formatCurrency(value), chartX - 2, y + 1, { align: "right" });
      }
      
      // Desenhar labels do eixo X (limitado para não sobrecarregar)
      const xStep = chartWidth / (dailyChartData.length - 1 || 1);
      const labelInterval = Math.ceil(dailyChartData.length / 15); // Mostrar no máximo ~15 labels
      dailyChartData.forEach((d, i) => {
        if (i % labelInterval === 0 || i === dailyChartData.length - 1) {
          const x = chartX + i * xStep;
          pdf.setTextColor(100, 100, 100);
          pdf.text(d.dateLabel, x, chartY + chartHeight + 6, { align: "center" });
        }
      });
      
      // Desenhar linhas do gráfico
      dailyLineKeys.forEach((key) => {
        const color = dailyChartConfig[key]?.color || '#000000';
        const hexColor = color.replace('#', '');
        const r = parseInt(hexColor.substring(0, 2), 16);
        const g = parseInt(hexColor.substring(2, 4), 16);
        const b = parseInt(hexColor.substring(4, 6), 16);
        
        pdf.setDrawColor(r, g, b);
        pdf.setLineWidth(1.5);
        
        const points: { x: number; y: number }[] = [];
        dailyChartData.forEach((d, i) => {
          const x = chartX + i * xStep;
          const val = d[key] as number || 0;
          const y = chartY + chartHeight - (val / maxValue) * chartHeight;
          points.push({ x, y });
        });
        
        // Desenhar linha
        for (let i = 1; i < points.length; i++) {
          pdf.line(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
        }
        
        // Desenhar pontos (menos pontos para não sobrecarregar)
        pdf.setFillColor(r, g, b);
        points.forEach((point, i) => {
          if (i % labelInterval === 0 || i === points.length - 1) {
            pdf.circle(point.x, point.y, 1.5, 'F');
          }
        });
      });
      
      // Legenda
      let legendX = chartX;
      const legendY = chartY + chartHeight + 15;
      pdf.setFontSize(8);
      dailyLineKeys.forEach((key) => {
        const config = dailyChartConfig[key];
        const color = config?.color || '#000000';
        const hexColor = color.replace('#', '');
        const r = parseInt(hexColor.substring(0, 2), 16);
        const g = parseInt(hexColor.substring(2, 4), 16);
        const b = parseInt(hexColor.substring(4, 6), 16);
        
        pdf.setFillColor(r, g, b);
        pdf.rect(legendX, legendY - 2, 4, 4, 'F');
        pdf.setTextColor(0, 0, 0);
        pdf.text(config?.label || key, legendX + 6, legendY + 1);
        legendX += pdf.getTextWidth(config?.label || key) + 15;
      });
      
      // Página 2 - Tabela
      pdf.addPage();
      pdf.setFontSize(18);
      pdf.text("Dados de Faturamento Diário", pageWidth / 2, 15, { align: "center" });
      
      // Colunas = Lojas, Linhas = Datas
      const storeNames = dailyLineKeys.map(key => dailyChartConfig[key]?.label || key);
      const tableHead = ["Data", ...storeNames];
      
      const tableBody = dailyChartData.map(d => {
        const dateLabel = d.dateLabel;
        const values = dailyLineKeys.map(key => formatCurrency(d[key] as number || 0));
        return [dateLabel, ...values];
      });
      
      autoTable(pdf, {
        head: [tableHead],
        body: tableBody,
        startY: 25,
        styles: {
          fontSize: 6,
          cellPadding: 1,
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245],
        },
        columnStyles: {
          0: { fontStyle: 'bold' },
        },
      });
      
      pdf.save(`grafico-faturamento-diario-${startDate}-${endDate}.pdf`);
      
      toast({
        title: "Sucesso",
        description: "PDF exportado com sucesso",
      });
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast({
        title: "Erro",
        description: "Erro ao exportar PDF",
        variant: "destructive",
      });
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center space-x-4">
          <Button onClick={() => navigate("/dashboard")} variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-primary">Gráfico de Faturamento</h1>
            <p className="text-sm text-muted-foreground">Visualize o faturamento em gráfico de linhas</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LineChart className="h-5 w-5" />
              Filtros
            </CardTitle>
            <CardDescription>Configure os filtros para gerar o gráfico</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Lojas *</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
                {stores.map((store) => (
                  <div key={store.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={store.id}
                      checked={selectedStores.includes(store.id)}
                      onCheckedChange={() => handleStoreToggle(store.id)}
                    />
                    <label
                      htmlFor={store.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {store.code} - {store.name}
                    </label>
                  </div>
                ))}
              </div>

              {selectedStores.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedStores.map(storeId => {
                    const store = stores.find(s => s.id === storeId);
                    return store ? (
                      <Badge key={storeId} variant="secondary" className="flex items-center gap-1">
                        {store.code} - {store.name}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 ml-1"
                          onClick={() => removeStore(storeId)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Data Inicial *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Data Final *</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => generateReport('monthly')} disabled={loading || selectedStores.length === 0}>
                {loading && chartType === 'monthly' ? "Gerando..." : "Gerar Gráfico Mensal"}
              </Button>
              <Button onClick={() => generateReport('accumulated')} disabled={loading || selectedStores.length === 0} variant="outline">
                {loading && chartType === 'accumulated' ? "Gerando..." : "Gerar Gráfico Acumulado"}
              </Button>
              <Button onClick={generateDailyReport} disabled={loading || selectedStores.length === 0} variant="outline">
                {loading && chartType === 'daily' ? "Gerando..." : "Gerar Gráfico Diário"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {chartData.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>
                  {chartType === 'accumulated' ? 'Gráfico de Faturamento Acumulado' : 'Gráfico de Faturamento Mensal'}
                </CardTitle>
                <CardDescription>
                  {chartType === 'accumulated' 
                    ? 'Faturamento acumulado de Janeiro a Dezembro' 
                    : 'Faturamento total por mês'}
                </CardDescription>
              </div>
              <Button onClick={exportToPdf} disabled={exportingPdf} variant="outline">
                <FileDown className="h-4 w-4 mr-2" />
                {exportingPdf ? "Exportando..." : "Exportar PDF"}
              </Button>
            </CardHeader>
            <CardContent ref={chartRef}>
              <ChartContainer config={chartConfig} className="h-[400px] w-full">
                <RechartsLineChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="monthLabel" 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    tickFormatter={(value) => formatCurrency(value)}
                    tick={{ fontSize: 10 }}
                    width={100}
                    className="text-muted-foreground"
                  />
                  <ChartTooltip 
                    content={
                      <ChartTooltipContent 
                        formatter={(value, name) => {
                          const config = chartConfig[name as string];
                          return (
                            <div className="flex items-center gap-2">
                              <span>{config?.label || name}:</span>
                              <span className="font-bold">{formatCurrency(value as number)}</span>
                            </div>
                          );
                        }}
                      />
                    } 
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  {lineKeys.map((key) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={chartConfig[key]?.color}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                      name={key}
                    />
                  ))}
                </RechartsLineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {dailyChartData.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Gráfico de Faturamento Diário</CardTitle>
                <CardDescription>
                  Faturamento por dia no período selecionado
                </CardDescription>
              </div>
              <Button onClick={exportDailyToPdf} disabled={exportingPdf} variant="outline">
                <FileDown className="h-4 w-4 mr-2" />
                {exportingPdf ? "Exportando..." : "Exportar PDF"}
              </Button>
            </CardHeader>
            <CardContent>
              <ChartContainer config={dailyChartConfig} className="h-[400px] w-full">
                <RechartsLineChart
                  data={dailyChartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="dateLabel" 
                    tick={{ fontSize: 10 }}
                    className="text-muted-foreground"
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis 
                    tickFormatter={(value) => formatCurrency(value)}
                    tick={{ fontSize: 10 }}
                    width={100}
                    className="text-muted-foreground"
                  />
                  <ChartTooltip 
                    content={
                      <ChartTooltipContent 
                        formatter={(value, name) => {
                          const config = dailyChartConfig[name as string];
                          return (
                            <div className="flex items-center gap-2">
                              <span>{config?.label || name}:</span>
                              <span className="font-bold">{formatCurrency(value as number)}</span>
                            </div>
                          );
                        }}
                      />
                    } 
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  {dailyLineKeys.map((key) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={dailyChartConfig[key]?.color}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      name={key}
                    />
                  ))}
                </RechartsLineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default TurnoverChartReport;
