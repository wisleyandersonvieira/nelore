import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Eye, Pencil, Ban, Upload, X, FileText, ArrowUp, ArrowDown, Link2, Download } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LinkToAccountsPayableModal } from "./LinkToAccountsPayableModal";
import { useCaixaPermissions } from "@/hooks/useCaixaPermissions";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface AttachmentInfo {
  path: string;
  originalName: string;
}

interface Expense {
  id: string;
  issue_date: string;
  supplier: string;
  description: string;
  amount: number;
  attachments: AttachmentInfo[];
  attachment_status: Record<string, boolean>;
  is_disabled: boolean;
  created_by_name: string;
  created_at: string;
  edit_history: Array<{ edited_at: string; edited_by_name: string }>;
  reference_month: number;
  reference_year: number;
  linked_account_payable_id: string | null;
  is_paid: boolean;
  payment_date: string | null;
  notes: string | null;
}

interface CashControlExpenseBoxProps {
  storeId: string;
  expenseType: "caixa_geral" | "banco";
  title: string;
  referenceMonth: number;
  referenceYear: number;
}

type SortField = 'issue_date' | 'created_at' | 'supplier' | 'description' | 'amount';
type SortDirection = 'asc' | 'desc';
type LinkFilter = 'all' | 'linked' | 'unlinked';

