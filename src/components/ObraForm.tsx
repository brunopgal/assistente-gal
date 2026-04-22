import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import FileUploadField from "@/components/FileUploadField";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_OPTIONS = [
  "Prospectar",
  "Em prospecção",
  "Fazendo Orçamento",
  "Orçamento Enviado",
  "Fechado",
  "Perdido",
] as const;

const CLASSIFICACAO_OPTIONS = ["Baixo", "Médio", "Médio/Alto", "Alto"] as const;
const PRODUTO_OPTIONS = ["IMAB", "RHODEN", "PRADO", "Nenhum"] as const;
const VISITA_OPTIONS = ["Visitado", "Não visitado"] as const;
const REUNIAO_OPTIONS = ["Sim", "Não"] as const;
const ESTAGIO_OPTIONS = [
  "Fundação",
  "Estrutura",
  "Alvenaria",
  "Acabamento",
  "Finalizado",
  "Não iniciado",
] as const;

const obraSchema = z.object({
  codigoObra: z.string().optional(),
  dataCadastro: z.string(),
  statusProspeccao: z.string(),
  nome: z.string().min(1, "Nome da obra é obrigatório"),
  classificacao: z.string(),
  construtora: z.string().min(1, "Construtora/Cliente é obrigatório"),
  responsavel: z.string(),
  telefone: z.string(),
  email: z.string(),
  cidade: z.string(),
  localizacao: z.string(),
  produtoOferecido: z.string(),
  estagioObra: z.string(),
  marcouReuniao: z.string(),
  visita: z.string(),
  dataUltimaVisita: z.string(),
  dataOrcamentoEnviado: z.string(),
  proximoContato: z.string(),
  linkOrcamentoRhoden: z.string(),
  linkOrcamentoPrado: z.string(),
  linkOrcamentoImab: z.string(),
  observacoes: z.string(),
  concorrentes: z.string(),
});

export type ObraFormValues = z.infer<typeof obraSchema>;

