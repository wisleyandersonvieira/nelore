import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  transfer_date: z.date({
    required_error: "Data é obrigatória",
  }),
  store_id: z.string().min(1, "Loja é obrigatória"),
  source_account_id: z.string().min(1, "Conta origem é obrigatória"),
  source_account_type: z.enum(['current', 'cash', 'card', 'delivery']),
  destination_account_id: z.string().min(1, "Conta destino é obrigatória"),
  destination_account_type: z.enum(['current', 'cash', 'card', 'delivery']),
  amount: z.string().min(1, "Valor é obrigatório").transform((val) => parseFloat(val)),
  description: z.string().optional(),
}).refine(
  (data) => {
    return !(data.source_account_id === data.destination_account_id && 
             data.source_account_type === data.destination_account_type);
  },
  {
    message: "Conta origem deve ser diferente da conta destino",
    path: ["destination_account_id"],
  }
);

type FormData = z.infer<typeof formSchema>;

interface Transfer {
  id: string;
  store_id: string;
  transfer_date: string;
  source_account_id: string;
  destination_account_id: string;
  source_account_type: 'current' | 'cash' | 'card' | 'delivery';
  destination_account_type: 'current' | 'cash' | 'card' | 'delivery';
  amount: number;
  description: string | null;
}

interface Store {
  id: string;
  name: string;
}

interface Account {
  id: string;
  name: string;
  type: 'current' | 'cash' | 'card' | 'delivery';
}

interface TransferFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transfer?: Transfer | null;
  readonly?: boolean;
  stores: Store[];
  accounts: Account[];
}

export function TransferFormModal({ 
  open, 
  onOpenChange, 
  transfer, 
  readonly = false,
  stores,
  accounts 
}: TransferFormModalProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      transfer_date: new Date(),
      store_id: "",
      source_account_id: "",
      source_account_type: "current",
      destination_account_id: "",
      destination_account_type: "current",
      amount: "" as any,
      description: "",
    },
  });

  // Carrega dados do transfer quando em modo de edição
  useEffect(() => {
    if (transfer && open) {
      form.reset({
        transfer_date: new Date(transfer.transfer_date),
        store_id: transfer.store_id,
        source_account_id: transfer.source_account_id,
        source_account_type: transfer.source_account_type,
        destination_account_id: transfer.destination_account_id,
        destination_account_type: transfer.destination_account_type,
        amount: transfer.amount.toString() as any,
        description: transfer.description || "",
      });
    } else if (!transfer && open) {
      form.reset({
        transfer_date: new Date(),
        store_id: "",
        source_account_id: "",
        source_account_type: "current",
        destination_account_id: "",
        destination_account_type: "current",
        amount: "" as any,
        description: "",
      });
    }
  }, [transfer, open, form]);

  const onSubmit = async (data: FormData) => {
    if (readonly) return;

    setLoading(true);

    const transferData = {
      store_id: data.store_id,
      transfer_date: format(data.transfer_date, 'yyyy-MM-dd'),
      source_account_id: data.source_account_id,
      source_account_type: data.source_account_type,
      destination_account_id: data.destination_account_id,
      destination_account_type: data.destination_account_type,
      amount: data.amount,
      description: data.description || null,
    };

    let error;

    if (transfer) {
      // Atualizar
      const result = await supabase
        .from('transfers')
        .update(transferData)
        .eq('id', transfer.id);
      error = result.error;
    } else {
      // Criar
      const result = await supabase
        .from('transfers')
        .insert(transferData);
      error = result.error;
    }

    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao salvar transferência",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    toast({
      title: "Sucesso",
      description: `Transferência ${transfer ? 'atualizada' : 'cadastrada'} com sucesso`,
    });

    setLoading(false);
    onOpenChange(false);
  };

  const getAccountTypeLabel = (type: string) => {
    const labels = {
      current: 'Conta Corrente',
      cash: 'Conta Caixa',
      card: 'Conta Cartão',
      delivery: 'Delivery'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getAccountsByType = (type: 'current' | 'cash' | 'card' | 'delivery') => {
    return accounts.filter(acc => acc.type === type);
  };

  const watchSourceAccountType = form.watch("source_account_type");
  const watchDestinationAccountType = form.watch("destination_account_type");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {readonly ? 'Visualizar' : transfer ? 'Editar' : 'Cadastrar'} Transferência
          </DialogTitle>
          <DialogDescription>
            {readonly 
              ? 'Visualize os detalhes da transferência' 
              : transfer 
                ? 'Edite os dados da transferência' 
                : 'Preencha os dados para cadastrar uma nova transferência'
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="transfer_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          disabled={readonly}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Selecione uma data</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => readonly}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="store_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Loja</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={readonly}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma loja" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {stores.map((store) => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="source_account_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo Conta Origem</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={readonly}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="current">Conta Corrente</SelectItem>
                        <SelectItem value="cash">Conta Caixa</SelectItem>
                        <SelectItem value="card">Conta Cartão</SelectItem>
                        <SelectItem value="delivery">Delivery</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="source_account_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conta Origem</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={readonly}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma conta" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {getAccountsByType(watchSourceAccountType).map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="destination_account_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo Conta Destino</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={readonly}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="current">Conta Corrente</SelectItem>
                        <SelectItem value="cash">Conta Caixa</SelectItem>
                        <SelectItem value="card">Conta Cartão</SelectItem>
                        <SelectItem value="delivery">Delivery</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="destination_account_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conta Destino</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={readonly}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma conta" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {getAccountsByType(watchDestinationAccountType).map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      disabled={readonly}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Histórico (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Digite o histórico da transferência..."
                      disabled={readonly}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!readonly && (
              <div className="flex gap-2 justify-end pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Salvando..." : "Salvar Transferência"}
                </Button>
              </div>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}