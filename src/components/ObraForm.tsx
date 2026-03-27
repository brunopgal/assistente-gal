import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  "Prospecção",
  "Contato Inicial",
  "Em Negociação",
  "Proposta Enviada",
  "Fechado",
  "Perdido",
] as const;

const CLASSIFICACAO_OPTIONS = [
  "Residencial",
  "Comercial",
  "Industrial",
  "Misto",
  "Infraestrutura",
] as const;

const ESTAGIO_OPTIONS = [
  "Fundação",
  "Estrutura",
  "Alvenaria",
  "Acabamento",
  "Finalizado",
  "Não iniciado",
] as const;

const REUNIAO_OPTIONS = ["Sim", "Não"] as const;
const VISITA_OPTIONS = ["Sim", "Não"] as const;

const obraSchema = z.object({
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

export default function ObraForm({ defaultValues, onSubmit, isSubmitting, isEdit }: ObraFormProps) {
  const today = new Date().toISOString().split("T")[0];

  const form = useForm<ObraFormValues>({
    resolver: zodResolver(obraSchema),
    defaultValues: {
      dataCadastro: today,
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Seção: Informações Básicas */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-3">Informações Básicas</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField control={form.control} name="dataCadastro" render={({ field }) => (
              <FormItem>
                <FormLabel>Data de Cadastro</FormLabel>
                <FormControl><Input type="date" {...field} readOnly className="bg-muted" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="statusProspeccao" render={({ field }) => (
              <FormItem>
                <FormLabel>Status da Prospecção</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                <FormLabel>Nome da Obra *</FormLabel>
                <FormControl><Input placeholder="Ex: Residencial Aurora" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="classificacao" render={({ field }) => (
              <FormItem>
                <FormLabel>Classificação da Obra</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                <FormLabel>Estágio da Obra</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
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

        {/* Seção: Contato */}
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
                <FormLabel>Telefone/WhatsApp</FormLabel>
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

        {/* Seção: Localização */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-3">Localização</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="cidade" render={({ field }) => (
              <FormItem>
                <FormLabel>Cidade da Obra</FormLabel>
                <FormControl><Input placeholder="Ex: Campinas" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="localizacao" render={({ field }) => (
              <FormItem>
                <FormLabel>Localização/Bairro</FormLabel>
                <FormControl><Input placeholder="Ex: Centro, Zona Norte" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </div>

        {/* Seção: Produto e Acompanhamento */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-3">Produto e Acompanhamento</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField control={form.control} name="produtoOferecido" render={({ field }) => (
              <FormItem>
                <FormLabel>Produto Oferecido</FormLabel>
                <FormControl><Input placeholder="Ex: Concreto usinado" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="marcouReuniao" render={({ field }) => (
              <FormItem>
                <FormLabel>Marcou Reunião?</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                <FormLabel>Data da Última Visita</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="dataOrcamentoEnviado" render={({ field }) => (
              <FormItem>
                <FormLabel>Data Orçamento Enviado</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="proximoContato" render={({ field }) => (
              <FormItem>
                <FormLabel>Próximo Contato/Follow Up</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </div>

        {/* Seção: Links de Orçamentos */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-3">Links de Orçamentos</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField control={form.control} name="linkOrcamentoRhoden" render={({ field }) => (
              <FormItem>
                <FormLabel>Link Orçamento RHODEN</FormLabel>
                <FormControl><Input placeholder="https://..." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="linkOrcamentoPrado" render={({ field }) => (
              <FormItem>
                <FormLabel>Link Orçamento PRADO</FormLabel>
                <FormControl><Input placeholder="https://..." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="linkOrcamentoImab" render={({ field }) => (
              <FormItem>
                <FormLabel>Link Orçamento IMAB</FormLabel>
                <FormControl><Input placeholder="https://..." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </div>

        {/* Seção: Observações */}
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
                <FormLabel>Observações</FormLabel>
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
