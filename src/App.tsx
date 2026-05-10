import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Auth from "./pages/Auth";
import Obras from "./pages/Obras";
import Agenda from "./pages/Agenda";
import Mapa from "./pages/Mapa";
import NovaObra from "./pages/NovaObra";
import FollowUp from "./pages/FollowUp";
import Visitas from "./pages/Visitas";
import Construtoras from "./pages/Construtoras";
import Atividades from "./pages/Atividades";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route
            path="*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Obras />} />
                    <Route path="/agenda" element={<Agenda />} />
                    <Route path="/mapa" element={<Mapa />} />
                    <Route path="/follow-up" element={<FollowUp />} />
                    <Route path="/visitas" element={<Visitas />} />
                    <Route path="/construtoras" element={<Construtoras />} />
                    <Route path="/atividades/:id" element={<Atividades />} />
                    <Route path="/nova-obra" element={<NovaObra />} />
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
