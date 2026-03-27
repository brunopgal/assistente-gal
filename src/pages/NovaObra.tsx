import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HardHat } from "lucide-react";
import ObraForm, { type ObraFormValues } from "@/components/ObraForm";
import { criarObra, atualizarObra, buscarObra } from "@/services/obrasService";

export default function NovaObra() {
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("id");
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [defaultValues, setDefaultValues] = useState<Partial<ObraFormValues>>();
  const [loading, setLoading] = useState(!!editId);

  useEffect(() => {
    if (editId) {
      buscarObra(editId)
        .then((data) => setDefaultValues(data))
        .catch(() => toast({ title: "Erro ao carregar obra", variant: "destructive" }))
        .finally(() => setLoading(false));
    }
  }, [editId]);

  const handleSubmit = async (values: ObraFormValues) => {
    setIsSubmitting(true);
    try {
      if (editId) {
        await atualizarObra(editId, values as any);
        toast({ title: "Obra atualizada com sucesso" });
      } else {
        await criarObra(values as any);
        toast({ title: "Obra criada com sucesso" });
      }
    } catch {
      toast({ title: "Erro ao salvar obra", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
          <HardHat className="h-7 w-7 text-primary" />
          {editId ? "Editar Obra" : "Nova Obra"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {editId ? "Atualize os dados da obra" : "Cadastre ou edite uma obra"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados da Obra</CardTitle>
          <CardDescription>Preencha as informações abaixo</CardDescription>
        </CardHeader>
        <CardContent>
          <ObraForm
            key={editId || "new"}
            defaultValues={defaultValues}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            isEdit={!!editId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
