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
  "Contato",
  "Visita",
  "Proposta",
  "Fechado",
] as const;

const obraSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  construtora: z.string().min(1, "Construtora é obrigatória"),
  cidade: z.string(),
  status: z.string(),
  responsavel: z.string(),
  dataContato: z.string(),
  observacoes: z.string(),
});

export type ObraFormValues = z.infer<typeof obraSchema>;

interface ObraFormProps {
  defaultValues?: Partial<ObraFormValues>;
  onSubmit: (values: ObraFormValues) => Promise<void>;
  isSubmitting: boolean;
  isEdit?: boolean;
}

export default function ObraForm({ defaultValues, onSubmit, isSubmitting, isEdit }: ObraFormProps) {
  const form = useForm<ObraFormValues>({
    resolver: zodResolver(obraSchema),
    defaultValues: {
      nome: "",
      construtora: "",
      cidade: "",
      status: "",
      responsavel: "",
      dataContato: "",
      observacoes: "",
      ...defaultValues,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormField control={form.control} name="nome" render={({ field }) => (
            <FormItem>
              <FormLabel>Nome da Obra</FormLabel>
              <FormControl><Input placeholder="Ex: Residencial Aurora" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="construtora" render={({ field }) => (
            <FormItem>
              <FormLabel>Construtora</FormLabel>
              <FormControl><Input placeholder="Ex: MRV Engenharia" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="cidade" render={({ field }) => (
            <FormItem>
              <FormLabel>Cidade</FormLabel>
              <FormControl><Input placeholder="Ex: Campinas" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="status" render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
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

          <FormField control={form.control} name="responsavel" render={({ field }) => (
            <FormItem>
              <FormLabel>Responsável</FormLabel>
              <FormControl><Input placeholder="Nome do responsável" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="dataContato" render={({ field }) => (
            <FormItem>
              <FormLabel>Data de Contato</FormLabel>
              <FormControl><Input type="date" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="observacoes" render={({ field }) => (
          <FormItem>
            <FormLabel>Observações</FormLabel>
            <FormControl><Textarea placeholder="Detalhes adicionais sobre a obra..." rows={4} {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <Button type="submit" disabled={isSubmitting} className="w-full md:w-auto">
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEdit ? "Atualizar obra" : "Salvar obra"}
        </Button>
      </form>
    </Form>
  );
}
