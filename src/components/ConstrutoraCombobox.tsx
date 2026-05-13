import { useEffect, useMemo, useState } from "react";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { listarConstrutoras, type Construtora } from "@/services/construtorasService";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function norm(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default function ConstrutoraCombobox({ value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Construtora[]>([]);

  useEffect(() => {
    listarConstrutoras().then(setItems).catch(() => setItems([]));
  }, []);

  const exists = useMemo(() => {
    const q = norm(query || value);
    return items.some((c) => norm(c.nome) === q);
  }, [items, query, value]);

  const filtradas = useMemo(() => {
    const q = norm(query);
    if (!q) return items.slice(0, 50);
    return items.filter((c) => norm(c.nome).includes(q)).slice(0, 50);
  }, [items, query]);

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
            {value || placeholder || "Selecione ou crie uma construtora"}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar ou digitar nova..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {filtradas.length === 0 && !query && (
              <CommandEmpty>Nenhuma construtora cadastrada.</CommandEmpty>
            )}
            <CommandGroup heading="Construtoras existentes">
              {filtradas.map((c) => (
                <CommandItem
                  key={c.codigo || c.nome}
                  value={c.nome}
                  onSelect={() => {
                    onChange(c.nome);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      norm(value) === norm(c.nome) ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="flex-1 truncate">{c.nome}</span>
                  {c.codigo && (
                    <span className="text-[10px] text-muted-foreground font-mono ml-2">
                      {c.codigo}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            {query && !exists && (
              <CommandGroup heading="Criar nova">
                <CommandItem
                  value={`__new__${query}`}
                  onSelect={() => {
                    onChange(query.trim());
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Criar nova: <span className="font-semibold ml-1">{query}</span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
