import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, Check, FileText, Paperclip, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

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
}

interface EmployeeObligationsTabProps {
  employeeId: string;
  employeeName: string;
  storeId: string;
}

const EmployeeObligationsTab = ({ employeeId, employeeName, storeId }: EmployeeObligationsTabProps) => {
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [completions, setCompletions] = useState<ObligationCompletion[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [jobFunctionName, setJobFunctionName] = useState<string>("");
  const { toast } = useToast();

  const fetchObligations = async () => {
    setLoading(true);
    try {
      // First, get the employee's job function
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

      // Type assertion for job_functions
      const jobFunction = employeeData.job_functions as { id: string; name: string } | null;
      setJobFunctionName(jobFunction?.name || "");

      // Get obligations linked to this job function
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

      // Fetch the actual obligation details
      const { data: obligationsData, error: obligationsError } = await supabase
        .from("employee_obligations")
        .select("id, name, recurrence_type, recurrence_months")
        .in("id", obligationIds)
        .eq("is_active", true)
        .order("name");

      if (obligationsError) throw obligationsError;

      setObligations(obligationsData || []);

      // Fetch completions for this employee
      const { data: completionsData, error: completionsError } = await supabase
        .from("employee_obligation_completions")
        .select("*")
        .eq("employee_id", employeeId);

      if (completionsError) throw completionsError;

      setCompletions(completionsData || []);
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
    // For unique obligations, just find any completion
    return completions.find(c => c.obligation_id === obligationId);
  };

  const isCompleted = (obligationId: string): boolean => {
    return !!getCompletion(obligationId);
  };

  const handleToggleCompletion = async (obligation: Obligation) => {
    const existingCompletion = getCompletion(obligation.id);

    try {
      if (existingCompletion) {
        // Remove completion
        const { error } = await supabase
          .from("employee_obligation_completions")
          .delete()
          .eq("id", existingCompletion.id);

        if (error) throw error;

        setCompletions(prev => prev.filter(c => c.id !== existingCompletion.id));
        
        toast({
          title: "Removido",
          description: "Conclusão removida"
        });
      } else {
        // Add completion
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

      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${employeeId}/${obligation.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("obligation-attachments")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("obligation-attachments")
        .getPublicUrl(fileName);

      const attachmentUrl = urlData.publicUrl;

      // Check if completion exists
      const existingCompletion = getCompletion(obligation.id);

      if (existingCompletion) {
        // Update existing completion with attachment
        const { data, error } = await supabase
          .from("employee_obligation_completions")
          .update({ attachment_url: attachmentUrl })
          .eq("id", existingCompletion.id)
          .select()
          .single();

        if (error) throw error;

        setCompletions(prev => prev.map(c => c.id === existingCompletion.id ? data : c));
      } else {
        // Create new completion with attachment
        const { data, error } = await supabase
          .from("employee_obligation_completions")
          .insert({
            employee_id: employeeId,
            obligation_id: obligation.id,
            completed_by: user.user.id,
            attachment_url: attachmentUrl
          })
          .select()
          .single();

        if (error) throw error;

        setCompletions(prev => [...prev, data]);
      }

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
    }
  };

  const getRecurrenceLabel = (type: string) => {
    return type === 'periodica' ? 'Periódica' : 'Única';
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Status</TableHead>
                <TableHead>Obrigação</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Data Conclusão</TableHead>
                <TableHead>Anexo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {obligations.map((obligation) => {
                const completion = getCompletion(obligation.id);
                const completed = !!completion;
                const isUnica = obligation.recurrence_type === 'unica';

                return (
                  <TableRow key={obligation.id}>
                    <TableCell>
                      {isUnica && (
                        <Checkbox
                          checked={completed}
                          onCheckedChange={() => handleToggleCompletion(obligation)}
                          className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                        />
                      )}
                      {!isUnica && (
                        <Badge variant={completed ? "default" : "secondary"} className="text-xs">
                          {completed ? <Check className="w-3 h-3" /> : "-"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{obligation.name}</TableCell>
                    <TableCell>
                      <Badge variant={isUnica ? "outline" : "secondary"}>
                        {getRecurrenceLabel(obligation.recurrence_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {completion?.completed_at 
                        ? format(new Date(completion.completed_at), "dd/MM/yyyy HH:mm")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {completion?.attachment_url ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(completion.attachment_url!, '_blank')}
                          className="text-primary"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Ver
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isUnica && (
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
                            onClick={() => document.getElementById(`file-${obligation.id}`)?.click()}
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
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default EmployeeObligationsTab;
