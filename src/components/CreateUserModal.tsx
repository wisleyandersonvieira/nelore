import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Store {
  id: string;
  name: string;
  code: string;
}

interface Profile {
  id: string;
  name: string;
  description: string | null;
}

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  stores: Store[];
  profiles: Profile[];
}

const CreateUserModal = ({
  isOpen,
  onClose,
  onSuccess,
  stores,
  profiles,
}: CreateUserModalProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleStoreToggle = (storeId: string) => {
    setSelectedStoreIds((prev) =>
      prev.includes(storeId)
        ? prev.filter((id) => id !== storeId)
        : [...prev, storeId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !email || !password) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Preencha todos os campos obrigatórios.",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "A senha deve ter pelo menos 6 caracteres.",
      });
      return;
    }

    if (selectedStoreIds.length === 0) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Selecione pelo menos uma loja.",
      });
      return;
    }

    setLoading(true);

    try {
      // Criar usuário via signUp (o perfil será criado pelo trigger)
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            name: name,
          },
        },
      });

      if (signUpError) throw signUpError;

      if (!signUpData.user) {
        throw new Error("Erro ao criar usuário");
      }

      // Aguardar um pouco para o trigger criar o profile
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Atualizar o profile para ativo e vincular o perfil de acesso
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          is_active: true,
          profile_id: selectedProfileId || null
        })
        .eq('id', signUpData.user.id);

      if (updateError) throw updateError;

      // Vincular lojas ao usuário
      const userStoresData = selectedStoreIds.map(storeId => ({
        user_id: signUpData.user!.id,
        store_id: storeId
      }));

      const { error: storesError } = await supabase
        .from('user_stores')
        .insert(userStoresData);

      if (storesError) throw storesError;

      toast({
        title: "Usuário criado",
        description: "O usuário foi criado e ativado com sucesso. O usuário precisará confirmar o email antes de acessar o sistema.",
      });

      // Limpar form
      setName("");
      setEmail("");
      setPassword("");
      setSelectedStoreIds([]);
      setSelectedProfileId("");
      
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        variant: "destructive",
        title: "Erro ao criar usuário",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Novo Usuário</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              type="text"
              placeholder="Nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha *</Label>
            <Input
              id="password"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <div className="space-y-2">
            <Label>Perfil de Acesso</Label>
            <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um perfil" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Lojas *</Label>
            <div className="border rounded-md p-2 max-h-40 overflow-y-auto">
              {stores.map((store) => (
                <div key={store.id} className="flex items-center space-x-2 py-1">
                  <input
                    type="checkbox"
                    id={`store-${store.id}`}
                    checked={selectedStoreIds.includes(store.id)}
                    onChange={() => handleStoreToggle(store.id)}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor={`store-${store.id}`} className="text-sm cursor-pointer">
                    {store.name} ({store.code})
                  </label>
                </div>
              ))}
            </div>
            {selectedStoreIds.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Selecione pelo menos uma loja
              </p>
            )}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
            <strong>Importante:</strong> Se a confirmação de email estiver habilitada no Supabase, 
            o usuário precisará confirmar o email antes de acessar. Para desabilitar, acesse 
            Supabase → Authentication → Providers → Email e desmarque "Confirm email".
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Criando..." : "Criar Usuário"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateUserModal;
