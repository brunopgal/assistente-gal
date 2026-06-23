import { useEffect, useState } from "react";
import { Settings, Save, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { getConfig, setConfig } from "@/services/configuracoesService";

const DEFAULT_EMAIL = 10;
const DEFAULT_WPP = 7;
const DEFAULT_ORC = 15;
const PRESETS = [5, 7, 10, 15, 30, 60];

function ConfigRow({ title, description, valor, setValor }: { title: string; description: string; valor: number; setValor: (v: number) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map(p => (
          <Button
            key={p}
            variant={valor === p ? "default" : "outline"}
            size="sm"
            onClick={() => setValor(p)}
          >
            {p} dias
          </Button>
        ))}
        <div className="flex items-center gap-2 ml-2">
          <span className="text-xs text-muted-foreground">Outro:</span>
          <Input
            type="number"
            className="w-20 h-8 text-sm"
            value={valor || ""}
            onChange={e => setValor(Number(e.target.value))}
            min={1}
          />
        </div>
      </div>
    </div>
  );
}

export default function Configuracoes() {
  const [emailDias, setEmailDias] = useState(DEFAULT_EMAIL);
  const [wppDias, setWppDias] = useState(DEFAULT_WPP);
  const [orcDias, setOrcDias] = useState(DEFAULT_ORC);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [e, w, o] = await Promise.all([
          getConfig("dias_followup_email"),
          getConfig("dias_followup_whatsapp"),
          getConfig("dias_followup_orcamento")
        ]);
        if (e) setEmailDias(Number(e));
        if (w) setWppDias(Number(w));
        if (o) setOrcDias(Number(o));
      } catch (err) {
        console.error("Erro ao carregar configurações", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function salvar() {
    setSaving(true);
    try {
      await Promise.all([
        setConfig("dias_followup_email", String(emailDias)),
        setConfig("dias_followup_whatsapp", String(wppDias)),
        setConfig("dias_followup_orcamento", String(orcDias))
      ]);
      toast.success("Configuração salva");
    } catch (e) {
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-muted flex items-center justify-center">
          <Settings className="h-6 w-6 text-foreground/80" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Configurações
          </h1>
          <p className="text-sm text-muted-foreground">Ajuste os prazos padrão para agendamento de follow-up.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Prazos padrão de follow-up</CardTitle>
              <CardDescription>
                Define a quantidade de dias para agendar o próximo contato ao registrar uma ação.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <>
              <ConfigRow
                title="E-mail"
                description="Prazo padrão sugerido ao registrar o envio de um e-mail."
                valor={emailDias}
                setValor={setEmailDias}
              />
              <ConfigRow
                title="WhatsApp"
                description="Prazo padrão sugerido ao registrar o envio de uma mensagem no WhatsApp."
                valor={wppDias}
                setValor={setWppDias}
              />
              <ConfigRow
                title="Orçamento enviado"
                description="Prazo padrão sugerido ao registrar o envio de um orçamento."
                valor={orcDias}
                setValor={setOrcDias}
              />

              <div className="flex justify-end pt-4 border-t">
                <Button onClick={salvar} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar configurações
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