interface ObraFormProps {
  defaultValues?: Partial<ObraFormValues>;
  onSubmit: (values: ObraFormValues) => Promise<void>;
  isSubmitting: boolean;
  isEdit?: boolean;
}

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export default function ObraForm({ defaultValues, onSubmit, isSubmitting, isEdit }: ObraFormProps) {
  const form = useForm<ObraFormValues>({
    resolver: zodResolver(obraSchema),
    defaultValues: {
      codigoObra: "",
      dataCadastro: todayIso(),
      statusProspeccao: "",
      nome: "",
      classificacao: "",
      construtora: "",
      responsavel: "",
      telefone: "",
      email: "",
      cidade: "",
      localizacao: "",
      produtoOferecido: "",
      estagioObra: "",
      marcouReuniao: "",
      visita: "",
      dataUltimaVisita: "",
      dataOrcamentoEnviado: "",
      proximoContato: "",
      linkOrcamentoRhoden: "",
      linkOrcamentoPrado: "",
      linkOrcamentoImab: "",
      observacoes: "",
      concorrentes: "",
      ...defaultValues,
    },
  });

  // Auto-fill "Data orçamento enviado" when status = "Orçamento Enviado"
  const statusValue = form.watch("statusProspeccao");
  useEffect(() => {
    if (statusValue === "Orçamento Enviado" && !form.getValues("dataOrcamentoEnviado")) {
      form.setValue("dataOrcamentoEnviado", todayIso(), { shouldDirty: true });
    }
  }, [statusValue, form]);

  // Visit date editing only enabled when visita = "Visitado"
  const visitaValue = form.watch("visita");
  const visitaEnabled = visitaValue === "Visitado";

  // Multi-select: produtoOferecido is stored as comma-separated string
  const produtoValue = form.watch("produtoOferecido");
  const produtoSelected = (produtoValue || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const toggleProduto = (option: string, checked: boolean) => {
    let next: string[];
    if (option === "nenhum") {
      next = checked ? ["nenhum"] : [];
    } else {
      next = produtoSelected.filter((p) => p !== "nenhum");
      if (checked) next = [...next, option];
      else next = next.filter((p) => p !== option);
    }
    form.setValue("produtoOferecido", next.join(", "), { shouldDirty: true });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Informações Básicas */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-3">Informações Básicas</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField control={form.control} name="codigoObra" render={({ field }) => (
              <FormItem>
                <FormLabel>ID</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    readOnly
                    placeholder={isEdit ? "" : "Gerado automaticamente"}
                    className="bg-muted"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="dataCadastro" render={({ field }) => (
              <FormItem>
                <FormLabel>Data de cadastro</FormLabel>
                <FormControl><Input type="date" {...field} readOnly className="bg-muted" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="statusProspeccao" render={({ field }) => (
              <FormItem>
                <FormLabel>Status da prospecção</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="nome" render={({ field }) => (
              <FormItem>
                <FormLabel>Nome da obra *</FormLabel>
                <FormControl><Input placeholder="Ex: Residencial Aurora" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="classificacao" render={({ field }) => (
              <FormItem>
                <FormLabel>Classificação da obra</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CLASSIFICACAO_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="construtora" render={({ field }) => (
              <FormItem>
                <FormLabel>Construtora/Cliente *</FormLabel>
                <FormControl><Input placeholder="Ex: MRV Engenharia" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="estagioObra" render={({ field }) => (
              <FormItem>
                <FormLabel>Estágio da obra</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ESTAGIO_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </div>

        {/* Contato */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-3">Contato</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField control={form.control} name="responsavel" render={({ field }) => (
              <FormItem>
                <FormLabel>Responsável/Contato</FormLabel>
                <FormControl><Input placeholder="Nome do responsável" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="telefone" render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone/Whastapp</FormLabel>
                <FormControl><Input placeholder="(00) 00000-0000" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl><Input type="email" placeholder="email@exemplo.com" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </div>

        {/* Localização */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-3">Localização</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="cidade" render={({ field }) => (
              <FormItem>
                <FormLabel>Cidade Obra</FormLabel>
                <FormControl><Input placeholder="Ex: Campinas" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="localizacao" render={({ field }) => (
              <FormItem>
                <FormLabel>Localização/Bairro Obra</FormLabel>
                <FormControl><Input placeholder="Ex: Centro, Zona Norte" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </div>

        {/* Produto e Acompanhamento */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-3">Produto e Acompanhamento</h3>

          {/* Produto Oferecido — multi select */}
          <div className="mb-4">
            <FormLabel>Produto Oferecido</FormLabel>
            <div className="flex flex-wrap gap-4 mt-2">
              {PRODUTO_OPTIONS.map((opt) => {
                const checked = produtoSelected.includes(opt);
                return (
                  <label key={opt} className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(c) => toggleProduto(opt, !!c)}
                    />
                    <span className="capitalize">{opt}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField control={form.control} name="marcouReuniao" render={({ field }) => (
              <FormItem>
                <FormLabel>Marcou Reunião?</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {REUNIAO_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="visita" render={({ field }) => (
              <FormItem>
                <FormLabel>Visita</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {VISITA_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="dataUltimaVisita" render={({ field }) => (
              <FormItem>
                <FormLabel>Data da última visita</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    {...field}
                    disabled={!visitaEnabled}
                    className={!visitaEnabled ? "bg-muted" : ""}
                  />
                </FormControl>
                {!visitaEnabled && (
                  <p className="text-xs text-muted-foreground">Disponível quando "Visita" = visitado</p>
                )}
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="dataOrcamentoEnviado" render={({ field }) => (
              <FormItem>
                <FormLabel>Data orçamento enviado</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="proximoContato" render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Próximo contato/Follow up</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => form.setValue("proximoContato", addDaysIso(7), { shouldDirty: true })}>
                    +7 dias
                  </Button>
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => form.setValue("proximoContato", addDaysIso(15), { shouldDirty: true })}>
                    +15 dias
                  </Button>
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => form.setValue("proximoContato", addDaysIso(30), { shouldDirty: true })}>
                    +30 dias
                  </Button>
                  <Button type="button" variant="ghost" size="sm"
                    onClick={() => form.setValue("proximoContato", "", { shouldDirty: true })}>
                    Limpar
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </div>

        {/* Orçamentos (Upload) */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-3">Orçamentos</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField control={form.control} name="linkOrcamentoRhoden" render={({ field }) => (
              <FileUploadField label="Link do orçamento/PDF RHODEN" value={field.value} onChange={field.onChange} />
            )} />
            <FormField control={form.control} name="linkOrcamentoPrado" render={({ field }) => (
              <FileUploadField label="Link do orçamento/PDF PRADO" value={field.value} onChange={field.onChange} />
            )} />
            <FormField control={form.control} name="linkOrcamentoImab" render={({ field }) => (
              <FileUploadField label="Link do orçamento/PDF IMAB" value={field.value} onChange={field.onChange} />
            )} />
          </div>
        </div>

        {/* Observações */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-3">Outras Informações</h3>
          <div className="grid grid-cols-1 gap-4">
            <FormField control={form.control} name="concorrentes" render={({ field }) => (
              <FormItem>
                <FormLabel>Concorrentes</FormLabel>
                <FormControl><Input placeholder="Ex: Empresa X, Empresa Y" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="observacoes" render={({ field }) => (
              <FormItem>
                <FormLabel>Observação</FormLabel>
                <FormControl><Textarea placeholder="Detalhes adicionais..." rows={4} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </div>

        <Button type="submit" disabled={isSubmitting} className="w-full md:w-auto">
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {isEdit ? "Atualizar obra" : "Salvar obra"}
        </Button>
      </form>
    </Form>
  );
}
