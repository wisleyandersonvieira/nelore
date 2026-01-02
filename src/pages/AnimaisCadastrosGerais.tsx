import { useNavigate } from "react-router-dom";
import { ArrowLeft, Dog, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const AnimaisCadastrosGerais = () => {
  const navigate = useNavigate();

  const menus = [
    {
      title: "Raça",
      description: "Cadastro de raças dos animais",
      icon: Dog,
      color: "bg-amber-500",
      route: "/animais/cadastros-gerais/racas",
    },
    {
      title: "Categoria",
      description: "Cadastro de categorias dos animais",
      icon: Tag,
      color: "bg-teal-500",
      route: "/animais/cadastros-gerais/categorias",
    },
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => navigate("/animais")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Cadastros Gerais</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menus.map((menu) => (
            <Card
              key={menu.title}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(menu.route)}
            >
              <CardHeader>
                <div className={`w-12 h-12 ${menu.color} rounded-lg flex items-center justify-center mb-2`}>
                  <menu.icon className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">{menu.title}</CardTitle>
                <CardDescription>{menu.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className={`w-full ${menu.color} hover:opacity-90`}>
                  Acessar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnimaisCadastrosGerais;
