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

export type ProcessPickerOption = {
  id: string;
  numero_cnj?: string | null;
  autor?: string | null;
  reu?: string | null;
  cliente?: string | null;
  label?: string | null;
  clientes?: { nome?: string | null } | null;
};

function processClient(option: ProcessPickerOption) {
  return (
    option.clientes?.nome?.trim() ||
    option.cliente?.trim() ||
    option.autor?.trim() ||
    option.label?.trim() ||
    "Processo sem cliente"
  );
}

function processNumber(option: ProcessPickerOption) {
  return option.numero_cnj?.trim() || option.label?.trim() || "Sem número informado";
}

type SearchableProcessPickerProps = {
  value: string | null | undefined;
  onValueChange: (value: string) => void;
  processes: ProcessPickerOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
};

export function SearchableProcessPicker({
  value,
  onValueChange,
  processes,
  placeholder = "Selecione o processo",
  searchPlaceholder = "Digite cliente, autor, réu ou número...",
  disabled = false,
}: SearchableProcessPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ordered = useMemo(
    () =>
      [...processes].sort((a, b) =>
        processClient(a).localeCompare(processClient(b), "pt-BR", { sensitivity: "base" }),
      ),
    [processes],
  );
  const filtered = useMemo(() => {
    const term = normalize(search);
    if (!term) return ordered;
    return ordered.filter((process) =>
      normalize(
        [processClient(process), process.numero_cnj, process.autor, process.reu, process.label]
          .filter(Boolean)
          .join(" "),
      ).includes(term),
    );
  }, [ordered, search]);
  const selected = processes.find((process) => process.id === value);

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
          className="h-auto min-h-11 w-full justify-between gap-3 px-3 py-2 text-left font-normal"
        >
          {selected ? (
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{processClient(selected)}</span>
              <span className="block truncate text-xs text-muted-foreground">
                Processo nº {processNumber(selected)}
              </span>
            </span>
          ) : (
            <span className="truncate text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-[360px] p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput value={search} onValueChange={setSearch} placeholder={searchPlaceholder} />
          <CommandList className="max-h-[min(420px,60vh)]">
            {!filtered.length && <CommandEmpty>Nenhum processo encontrado.</CommandEmpty>}
            <CommandGroup>
              {filtered.map((process) => (
                <CommandItem
                  key={process.id}
                  value={process.id}
                  className="items-start py-2.5"
                  onSelect={() => {
                    onValueChange(process.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mt-0.5 size-4",
                      value === process.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{processClient(process)}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      Processo nº {processNumber(process)}
                    </span>
                    {(process.autor || process.reu) && (
                      <span className="block truncate text-xs text-muted-foreground/80">
                        {[process.autor, process.reu].filter(Boolean).join(" × ")}
                      </span>
                    )}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
