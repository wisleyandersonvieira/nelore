import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Supplier {
  id: string;
  name: string;
  cnpj_cpf?: string;
}

interface SupplierSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectSupplier: (supplier: Supplier) => void;
}

export function SupplierSearchModal({ 
  open, 
  onOpenChange, 
  onSelectSupplier 
}: SupplierSearchModalProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);
  const [searchName, setSearchName] = useState("");
  const [searchCnpj, setSearchCnpj] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchSuppliers();
    }
  }, [open]);

  useEffect(() => {
    filterSuppliers();
  }, [searchName, searchCnpj, suppliers]);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, cnpj_cpf")
        .eq("is_active", true)
        .eq("is_supplier", true)
        .order("name");

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      toast({
        title: "Erro",
        description: "Erro ao buscar fornecedores",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterSuppliers = () => {
    let filtered = suppliers;

    if (searchName.trim()) {
      filtered = filtered.filter(supplier =>
        supplier.name.toLowerCase().includes(searchName.toLowerCase())
      );
    }

    if (searchCnpj.trim()) {
      filtered = filtered.filter(supplier =>
        supplier.cnpj_cpf?.includes(searchCnpj.replace(/\D/g, '')) // Remove non-numeric chars
      );
    }

    setFilteredSuppliers(filtered);
  };

  const handleSelectSupplier = (supplier: Supplier) => {
    onSelectSupplier(supplier);
    onOpenChange(false);
    setSearchName("");
    setSearchCnpj("");
  };

  const formatCnpjCpf = (value?: string) => {
    if (!value) return "";
    const numbers = value.replace(/\D/g, '');
    if (numbers.length === 11) {
      return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else if (numbers.length === 14) {
      return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return value;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80dvh]">
        <DialogHeader>
          <DialogTitle>Pesquisar Fornecedor</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Nome</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Digite o nome do fornecedor..."
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">CNPJ/CPF</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Digite o CNPJ/CPF..."
                  value={searchCnpj}
                  onChange={(e) => setSearchCnpj(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="border rounded-md max-h-96 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CNPJ/CPF</TableHead>
                  <TableHead className="w-20">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredSuppliers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                      Nenhum fornecedor encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSuppliers.map((supplier) => (
                    <TableRow key={supplier.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell>{supplier.name}</TableCell>
                      <TableCell>{formatCnpjCpf(supplier.cnpj_cpf)}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => handleSelectSupplier(supplier)}
                          variant="ghost"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}