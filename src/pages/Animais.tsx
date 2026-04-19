import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ClipboardList, Scale, Syringe, Layers, Heart, Settings, Baby, Droplets, GitBranch, FlaskConical } from "lucide-react";

const Animais = () => {
  const navigate = useNavigate();

  const menus = [
    {
      id: "cadastro",
      title: "Gestão de Animais",
      description: "Cadastro e gestão de animais",
      icon: ClipboardList,
      color: "bg-green-500",
      route: "/animais/cadastro",
    },
    {
      id: "lotes",
      title: "Lotes",
      description: "Gestão de lotes de animais",
      icon: Layers,
      color: "bg-orange-500",
      route: "/animais/lotes",
    },
    {
      id: "matrizes",
      title: "Matrizes & Genitores",
      description: "Cadastro de matrizes e genitores",
      icon: Heart,
      color: "bg-pink-500",
      route: "/animais/matrizes",
    },
    {
      id: "prenhez",
      title: "Gestão de Prenhez",
      description: "Acompanhamento de gestações",
      icon: Baby,
      color: "bg-rose-500",
      route: "/animais/prenhez",
    },
    {
      id: "aspiracoes",
      title: "Gestão de Aspirações",
      description: "Acompanhamento de aspirações",
      icon: Droplets,
      color: "bg-cyan-500",
      route: "/animais/aspiracoes",
    },
    {
      id: "semen",
      title: "Sêmen",
      description: "Estoque, genealogia e financeiro de sêmen",
      icon: FlaskConical,
      color: "bg-sky-600",
      route: "/animais/semen",
    },
    {
      id: "transferencia-embriao",
      title: "Pós Transferência de Embrião",
      description: "Acompanhamento pós transferência de embrião",
      icon: GitBranch,
      color: "bg-indigo-500",
      route: "/animais/transferencia-embriao",
    },
    {
      id: "pesagem",
      title: "Pesagem",
      description: "Controle de pesagem dos animais",
      icon: Scale,
      color: "bg-blue-500",
      route: "/animais/pesagem",
    },
    {
      id: "vacinacao",
      title: "Vacinação",
      description: "Controle de vacinação dos animais",
      icon: Syringe,
      color: "bg-purple-500",
      route: "/animais/vacinacao",
    },
    {
      id: "cadastros-gerais",
      title: "Cadastros Gerais",
      description: "Raças, categorias e outros cadastros",
      icon: Settings,
      color: "bg-gray-500",
      route: "/animais/cadastros-gerais",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-primary">Animais</h1>
            <p className="text-sm text-muted-foreground">Gestão de animais da fazenda</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menus.map((menu) => {
            const IconComponent = menu.icon;
            return (
              <Card key={menu.id} className="cursor-pointer hover:shadow-lg transition-shadow h-full flex flex-col">
                <CardHeader className="pb-3 flex-1">
                  <div className={`w-12 h-12 rounded-lg ${menu.color} flex items-center justify-center mb-3`}>
                    <IconComponent className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-lg">{menu.title}</CardTitle>
                  <CardDescription>{menu.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  <Button 
                    className="w-full" 
                    variant="outline"
                    onClick={() => navigate(menu.route)}
                  >
                    Acessar
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default Animais;
