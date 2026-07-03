import { useEffect, useMemo, useState } from "react";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { listarObras, type Obra } from "@/services/obrasService";

interface Props {
  value: string; // codigoObra
  onChange: (codigoObra: string, nome?: string) => void;
  placeholder?: string;
}

function norm(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default function ObraCombobox({ value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Obra[]>([]);

  useEffect(() => {
    listarObras().then(setItems).catch(() => setItems([]));
  }, []);

  const selectedItem = useMemo(() => {
    return items.find((o) => (o.codigoObra || o.id) === value);
  }, [items, value]);

  const filtradas = useMemo(() => {
    const q = norm(query);
    if (!q) return items.slice(0, 50);
    return items.filter((o) => {
      const matchName = norm(o.nome).includes(q);
      const matchCode = norm(o.codigoObra || "").includes(q);
      const matchConstrutora = norm(o.construtora || "").includes(q);
      const matchCidade = norm(o.cidade || "").includes(q);
      return matchName || matchCode || matchConstrutora || matchCidade;
    }).slice(0, 50);
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
            {selectedItem ? `${selectedItem.nome} (${selectedItem.codigoObra || selectedItem.id})` : placeholder || "Selecione uma obra"}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar obra por nome, construtora, cidade ou código..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {filtradas.length === 0 && (
              <CommandEmpty>Nenhuma obra encontrada.</CommandEmpty>
            )}
            <CommandGroup heading="Obras">
              {filtradas.map((o) => {
                const key = o.codigoObra || o.id || "";
                const subtitulo = [
                  o.construtora,
                  o.cidade || key
                ].filter(Boolean).join(" · ");
                return (
                  <CommandItem
                    key={key}
                    value={o.nome}
                    onSelect={() => {
                      onChange(key, o.nome || "");
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
                      <span className="truncate font-medium">{o.nome}</span>
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
