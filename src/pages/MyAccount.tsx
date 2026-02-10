import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Eye, EyeOff, Loader2, User, Store, Shield, KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface UserProfile {
  name: string;
  email: string;
  role: string;
  profile_name: string | null;
  stores: { id: string; name: string; code: string }[];
}

const MyAccount = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Password change state
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate("/auth");
          return;
        }

        // Fetch user profile with linked profile name
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select(`
            name,
            email,
            role,
            store_id,
            profile_id,
            user_profiles:profile_id (name)
          `)
          .eq("id", user.id)
          .single();

        if (profileError) throw profileError;

        // Fetch user stores
        let stores: { id: string; name: string; code: string }[] = [];
        
        if (profileData.role === "admin") {
          // Admin sees all stores
          const { data: allStores } = await supabase
            .from("stores")
            .select("id, name, code")
            .order("name");
          stores = allStores || [];
        } else {
          // Get stores from user_stores + primary store
          const storeIds: string[] = [];
          
          if (profileData.store_id) {
            storeIds.push(profileData.store_id);
          }
          
          const { data: userStores } = await supabase
            .from("user_stores")
            .select("store_id")
            .eq("user_id", user.id);
          
          if (userStores) {
            userStores.forEach(us => {
              if (!storeIds.includes(us.store_id)) {
                storeIds.push(us.store_id);
              }
            });
          }
          
          if (storeIds.length > 0) {
            const { data: linkedStores } = await supabase
              .from("stores")
              .select("id, name, code")
              .in("id", storeIds)
              .order("name");
            stores = linkedStores || [];
          }
        }

        setProfile({
          name: profileData.name,
          email: profileData.email,
          role: profileData.role,
          profile_name: (profileData.user_profiles as { name: string } | null)?.name || null,
          stores,
        });
      } catch (error) {
        console.error("Error fetching user data:", error);
        toast({
          title: "Erro",
          description: "Erro ao carregar dados do usuário",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigate, toast]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Erro",
        description: "A nova senha deve ter pelo menos 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    setChangingPassword(true);

    try {
      // First, verify the old password by re-authenticating
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Usuário não encontrado");

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: oldPassword,
      });

      if (signInError) {
        toast({
          title: "Erro",
          description: "Senha atual incorreta",
          variant: "destructive",
        });
        setChangingPassword(false);
        return;
      }

      // Now update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      toast({
        title: "Sucesso",
        description: "Senha alterada com sucesso!",
      });

      // Clear form
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Error changing password:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao alterar senha",
        variant: "destructive",
      });
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="pl-16">
        {/* Header */}
        <header className="border-b bg-card h-14 sticky top-0 z-30">
          <div className="h-full px-4 flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <h1 className="text-lg font-semibold">Minha Conta</h1>
          </div>
        </header>

        {/* Content */}
        <main className="p-6 max-w-4xl mx-auto space-y-6">
          {/* User Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Informações do Usuário
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Nome</Label>
                  <p className="text-lg font-medium">{profile?.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">E-mail</Label>
                  <p className="text-lg font-medium">{profile?.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profile Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Perfil de Acesso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {profile?.role === "admin" ? (
                  <Badge variant="default">Administrador</Badge>
                ) : profile?.profile_name ? (
                  <Badge variant="secondary">{profile.profile_name}</Badge>
                ) : (
                  <Badge variant="outline">Usuário</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stores Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                Lojas Vinculadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {profile?.stores && profile.stores.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.stores.map((store) => (
                    <Badge key={store.id} variant="outline">
                      {store.code} - {store.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Nenhuma loja vinculada</p>
              )}
            </CardContent>
          </Card>

          {/* Change Password Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Alterar Senha
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="oldPassword">Senha Atual</Label>
                  <div className="relative">
                    <Input
                      id="oldPassword"
                      type={showOldPassword ? "text" : "password"}
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="Digite sua senha atual"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                    >
                      {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nova Senha</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Digite a nova senha"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirme a nova senha"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <Button type="submit" disabled={changingPassword}>
                  {changingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Alterar Senha
                </Button>
              </form>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
};

export default MyAccount;
