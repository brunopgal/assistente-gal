import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Obras from "./pages/Obras";
import Agenda from "./pages/Agenda";
import Mapa from "./pages/Mapa";
import NovaObra from "./pages/NovaObra";
import FollowUp from "./pages/FollowUp";
import Construtoras from "./pages/Construtoras";
import Atividades from "./pages/Atividades";
import AtividadesGerais from "./pages/AtividadesGerais";
import ProspeccaoIA from "./pages/ProspeccaoIA";
import Pessoas from "./pages/Pessoas";
import Relatorios from "./pages/Relatorios";
import Configuracoes from "./pages/Configuracoes";
import Prospeccao from "./pages/Prospeccao";
import Orcamentos from "./pages/Orcamentos";
import NotFound from "./pages/NotFound";
import OrcamentoPublico from "./pages/OrcamentoPublico";
import ApresentacaoRedirect from "./pages/ApresentacaoRedirect";
import Apresentacao from "./pages/Apresentacao";
import Duplicatas from "./pages/Duplicatas";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/orcamento/:token" element={<OrcamentoPublico />} />
          <Route path="/apresentacao/:token" element={<ApresentacaoRedirect />} />
          <Route
            path="*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/obras" element={<Obras />} />
                    <Route path="/agenda" element={<Agenda />} />
                    <Route path="/mapa" element={<Mapa />} />
                    <Route path="/follow-up" element={<FollowUp />} />
                    <Route path="/construtoras" element={<Construtoras />} />
                    <Route path="/atividades/:id" element={<Atividades />} />
                    <Route path="/atividades-gerais" element={<AtividadesGerais />} />
                    <Route path="/pessoas" element={<Pessoas />} />
                    <Route path="/relatorios" element={<Relatorios />} />
                    <Route path="/configuracoes" element={<Configuracoes />} />
                    <Route path="/prospeccao" element={<Prospeccao />} />
                    <Route path="/orcamentos" element={<Orcamentos />} />
                    <Route path="/apresentacao" element={<Apresentacao />} />
                    <Route path="/prospeccao-ia" element={<ProspeccaoIA />} />
                    <Route path="/nova-obra" element={<NovaObra />} />
                    <Route path="/duplicatas" element={<Duplicatas />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
