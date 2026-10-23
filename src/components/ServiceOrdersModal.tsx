import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Eye, Pencil, CalendarIcon, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ServiceOrderFormModal } from "./ServiceOrderFormModal";
import { ServiceOrderViewModal } from "./ServiceOrderViewModal";
import { useServiceOrderDeletePermission } from "@/hooks/useServiceOrderDeletePermission";
import type { ServiceOrder, Store } from "@/types/serviceOrder";

interface ServiceOrdersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ServiceOrdersModal = ({ open, onOpenChange }: ServiceOrdersModalProps) => {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStores, setLoadingStores] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Modal states
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Dropdown for status change
  const [statusDropdownOpen, setStatusDropdownOpen] = useState<string | null>(null);

  // Delete permission and state
  const { canDelete } = useServiceOrderDeletePermission();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<ServiceOrder | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      fetchUserStores();
      setHasSearched(false);
      setServiceOrders([]);
    }
  }, [open]);

  const handleSearch = () => {
    setHasSearched(true);
    fetchServiceOrders();
  };

  const fetchUserStores = async () => {
    setLoadingStores(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, store_id')
        .eq('id', user.id)
        .single();

      if (profile?.role === 'admin') {
        const { data } = await supabase
          .from('stores')
          .select('id, name, code')
          .order('name');
        if (data) setStores(data);
      } else {
        const storeIds: string[] = [];
        if (profile?.store_id) storeIds.push(profile.store_id);

        const { data: userStores } = await supabase
          .from('user_stores')
          .select('store_id')
          .eq('user_id', user.id);

        if (userStores) {
          userStores.forEach(us => {
            if (!storeIds.includes(us.store_id)) {
              storeIds.push(us.store_id);
            }
          });
        }

        if (storeIds.length > 0) {
          const { data } = await supabase
            .from('stores')
            .select('id, name, code')
            .in('id', storeIds)
            .order('name');
          if (data) setStores(data);
        }
      }
    } catch (error) {
      console.error('Error fetching stores:', error);
      toast.error('Erro ao carregar lojas');
    } finally {
      setLoadingStores(false);
    }
  };

  const fetchServiceOrders = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('service_orders')
        .select(`
          *,
          stores:store_id(name, code),
          suppliers:supplier_id(name)
        `)
        .order('registration_date', { ascending: false });

      // Filter by selected stores
      if (selectedStores.length > 0) {
        query = query.in('store_id', selectedStores);
      } else if (stores.length > 0) {
        query = query.in('store_id', stores.map(s => s.id));
      }

      // Filter by status
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      // Filter by date range
      if (startDate) {
        query = query.gte('registration_date', format(startDate, 'yyyy-MM-dd'));
      }
      if (endDate) {
        query = query.lte('registration_date', format(endDate, 'yyyy-MM-dd'));
      }

      const { data, error } = await query;

      if (error) throw error;
      // Map data to ensure proper types
      const mappedData: ServiceOrder[] = (data || []).map((item: any) => ({
        ...item,
        attachments: Array.isArray(item.attachments) ? item.attachments : []
      }));
      setServiceOrders(mappedData);
    } catch (error) {
      console.error('Error fetching service orders:', error);
      toast.error('Erro ao carregar ordens de serviço');
    } finally {
      setLoading(false);
    }
  };

  const handleStoreSelection = (storeId: string, checked: boolean) => {
    if (checked) {
      setSelectedStores([...selectedStores, storeId]);
    } else {
      setSelectedStores(selectedStores.filter(id => id !== storeId));
    }
  };

  const handleSelectAllStores = (checked: boolean) => {
    if (checked) {
      setSelectedStores(stores.map(s => s.id));
    } else {
      setSelectedStores([]);
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('service_orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;
      
      toast.success('Status atualizado com sucesso');
      fetchServiceOrders();
      setStatusDropdownOpen(null);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const handleView = (order: ServiceOrder) => {
    setSelectedOrder(order);
    setViewModalOpen(true);
  };

  const handleEdit = (order: ServiceOrder) => {
    setSelectedOrder(order);
    setIsEditing(true);
    setFormModalOpen(true);
  };

  const handleNewOrder = () => {
    setSelectedOrder(null);
    setIsEditing(false);
    setFormModalOpen(true);
  };

  const handleDeleteClick = (order: ServiceOrder) => {
    setOrderToDelete(order);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!orderToDelete) return;
    
    setDeleting(true);
    try {
      // Delete attachments from storage if any
      if (orderToDelete.attachments && orderToDelete.attachments.length > 0) {
        const paths = orderToDelete.attachments.map((att: any) => att.path);
        await supabase.storage.from('attachments').remove(paths);
      }

      const { error } = await supabase
        .from('service_orders')
        .delete()
        .eq('id', orderToDelete.id);

      if (error) throw error;
      
      toast.success('OS excluída com sucesso');
      fetchServiceOrders();
    } catch (error: any) {
      console.error('Error deleting service order:', error);
      toast.error(error.message || 'Erro ao excluir OS');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setOrderToDelete(null);
    }
  };

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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90dvh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Registro de OS</DialogTitle>
            <DialogDescription>
              Gerencie as ordens de serviço cadastradas
            </DialogDescription>
          </DialogHeader>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            {/* Store Filter */}
            <div className="space-y-2">
              <Label>Lojas</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    {selectedStores.length === 0 
                      ? "Todas as lojas" 
                      : `${selectedStores.length} loja(s) selecionada(s)`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2">
                  {loadingStores ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {/* Select All Option */}
                      <div className="flex items-center space-x-2 border-b pb-2 mb-2">
                        <Checkbox
                          id="select-all"
                          checked={selectedStores.length === stores.length && stores.length > 0}
                          onCheckedChange={(checked) => handleSelectAllStores(checked as boolean)}
                        />
                        <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                          Selecionar todas
                        </label>
                      </div>
                      {stores.map((store) => (
                        <div key={store.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={store.id}
                            checked={selectedStores.includes(store.id)}
                            onCheckedChange={(checked) => handleStoreSelection(store.id, checked as boolean)}
                          />
                          <label htmlFor={store.id} className="text-sm cursor-pointer">
                            {store.code} - {store.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label>Situação</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="aberta">Aberta</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="fechada">Fechada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <Label>Data Inicial</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label>Data Final</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => {
                setSelectedStores([]);
                setStatusFilter("all");
                setStartDate(undefined);
                setEndDate(undefined);
                setHasSearched(false);
                setServiceOrders([]);
              }}>
                Limpar Filtros
              </Button>
              <Button onClick={handleSearch}>
                Pesquisar
              </Button>
            </div>
            <Button onClick={handleNewOrder}>
              <Plus className="h-4 w-4 mr-2" />
              Cadastrar OS
            </Button>
          </div>

          {/* Table */}
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data OS</TableHead>
                  <TableHead>Número OS</TableHead>
                  <TableHead>Loja</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!hasSearched ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Utilize os filtros acima e clique em Pesquisar para buscar as ordens de serviço
                    </TableCell>
                  </TableRow>
                ) : loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : serviceOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhuma OS encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  serviceOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        {format(parseISO(order.os_date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>{order.os_number}</TableCell>
                      <TableCell>
                        {order.stores?.code} - {order.stores?.name}
                      </TableCell>
                      <TableCell>{order.suppliers?.name || '-'}</TableCell>
                      <TableCell>
                        <Popover 
                          open={statusDropdownOpen === order.id}
                          onOpenChange={(open) => setStatusDropdownOpen(open ? order.id : null)}
                        >
                          <PopoverTrigger asChild>
                            <button className="cursor-pointer">
                              {getStatusBadge(order.status)}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-40 p-1">
                            <div className="flex flex-col gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="justify-start"
                                onClick={() => handleStatusChange(order.id, 'aberta')}
                              >
                                Aberta
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="justify-start"
                                onClick={() => handleStatusChange(order.id, 'em_andamento')}
                              >
                                Em Andamento
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="justify-start"
                                onClick={() => handleStatusChange(order.id, 'fechada')}
                              >
                                Fechada
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleView(order)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(order)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {canDelete && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDeleteClick(order)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Form Modal for Create/Edit */}
      <ServiceOrderFormModal
        open={formModalOpen}
        onOpenChange={setFormModalOpen}
        order={selectedOrder}
        isEditing={isEditing}
        stores={stores}
        onSuccess={() => {
          fetchServiceOrders();
          setFormModalOpen(false);
        }}
      />

      {/* View Modal */}
      <ServiceOrderViewModal
        open={viewModalOpen}
        onOpenChange={setViewModalOpen}
        order={selectedOrder}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a OS {orderToDelete?.os_number}? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
