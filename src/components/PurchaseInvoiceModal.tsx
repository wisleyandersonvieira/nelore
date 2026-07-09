import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  PURCHASE_INVOICE_ACCEPT,
  PurchaseInvoice,
  fetchPurchaseInvoice,
  getPurchaseInvoiceUrl,
  removePurchaseInvoice,
  uploadPurchaseInvoice,
} from "@/lib/purchases";

interface PurchaseInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseId: string | null;
  purchaseCode?: number | string | null;
  canEdit?: boolean;
  onSaved?: () => Promise<void> | void;
}

export function PurchaseInvoiceModal({
  open,
  onOpenChange,
  purchaseId,
  purchaseCode,
  canEdit = true,
  onSaved,
}: PurchaseInvoiceModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [invoice, setInvoice] = useState<PurchaseInvoice | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open || !purchaseId) {
      setInvoice(null);
      setSelectedFile(null);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        setInvoice(await fetchPurchaseInvoice(purchaseId));
      } catch (error) {
        console.error("Erro ao carregar nota fiscal:", error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar a nota fiscal da compra.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [open, purchaseId]);

  const handleView = async () => {
    if (!invoice) return;
    try {
      const url = await getPurchaseInvoiceUrl(invoice.filePath);
      window.open(url, "_blank");
    } catch (error) {
      console.error("Erro ao abrir nota fiscal:", error);
      toast({
        title: "Erro",
        description: "Não foi possível abrir a nota fiscal.",
        variant: "destructive",
      });
    }
  };

  const handleUpload = async () => {
    if (!purchaseId || !selectedFile) return;
    setSaving(true);
    try {
      setInvoice(await uploadPurchaseInvoice(purchaseId, selectedFile));
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast({ title: "Nota fiscal anexada", description: "O arquivo foi vinculado à compra." });
      await onSaved?.();
    } catch (error: any) {
      console.error("Erro ao enviar nota fiscal:", error);
      toast({
        title: "Erro ao enviar",
        description: error?.message || "Não foi possível enviar a nota fiscal.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!purchaseId) return;
    setSaving(true);
    try {
      await removePurchaseInvoice(purchaseId);
      setInvoice(null);
      toast({ title: "Nota fiscal removida", description: "O arquivo foi desvinculado da compra." });
      await onSaved?.();
    } catch (error: any) {
      console.error("Erro ao remover nota fiscal:", error);
      toast({
        title: "Erro ao remover",
        description: error?.message || "Não foi possível remover a nota fiscal.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-600" />
            Upload de NF{purchaseCode ? ` - Compra #${purchaseCode}` : ""}
          </DialogTitle>
          <DialogDescription>
            Anexe a nota fiscal da compra. O envio é opcional e pode ser feito a qualquer momento.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {invoice ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-muted/40 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-medium">{invoice.fileName}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button type="button" variant="ghost" size="sm" onClick={handleView}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  {canEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={handleRemove}
                      disabled={saving}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <p className="rounded-md border border-dashed border-border/70 px-3 py-6 text-center text-sm text-muted-foreground">
                Nenhuma nota fiscal anexada a esta compra.
              </p>
            )}

            {canEdit && (
              <div className="space-y-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept={PURCHASE_INVOICE_ACCEPT}
                  onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground">
                  Formatos aceitos: PDF, XML, JPG ou PNG.
                  {invoice ? " O envio de um novo arquivo substitui o atual." : ""}
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Fechar
          </Button>
          {canEdit && (
            <Button type="button" onClick={handleUpload} disabled={!selectedFile || saving || loading}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Enviar nota fiscal
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PurchaseInvoiceModal;