export const CashControlExpenseBox = ({ storeId, expenseType, title, referenceMonth, referenceYear }: CashControlExpenseBoxProps) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);
  const [sortField, setSortField] = useState<SortField>('issue_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [linkFilter, setLinkFilter] = useState<LinkFilter>('all');
  
  // Permissions
  const { canEdit, canApprove } = useCaixaPermissions();
  
  // Link to accounts payable modal
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [expenseToLink, setExpenseToLink] = useState<Expense | null>(null);
  
  // Form fields
  const [issueDate, setIssueDate] = useState("");
  const [supplier, setSupplier] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [newAttachments, setNewAttachments] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<AttachmentInfo[]>([]);
  const [attachmentStatus, setAttachmentStatus] = useState<Record<string, boolean>>({});
  const [uploading, setUploading] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [paymentDate, setPaymentDate] = useState("");
  const [notes, setNotes] = useState("");

  const handleOpenLinkModal = (expense: Expense) => {
    setExpenseToLink(expense);
    setLinkModalOpen(true);
  };

  useEffect(() => {
    fetchExpenses();
  }, [storeId, expenseType, referenceMonth, referenceYear]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("cash_control_expenses")
        .select("*")
        .eq("store_id", storeId)
        .eq("expense_type", expenseType)
        .eq("reference_month", referenceMonth)
        .eq("reference_year", referenceYear)
        .order("issue_date", { ascending: false });

      if (error) throw error;
      
      setExpenses((data || []).map(exp => {
        // Handle both old format (string[]) and new format (AttachmentInfo[])
        const rawAttachments = exp.attachments as (string | AttachmentInfo)[] || [];
        const normalizedAttachments: AttachmentInfo[] = rawAttachments.map(att => {
          if (typeof att === 'string') {
            // Legacy format - extract name from path
            const parts = att.split('/');
            return { path: att, originalName: parts[parts.length - 1] };
          }
          return att as AttachmentInfo;
        });
        
        return {
          ...exp,
          attachments: normalizedAttachments,
          attachment_status: (exp.attachment_status as Record<string, boolean>) || {},
          edit_history: (exp.edit_history as Array<{ edited_at: string; edited_by_name: string }>) || [],
          reference_month: exp.reference_month,
          reference_year: exp.reference_year,
          linked_account_payable_id: exp.linked_account_payable_id || null,
          is_paid: exp.is_paid || false,
          payment_date: exp.payment_date || null,
          notes: exp.notes || null
        };
      }));
    } catch (error) {
      console.error("Erro ao carregar despesas:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setIssueDate("");
    setSupplier("");
    setDescription("");
    setAmount("");
    setNewAttachments([]);
    setExistingAttachments([]);
    setAttachmentStatus({});
    setEditingExpense(null);
    setIsPaid(false);
    setPaymentDate("");
    setNotes("");
  };

  const handleOpenForm = (expense?: Expense) => {
    if (expense) {
      setEditingExpense(expense);
      setIssueDate(expense.issue_date);
      setSupplier(expense.supplier);
      setDescription(expense.description);
      setAmount(expense.amount.toString());
      setExistingAttachments(expense.attachments);
      setAttachmentStatus(expense.attachment_status);
      setIsPaid(expense.is_paid || false);
      setPaymentDate(expense.payment_date || "");
      setNotes(expense.notes || "");
    } else {
      resetForm();
    }
    setFormOpen(true);
  };

  const handleView = (expense: Expense) => {
    setViewingExpense(expense);
    setViewOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setNewAttachments([...newAttachments, ...Array.from(e.target.files)]);
    }
  };

  const removeNewAttachment = (index: number) => {
    setNewAttachments(newAttachments.filter((_, i) => i !== index));
  };

  const toggleAttachmentStatus = (path: string) => {
    setAttachmentStatus(prev => ({
      ...prev,
      [path]: prev[path] === undefined ? false : !prev[path]
    }));
  };

  const uploadAttachments = async (): Promise<AttachmentInfo[]> => {
    const attachments: AttachmentInfo[] = [];
    
    for (const file of newAttachments) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `${storeId}/expenses/${fileName}`;

      const { error } = await supabase.storage
        .from("account-documents")
        .upload(filePath, file);

      if (error) {
        console.error("Erro ao fazer upload:", error);
        continue;
      }

      // Store the path and original filename
      attachments.push({ path: filePath, originalName: file.name });
    }

    return attachments;
  };

  const openAttachment = async (pathOrUrl: string) => {
    try {
      if (!pathOrUrl) {
        console.error("Path do anexo não encontrado");
        toast.error("Erro ao abrir anexo: caminho não encontrado");
        return;
      }

      // Check if it's already a full URL (legacy data)
      if (pathOrUrl.startsWith('http')) {
        window.open(pathOrUrl, "_blank");
        return;
      }

      // Check if it's a PDF file
      const isPdf = pathOrUrl.toLowerCase().endsWith('.pdf');

      if (isPdf) {
        // For PDFs, download the file and trigger download via hidden link
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("account-documents")
          .download(pathOrUrl);

        if (downloadError) {
          console.error("Erro ao baixar PDF:", downloadError, "Path:", pathOrUrl);
          toast.error("Erro ao abrir anexo PDF");
          return;
        }

        // Create a blob URL and use a hidden link to open/download
        const blob = new Blob([fileData], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        
        // Create a hidden link and click it to bypass popup blockers
        const link = document.createElement('a');
        link.href = blobUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        // Extract filename from path
        const fileName = pathOrUrl.split('/').pop() || 'documento.pdf';
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up the blob URL after a delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      } else {
        // For other file types, download and open like PDF
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("account-documents")
          .download(pathOrUrl);

        if (downloadError) {
          console.error("Erro ao baixar anexo:", downloadError, "Path:", pathOrUrl);
          toast.error("Erro ao abrir anexo");
          return;
        }

        // Determine MIME type based on extension
        const ext = pathOrUrl.toLowerCase().split('.').pop();
        let mimeType = 'application/octet-stream';
        if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
        else if (ext === 'png') mimeType = 'image/png';
        else if (ext === 'gif') mimeType = 'image/gif';
        else if (ext === 'webp') mimeType = 'image/webp';

        // Create blob URL and open in new tab
        const blob = new Blob([fileData], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, "_blank");
        
        // Clean up after delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      }
    } catch (error) {
      console.error("Erro ao abrir anexo:", error);
      toast.error("Erro ao abrir anexo");
    }
  };

  const handleSubmit = async () => {
    if (!issueDate || !supplier || !description || !amount) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

      const userName = profile?.name || user.email || "Usuário";
      const uploadedAttachments = await uploadAttachments();
      const allAttachments = [...existingAttachments, ...uploadedAttachments];
      
      // Initialize status for new attachments
      const newStatus = { ...attachmentStatus };
      uploadedAttachments.forEach(att => {
        newStatus[att.path] = true;
      });

      if (editingExpense) {
        // Update
        const newHistory = [
          ...(editingExpense.edit_history || []),
          { edited_at: new Date().toISOString(), edited_by_name: userName }
        ];

        const { error } = await supabase
          .from("cash_control_expenses")
          .update({
            issue_date: issueDate,
            supplier,
            description,
            amount: parseFloat(amount),
            attachments: allAttachments as unknown as Json,
            attachment_status: newStatus as unknown as Json,
            edit_history: newHistory,
            is_paid: isPaid,
            payment_date: isPaid ? paymentDate || null : null,
            notes: notes || null
          })
          .eq("id", editingExpense.id);

        if (error) throw error;
        toast.success("Despesa atualizada com sucesso");
      } else {
        // Create
        const { error } = await supabase
          .from("cash_control_expenses")
          .insert({
            store_id: storeId,
            expense_type: expenseType,
            issue_date: issueDate,
            supplier,
            description,
            amount: parseFloat(amount),
            attachments: allAttachments as unknown as Json,
            attachment_status: newStatus as unknown as Json,
            created_by: user.id,
            created_by_name: userName,
            reference_month: referenceMonth,
            reference_year: referenceYear,
            is_paid: isPaid,
            payment_date: isPaid ? paymentDate || null : null,
            notes: notes || null
          });

        if (error) throw error;
        toast.success("Despesa cadastrada com sucesso");
      }

      setFormOpen(false);
      resetForm();
      fetchExpenses();
    } catch (error) {
      console.error("Erro ao salvar despesa:", error);
      toast.error("Erro ao salvar despesa");
    } finally {
      setUploading(false);
    }
  };

  const handleDisable = async (expense: Expense) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

      const userName = profile?.name || user.email || "Usuário";
      const newHistory = [
        ...(expense.edit_history || []),
        { edited_at: new Date().toISOString(), edited_by_name: `${userName} (inabilitou)` }
      ];

      const { error } = await supabase
        .from("cash_control_expenses")
        .update({ 
          is_disabled: !expense.is_disabled,
          edit_history: newHistory
        })
        .eq("id", expense.id);

      if (error) throw error;
      
      toast.success(expense.is_disabled ? "Despesa habilitada" : "Despesa inabilitada");
      fetchExpenses();
    } catch (error) {
      console.error("Erro ao inabilitar despesa:", error);
      toast.error("Erro ao inabilitar despesa");
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getAttachmentName = (url: string) => {
    const parts = url.split('/');
    return parts[parts.length - 1];
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'issue_date' ? 'desc' : 'asc');
    }
  };

  // Filter by link status
  const filteredExpenses = expenses.filter((expense) => {
    // Only show disabled items when filter is 'all'
    if (linkFilter === 'all') {
      return true;
    }
    // For 'linked' and 'unlinked', hide disabled items
    if (expense.is_disabled) {
      return false;
    }
    if (linkFilter === 'linked') {
      return !!expense.linked_account_payable_id;
    }
    if (linkFilter === 'unlinked') {
      return !expense.linked_account_payable_id;
    }
    return true;
  });

  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'issue_date':
        comparison = new Date(a.issue_date).getTime() - new Date(b.issue_date).getTime();
        break;
      case 'created_at':
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;
      case 'supplier':
        comparison = a.supplier.localeCompare(b.supplier, 'pt-BR');
        break;
      case 'description':
        comparison = a.description.localeCompare(b.description, 'pt-BR');
        break;
      case 'amount':
        comparison = a.amount - b.amount;
        break;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 inline ml-1" />
      : <ArrowDown className="h-3 w-3 inline ml-1" />;
  };

  const linkFilterOptions: { value: LinkFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'linked', label: 'Vinculados' },
    { value: 'unlinked', label: 'Não Vinculados' },
  ];

  // Calculate total for filtered expenses
  const filteredTotal = sortedExpenses.reduce((acc, expense) => acc + expense.amount, 0);
  const filteredCount = sortedExpenses.length;

  // Export to PDF
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      
      // Title
      doc.setFontSize(16);
      doc.text(title, 14, 15);
      
      // Reference period
      doc.setFontSize(10);
      const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
      doc.text(`Período: ${monthNames[referenceMonth - 1]} / ${referenceYear}`, 14, 22);
      
      // Filter info
      const filterLabel = linkFilterOptions.find(o => o.value === linkFilter)?.label || 'Todos';
      doc.text(`Filtro: ${filterLabel}`, 14, 28);
      
      // Table data
      const tableData = sortedExpenses.map(expense => [
        format(new Date(expense.issue_date + 'T12:00:00'), "dd/MM/yyyy"),
        format(new Date(expense.created_at), "dd/MM/yyyy HH:mm"),
        expense.supplier + (expense.is_disabled ? ' (inabilitado)' : ''),
        expense.description,
        formatCurrency(expense.amount)
      ]);
      
      autoTable(doc, {
        head: [['Data', 'Criado em', 'Fornecedor', 'Descrição', 'Valor']],
        body: tableData,
        startY: 35,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246] },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 35 },
          2: { cellWidth: 40 },
          3: { cellWidth: 'auto' },
          4: { cellWidth: 30, halign: 'right' }
        }
      });
      
      // Total
      const finalY = (doc as any).lastAutoTable.finalY || 35;
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text(`Total: ${formatCurrency(filteredTotal)} (${filteredCount} registro${filteredCount !== 1 ? 's' : ''})`, 14, finalY + 10);
      
      // Save
      const fileName = `${title.replace(/\s+/g, '_')}_${referenceMonth}_${referenceYear}.pdf`;
      doc.save(fileName);
      
      toast.success("PDF exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      toast.error("Erro ao exportar PDF");
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            {title}
            <span className="text-sm font-normal text-muted-foreground">
              ({filteredCount} registro{filteredCount !== 1 ? 's' : ''})
            </span>
          </CardTitle>
          {canEdit && (
            <Button size="sm" onClick={() => handleOpenForm()}>
              <Plus className="h-4 w-4 mr-1" />
              Nova Despesa
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : expenses.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma despesa cadastrada
          </p>
        ) : (
          <>
          {/* Filter by link status */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Filtrar:</span>
              <div className="flex gap-1">
                {linkFilterOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={linkFilter === option.value ? "default" : "outline"}
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => setLinkFilter(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              {linkFilter !== 'all' && (
                <span className="text-xs font-medium text-primary ml-2">
                  Total: {formatCurrency(filteredTotal)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={handleExportPDF}
                title="Exportar PDF"
              >
                <Download className="h-3 w-3 mr-1" />
                PDF
              </Button>
            </div>
          </div>
          <div className="border rounded">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow className="h-8">
                  <TableHead 
                    className="text-xs py-1 text-left cursor-pointer hover:bg-muted/50 select-none w-[90px]"
                    onClick={() => handleSort('issue_date')}
                  >
                    Data <SortIcon field="issue_date" />
                  </TableHead>
                  <TableHead 
                    className="text-xs py-1 text-left cursor-pointer hover:bg-muted/50 select-none w-[130px]"
                    onClick={() => handleSort('created_at')}
                  >
                    Criado em <SortIcon field="created_at" />
                  </TableHead>
                  <TableHead 
                    className="text-xs py-1 text-left cursor-pointer hover:bg-muted/50 select-none w-[200px]"
                    onClick={() => handleSort('supplier')}
                  >
                    Fornecedor <SortIcon field="supplier" />
                  </TableHead>
                  <TableHead 
                    className="text-xs py-1 text-left cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('description')}
                  >
                    Descrição <SortIcon field="description" />
                  </TableHead>
                  <TableHead 
                    className="text-xs py-1 text-left cursor-pointer hover:bg-muted/50 select-none w-[100px]"
                    onClick={() => handleSort('amount')}
                  >
                    Valor <SortIcon field="amount" />
                  </TableHead>
                  <TableHead className="text-xs py-1 text-left w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
            </Table>
            <div className="max-h-[150px] overflow-auto">
              <Table>
                <TableBody>
                  {sortedExpenses.map((expense) => {
                    const isLinked = !!expense.linked_account_payable_id;
                    const rowClassName = expense.is_disabled 
                      ? "h-8 bg-red-50 text-red-700" 
                      : isLinked 
                        ? "h-8 bg-green-50" 
                        : "h-8";
                    
                    return (
                    <TableRow 
                      key={expense.id}
                      className={rowClassName}
                    >
                      <TableCell className="text-xs py-1 text-left w-[90px]">
                        {format(new Date(expense.issue_date + 'T12:00:00'), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="text-xs py-1 text-left w-[130px]">
                        {format(new Date(expense.created_at), "dd/MM/yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="text-xs py-1 text-left w-[200px]">
                        {expense.supplier}
                        {expense.is_disabled && " (inabilitado)"}
                      </TableCell>
                      <TableCell className="text-xs py-1 text-left max-w-[200px] truncate">
                        {expense.description}
                      </TableCell>
                      <TableCell className="text-xs py-1 text-left w-[100px]">
                        {formatCurrency(expense.amount)}
                      </TableCell>
                      <TableCell className="text-xs py-1 text-left w-[100px]">
                        <div className="flex justify-start gap-0.5">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6"
                            onClick={() => handleView(expense)}
                            title="Visualizar"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          {canEdit && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className={`h-6 w-6 ${isLinked ? "opacity-50" : ""}`}
                                onClick={() => handleOpenForm(expense)}
                                title={isLinked ? "Não pode editar (vinculado)" : "Editar"}
                                disabled={isLinked}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className={`h-6 w-6 ${isLinked ? "text-green-600 opacity-50" : "text-blue-600"}`}
                                onClick={() => handleOpenLinkModal(expense)}
                                title={isLinked ? "Já vinculado" : "Vincular ao Contas a Pagar"}
                                disabled={isLinked}
                              >
                                <Link2 className="h-3 w-3" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className={`h-6 w-6 ${isLinked ? "opacity-50" : expense.is_disabled ? "text-green-600" : "text-red-600"}`}
                                onClick={() => handleDisable(expense)}
                                title={isLinked ? "Não pode inabilitar (vinculado)" : expense.is_disabled ? "Habilitar" : "Inabilitar"}
                                disabled={isLinked}
                              >
                                <Ban className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )})}
                </TableBody>
              </Table>
            </div>
          </div>
          </>
        )}
      </CardContent>

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingExpense ? "Editar Despesa" : "Nova Despesa"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="issueDate">Data de Emissão *</Label>
              <Input
                id="issueDate"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="supplier">Fornecedor *</Label>
              <Input
                id="supplier"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Nome do fornecedor"
              />
            </div>

            <div>
              <Label htmlFor="description">Descrição *</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição da despesa"
              />
            </div>

            <div>
              <Label htmlFor="amount">Valor *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <Label htmlFor="isPaid" className="cursor-pointer">Despesa paga?</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{isPaid ? "Sim" : "Não"}</span>
                <Switch
                  id="isPaid"
                  checked={isPaid}
                  onCheckedChange={(checked) => {
                    setIsPaid(checked);
                    if (checked && !paymentDate && issueDate) {
                      setPaymentDate(issueDate);
                    }
                  }}
                />
              </div>
            </div>

            {isPaid && (
              <div>
                <Label htmlFor="paymentDate">Data do Pagamento</Label>
                <Input
                  id="paymentDate"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>
            )}

            <div>
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações sobre a despesa..."
                rows={3}
              />
            </div>

            <div>
              <Label>Anexos</Label>
              <div className="mt-2">
                <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary transition-colors">
                  <Upload className="h-4 w-4" />
                  <span className="text-sm">Adicionar anexo</span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                    multiple
                  />
                </label>
              </div>

              {/* Existing attachments */}
              {existingAttachments.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-muted-foreground">Anexos existentes:</p>
                  {existingAttachments.map((att, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-2 rounded text-xs ${
                        attachmentStatus[att.path] === false
                          ? "bg-red-100 border border-red-300 text-red-700"
                          : "bg-muted"
                      }`}
                    >
                      <span className="truncate flex-1">
                        {att.originalName}
                        {attachmentStatus[att.path] === false && " (inabilitado)"}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => openAttachment(att.path)}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-600"
                          onClick={() => toggleAttachmentStatus(att.path)}
                        >
                          <Ban className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* New attachments */}
              {newAttachments.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-muted-foreground">Novos anexos:</p>
                  {newAttachments.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-blue-50 rounded text-xs"
                    >
                      <span className="truncate flex-1">{file.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeNewAttachment(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={uploading}>
              {uploading ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes da Despesa</DialogTitle>
          </DialogHeader>
          
          {viewingExpense && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Data de Emissão</Label>
                  <p className="font-medium">
                    {format(new Date(viewingExpense.issue_date + 'T12:00:00'), "dd/MM/yyyy")}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Valor</Label>
                  <p className="font-medium">{formatCurrency(viewingExpense.amount)}</p>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground text-xs">Fornecedor</Label>
                <p className="font-medium">{viewingExpense.supplier}</p>
              </div>

              <div>
                <Label className="text-muted-foreground text-xs">Descrição</Label>
                <p className="font-medium">{viewingExpense.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Despesa paga?</Label>
                  <p className="font-medium">{viewingExpense.is_paid ? "Sim" : "Não"}</p>
                </div>
                {viewingExpense.is_paid && viewingExpense.payment_date && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Data do Pagamento</Label>
                    <p className="font-medium">
                      {format(new Date(viewingExpense.payment_date + 'T12:00:00'), "dd/MM/yyyy")}
                    </p>
                  </div>
                )}
              </div>

              {viewingExpense.notes && (
                <div>
                  <Label className="text-muted-foreground text-xs">Observações</Label>
                  <p className="font-medium whitespace-pre-wrap">{viewingExpense.notes}</p>
                </div>
              )}

              {viewingExpense.attachments.length > 0 && (
                <div>
                  <Label className="text-muted-foreground text-xs">Anexos</Label>
                  <div className="mt-1 space-y-1">
                    {viewingExpense.attachments.map((att, index) => (
                      <div
                        key={index}
                        className={`flex items-center justify-between p-2 rounded text-xs ${
                          viewingExpense.attachment_status[att.path] === false
                            ? "bg-red-100 border border-red-300 text-red-700"
                            : "bg-muted"
                        }`}
                      >
                        <span className="truncate flex-1 flex items-center gap-2">
                          <FileText className="h-3 w-3" />
                          {att.originalName}
                          {viewingExpense.attachment_status[att.path] === false && " (inabilitado)"}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => openAttachment(att.path)}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  Criado em {format(new Date(viewingExpense.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} por {viewingExpense.created_by_name}
                </p>
                {viewingExpense.edit_history.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {viewingExpense.edit_history.map((edit, index) => (
                      <p key={index} className="text-xs text-muted-foreground">
                        Editado em {format(new Date(edit.edited_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} por {edit.edited_by_name}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setViewOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link to Accounts Payable Modal */}
      <LinkToAccountsPayableModal
        open={linkModalOpen}
        onOpenChange={setLinkModalOpen}
        expense={expenseToLink}
        storeId={storeId}
        onLinkSuccess={fetchExpenses}
        expenseType={expenseType}
      />
    </Card>
  );
};

