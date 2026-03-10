import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface CreateLeilaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (newAuction: { id: string; name: string }) => void;
}

export function CreateLeilaoModal({ open, onOpenChange, onCreated }: CreateLeilaoModalProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({ name: "", city: "" });
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.name.trim() || !selectedDate) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const { data: profile } = await supabase
        .from("profiles")
        .select("store_id")
        .eq("id", userData.user.id)
        .single();

      if (!profile?.store_id) {
        const { data: userStore } = await supabase
          .from("user_stores")
          .select("store_id")
          .eq("user_id", userData.user.id)
          .limit(1)
          .single();
        
        if (!userStore?.store_id) throw new Error("Fazenda não encontrada");
        
        const storeId = userStore.store_id;
        const { data: codeData } = await supabase.rpc("get_next_leilao_code", { store_uuid: storeId });
        const nextCode = codeData || 1;

        const { data: newLeilao, error } = await supabase.from("leiloes").insert({
          code: nextCode,
          name: formData.name.trim(),
          date: format(selectedDate, "yyyy-MM-dd"),
          city: formData.city.trim() || null,
          store_id: storeId,
        }).select("id, name").single();

        if (error) throw error;
        toast({ title: "Sucesso", description: "Leilão cadastrado com sucesso!" });
        onCreated(newLeilao);
        resetAndClose();
        return;
      }

      const storeId = profile.store_id;
      const { data: codeData } = await supabase.rpc("get_next_leilao_code", { store_uuid: storeId });
      const nextCode = codeData || 1;

      const { data: newLeilao, error } = await supabase.from("leiloes").insert({
        code: nextCode,
        name: formData.name.trim(),
        date: format(selectedDate, "yyyy-MM-dd"),
        city: formData.city.trim(),
        store_id: storeId,
      }).select("id, name").single();

      if (error) throw error;
      toast({ title: "Sucesso", description: "Leilão cadastrado com sucesso!" });
      onCreated(newLeilao);
      resetAndClose();
    } catch (error: any) {
      console.error("Erro ao salvar leilão:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar leilão.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const resetAndClose = () => {
    setFormData({ name: "", city: "" });
    setSelectedDate(undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetAndClose(); else onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastrar Leilão</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nome do leilão"
            />
          </div>

          <div>
            <Label>Data *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-[60]" align="start">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label>Cidade *</Label>
            <Input
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="Cidade do leilão"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-purple-500 hover:bg-purple-600">
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
