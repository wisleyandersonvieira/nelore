import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const AnimaisPesagem = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/animais")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-primary">Pesagem de Animais</h1>
            <p className="text-sm text-muted-foreground">Controle de pesagem dos animais</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="text-center text-muted-foreground py-12">
          <p>Módulo de pesagem de animais em desenvolvimento.</p>
        </div>
      </main>
    </div>
  );
};

export default AnimaisPesagem;
