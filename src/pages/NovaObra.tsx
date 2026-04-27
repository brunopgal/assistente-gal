import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { HardHat, Search, Loader2 } from "lucide-react";
import ObraForm, { type ObraFormValues } from "@/components/ObraForm";
import { criarObra, atualizarObra, buscarObra } from "@/services/obrasService";

export default function NovaObra() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawId = searchParams.get("id") || "";
  // Aceita apenas IDs válidos (OBRA + 9 dígitos, e diferente do placeholder zerado)
  const isValidId = /^OBRA\d{9}$/i.test(rawId) && !/^OBRA0+$/i.test(rawId);
  const editId = isValidId ? rawId.toUpperCase() : "";
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [defaultValues, setDefaultValues] = useState<Partial<ObraFormValues>>();
  const [loading, setLoading] = useState(!!editId);
  const [searchInput, setSearchInput] = useState(editId);

  useEffect(() => {
    // Se URL trouxe id inválido (ex: OBRA000000000), limpa para evitar 404
    if (rawId && !isValidId) {
      setSearchParams({});
      return;
    }
    setSearchInput(editId);

    // Read optional prefill from Secretária chat
    let prefill: Partial<ObraFormValues> | undefined;
    try {
      const raw = sessionStorage.getItem("secretaria_prefill");
      if (raw) {
        const parsed = JSON.parse(raw) as { mode: string; id?: string; fields?: Record<string, string> };
        const matchesEdit = parsed.mode === "editar" && parsed.id === editId;
        const matchesNew = parsed.mode === "nova" && !editId;
        if (matchesEdit || matchesNew) {
          prefill = parsed.fields as Partial<ObraFormValues>;
        }
        sessionStorage.removeItem("secretaria_prefill");
      }
    } catch {
      // ignore
    }

    if (!editId) {
      setDefaultValues(prefill);
      setLoading(false);
      if (prefill) toast({ title: "Campos preenchidos pela Secretária" });
      return;
    }
    setLoading(true);
    buscarObra(editId)
      .then((data) => {
        const merged = { ...(data as Partial<ObraFormValues>), ...(prefill || {}) };
        setDefaultValues(merged);
        if (prefill) toast({ title: "Obra carregada e atualizada pela Secretária" });
      })
      .catch(() => toast({ title: "Obra não encontrada", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [editId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const id = searchInput.trim();
    if (!id) {
      setSearchParams({});
      return;
    }
    setSearchParams({ id });
  };

  const handleClear = () => {
    setSearchInput("");
    setSearchParams({});
  };

  const handleSubmit = async (values: ObraFormValues) => {
    setIsSubmitting(true);
    try {
      if (editId) {
        await atualizarObra(editId, values as never);
        toast({ title: "Obra atualizada com sucesso" });
      } else {
        const created = await criarObra(values as never);
        toast({ title: `Obra criada (${created.codigoObra || created.id})` });
        if (created.codigoObra || created.id) {
          setSearchParams({ id: (created.codigoObra || created.id) as string });
        }
      }
    } catch (err) {
      toast({
        title: "Erro ao salvar obra",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
          <HardHat className="h-7 w-7 text-primary" />
          {editId ? "Editar Obra" : "Nova Obra"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {editId ? `Editando ${editId}` : "Cadastre uma nova obra ou busque por ID para editar"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buscar obra existente</CardTitle>
          <CardDescription>Digite o ID (ex: OBRA000000001) para editar</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
              placeholder="OBRA000000001"
              className="font-mono"
            />
            <Button type="submit" variant="default">
              <Search className="h-4 w-4 mr-1" /> Buscar
            </Button>
            {editId && (
              <Button type="button" variant="outline" onClick={handleClear}>
                Nova obra
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dados da Obra</CardTitle>
          <CardDescription>Preencha as informações abaixo</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <ObraForm
              key={editId || "new"}
              defaultValues={defaultValues}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              isEdit={!!editId}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
