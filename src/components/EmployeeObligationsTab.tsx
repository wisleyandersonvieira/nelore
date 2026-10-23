import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Loader2, FileText, Paperclip, Eye, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isAfter, subDays } from "date-fns";
import PeriodicObligationModal from "./PeriodicObligationModal";
import ObligationAttachmentsModal from "./ObligationAttachmentsModal";

interface Obligation {
  id: string;
  name: string;
  recurrence_type: string;
  recurrence_months: number | null;
}

interface ObligationCompletion {
  id: string;
  obligation_id: string;
  completed_at: string;
  attachment_url: string | null;
  notes: string | null;
  reference_month: number | null;
  reference_year: number | null;
  due_date?: string | null;
}

interface PeriodicLatestCompletion {
  obligation_id: string;
  due_date: string | null;
}

interface EmployeeObligationsTabProps {
  employeeId: string;
  employeeName: string;
  storeId: string;
}

interface SelectedAttachment {
  completionId: string;
  obligationName: string;
}

// Helper to parse date strings without timezone issues
const parseLocalDate = (dateString: string) => {
  const datePart = dateString.split('T')[0];
  return parseISO(datePart + 'T12:00:00');
};

const EmployeeObligationsTab = ({ employeeId, employeeName, storeId }: EmployeeObligationsTabProps) => {
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [completions, setCompletions] = useState<ObligationCompletion[]>([]);
  const [periodicLatestCompletions, setPeriodicLatestCompletions] = useState<PeriodicLatestCompletion[]>([]);
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [jobFunctionName, setJobFunctionName] = useState<string>("");
  const [selectedPeriodicObligation, setSelectedPeriodicObligation] = useState<Obligation | null>(null);
  const [selectedAttachment, setSelectedAttachment] = useState<SelectedAttachment | null>(null);
  const { toast } = useToast();

  const fetchAttachmentCounts = async (completionIds: string[]) => {
    if (completionIds.length === 0) return;

    try {
      const { data, error } = await supabase
        .from("employee_obligation_attachments")
        .select("completion_id")
        .in("completion_id", completionIds)
        .eq("is_active", true);

      if (error) throw error;

      const counts: Record<string, number> = {};
      data?.forEach(item => {
        counts[item.completion_id] = (counts[item.completion_id] || 0) + 1;
      });
      setAttachmentCounts(counts);
    } catch (error) {
      console.error("Error fetching attachment counts:", error);
    }
  };

  const fetchObligations = async () => {
    setLoading(true);
    try {
      const { data: employeeData, error: employeeError } = await supabase
        .from("employees")
        .select("job_function_id, job_functions(id, name)")
        .eq("id", employeeId)
        .single();

      if (employeeError) throw employeeError;

      if (!employeeData?.job_function_id) {
        setObligations([]);
        setJobFunctionName("");
        return;
      }

      const jobFunction = employeeData.job_functions as { id: string; name: string } | null;
      setJobFunctionName(jobFunction?.name || "");

      const { data: linkedObligations, error: linkedError } = await supabase
        .from("job_function_obligations")
        .select("obligation_id")
        .eq("job_function_id", employeeData.job_function_id);

      if (linkedError) throw linkedError;

      if (!linkedObligations || linkedObligations.length === 0) {
        setObligations([]);
        return;
      }

      const obligationIds = linkedObligations.map(l => l.obligation_id);

      const { data: obligationsData, error: obligationsError } = await supabase
        .from("employee_obligations")
        .select("id, name, recurrence_type, recurrence_months")
        .in("id", obligationIds)
        .eq("is_active", true)
        .order("name");

      if (obligationsError) throw obligationsError;

      setObligations(obligationsData || []);

      const { data: completionsData, error: completionsError } = await supabase
        .from("employee_obligation_completions")
        .select("*")
        .eq("employee_id", employeeId);

      if (completionsError) throw completionsError;

      setCompletions(completionsData || []);

      // Fetch attachment counts for unique and documentacao obligations
      const uniqueAndDocCompletionIds = completionsData
        ?.filter(c => {
          const obl = obligationsData?.find(o => o.id === c.obligation_id);
          return obl?.recurrence_type === 'unica' || obl?.recurrence_type === 'documentacao';
        })
        .map(c => c.id) || [];
      
      await fetchAttachmentCounts(uniqueAndDocCompletionIds);

      // Fetch latest completion for periodic obligations (to get status)
      const periodicObligationIds = obligationsData
        ?.filter(o => o.recurrence_type === 'periodica')
        .map(o => o.id) || [];

      if (periodicObligationIds.length > 0) {
        const latestCompletions: PeriodicLatestCompletion[] = [];
        
        for (const obligationId of periodicObligationIds) {
          const { data: latestData } = await supabase
            .from("employee_obligation_completions")
            .select("obligation_id, due_date")
            .eq("employee_id", employeeId)
            .eq("obligation_id", obligationId)
            .order("created_at", { ascending: false })
            .limit(1);
          
          if (latestData && latestData.length > 0) {
            latestCompletions.push({
              obligation_id: latestData[0].obligation_id,
              due_date: latestData[0].due_date
            });
          }
        }
        
        setPeriodicLatestCompletions(latestCompletions);
      }
    } catch (error) {
      console.error("Error fetching obligations:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar obrigações",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (employeeId) {
      fetchObligations();
    }
  }, [employeeId]);

  const getCompletion = (obligationId: string): ObligationCompletion | undefined => {
    return completions.find(c => c.obligation_id === obligationId);
  };

  const getPeriodicStatus = (obligationId: string) => {
    const latest = periodicLatestCompletions.find(p => p.obligation_id === obligationId);
    
    if (!latest) {
      return { label: "Pendente", variant: "outline" as const, className: "" };
    }
    
    if (!latest.due_date) {
      return { label: "Vigente", variant: "default" as const, className: "bg-green-500 hover:bg-green-600" };
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dueDate = parseLocalDate(latest.due_date);
    dueDate.setHours(0, 0, 0, 0);
    
    if (isAfter(dueDate, subDays(today, 1))) {
      return { label: "Vigente", variant: "default" as const, className: "bg-green-500 hover:bg-green-600" };
    }
    
    return { label: "Vencido", variant: "destructive" as const, className: "" };
  };

  const handleToggleCompletion = async (obligation: Obligation) => {
    const existingCompletion = getCompletion(obligation.id);

    try {
      if (existingCompletion) {
        // Check if there are attachments before allowing deletion
        const currentAttachmentCount = attachmentCounts[existingCompletion.id] || 0;
        
        if (currentAttachmentCount > 0) {
          toast({
            title: "Não é possível desmarcar",
            description: "Exclua os anexos primeiro através do botão 'Ver'",
            variant: "destructive"
          });
          return;
        }

        const { error } = await supabase
          .from("employee_obligation_completions")
          .delete()
          .eq("id", existingCompletion.id);

        if (error) throw error;

        setCompletions(prev => prev.filter(c => c.id !== existingCompletion.id));
        setAttachmentCounts(prev => {
          const newCounts = { ...prev };
          delete newCounts[existingCompletion.id];
          return newCounts;
        });
        
        toast({
          title: "Removido",
          description: "Conclusão removida"
        });
      } else {
        const { data: user } = await supabase.auth.getUser();
        if (!user.user) throw new Error("Usuário não autenticado");

        const { data, error } = await supabase
          .from("employee_obligation_completions")
          .insert({
            employee_id: employeeId,
            obligation_id: obligation.id,
            completed_by: user.user.id
          })
          .select()
          .single();

        if (error) throw error;

        setCompletions(prev => [...prev, data]);
        
        toast({
          title: "Concluído",
          description: "Obrigação marcada como concluída"
        });
      }
    } catch (error) {
      console.error("Error toggling completion:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar status",
        variant: "destructive"
      });
    }
  };

  const handleFileUpload = async (obligation: Obligation, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(obligation.id);

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Usuário não autenticado");

      let completionId: string;
      const existingCompletion = getCompletion(obligation.id);

      if (existingCompletion) {
        completionId = existingCompletion.id;
      } else {
        // Create completion first
        const { data, error } = await supabase
          .from("employee_obligation_completions")
          .insert({
            employee_id: employeeId,
            obligation_id: obligation.id,
            completed_by: user.user.id
          })
          .select()
          .single();

        if (error) throw error;
        completionId = data.id;
        setCompletions(prev => [...prev, data]);
      }

      // Upload file to storage with store_id as first path segment for RLS compliance
      const fileExt = file.name.split('.').pop();
      const fileName = `${storeId}/${completionId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("obligation-attachments")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Insert into attachments table
      const { error: insertError } = await supabase
        .from("employee_obligation_attachments")
        .insert({
          completion_id: completionId,
          file_path: fileName,
          file_name: file.name,
          uploaded_by: user.user.id
        });

      if (insertError) throw insertError;

      // Update attachment count
      setAttachmentCounts(prev => ({
        ...prev,
        [completionId]: (prev[completionId] || 0) + 1
      }));

      toast({
        title: "Sucesso",
        description: "Anexo enviado com sucesso"
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      toast({
        title: "Erro",
        description: "Erro ao enviar anexo",
        variant: "destructive"
      });
    } finally {
      setUploading(null);
      event.target.value = '';
    }
  };

  const getRecurrenceLabel = (type: string) => {
    if (type === 'periodica') return 'Periódica';
    if (type === 'documentacao') return 'Documentação';
    return 'Única';
  };

  const getDocumentacaoStatus = (obligationId: string) => {
    const completion = getCompletion(obligationId);
    const attachmentCount = completion ? (attachmentCounts[completion.id] || 0) : 0;
    
    if (attachmentCount > 0) {
      return { label: "Concluído", variant: "default" as const, className: "bg-green-500 hover:bg-green-600" };
    }
    return { label: "Pendente", variant: "outline" as const, className: "" };
  };

  const handleAttachmentsChange = (completionId: string, count: number) => {
    setAttachmentCounts(prev => ({
      ...prev,
      [completionId]: count
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Obrigações do Funcionário</CardTitle>
        <CardDescription>
          {jobFunctionName 
            ? `Obrigações vinculadas à função: ${jobFunctionName}` 
            : "Nenhuma função atribuída ao funcionário"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {obligations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>
              {jobFunctionName 
                ? "Nenhuma obrigação vinculada a esta função." 
                : "Funcionário não possui função atribuída."}
            </p>
          </div>
        ) : (
          <Table className="table-sticky-first table-sticky-last">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Status</TableHead>
                <TableHead>Obrigação</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Data Conclusão</TableHead>
                <TableHead>Anexos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {obligations.map((obligation) => {
                const completion = getCompletion(obligation.id);
                const completed = !!completion;
                const isUnica = obligation.recurrence_type === 'unica';
                const isPeriodica = obligation.recurrence_type === 'periodica';
                const isDocumentacao = obligation.recurrence_type === 'documentacao';
                const attachmentCount = completion ? (attachmentCounts[completion.id] || 0) : 0;

                return (
                  <TableRow 
                    key={obligation.id}
                    className={isPeriodica ? "cursor-pointer hover:bg-muted/80" : ""}
                    onClick={isPeriodica ? () => setSelectedPeriodicObligation(obligation) : undefined}
                  >
                    <TableCell>
                      {isUnica && (
                        <Checkbox
                          checked={completed}
                          onCheckedChange={() => handleToggleCompletion(obligation)}
                          className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                      {isPeriodica && (() => {
                        const status = getPeriodicStatus(obligation.id);
                        return (
                          <Badge variant={status.variant} className={status.className}>
                            {status.label}
                          </Badge>
                        );
                      })()}
                      {isDocumentacao && (() => {
                        const status = getDocumentacaoStatus(obligation.id);
                        return (
                          <Badge variant={status.variant} className={status.className}>
                            {status.label}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="font-medium">{obligation.name}</TableCell>
                    <TableCell>
                      <Badge variant={isUnica ? "outline" : "secondary"}>
                        {getRecurrenceLabel(obligation.recurrence_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isUnica && completion?.completed_at 
                        ? format(new Date(completion.completed_at), "dd/MM/yyyy HH:mm")
                        : isPeriodica ? "Ver movimentações" 
                        : isDocumentacao && attachmentCount > 0 ? `${attachmentCount} arquivo(s)`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {(isUnica || isDocumentacao) && completion ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAttachment({
                              completionId: completion.id,
                              obligationName: obligation.name
                            });
                          }}
                          className="text-primary"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Ver ({attachmentCount})
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {(isUnica || isDocumentacao) && (
                        <div className="flex items-center justify-end gap-2">
                          <Input
                            type="file"
                            className="hidden"
                            id={`file-${obligation.id}`}
                            onChange={(e) => handleFileUpload(obligation, e)}
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              document.getElementById(`file-${obligation.id}`)?.click();
                            }}
                            disabled={uploading === obligation.id}
                          >
                            {uploading === obligation.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Paperclip className="w-4 h-4 mr-1" />
                                Anexar
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                      {isPeriodica && (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {selectedPeriodicObligation && (
          <PeriodicObligationModal
            isOpen={!!selectedPeriodicObligation}
            onClose={() => setSelectedPeriodicObligation(null)}
            employeeId={employeeId}
            employeeName={employeeName}
            obligationId={selectedPeriodicObligation.id}
            obligationName={selectedPeriodicObligation.name}
          />
        )}

        {selectedAttachment && (
          <ObligationAttachmentsModal
            isOpen={!!selectedAttachment}
            onClose={() => setSelectedAttachment(null)}
            completionId={selectedAttachment.completionId}
            obligationName={selectedAttachment.obligationName}
            employeeName={employeeName}
            onAttachmentsChange={(count) => handleAttachmentsChange(selectedAttachment.completionId, count)}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default EmployeeObligationsTab;
