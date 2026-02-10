import { useState, useEffect, useMemo } from "react";
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
  matrix_id: string;
}

interface Profile {
  id: string;
  name: string;
  description: string | null;
}

interface Matrix {
  id: string;
  name: string;
  code: number;
}

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  stores: Store[];
  profiles: Profile[];
  matrices: Matrix[];
  currentUserEmail?: string;
}

const MASTER_USER_EMAIL = "wisley_anderson@hotmail.com";

const CreateUserModal = ({
  isOpen,
  onClose,
  onSuccess,
  stores,
  profiles,
  matrices,
  currentUserEmail,
}: CreateUserModalProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [selectedMatrixId, setSelectedMatrixId] = useState("");
  const [loading, setLoading] = useState(false);
  const [matrixUsersCount, setMatrixUsersCount] = useState<Record<string, number>>({});
  const [userMatrixId, setUserMatrixId] = useState<string | null>(null);
  const [userMatrixName, setUserMatrixName] = useState<string>("");
  const { toast } = useToast();

  const isMasterUser = currentUserEmail === MASTER_USER_EMAIL;

  // Buscar a matriz do usuário logado (para não-mestre)
  useEffect(() => {
    const fetchUserMatrix = async () => {
      if (isMasterUser) return;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('matrix_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.matrix_id) {
        setUserMatrixId(profile.matrix_id);
        setSelectedMatrixId(profile.matrix_id);
        
        // Buscar o nome da matriz
        const matrix = matrices.find(m => m.id === profile.matrix_id);
        if (matrix) {
          setUserMatrixName(`${matrix.code} - ${matrix.name}`);
        }
      }
    };

    if (isOpen) {
      fetchUserMatrix();
    }
  }, [isOpen, isMasterUser, matrices]);

  // Buscar contagem de usuários com perfil "Matriz" por matriz
  useEffect(() => {
    const fetchMatrixUsersCount = async () => {
      // Buscar o ID do perfil "Matriz"
      const { data: matrizProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('name', 'Matriz')
        .maybeSingle();

      if (!matrizProfile) return;

      // Buscar quantos usuários com perfil "Matriz" existem por matriz
      const { data: counts } = await supabase
        .from('profiles')
        .select('matrix_id')
        .eq('profile_id', matrizProfile.id);

      if (counts) {
        const countMap: Record<string, number> = {};
        counts.forEach(item => {
          if (item.matrix_id) {
            countMap[item.matrix_id] = (countMap[item.matrix_id] || 0) + 1;
          }
        });
        setMatrixUsersCount(countMap);
      }
    };

    if (isOpen) {
      fetchMatrixUsersCount();
    }
  }, [isOpen]);

  // Filtrar perfis disponíveis baseado no usuário atual
  const availableProfiles = useMemo(() => {
    if (isMasterUser) {
      return profiles; // Usuário mestre pode ver todos os perfis
    }
    // Outros usuários não podem ver o perfil "Matriz"
    return profiles.filter(p => p.name !== 'Matriz');
  }, [profiles, isMasterUser]);

  // Verificar se pode selecionar o perfil "Matriz" para a matriz selecionada
  const canSelectMatrizProfile = useMemo(() => {
    if (!selectedMatrixId) return true;
    const matrizProfile = profiles.find(p => p.name === 'Matriz');
    if (!matrizProfile) return true;
    // Se já existe um usuário com perfil "Matriz" nesta matriz, não permitir
    return (matrixUsersCount[selectedMatrixId] || 0) === 0;
  }, [selectedMatrixId, matrixUsersCount, profiles]);

  // Filtrar lojas pela matriz selecionada
  const filteredStores = useMemo(() => {
    if (!selectedMatrixId) return [];
    return stores.filter(store => store.matrix_id === selectedMatrixId);
  }, [stores, selectedMatrixId]);

  const handleStoreToggle = (storeId: string) => {
    setSelectedStoreIds((prev) =>
      prev.includes(storeId)
        ? prev.filter((id) => id !== storeId)
        : [...prev, storeId]
    );
  };

  // Limpar lojas selecionadas quando a matriz mudar
  useEffect(() => {
    setSelectedStoreIds([]);
  }, [selectedMatrixId]);

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

    if (!selectedMatrixId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Selecione uma matriz.",
      });
      return;
    }

    // Validar se está tentando criar usuário com perfil "Matriz" e já existe um na matriz
    const matrizProfile = profiles.find(p => p.name === 'Matriz');
    if (matrizProfile && selectedProfileId === matrizProfile.id && !canSelectMatrizProfile) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Esta matriz já possui um usuário com perfil Matriz. Cada matriz só pode ter um usuário com este perfil.",
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
            matrix_id: selectedMatrixId,
          },
        },
      });

      if (signUpError) throw signUpError;

      if (!signUpData.user) {
        throw new Error("Erro ao criar usuário");
      }

      // Aguardar um pouco para o trigger criar o profile
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Atualizar o profile para ativo e vincular o perfil de acesso e matriz
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          is_active: true,
          profile_id: selectedProfileId || null,
          matrix_id: selectedMatrixId
        })
        .eq('id', signUpData.user.id);

      if (updateError) throw updateError;

      // Vincular lojas ao usuário (se houver lojas selecionadas)
      if (selectedStoreIds.length > 0) {
        const userStoresData = selectedStoreIds.map(storeId => ({
          user_id: signUpData.user!.id,
          store_id: storeId
        }));

        const { error: storesError } = await supabase
          .from('user_stores')
          .insert(userStoresData);

        if (storesError) throw storesError;
      }

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
      setSelectedMatrixId("");
      
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
      <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Novo Usuário</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4 px-1">
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
            <Label>Matriz *</Label>
            {isMasterUser ? (
              <Select value={selectedMatrixId} onValueChange={setSelectedMatrixId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma matriz" />
                </SelectTrigger>
                <SelectContent>
                  {matrices.map((matrix) => (
                    <SelectItem key={matrix.id} value={matrix.id}>
                      {matrix.code} - {matrix.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={userMatrixName}
                disabled
                className="bg-muted"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Perfil de Acesso</Label>
            <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um perfil" />
              </SelectTrigger>
              <SelectContent>
                {availableProfiles.map((profile) => {
                  const isMatrizProfile = profile.name === 'Matriz';
                  const isDisabled = isMatrizProfile && !canSelectMatrizProfile;
                  return (
                    <SelectItem 
                      key={profile.id} 
                      value={profile.id}
                      disabled={isDisabled}
                    >
                      {profile.name}
                      {isDisabled && " (matriz já possui usuário)"}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {isMasterUser && (
              <p className="text-xs text-muted-foreground">
                Como usuário mestre, você pode criar usuários com perfil "Matriz".
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Lojas</Label>
            <div className="border rounded-md p-2 max-h-40 overflow-y-auto">
              {filteredStores.length > 0 ? (
                filteredStores.map((store) => (
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
                ))
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  {selectedMatrixId ? "Nenhuma loja vinculada a esta matriz" : "Selecione uma matriz primeiro"}
                </p>
              )}
            </div>
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
