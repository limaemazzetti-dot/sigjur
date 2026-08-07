import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export type ClientPickerOption = {
  id: string;
  nome: string;
};

type SearchableClientPickerProps = {
  value: string | null | undefined;
  onValueChange: (value: string) => void;
  clients: ClientPickerOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyOptionLabel?: string;
  disabled?: boolean;
  excludeIds?: string[];
};

export function SearchableClientPicker({
  value,
  onValueChange,
  clients,
  placeholder = "Selecione o cliente",
  searchPlaceholder = "Digite o nome do cliente...",
  emptyOptionLabel,
  disabled = false,
  excludeIds = [],
}: SearchableClientPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const available = useMemo(
    () =>
      clients
        .filter((client) => !excludeIds.includes(client.id))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [clients, excludeIds],
  );
  const filtered = useMemo(() => {
    const term = normalize(search);
    if (!term) return available;
    return available.filter((client) => normalize(client.nome).includes(term));
  }, [available, search]);
  const selected = clients.find((client) => client.id === value);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
      modal
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-10 w-full justify-between px-3 font-normal"
        >
          <span
            className={cn("truncate", !selected && value !== "__none__" && "text-muted-foreground")}
          >
            {value === "__none__" && emptyOptionLabel
              ? emptyOptionLabel
              : selected?.nome || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput value={search} onValueChange={setSearch} placeholder={searchPlaceholder} />
          <CommandList className="max-h-80">
            {!filtered.length && <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>}
            <CommandGroup>
              {emptyOptionLabel && (
                <CommandItem
                  value="__none__"
                  onSelect={() => {
                    onValueChange("__none__");
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("size-4", value === "__none__" ? "opacity-100" : "opacity-0")}
                  />
                  <span>{emptyOptionLabel}</span>
                </CommandItem>
              )}
              {filtered.map((client) => (
                <CommandItem
                  key={client.id}
                  value={client.id}
                  onSelect={() => {
                    onValueChange(client.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("size-4", value === client.id ? "opacity-100" : "opacity-0")}
                  />
                  <span className="truncate">{client.nome}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
