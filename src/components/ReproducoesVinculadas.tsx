import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, GitBranch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const formatDateBR = (value?: string | null) =>
  value ? format(new Date(value), "dd/MM/yyyy", { locale: ptBR }) : "-";

interface NamedRecord { id: string; name: string; }

interface Props {
  animalId: string | null;
}

/**
 * Quadro "Reproduções Vinculadas" exibido na aba "Dados Reprodução"
 * do cadastro de animais. Mostra, em 4 abas, a evolução do ciclo
 * reprodutivo originado a partir deste animal/mãe.
 */
const ReproducoesVinculadas = ({ animalId }: Props) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [aspiracoes, setAspiracoes] = useState<any[]>([]);
  const [posTransferencias, setPosTransferencias] = useState<any[]>([]);
  const [prenhezes, setPrenhezes] = useState<any[]>([]);
  const [animaisGerados, setAnimaisGerados] = useState<any[]>([]);

  const [breeds, setBreeds] = useState<NamedRecord[]>([]);
  const [categories, setCategories] = useState<NamedRecord[]>([]);
  const [ownFarms, setOwnFarms] = useState<NamedRecord[]>([]);
  const [thirdPartyFarms, setThirdPartyFarms] = useState<NamedRecord[]>([]);
  const [animalsById, setAnimalsById] = useState<Record<string, any>>({});

  const breedName = (id: string | null) => (id ? breeds.find((b) => b.id === id)?.name || "-" : "-");
  const categoryName = (id: string | null) => (id ? categories.find((c) => c.id === id)?.name || "-" : "-");
  const farmName = (farmId: string | null, farmType: string | null) => {
    if (!farmId || !farmType) return "-";
    if (farmType === "own") return ownFarms.find((f) => f.id === farmId)?.name || "-";
    return thirdPartyFarms.find((f) => f.id === farmId)?.name || "-";
  };
  const animalName = (id: string | null) => (id ? animalsById[id]?.name || "-" : "-");

  useEffect(() => {
    if (!animalId) {
      setAspiracoes([]); setPosTransferencias([]); setPrenhezes([]); setAnimaisGerados([]);
      return;
    }
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: repros } = await supabase
          .from("reproducoes")
          .select("*")
          .eq("animal_mae_id", animalId)
          .order("code", { ascending: false });

        const list = repros || [];
        const aspIds = list.map((r) => r.aspiracao_id).filter(Boolean) as string[];
        const posIds = list.map((r) => r.pos_transferencia_id).filter(Boolean) as string[];
        const preIds = list.map((r) => r.prenhez_id).filter(Boolean) as string[];
        const animalIds = list.map((r) => r.animal_gerado_id).filter(Boolean) as string[];

        const [aspRes, posRes, preRes, breedsRes, catsRes, storesRes, thirdRes] = await Promise.all([
          aspIds.length ? supabase.from("aspiration_management").select("*").in("id", aspIds) : Promise.resolve({ data: [] as any[] }),
          posIds.length ? supabase.from("embryo_transfer_management").select("*").in("id", posIds) : Promise.resolve({ data: [] as any[] }),
          preIds.length ? supabase.from("pregnancy_management").select("*").in("id", preIds) : Promise.resolve({ data: [] as any[] }),
          supabase.from("animal_breeds").select("id, name"),
          supabase.from("animal_categories").select("id, name"),
          supabase.from("stores").select("id, name"),
          supabase.from("third_party_farms").select("id, name"),
        ]);

        setAspiracoes(aspRes.data || []);
        setPosTransferencias(posRes.data || []);
        setPrenhezes(preRes.data || []);
        setBreeds(breedsRes.data || []);
        setCategories(catsRes.data || []);
        setOwnFarms(storesRes.data || []);
        setThirdPartyFarms(thirdRes.data || []);

        // Resolve nomes de animais usados (gerados + receptoras de pós/prenhez)
        const recipientIds = [
          ...(posRes.data || []).map((p: any) => p.recipient_id),
          ...(preRes.data || []).map((p: any) => p.recipient_id),
        ].filter(Boolean);
        const allAnimalIds = Array.from(new Set([...animalIds, ...recipientIds]));
        if (allAnimalIds.length) {
          const { data: animalsData } = await supabase
            .from("animals").select("id, code, name, sex, breed_id, birth_date, category_id, is_active").in("id", allAnimalIds);
          const map: Record<string, any> = {};
          (animalsData || []).forEach((a) => { map[a.id] = a; });
          setAnimalsById(map);
          setAnimaisGerados((animalsData || []).filter((a) => animalIds.includes(a.id)));
        } else {
          setAnimalsById({});
          setAnimaisGerados([]);
        }
      } catch (error) {
        console.error("Erro ao carregar reproduções vinculadas:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [animalId]);

  const counts = useMemo(() => ({
    asp: aspiracoes.length,
    pos: posTransferencias.length,
    pre: prenhezes.length,
    ani: animaisGerados.length,
  }), [aspiracoes, posTransferencias, prenhezes, animaisGerados]);

  if (!animalId) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GitBranch className="h-4 w-4 text-primary" />
          Reproduções Vinculadas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="aspiracao" className="w-full">
          <TabsList className="flex w-full md:grid md:grid-cols-4">
            <TabsTrigger value="aspiracao">Aspiração ({counts.asp})</TabsTrigger>
            <TabsTrigger value="pos">Pós-transferência ({counts.pos})</TabsTrigger>
            <TabsTrigger value="prenhez">Prenhez ({counts.pre})</TabsTrigger>
            <TabsTrigger value="animal">Animal ({counts.ani})</TabsTrigger>
          </TabsList>

          {/* Aba Aspiração */}
          <TabsContent value="aspiracao" className="mt-4">
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Mês Previsto</TableHead>
                    <TableHead>Oócitos</TableHead>
                    <TableHead>Raça</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Fazenda</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criação</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={10} className="py-6 text-center text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : aspiracoes.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="py-6 text-center text-muted-foreground">Nenhuma aspiração vinculada.</TableCell></TableRow>
                  ) : aspiracoes.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">#{a.code}</TableCell>
                      <TableCell>{a.name}</TableCell>
                      <TableCell>{formatDateBR(a.expected_aspiration_month)}</TableCell>
                      <TableCell>{a.oocyte_count ?? "-"}</TableCell>
                      <TableCell>{breedName(a.breed_id)}</TableCell>
                      <TableCell>{categoryName(a.category_id)}</TableCell>
                      <TableCell>{farmName(a.farm_id, a.farm_type)}</TableCell>
                      <TableCell><Badge variant="outline">{a.status}</Badge></TableCell>
                      <TableCell>{formatDateBR(a.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/animais/aspiracoes")}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Aba Pós-transferência de embrião */}
          <TabsContent value="pos" className="mt-4">
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Data Transferência</TableHead>
                    <TableHead>Receptora</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criação</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={7} className="py-6 text-center text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : posTransferencias.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="py-6 text-center text-muted-foreground">Nenhuma pós-transferência vinculada.</TableCell></TableRow>
                  ) : posTransferencias.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">#{p.code}</TableCell>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{formatDateBR(p.transfer_date)}</TableCell>
                      <TableCell>{animalName(p.recipient_id)}</TableCell>
                      <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                      <TableCell>{formatDateBR(p.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/animais/transferencia-embriao")}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Aba Prenhez */}
          <TabsContent value="prenhez" className="mt-4">
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Ultrassom</TableHead>
                    <TableHead>Previsão Parto</TableHead>
                    <TableHead>Receptora</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criação</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : prenhezes.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">Nenhuma prenhez vinculada.</TableCell></TableRow>
                  ) : prenhezes.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">#{p.code}</TableCell>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{formatDateBR(p.ultrasound_date)}</TableCell>
                      <TableCell>{p.expected_birth_month ? formatDateBR(p.expected_birth_month) : "-"}</TableCell>
                      <TableCell>{animalName(p.recipient_id)}</TableCell>
                      <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                      <TableCell>{formatDateBR(p.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/animais/prenhez")}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Aba Animal */}
          <TabsContent value="animal" className="mt-4">
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Sexo</TableHead>
                    <TableHead>Raça</TableHead>
                    <TableHead>Nascimento</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : animaisGerados.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">Nenhum animal gerado vinculado.</TableCell></TableRow>
                  ) : animaisGerados.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">#{a.code}</TableCell>
                      <TableCell>{a.name}</TableCell>
                      <TableCell className="capitalize">{a.sex === "femea" ? "Fêmea" : a.sex === "macho" ? "Macho" : a.sex}</TableCell>
                      <TableCell>{breedName(a.breed_id)}</TableCell>
                      <TableCell>{formatDateBR(a.birth_date)}</TableCell>
                      <TableCell>{categoryName(a.category_id)}</TableCell>
                      <TableCell><Badge variant="outline">{a.is_active ? "Ativo" : "Inativo"}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/animais/cadastro")}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default ReproducoesVinculadas;
