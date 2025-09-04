import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCog, UserPlus, Activity } from "lucide-react";
import JobFunctionModal from "./JobFunctionModal";
import EmployeeModal from "./EmployeeModal";
import EmployeeMovementModal from "./EmployeeMovementModal";

interface FuncionariosModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FuncionariosModal = ({ isOpen, onClose }: FuncionariosModalProps) => {
  const [showJobFunctionModal, setShowJobFunctionModal] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showEmployeeMovementModal, setShowEmployeeMovementModal] = useState(false);

  const modules = [
    {
      id: 'job-functions',
      title: 'Cadastrar Função',
      description: 'Cadastro de funções e cargos',
      icon: UserCog,
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: 'employees',
      title: 'Cadastrar Funcionário',
      description: 'Cadastro de funcionários',
      icon: UserPlus,
      color: 'from-green-500 to-green-600'
    },
    {
      id: 'employee-movement',
      title: 'Movimentação Funcionários',
      description: 'Consultar movimentações financeiras dos funcionários',
      icon: Activity,
      color: 'from-purple-500 to-purple-600'
    }
  ];

  const handleModuleClick = (moduleId: string) => {
    if (moduleId === 'job-functions') {
      setShowJobFunctionModal(true);
    } else if (moduleId === 'employees') {
      setShowEmployeeModal(true);
    } else if (moduleId === 'employee-movement') {
      setShowEmployeeMovementModal(true);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">
              Módulo Funcionários
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4">
            {modules.map((module) => {
              const IconComponent = module.icon;
              return (
                <Card 
                  key={module.id}
                  className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] group"
                  onClick={() => handleModuleClick(module.id)}
                >
                  <CardHeader className="text-center">
                    <div className={`mx-auto w-16 h-16 rounded-full bg-gradient-to-r ${module.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200`}>
                      <IconComponent className="w-8 h-8 text-white" />
                    </div>
                    <CardTitle className="text-xl">{module.title}</CardTitle>
                    <CardDescription className="text-base">
                      {module.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      className="w-full" 
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleModuleClick(module.id);
                      }}
                    >
                      Acessar
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <JobFunctionModal 
        isOpen={showJobFunctionModal} 
        onClose={() => setShowJobFunctionModal(false)} 
      />

      <EmployeeModal 
        isOpen={showEmployeeModal} 
        onClose={() => setShowEmployeeModal(false)} 
      />

      <EmployeeMovementModal 
        isOpen={showEmployeeMovementModal} 
        onClose={() => setShowEmployeeMovementModal(false)} 
      />
    </>
  );
};

export default FuncionariosModal;