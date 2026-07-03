import { useEffect, useMemo, useState } from "react";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { listarConstrutoras, type Construtora } from "@/services/construtorasService";

interface Props {
  value: string; // codigo
  onChange: (codigo: string, nome?: string) => void;
  placeholder?: string;
}

function norm(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default function ConstrutoraCodeCombobox({ value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Construtora[]>([]);

  useEffect(() => {
    listarConstrutoras().then(setItems).catch(() => setItems([]));
  }, []);

  const selectedItem = useMemo(() => {
    return items.find((c) => c.codigo === value);
  }, [items, value]);

  const filtradas = useMemo(() => {
    const q = norm(query);
    if (!q) return items.slice(0, 50);
    return items.filter((c) => norm(c.nome).includes(q) || norm(c.codigo || "").includes(q) || norm(c.cnpj || "").includes(q)).slice(0, 50);
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
            {selectedItem ? `${selectedItem.nome} (${selectedItem.codigo})` : placeholder || "Selecione uma construtora"}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar construtora por nome, cnpj ou código..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {filtradas.length === 0 && (
              <CommandEmpty>Nenhuma construtora encontrada.</CommandEmpty>
            )}
            <CommandGroup heading="Construtoras">
              {filtradas.map((c) => {
                const key = c.codigo || "";
                const subtitulo = c.cnpj ? `CNPJ: ${c.cnpj}` : key;
                return (
                  <CommandItem
                    key={key}
                    value={c.nome}
                    onSelect={() => {
                      onChange(key, c.nome || "");
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
                      <span className="truncate font-medium">{c.nome}</span>
                      <span className="text-[10px] text-muted-foreground font-mono truncate">
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
