import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ExtratosModal } from "@/components/ExtratosModal";

const Extratos = () => {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(true);

  const handleModalClose = (open: boolean) => {
    setModalOpen(open);
    if (!open) {
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center space-x-4">
          <Button onClick={() => navigate("/dashboard")} variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-primary">Extratos de Contas</h1>
            <p className="text-sm text-muted-foreground">Gere extratos detalhados das movimentações das suas contas</p>
          </div>
        </div>
      </header>

      <ExtratosModal open={modalOpen} onOpenChange={handleModalClose} />
    </div>
  );
};

export default Extratos;