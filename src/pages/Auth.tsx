import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Lock, Mail, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: string } | null)?.from || "/";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate(from, { replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate(from, { replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate, from]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      let finalEmail = email.trim();
      if (!finalEmail.includes("@")) {
        finalEmail = `${finalEmail.replace(/\s+/g, "").toLowerCase()}@gallo.com`;
      }

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: finalEmail, password });
        if (error) {
          // If login fails because user does not exist, try to sign up automatically
          if (error.message.toLowerCase().includes("invalid login credentials")) {
            const { error: signUpError } = await supabase.auth.signUp({
              email: finalEmail,
              password,
              options: { emailRedirectTo: `${window.location.origin}/` },
            });
            if (signUpError) throw signUpError;
            
            // Login again after sign up
            const { error: signInError } = await supabase.auth.signInWithPassword({ email: finalEmail, password });
            if (signInError) throw signInError;
            toast.success("Conta criada e conectado com sucesso!");
          } else {
            throw error;
          }
        } else {
          toast.success("Bem-vindo!");
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email: finalEmail,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        toast.success("Conta criada! Você já pode entrar.");
        setMode("login");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-nav-active/10 mb-4">
            <Building2 className="h-8 w-8 text-nav-active" />
          </div>
          <h1
            className="text-3xl font-bold tracking-tight text-foreground"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Painel de Obras
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Acesso restrito · sistema privado de gestão comercial
          </p>
        </div>

        <div className="rounded-2xl border bg-card text-card-foreground shadow-xl p-6 md:p-8">
          <div className="flex gap-2 mb-6 p-1 bg-muted rounded-lg">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
                mode === "login"
                  ? "bg-nav-active text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
                mode === "signup"
                  ? "bg-nav-active text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email ou Usuário</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ex: gallo.rep ou seu@email.com"
                  className="pl-10"
                  autoComplete="email"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-nav-active hover:bg-nav-active/90 text-primary-foreground font-medium"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "login" ? (
                "Entrar"
              ) : (
                "Criar conta"
              )}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-6">
            Conexão protegida · seus dados são privados
          </p>
        </div>
      </div>
    </div>
  );
}
