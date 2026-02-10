import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { Paperclip, Download } from "lucide-react";
import { toast } from "sonner";
import type { ServiceOrder } from "@/types/serviceOrder";

interface ServiceOrderViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: ServiceOrder | null;
}

export const ServiceOrderViewModal = ({ open, onOpenChange, order }: ServiceOrderViewModalProps) => {
  const [creatorName, setCreatorName] = useState<string>("");
  const [editorName, setEditorName] = useState<string>("");

  useEffect(() => {
    if (open && order?.created_by) {
      fetchCreatorName(order.created_by);
    }
    if (open && order?.updated_by) {
      fetchEditorName(order.updated_by);
    } else {
      setEditorName("");
    }
  }, [open, order?.created_by, order?.updated_by]);

  const fetchCreatorName = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', userId)
        .single();
      
      if (data?.name) {
        setCreatorName(data.name);
      }
    } catch (error) {
      console.error('Error fetching creator name:', error);
    }
  };

  const fetchEditorName = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', userId)
        .single();
      
      if (data?.name) {
        setEditorName(data.name);
      }
    } catch (error) {
      console.error('Error fetching editor name:', error);
    }
  };

  if (!order) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'aberta':
        return <Badge variant="secondary" className="border-warning text-warning-foreground bg-warning/20">Aberta</Badge>;
      case 'em_andamento':
        return <Badge variant="secondary" className="border-primary text-primary bg-primary/10">Em Andamento</Badge>;
      case 'fechada':
        return <Badge variant="secondary" className="border-green-600 text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400">Fechada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleDownload = async (attachment: any) => {
    try {
      const { data, error } = await supabase.storage
        .from('attachments')
        .download(attachment.path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Erro ao baixar arquivo');
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Detalhes da OS
            {getStatusBadge(order.status)}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Main Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Número da OS</p>
              <p className="font-medium">{order.os_number}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Número da NF</p>
              <p className="font-medium">{order.nf_number || '-'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Data da OS</p>
              <p className="font-medium">{format(parseISO(order.os_date), "dd/MM/yyyy")}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Data do Cadastro</p>
              <p className="font-medium">{format(parseISO(order.registration_date), "dd/MM/yyyy")}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Loja</p>
              <p className="font-medium">
                {order.stores?.code} - {order.stores?.name}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fornecedor</p>
              <p className="font-medium">{order.suppliers?.name || '-'}</p>
            </div>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Valor</p>
            <p className="font-medium">{formatCurrency(order.value)}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Descrição</p>
            <p className="font-medium whitespace-pre-wrap">{order.description}</p>
          </div>

          {/* Attachments */}
          {order.attachments && order.attachments.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Anexos</p>
              <div className="space-y-2">
                {order.attachments.map((attachment, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-md bg-muted/30"
                  >
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{attachment.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownload(attachment)}
                      title="Baixar"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer Info */}
          <div className="border-t pt-4 text-sm text-muted-foreground space-y-1">
            <p>
              Criado em: {format(parseISO(order.created_at || order.registration_date), "dd/MM/yyyy 'às' HH:mm")}
              {creatorName && ` por ${creatorName}`}
            </p>
            {order.updated_by && order.updated_at && (
              <p>
                Editado em: {format(parseISO(order.updated_at), "dd/MM/yyyy 'às' HH:mm")}
                {editorName && ` por ${editorName}`}
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
