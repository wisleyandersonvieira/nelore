import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Eye, Pencil, Ban, Upload, X, FileText, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Expense {
  id: string;
  issue_date: string;
  supplier: string;
  description: string;
  amount: number;
  attachments: string[];
  attachment_status: Record<string, boolean>;
  is_disabled: boolean;
  created_by_name: string;
  created_at: string;
  edit_history: Array<{ edited_at: string; edited_by_name: string }>;
  reference_month: number;
  reference_year: number;
}

interface CashControlExpenseBoxProps {
  storeId: string;
  expenseType: "caixa_geral" | "banco";
  title: string;
  referenceMonth: number;
  referenceYear: number;
}

type SortField = 'issue_date' | 'supplier' | 'description' | 'amount';
type SortDirection = 'asc' | 'desc';

export const CashControlExpenseBox = ({ storeId, expenseType, title, referenceMonth, referenceYear }: CashControlExpenseBoxProps) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);
  const [sortField, setSortField] = useState<SortField>('issue_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Form fields
  const [issueDate, setIssueDate] = useState("");
  const [supplier, setSupplier] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [newAttachments, setNewAttachments] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<string[]>([]);
  const [attachmentStatus, setAttachmentStatus] = useState<Record<string, boolean>>({});
  const [uploading, setUploading] = useState(false);

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
      
      setExpenses((data || []).map(exp => ({
        ...exp,
        attachments: exp.attachments as string[] || [],
        attachment_status: (exp.attachment_status as Record<string, boolean>) || {},
        edit_history: (exp.edit_history as Array<{ edited_at: string; edited_by_name: string }>) || [],
        reference_month: exp.reference_month,
        reference_year: exp.reference_year
      })));
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

  const toggleAttachmentStatus = (url: string) => {
    setAttachmentStatus(prev => ({
      ...prev,
      [url]: prev[url] === undefined ? false : !prev[url]
    }));
  };

  const uploadAttachments = async (): Promise<string[]> => {
    const paths: string[] = [];
    
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

      // Store the path, not the public URL (bucket is private)
      paths.push(filePath);
    }

    return paths;
  };

  const openAttachment = async (pathOrUrl: string) => {
    try {
      // Check if it's already a full URL (legacy data)
      if (pathOrUrl.startsWith('http')) {
        window.open(pathOrUrl, "_blank");
        return;
      }

      // Generate signed URL for private bucket
      const { data, error } = await supabase.storage
        .from("account-documents")
        .createSignedUrl(pathOrUrl, 60); // 60 seconds expiry

      if (error) {
        console.error("Erro ao gerar URL:", error);
        toast.error("Erro ao abrir anexo");
        return;
      }

      window.open(data.signedUrl, "_blank");
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
      const uploadedUrls = await uploadAttachments();
      const allAttachments = [...existingAttachments, ...uploadedUrls];
      
      // Initialize status for new attachments
      const newStatus = { ...attachmentStatus };
      uploadedUrls.forEach(url => {
        newStatus[url] = true;
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
            attachments: allAttachments,
            attachment_status: newStatus,
            edit_history: newHistory
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
            attachments: allAttachments,
            attachment_status: newStatus,
            created_by: user.id,
            created_by_name: userName,
            reference_month: referenceMonth,
            reference_year: referenceYear
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

  const sortedExpenses = [...expenses].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'issue_date':
        comparison = new Date(a.issue_date).getTime() - new Date(b.issue_date).getTime();
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

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <Button size="sm" onClick={() => handleOpenForm()}>
            <Plus className="h-4 w-4 mr-1" />
            Nova Despesa
          </Button>
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
          <div className="border rounded">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow className="h-8">
                  <TableHead 
                    className="text-xs py-1 cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('issue_date')}
                  >
                    Data <SortIcon field="issue_date" />
                  </TableHead>
                  <TableHead 
                    className="text-xs py-1 cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('supplier')}
                  >
                    Fornecedor <SortIcon field="supplier" />
                  </TableHead>
                  <TableHead 
                    className="text-xs py-1 cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('description')}
                  >
                    Descrição <SortIcon field="description" />
                  </TableHead>
                  <TableHead 
                    className="text-xs py-1 text-right cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('amount')}
                  >
                    Valor <SortIcon field="amount" />
                  </TableHead>
                  <TableHead className="text-xs py-1 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
            </Table>
            <div className="max-h-[150px] overflow-auto">
              <Table>
                <TableBody>
                  {sortedExpenses.map((expense) => (
                    <TableRow 
                      key={expense.id}
                      className={`h-8 ${expense.is_disabled ? "bg-red-50 text-red-700" : ""}`}
                    >
                      <TableCell className="text-xs py-1">
                        {format(new Date(expense.issue_date + 'T12:00:00'), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="text-xs py-1">
                        {expense.supplier}
                        {expense.is_disabled && " (inabilitado)"}
                      </TableCell>
                      <TableCell className="text-xs py-1 max-w-[200px] truncate">
                        {expense.description}
                      </TableCell>
                      <TableCell className="text-xs py-1 text-right">
                        {formatCurrency(expense.amount)}
                      </TableCell>
                      <TableCell className="text-xs py-1 text-right">
                        <div className="flex justify-end gap-0.5">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6"
                            onClick={() => handleView(expense)}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6"
                            onClick={() => handleOpenForm(expense)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className={`h-6 w-6 ${expense.is_disabled ? "text-green-600" : "text-red-600"}`}
                            onClick={() => handleDisable(expense)}
                          >
                            <Ban className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
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
                  {existingAttachments.map((url, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-2 rounded text-xs ${
                        attachmentStatus[url] === false
                          ? "bg-red-100 border border-red-300 text-red-700"
                          : "bg-muted"
                      }`}
                    >
                      <span className="truncate flex-1">
                        {getAttachmentName(url)}
                        {attachmentStatus[url] === false && " (inabilitado)"}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => openAttachment(url)}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-600"
                          onClick={() => toggleAttachmentStatus(url)}
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

              {viewingExpense.attachments.length > 0 && (
                <div>
                  <Label className="text-muted-foreground text-xs">Anexos</Label>
                  <div className="mt-1 space-y-1">
                    {viewingExpense.attachments.map((url, index) => (
                      <div
                        key={index}
                        className={`flex items-center justify-between p-2 rounded text-xs ${
                          viewingExpense.attachment_status[url] === false
                            ? "bg-red-100 border border-red-300 text-red-700"
                            : "bg-muted"
                        }`}
                      >
                        <span className="truncate flex-1 flex items-center gap-2">
                          <FileText className="h-3 w-3" />
                          {getAttachmentName(url)}
                          {viewingExpense.attachment_status[url] === false && " (inabilitado)"}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => openAttachment(url)}
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
    </Card>
  );
};

