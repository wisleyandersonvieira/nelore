import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, DollarSign, CreditCard, Building2, Truck, Trash2, Plus, Eye, Ban } from "lucide-react";
import { validateCashControlPeriod } from "@/utils/periodValidation";

interface CashRegisterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  storeId: string;
  mode?: 'view' | 'edit' | 'create';
  onBack?: () => void;
}

interface CashControl {
  id?: string;
  date: string;
  saldo_inicial: number;
  contagem_dinheiro: number;
  despesas_pagas: number;
  valor_mantido_caixa: number;
  faturamento_dinheiro: number;
  faturamento_cartao: number;
  faturamento_conta: number;
  faturamento_delivery: number;
  faturamento_total: number;
  valor_fechamento_pdv: number;
  diferenca: number;
  anexos: any;
  image_urls?: string[];
  created_by_name?: string;
  edit_history?: Array<{edited_at: string; edited_by: string; edited_by_name: string}>;
  attachment_status?: Array<{url: string; disabled: boolean}>;
}

interface AttachmentStatus {
  url: string;
  disabled: boolean;
}

interface CardItem {
  id?: string;
  card_account_id: string;
  card_name?: string;
  valor: number;
}

interface AccountItem {
  id?: string;
  current_account_id: string;
  account_name?: string;
  valor: number;
}

interface DeliveryItem {
  id?: string;
  delivery_account_id: string;
  delivery_name?: string;
  valor: number;
}

interface CashItem {
  id?: string;
  cash_account_id: string;
  cash_name?: string;
  valor: number;
}

interface CardAccount {
  id: string;
  name: string;
}

interface CurrentAccount {
  id: string;
  name: string;
}

interface DeliveryAccount {
  id: string;
  name: string;
}

interface CashAccount {
  id: string;
  name: string;
}

const formSchema = z.object({
  saldo_inicial: z.number().min(0),
  contagem_dinheiro: z.number().min(0),
  despesas_pagas: z.number().min(0),
  valor_mantido_caixa: z.number().min(0),
  valor_fechamento_pdv: z.number().min(0),
});

