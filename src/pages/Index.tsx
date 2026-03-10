import elitebovLogo from "@/assets/elitebov-logo.png";
import { BarChart3, Beef, DollarSign, LayoutDashboard, CheckCircle2, Users, TrendingUp, Wallet, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const Index = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* HERO SECTION */}
      <section className="relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-50 via-emerald-50 to-green-100" />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23166534' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
        
        <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-32">
          <div className="flex flex-col items-center text-center space-y-8">
            <img src={elitebovLogo} alt="ELITEBOV" className="h-28 md:h-36 drop-shadow-lg" />
            
            <div className="space-y-4">
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-green-900">
                ELITEBOV
              </h1>
              <p className="text-xl md:text-2xl font-medium text-green-700">
                Plataforma inteligente para gestão pecuária.
              </p>
              <p className="text-base md:text-lg text-green-800/70 max-w-2xl mx-auto leading-relaxed">
                Controle financeiro, gestão do rebanho, acompanhamento de manejo e relatórios completos para uma pecuária mais eficiente e profissional.
              </p>
            </div>

            <a href="/auth">
              <Button className="bg-green-700 hover:bg-green-800 text-white px-10 py-6 text-lg rounded-xl shadow-lg shadow-green-700/20 transition-all hover:shadow-xl hover:shadow-green-700/30 hover:-translate-y-0.5">
                Entrar no Sistema
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </a>
          </div>
        </div>

        {/* Decorative bottom wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 80L60 68C120 56 240 32 360 24C480 16 600 24 720 32C840 40 960 48 1080 44C1200 40 1320 24 1380 16L1440 8V80H0Z" fill="white"/>
          </svg>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section className="py-20 md:py-28 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-green-900 mb-4">
              Tudo que você precisa em um só lugar
            </h2>
            <p className="text-green-700/70 text-lg max-w-xl mx-auto">
              Funcionalidades pensadas para simplificar e profissionalizar a gestão da sua fazenda.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: DollarSign,
                title: "Controle Financeiro",
                description: "Gestão completa de receitas, despesas, fluxo de caixa e relatórios financeiros por fazenda.",
              },
              {
                icon: Beef,
                title: "Gestão do Rebanho",
                description: "Controle de animais, genética, reprodução, movimentações e histórico completo do rebanho.",
              },
              {
                icon: BarChart3,
                title: "Indicadores da Fazenda",
                description: "Acompanhe produtividade, custos, desempenho do rebanho e indicadores estratégicos.",
              },
            ].map((feature, i) => (
              <Card key={i} className="border-green-100 bg-green-50/40 shadow-sm hover:shadow-md transition-shadow group">
                <CardContent className="pt-8 pb-6 px-6 text-center space-y-4">
                  <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto group-hover:bg-green-200 transition-colors">
                    <feature.icon className="h-7 w-7 text-green-700" />
                  </div>
                  <h3 className="text-xl font-semibold text-green-900">{feature.title}</h3>
                  <p className="text-green-800/60 leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* BENEFITS SECTION */}
      <section className="py-20 bg-gradient-to-r from-green-700 to-green-800">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
            Por que escolher a ELITEBOV?
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              "Gestão centralizada de todas as fazendas",
              "Histórico completo do rebanho",
              "Controle financeiro integrado",
              "Relatórios automáticos",
              "Plataforma segura e em nuvem",
              "Suporte técnico dedicado",
            ].map((benefit, i) => (
              <div key={i} className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-5 py-4">
                <CheckCircle2 className="h-5 w-5 text-green-300 shrink-0" />
                <span className="text-white font-medium">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DASHBOARD PREVIEW */}
      <section className="py-20 md:py-28 bg-green-50/50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-green-900 mb-4">
              Visão completa da sua fazenda
            </h2>
            <p className="text-green-700/70 text-lg max-w-xl mx-auto">
              Dashboard intuitivo com os indicadores mais importantes na palma da sua mão.
            </p>
          </div>

          {/* Mock dashboard */}
          <div className="bg-white rounded-2xl shadow-xl border border-green-100 p-6 md:p-8 max-w-4xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Total de Animais", value: "1.248", icon: Beef, color: "text-green-700" },
                { label: "Receita do Mês", value: "R$ 285.400", icon: TrendingUp, color: "text-emerald-600" },
                { label: "Despesas", value: "R$ 142.800", icon: Wallet, color: "text-orange-600" },
                { label: "Lucro da Fazenda", value: "R$ 142.600", icon: DollarSign, color: "text-green-700" },
              ].map((card, i) => (
                <div key={i} className="bg-green-50 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <card.icon className={`h-4 w-4 ${card.color}`} />
                    <span className="text-xs text-green-800/60 font-medium">{card.label}</span>
                  </div>
                  <p className={`text-lg md:text-xl font-bold ${card.color}`}>{card.value}</p>
                </div>
              ))}
            </div>

            {/* Mock charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-green-50/60 rounded-xl p-5 h-44 flex flex-col">
                <span className="text-sm font-semibold text-green-900 mb-3">Crescimento do Rebanho</span>
                <div className="flex-1 flex items-end gap-2">
                  {[40, 55, 45, 65, 50, 72, 60, 78, 85, 70, 90, 95].map((h, i) => (
                    <div key={i} className="flex-1 bg-green-300 rounded-t-sm hover:bg-green-500 transition-colors" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
              <div className="bg-green-50/60 rounded-xl p-5 h-44 flex flex-col">
                <span className="text-sm font-semibold text-green-900 mb-3">Resultado Financeiro</span>
                <div className="flex-1 flex items-end gap-2">
                  {[60, 50, 70, 45, 80, 65, 90, 55, 75, 85, 70, 88].map((h, i) => (
                    <div key={i} className="flex-1 bg-emerald-300 rounded-t-sm hover:bg-emerald-500 transition-colors" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TARGET AUDIENCE */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-green-900 mb-4">
              Para quem é a ELITEBOV?
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Users, title: "Produtores Rurais" },
              { icon: Beef, title: "Fazendas de Gado" },
              { icon: TrendingUp, title: "Melhoramento Genético" },
              { icon: LayoutDashboard, title: "Gestores Agropecuários" },
            ].map((item, i) => (
              <div key={i} className="text-center space-y-3 p-6 rounded-xl border border-green-100 hover:border-green-200 hover:bg-green-50/50 transition-all">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <item.icon className="h-6 w-6 text-green-700" />
                </div>
                <h3 className="font-semibold text-green-900">{item.title}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-20 md:py-28 bg-gradient-to-br from-green-800 to-green-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23fff' fill-opacity='1' fill-rule='evenodd'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E")`,
        }} />
        <div className="relative max-w-3xl mx-auto px-4 text-center space-y-8">
          <h2 className="text-3xl md:text-5xl font-bold text-white">
            Transforme a gestão da sua pecuária
          </h2>
          <p className="text-green-200 text-lg md:text-xl leading-relaxed">
            Utilize tecnologia para aumentar produtividade, organização e controle da sua fazenda.
          </p>
          <a href="/auth">
            <Button className="bg-white text-green-800 hover:bg-green-50 px-10 py-6 text-lg rounded-xl shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 font-semibold mt-4">
              Acessar Plataforma
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-green-950 text-green-300 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <img src={elitebovLogo} alt="ELITEBOV" className="h-10" />
                <span className="text-xl font-bold text-white">ELITEBOV</span>
              </div>
              <p className="text-sm text-green-400/70 leading-relaxed">
                ELITEBOV é uma plataforma desenvolvida para modernizar a gestão pecuária, trazendo controle financeiro, gestão do rebanho e indicadores estratégicos em um único sistema.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-white">Links</h4>
              <div className="flex flex-col gap-2">
                <a href="/auth" className="text-sm text-green-400/70 hover:text-white transition-colors">Login</a>
                <a href="#" className="text-sm text-green-400/70 hover:text-white transition-colors">Contato</a>
                <a href="#" className="text-sm text-green-400/70 hover:text-white transition-colors">Suporte</a>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-white">Contato</h4>
              <p className="text-sm text-green-400/70">suporte@elitebov.com.br</p>
            </div>
          </div>

          <div className="border-t border-green-800 mt-10 pt-6 text-center">
            <p className="text-sm text-green-500/60">© {new Date().getFullYear()} ELITEBOV. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
