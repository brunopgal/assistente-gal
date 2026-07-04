import { useEffect, useMemo, useState } from "react";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { listarPessoas, type Pessoa } from "@/services/pessoasService";
import { listarConstrutoras, type Construtora } from "@/services/construtorasService";

interface Props {
  value: string; // codigoPessoa
  onChange: (codigoPessoa: string, nome?: string) => void;
  placeholder?: string;
  codigoConstrutoraFilter?: string; // Filtro opcional por Construtora
}

function norm(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default function PessoaCombobox({ value, onChange, placeholder, codigoConstrutoraFilter }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Pessoa[]>([]);
  const [construtoras, setConstrutoras] = useState<Construtora[]>([]);

  useEffect(() => {
    Promise.all([
      listarPessoas().catch(() => []),
      listarConstrutoras().catch(() => [])
    ]).then(([p, c]) => {
      setItems(p);
      setConstrutoras(c);
    });
  }, []);

  const construtoraMap = useMemo(() => {
    const m = new Map<string, string>();
    construtoras.forEach((c) => {
      if (c.codigo) m.set(c.codigo, c.nome);
    });
    return m;
  }, [construtoras]);

  const filteredItems = useMemo(() => {
    if (!codigoConstrutoraFilter) return items;
    return items.filter((p) => p.codigoConstrutora === codigoConstrutoraFilter);
  }, [items, codigoConstrutoraFilter]);

  const selectedItem = useMemo(() => {
    return items.find((p) => p.codigoPessoa === value);
  }, [items, value]);

  const filtradas = useMemo(() => {
    const q = norm(query);
    if (!q) return filteredItems.slice(0, 50);
    return filteredItems.filter((p) => {
      const matchName = norm(p.nome).includes(q);
      const matchCargo = norm(p.cargo || "").includes(q);
      const matchCode = norm(p.codigoPessoa || "").includes(q);
      const construtorNome = construtoraMap.get(p.codigoConstrutora) || "";
      const matchConstrutora = norm(construtorNome).includes(q);
      return matchName || matchCargo || matchCode || matchConstrutora;
    }).slice(0, 50);
  }, [filteredItems, query, construtoraMap]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {selectedItem ? `${selectedItem.nome} (${selectedItem.cargo || "Contato"})` : placeholder || "Selecione um contato"}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar contato por nome, cargo ou construtora..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {filtradas.length === 0 && (
              <CommandEmpty>Nenhum contato encontrado.</CommandEmpty>
            )}
            <CommandItem
              value="__none__"
              onSelect={() => {
                onChange("");
                setQuery("");
                setOpen(false);
              }}
            >
              <Check className={cn("mr-2 h-4 w-4 shrink-0", !value ? "opacity-100" : "opacity-0")} />
              <span className="text-muted-foreground">Nenhum contato</span>
            </CommandItem>
            <CommandGroup heading="Contatos">
              {filtradas.map((p) => {
                const key = p.codigoPessoa || "";
                const construtorNome = construtoraMap.get(p.codigoConstrutora) || p.codigoConstrutora || "Sem Construtora";
                const subtitulo = [
                  p.cargo,
                  construtorNome
                ].filter(Boolean).join(" · ");
                return (
                  <CommandItem
                    key={key}
                    value={p.nome}
                    onSelect={() => {
                      onChange(key, p.nome || "");
                      setQuery("");
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        value === key ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="truncate font-medium">{p.nome}</span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {subtitulo}
                      </span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