export const CashRegisterModal = ({ open, onOpenChange, date, storeId, mode = 'create', onBack }: CashRegisterModalProps) => {
  const [cashControl, setCashControl] = useState<CashControl | null>(null);
  const [cardItems, setCardItems] = useState<CardItem[]>([]);
  const [accountItems, setAccountItems] = useState<AccountItem[]>([]);
  const [deliveryItems, setDeliveryItems] = useState<DeliveryItem[]>([]);
  const [cashItems, setCashItems] = useState<CashItem[]>([]);
  
  const [cardAccounts, setCardAccounts] = useState<CardAccount[]>([]);
  const [currentAccounts, setCurrentAccounts] = useState<CurrentAccount[]>([]);
  const [deliveryAccounts, setDeliveryAccounts] = useState<DeliveryAccount[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<string[]>([]);
  const [attachmentStatus, setAttachmentStatus] = useState<AttachmentStatus[]>([]);
  const [editHistory, setEditHistory] = useState<Array<{edited_at: string; edited_by: string; edited_by_name: string}>>([]);
  const [createdInfo, setCreatedInfo] = useState<{created_at?: string; created_by_name?: string} | null>(null);
  
  const [loading, setLoading] = useState(false);

  const isReadOnly = mode === 'view';

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      saldo_inicial: 0,
      contagem_dinheiro: 0,
      despesas_pagas: 0,
      valor_mantido_caixa: 0,
      valor_fechamento_pdv: 0,
    },
  });

  // Format date properly to avoid timezone issues
  const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    if (open) {
      fetchData();
      fetchAccounts();
    } else {
      // Limpar estados quando fechar o modal
      setAttachments([]);
      setExistingAttachments([]);
      setAttachmentStatus([]);
      setEditHistory([]);
      setCreatedInfo(null);
      setCashItems([]);
      form.reset();
    }
  }, [open, dateString, storeId]);

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from('cash_control')
        .select('*')
        .eq('store_id', storeId)
        .eq('date', dateString)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setCashControl(data as any);
        form.reset({
          saldo_inicial: data.saldo_inicial || 0,
          contagem_dinheiro: data.contagem_dinheiro || 0,
          despesas_pagas: data.despesas_pagas || 0,
          valor_mantido_caixa: data.valor_mantido_caixa || 0,
          valor_fechamento_pdv: data.valor_fechamento_pdv || 0,
        });

        // Carregar anexos existentes
        if (data.image_urls && data.image_urls.length > 0) {
          setExistingAttachments(data.image_urls);
          // Carregar status dos anexos
          if (data.attachment_status && Array.isArray(data.attachment_status)) {
            setAttachmentStatus(data.attachment_status as unknown as AttachmentStatus[]);
          } else {
            // Inicializar status como habilitado para anexos existentes
            setAttachmentStatus(data.image_urls.map((url: string) => ({ url, disabled: false })));
          }
        }

        // Carregar info de criação
        setCreatedInfo({
          created_at: data.created_at,
          created_by_name: data.created_by_name
        });

        // Carregar histórico de edições
        if (data.edit_history && Array.isArray(data.edit_history)) {
          setEditHistory(data.edit_history as unknown as Array<{edited_at: string; edited_by: string; edited_by_name: string}>);
        }

        // Fetch items
        await fetchItems(data.id);
      } else {
        // Não existe registro para a data atual - buscar valor do dia anterior
        let saldoInicialPrevio = 0;
        
        if (mode === 'create') {
          // Calcular a data do dia anterior
          const previousDate = new Date(date);
          previousDate.setDate(previousDate.getDate() - 1);
          const previousDateString = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, '0')}-${String(previousDate.getDate()).padStart(2, '0')}`;
          
          // Buscar dados do dia anterior
          const { data: previousData } = await supabase
            .from('cash_control')
            .select('valor_mantido_caixa')
            .eq('store_id', storeId)
            .eq('date', previousDateString)
            .maybeSingle();
          
          if (previousData && previousData.valor_mantido_caixa) {
            saldoInicialPrevio = previousData.valor_mantido_caixa;
          }
        }
        
        setCashControl(null);
        setCardItems([]);
        setAccountItems([]);
        setDeliveryItems([]);
        setCashItems([]);
        setExistingAttachments([]);
        setAttachmentStatus([]);
        setAttachments([]);
        setEditHistory([]);
        setCreatedInfo(null);
        
        // Preencher o saldo inicial com o valor do dia anterior (ou zero)
        form.reset({
          saldo_inicial: saldoInicialPrevio,
          contagem_dinheiro: 0,
          despesas_pagas: 0,
          valor_mantido_caixa: 0,
          valor_fechamento_pdv: 0,
        });
      }
    } catch (error) {
      console.error('Erro ao carregar dados do caixa:', error);
      toast.error('Erro ao carregar dados do caixa');
    }
  };

  const fetchItems = async (cashControlId: string) => {
    try {
      // Fetch card items
      const { data: cardData } = await supabase
        .from('cash_control_card_items')
        .select(`
          *,
          card_accounts (name)
        `)
        .eq('cash_control_id', cashControlId);

      // Fetch account items
      const { data: accountData } = await supabase
        .from('cash_control_account_items')
        .select(`
          *,
          current_accounts (name)
        `)
        .eq('cash_control_id', cashControlId);

      // Fetch delivery items
      const { data: deliveryData } = await supabase
        .from('cash_control_delivery_items')
        .select(`
          *,
          delivery_accounts (name)
        `)
        .eq('cash_control_id', cashControlId);

      // Fetch cash items
      const { data: cashData } = await supabase
        .from('cash_control_cash_items')
        .select(`
          *,
          cash_accounts (name)
        `)
        .eq('cash_control_id', cashControlId);

      // Fetch all cash accounts for fallback lookup
      const { data: allCashAccounts } = await supabase
        .from('cash_accounts')
        .select('id, name');

      setCardItems(cardData?.map(item => ({
        ...item,
        card_name: (item as any).card_accounts?.name,
        valor: Number(item.valor)
      })) || []);

      setAccountItems(accountData?.map(item => ({
        ...item,
        account_name: (item as any).current_accounts?.name,
        valor: Number(item.valor)
      })) || []);

      setDeliveryItems(deliveryData?.map(item => ({
        ...item,
        delivery_name: (item as any).delivery_accounts?.name,
        valor: Number(item.valor)
      })) || []);

      setCashItems(cashData?.map(item => {
        // Try to get name from join, fallback to manual lookup
        const joinedName = (item as any).cash_accounts?.name;
        const fallbackName = allCashAccounts?.find(acc => acc.id === item.cash_account_id)?.name;
        return {
          ...item,
          cash_name: joinedName || fallbackName || 'Conta não encontrada',
          valor: Number(item.valor)
        };
      }) || []);
    } catch (error) {
      console.error('Erro ao carregar itens:', error);
    }
  };

  const fetchAccounts = async () => {
    try {
      // Fetch card accounts for this store
      const { data: cardData } = await supabase
        .from('card_accounts')
        .select(`
          id, name,
          card_account_stores!inner (store_id)
        `)
        .eq('card_account_stores.store_id', storeId)
        .eq('is_active', true);

      // Fetch current accounts for this store
      const { data: currentData } = await supabase
        .from('current_accounts')
        .select(`
          id, name,
          current_account_stores!inner (store_id)
        `)
        .eq('current_account_stores.store_id', storeId)
        .eq('is_active', true);

      // Fetch delivery accounts for this store
      const { data: deliveryData } = await supabase
        .from('delivery_accounts')
        .select(`
          id, name,
          delivery_account_stores!inner (store_id)
        `)
        .eq('delivery_account_stores.store_id', storeId)
        .eq('is_active', true);

      // Fetch cash accounts for this store
      const { data: cashData } = await supabase
        .from('cash_accounts')
        .select(`
          id, name,
          cash_account_stores!inner (store_id)
        `)
        .eq('cash_account_stores.store_id', storeId)
        .eq('is_active', true);

      setCardAccounts(cardData || []);
      setCurrentAccounts(currentData || []);
      setDeliveryAccounts(deliveryData || []);
      setCashAccounts(cashData || []);
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
    }
  };

  // Watch form values for automatic calculations
  const watchedValues = form.watch();
  
  const faturamentoDinheiro = (watchedValues.contagem_dinheiro || 0) + 
                              (watchedValues.despesas_pagas || 0) + 
                              (watchedValues.valor_mantido_caixa || 0) - 
                              (watchedValues.saldo_inicial || 0);

  const faturamentoCartao = cardItems.reduce((sum, item) => sum + (item.valor || 0), 0);
  const faturamentoConta = accountItems.reduce((sum, item) => sum + (item.valor || 0), 0);
  const faturamentoDelivery = deliveryItems.reduce((sum, item) => sum + (item.valor || 0), 0);
  
  const faturamentoTotal = faturamentoDinheiro + faturamentoCartao + faturamentoConta + faturamentoDelivery;
  const diferenca = faturamentoTotal - (watchedValues.valor_fechamento_pdv || 0);

  const addCardItem = (cardId: string, valor: number) => {
    const cardAccount = cardAccounts.find(c => c.id === cardId);
    if (cardAccount && valor > 0) {
      setCardItems(prev => [...prev, {
        card_account_id: cardId,
        card_name: cardAccount.name,
        valor
      }]);
    }
  };

  const addAccountItem = (accountId: string, valor: number) => {
    const currentAccount = currentAccounts.find(c => c.id === accountId);
    if (currentAccount && valor > 0) {
      setAccountItems(prev => [...prev, {
        current_account_id: accountId,
        account_name: currentAccount.name,
        valor
      }]);
    }
  };

  const addDeliveryItem = (deliveryId: string, valor: number) => {
    const deliveryAccount = deliveryAccounts.find(d => d.id === deliveryId);
    if (deliveryAccount && valor > 0) {
      setDeliveryItems(prev => [...prev, {
        delivery_account_id: deliveryId,
        delivery_name: deliveryAccount.name,
        valor
      }]);
    }
  };

  const addCashItem = (cashId: string, valor: number) => {
    const cashAccount = cashAccounts.find(c => c.id === cashId);
    if (cashAccount && valor > 0) {
      setCashItems(prev => [...prev, {
        cash_account_id: cashId,
        cash_name: cashAccount.name,
        valor
      }]);
    }
  };

  const removeCardItem = (index: number) => {
    setCardItems(prev => prev.filter((_, i) => i !== index));
  };

  const removeAccountItem = (index: number) => {
    setAccountItems(prev => prev.filter((_, i) => i !== index));
  };

  const removeDeliveryItem = (index: number) => {
    setDeliveryItems(prev => prev.filter((_, i) => i !== index));
  };

  const removeCashItem = (index: number) => {
    setCashItems(prev => prev.filter((_, i) => i !== index));
  };

  // Função utilitária para upload de arquivo
  const uploadFile = async (file: File): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return null;
      }

      const fileExtension = file.name.split('.').pop();
      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      // Use storeId prop as the first path segment for RLS compliance
      const filePath = `${storeId}/${user.id}/${fileName}`;
      
      // Determinar contentType correto
      let contentType = file.type;
      if (!contentType && fileExtension) {
        const typeMap: { [key: string]: string } = {
          'pdf': 'application/pdf',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg', 
          'png': 'image/png',
          'txt': 'text/plain',
          'doc': 'application/msword',
          'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        };
        contentType = typeMap[fileExtension.toLowerCase()] || 'application/octet-stream';
      }

      const { data, error } = await supabase.storage
        .from('account-documents')
        .upload(filePath, file, { contentType });
      
      if (error) {
        console.error('Erro ao fazer upload do arquivo:', error);
        toast.error('Erro ao fazer upload do arquivo');
        return null;
      }

      return filePath;
    } catch (error) {
      console.error('Erro no uploadFile:', error);
      toast.error('Erro ao fazer upload do arquivo');
      return null;
    }
  };

  // Função utilitária para visualização e download
  const viewAttachment = async (filePath: string, mode: 'inline' | 'download' = 'inline') => {
    try {
      if (!filePath) {
        toast.error('Caminho do anexo não encontrado');
        return;
      }

      // Detectar se é PDF para forçar download
      const fileExtension = filePath.split('.').pop()?.toLowerCase();
      const isPdf = fileExtension === 'pdf';
      
      // Se já é uma URL completa (anexos antigos), tentar abrir diretamente
      if (filePath.startsWith('http')) {
        // URLs antigas podem não funcionar se apontarem para outro projeto
        // Tentar abrir diretamente
        window.open(filePath, '_blank');
        return;
      }
      
      // Para paths do bucket, fazer download direto e criar Blob URL
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('account-documents')
        .download(filePath);

      if (downloadError) {
        console.error('Erro ao baixar anexo:', downloadError, 'Path:', filePath);
        toast.error('Erro ao fazer download do arquivo');
        return;
      }

      // Determinar MIME type baseado na extensão
      let mimeType = 'application/octet-stream';
      if (isPdf) {
        mimeType = 'application/pdf';
      } else if (fileExtension === 'jpg' || fileExtension === 'jpeg') {
        mimeType = 'image/jpeg';
      } else if (fileExtension === 'png') {
        mimeType = 'image/png';
      } else if (fileExtension === 'gif') {
        mimeType = 'image/gif';
      } else if (fileExtension === 'webp') {
        mimeType = 'image/webp';
      }

      // Criar Blob URL
      const blob = new Blob([fileData], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);

      if (isPdf || mode === 'download') {
        // Para PDFs ou download explícito, usar link oculto
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filePath.split('/').pop() || 'arquivo';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Download realizado com sucesso');
      } else {
        // Para imagens, abrir em nova aba
        window.open(blobUrl, '_blank');
      }

      // Limpar Blob URL após delay
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (error) {
      console.error('Erro ao visualizar anexo:', error);
      toast.error('Erro ao visualizar anexo');
    }
  };

  // Função utilitária para upload e abertura imediata
  const uploadAndOpen = async (file: File, mode: 'inline' | 'download' = 'inline') => {
    try {
      const filePath = await uploadFile(file);
      if (filePath) {
        await viewAttachment(filePath, mode);
        return filePath;
      }
      return null;
    } catch (error) {
      console.error('Erro no uploadAndOpen:', error);
      toast.error('Erro ao processar arquivo');
      return null;
    }
  };

  const uploadAttachments = async (cashControlId: string): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    
    for (const file of attachments) {
      const filePath = await uploadFile(file);
      if (filePath) {
        uploadedUrls.push(filePath);
      }
    }
    
    return uploadedUrls;
  };

  const onSubmit = async (data: any) => {
    try {
      setLoading(true);

      // Verificar se o período está bloqueado para operações de caixa
      if (mode !== 'view') {
        const validation = await validateCashControlPeriod.pagamento(dateString);
        if (validation.blocked) {
          toast.error(validation.message || 'Período bloqueado para Controle de Caixa');
          setLoading(false);
          return;
        }
      }

      // Validar se o somatório das contas caixa é igual ao faturamento dinheiro calculado
      const totalCashItems = cashItems.reduce((sum, item) => sum + Number(item.valor), 0);
      const calculatedFaturamentoDinheiro = faturamentoDinheiro;
      
      if (Math.abs(totalCashItems - calculatedFaturamentoDinheiro) > 0.01) {
        toast.error(`O valor cadastrado nas contas caixa (R$ ${totalCashItems.toFixed(2)}) não confere com o total de faturamento em dinheiro (R$ ${calculatedFaturamentoDinheiro.toFixed(2)}).`);
        setLoading(false);
        return;
      }

      let cashControlId = cashControl?.id;
      let existingUrls: string[] = [];
      
      // Se estiver editando, manter URLs existentes
      if (cashControlId && existingAttachments.length > 0) {
        existingUrls = existingAttachments;
      }

      // Obter dados do usuário atual
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      
      // Buscar nome do usuário atual
      let userName = 'Usuário';
      if (userId) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', userId)
          .maybeSingle();
        if (profileData?.name) {
          userName = profileData.name;
        }
      }

      if (cashControlId) {
        // Update existing cash control
        let finalUrls = existingUrls;
        
        // Upload de novos anexos se houver
        if (attachments.length > 0) {
          const newUrls = await uploadAttachments(cashControlId);
          finalUrls = [...existingUrls, ...newUrls];
          
          // Adicionar status para novos anexos
          const newAttachmentStatus = [
            ...attachmentStatus,
            ...newUrls.map(url => ({ url, disabled: false }))
          ];
          setAttachmentStatus(newAttachmentStatus);
        }

        // Criar nova entrada no histórico de edições
        const newEditEntry = {
          edited_at: new Date().toISOString(),
          edited_by: userId,
          edited_by_name: userName
        };
        const updatedHistory = [...editHistory, newEditEntry];
        
        const { error } = await supabase
          .from('cash_control')
          .update({
            saldo_inicial: data.saldo_inicial,
            contagem_dinheiro: data.contagem_dinheiro,
            despesas_pagas: data.despesas_pagas,
            valor_mantido_caixa: data.valor_mantido_caixa,
            faturamento_dinheiro: faturamentoDinheiro,
            faturamento_cartao: faturamentoCartao,
            faturamento_conta: faturamentoConta,
            faturamento_delivery: faturamentoDelivery,
            faturamento_total: faturamentoTotal,
            valor_fechamento_pdv: data.valor_fechamento_pdv,
            diferenca: diferenca,
            image_urls: finalUrls.length > 0 ? finalUrls : null,
            attachment_status: attachmentStatus.length > 0 ? JSON.parse(JSON.stringify(attachmentStatus)) : null,
            edited_at: new Date().toISOString(),
            edited_by: userId,
            edited_by_name: userName,
            edit_history: updatedHistory,
          })
          .eq('id', cashControlId);

        if (error) throw error;
      } else {
        // Create new cash control
        const { data: newCashControl, error } = await supabase
          .from('cash_control')
          .insert({
            store_id: storeId,
            date: dateString,
            saldo_inicial: data.saldo_inicial,
            contagem_dinheiro: data.contagem_dinheiro,
            despesas_pagas: data.despesas_pagas,
            valor_mantido_caixa: data.valor_mantido_caixa,
            faturamento_dinheiro: faturamentoDinheiro,
            faturamento_cartao: faturamentoCartao,
            faturamento_conta: faturamentoConta,
            faturamento_delivery: faturamentoDelivery,
            faturamento_total: faturamentoTotal,
            valor_fechamento_pdv: data.valor_fechamento_pdv,
            diferenca: diferenca,
            created_by: userId,
            created_by_name: userName,
            edit_history: [],
          })
          .select()
          .single();

        if (error) throw error;
        cashControlId = newCashControl.id;
        
        // Upload de anexos após criar o cash control
        if (attachments.length > 0) {
          const uploadedUrls = await uploadAttachments(cashControlId);
          const newAttachmentStatus = uploadedUrls.map(url => ({ url, disabled: false }));
          await supabase
            .from('cash_control')
            .update({ 
              image_urls: uploadedUrls,
              attachment_status: JSON.parse(JSON.stringify(newAttachmentStatus))
            })
            .eq('id', cashControlId);
        }
      }

      // Save items
      await saveItems(cashControlId);

      toast.success('Fechamento de caixa salvo com sucesso!');
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar fechamento:', error);
      toast.error('Erro ao salvar fechamento de caixa');
    } finally {
      setLoading(false);
    }
  };

  const saveItems = async (cashControlId: string) => {
    // Delete existing items
    await supabase.from('cash_control_card_items').delete().eq('cash_control_id', cashControlId);
    await supabase.from('cash_control_account_items').delete().eq('cash_control_id', cashControlId);
    await supabase.from('cash_control_delivery_items').delete().eq('cash_control_id', cashControlId);
    await supabase.from('cash_control_cash_items').delete().eq('cash_control_id', cashControlId);

    // Insert card items
    if (cardItems.length > 0) {
      await supabase.from('cash_control_card_items').insert(
        cardItems.map(item => ({
          cash_control_id: cashControlId,
          card_account_id: item.card_account_id,
          valor: item.valor,
        }))
      );
    }

    // Insert account items
    if (accountItems.length > 0) {
      await supabase.from('cash_control_account_items').insert(
        accountItems.map(item => ({
          cash_control_id: cashControlId,
          current_account_id: item.current_account_id,
          valor: item.valor,
        }))
      );
    }

    // Insert delivery items
    if (deliveryItems.length > 0) {
      await supabase.from('cash_control_delivery_items').insert(
        deliveryItems.map(item => ({
          cash_control_id: cashControlId,
          delivery_account_id: item.delivery_account_id,
          valor: item.valor,
        }))
      );
    }

    // Insert cash items
    if (cashItems.length > 0) {
      await supabase.from('cash_control_cash_items').insert(
        cashItems.map(item => ({
          cash_control_id: cashControlId,
          cash_account_id: item.cash_account_id,
          valor: item.valor,
        }))
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Controle de Caixa - {date.toLocaleDateString('pt-BR')}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* BLOCO 1: DINHEIRO */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  DINHEIRO
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="saldo_inicial"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Saldo Inicial</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          disabled={isReadOnly}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contagem_dinheiro"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contagem Dinheiro</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            disabled={isReadOnly}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="despesas_pagas"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Despesas Pagas</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            disabled={isReadOnly}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="valor_mantido_caixa"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor Mantido no Caixa</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            disabled={isReadOnly}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <CashItemsSection
                  items={cashItems}
                  accounts={cashAccounts}
                  onAdd={addCashItem}
                  onRemove={removeCashItem}
                  accountKeyName="cash_account_id"
                  accountDisplayName="cash_name"
                  placeholder="Selecione uma conta de caixa"
                  isReadOnly={isReadOnly}
                  faturamentoDinheiro={faturamentoDinheiro}
                />

                <div className="bg-muted p-4 rounded-lg">
                  <Label>Faturamento Dinheiro: R$ {faturamentoDinheiro.toFixed(2)}</Label>
                </div>
              </CardContent>
            </Card>

            {/* BLOCO 2: CARTÃO */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  CARTÃO
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <CardItemsSection
                  items={cardItems}
                  accounts={cardAccounts}
                  onAdd={addCardItem}
                  onRemove={removeCardItem}
                  accountKeyName="card_account_id"
                  accountDisplayName="card_name"
                  placeholder="Selecione um cartão"
                  isReadOnly={isReadOnly}
                />
                <div className="bg-muted p-4 rounded-lg">
                  <Label>Faturamento Cartão: R$ {faturamentoCartao.toFixed(2)}</Label>
                </div>
              </CardContent>
            </Card>

            {/* BLOCO 3: CONTAS */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  CONTAS
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <AccountItemsSection
                  items={accountItems}
                  accounts={currentAccounts}
                  onAdd={addAccountItem}
                  onRemove={removeAccountItem}
                  accountKeyName="current_account_id"
                  accountDisplayName="account_name"
                  placeholder="Selecione uma conta"
                  isReadOnly={isReadOnly}
                />
                <div className="bg-muted p-4 rounded-lg">
                  <Label>Faturamento Conta: R$ {faturamentoConta.toFixed(2)}</Label>
                </div>
              </CardContent>
            </Card>

            {/* BLOCO 4: DELIVERY */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  DELIVERY
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <DeliveryItemsSection
                  items={deliveryItems}
                  accounts={deliveryAccounts}
                  onAdd={addDeliveryItem}
                  onRemove={removeDeliveryItem}
                  accountKeyName="delivery_account_id"
                  accountDisplayName="delivery_name"
                  placeholder="Selecione uma conta delivery"
                  isReadOnly={isReadOnly}
                />
                <div className="bg-muted p-4 rounded-lg">
                  <Label>Faturamento Delivery: R$ {faturamentoDelivery.toFixed(2)}</Label>
                </div>
              </CardContent>
            </Card>

            {/* TOTAIS E FECHAMENTO */}
            <Card>
              <CardHeader>
                <CardTitle>FECHAMENTO</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <Label className="text-lg font-bold">Faturamento Total: R$ {faturamentoTotal.toFixed(2)}</Label>
                </div>

                <FormField
                  control={form.control}
                  name="valor_fechamento_pdv"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor Total Fechamento PDV</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            disabled={isReadOnly}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className={`p-4 rounded-lg ${diferenca === 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                  <Label className="text-lg font-bold">
                    Diferença: R$ {diferenca.toFixed(2)}
                  </Label>
                </div>

                {/* Campo de Anexos */}
                <div className="space-y-2">
                  <Label>Anexos</Label>
                  
                  {/* Anexos existentes */}
                  {existingAttachments.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Anexos salvos:</Label>
                      {existingAttachments.map((url, index) => {
                        const status = attachmentStatus.find(s => s.url === url);
                        const isDisabled = status?.disabled || false;
                        
                        return (
                          <div 
                            key={index} 
                            className={`flex items-center justify-between p-2 rounded border ${
                              isDisabled ? 'bg-red-100 border-red-300' : 'bg-blue-50'
                            }`}
                          >
                            <span className={`text-sm ${isDisabled ? 'text-red-700' : ''}`}>
                              Anexo {index + 1} {isDisabled && '(inabilitado)'}
                            </span>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => viewAttachment(url)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {!isReadOnly && !isDisabled && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setAttachmentStatus(prev => {
                                      const existing = prev.find(s => s.url === url);
                                      if (existing) {
                                        return prev.map(s => s.url === url ? { ...s, disabled: true } : s);
                                      }
                                      return [...prev, { url, disabled: true }];
                                    });
                                  }}
                                  title="Inabilitar anexo"
                                >
                                  <Ban className="h-4 w-4 text-orange-500" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Upload de novos anexos */}
                  {!isReadOnly && (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          setAttachments(prev => [...prev, ...files]);
                        }}
                        className="hidden"
                        id="file-upload"
                      />
                      <label
                        htmlFor="file-upload"
                        className="cursor-pointer flex flex-col items-center justify-center text-gray-500"
                      >
                        <Upload className="h-8 w-8 mb-2" />
                        <span>Clique para adicionar anexos (PDF, JPG, PNG)</span>
                      </label>
                      
                      {attachments.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <Label className="text-sm text-muted-foreground">Novos anexos:</Label>
                          {attachments.map((file, index) => (
                            <div key={index} className="flex items-center justify-between bg-green-50 p-2 rounded border">
                              <span className="text-sm">{file.name}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setAttachments(prev => prev.filter((_, i) => i !== index))}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Informações de Criação e Histórico de Edições */}
                {(createdInfo?.created_at || editHistory.length > 0) && (
                  <div className="bg-muted p-4 rounded-lg space-y-2">
                    {createdInfo?.created_at && (
                      <div className="text-sm">
                        <span className="font-medium">Caixa criado em:</span> {new Date(createdInfo.created_at).toLocaleString('pt-BR')}
                        {createdInfo.created_by_name && <span> por {createdInfo.created_by_name}</span>}
                      </div>
                    )}
                    {editHistory.map((edit, index) => (
                      <div key={index} className="text-sm border-t border-border pt-2 mt-2">
                        <span className="font-medium">Editado em:</span> {new Date(edit.edited_at).toLocaleString('pt-BR')}
                        {edit.edited_by_name && <span> por {edit.edited_by_name}</span>}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      if (isReadOnly && onBack) {
                        onBack();
                      } else {
                        onOpenChange(false);
                      }
                    }}
                  >
                    {isReadOnly ? 'Voltar' : 'Cancelar'}
                  </Button>
                  {!isReadOnly && (
                    <Button type="submit" disabled={loading}>
                      {loading ? 'Salvando...' : 'Gravar Fechamento'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

// Componente para seção de itens de cartão
const CardItemsSection = ({ items, accounts, onAdd, onRemove, accountKeyName, accountDisplayName, placeholder, isReadOnly }: any) => {
  const [selectedAccount, setSelectedAccount] = useState('');
  const [valor, setValor] = useState('');

  const handleAdd = () => {
    if (selectedAccount && valor && parseFloat(valor) > 0) {
      onAdd(selectedAccount, parseFloat(valor));
      setSelectedAccount('');
      setValor('');
    }
  };

  return (
    <div className="space-y-4">
      {!isReadOnly && (
        <div className="flex gap-4">
          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account: any) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            step="0.01"
            placeholder="Valor"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="w-32"
          />
          <Button type="button" onClick={handleAdd}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item: any, index: number) => (
            <div key={index} className="flex items-center justify-between bg-muted p-2 rounded">
              <span>{item[accountDisplayName]} - R$ {item.valor.toFixed(2)}</span>
              {!isReadOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Componente para seção de itens de conta
const AccountItemsSection = CardItemsSection;

// Componente para seção de itens de delivery
const DeliveryItemsSection = CardItemsSection;

// Componente específico para seção de itens de cash (com botão + igual aos outros)
const CashItemsSection = ({ items, accounts, onAdd, onRemove, accountKeyName, accountDisplayName, placeholder, isReadOnly, faturamentoDinheiro }: any) => {
  const [selectedAccount, setSelectedAccount] = useState('');
  const [valor, setValor] = useState('');

  const handleAdd = () => {
    if (selectedAccount && valor && parseFloat(valor) > 0) {
      onAdd(selectedAccount, parseFloat(valor));
      setSelectedAccount('');
      setValor('');
    }
  };

  return (
    <div className="space-y-4">
      {!isReadOnly && (
        <div className="flex gap-4">
          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account: any) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            step="0.01"
            placeholder="Valor"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="w-32"
          />
          <Button type="button" onClick={handleAdd} disabled={!selectedAccount || !valor || parseFloat(valor) <= 0}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item: any, index: number) => (
            <div key={index} className="flex items-center justify-between bg-muted/50 p-3 rounded-lg">
              <span className="font-medium">{item[accountDisplayName]} - R$ {item.valor.toFixed(2)}</span>
              {!isReadOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};