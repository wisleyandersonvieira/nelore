import logo from "@/assets/logo.png";

const Index = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100">
      <div className="text-center space-y-8 max-w-4xl mx-auto px-4">
        <div className="space-y-4">
          <img src={logo} alt="Elite Sistemas" className="h-48 w-48 mx-auto" />
          <h2 className="text-2xl font-semibold text-green-700">Sistema para Gestão de Gado de Elite</h2>
          <p className="text-xl text-green-600/80 max-w-2xl mx-auto">
            Gestão completa do seu rebanho com controle de pesagens, lotes, reprodução e muito mais.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a 
            href="/auth" 
            className="inline-flex items-center justify-center rounded-full bg-green-700 px-8 py-3 text-sm font-medium text-white hover:bg-green-800 transition-colors"
          >
            Fazer Login
          </a>
          <a 
            href="/auth" 
            className="inline-flex items-center justify-center rounded-full border border-green-300 bg-white px-8 py-3 text-sm font-medium text-green-700 hover:bg-green-50 transition-colors"
          >
            Criar Conta
          </a>
        </div>
      </div>
    </div>
  );
};

export default Index;
