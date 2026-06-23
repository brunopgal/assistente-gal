import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function ApresentacaoRedirect() {
  const { token } = useParams<{ token: string }>();

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        window.location.reload();
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  useEffect(() => {
    if (token) {
      const registrarERedirecionar = async () => {
        try {
          await supabase.functions.invoke("registrar-abertura", {
            body: { token, tipo: "apresentacao", _cb: Date.now() },
          });
        } catch (error) {
          console.warn("Falha silenciosa ao registrar abertura de apresentacao:", error);
        } finally {
          window.location.replace("https://galrepresentacoes.com.br/");
        }
      };
      registrarERedirecionar();
    } else {
      window.location.replace("https://galrepresentacoes.com.br/");
    }
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
      <h2 className="text-xl font-bold text-foreground mb-2">Redirecionando...</h2>
      <p className="text-sm text-muted-foreground">Você está sendo redirecionado para a Gal Representações.</p>
    </div>
  );
}
