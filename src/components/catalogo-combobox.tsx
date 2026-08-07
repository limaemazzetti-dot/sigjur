import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
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

type CatalogoComboboxProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  allowCustom?: boolean;
};

export function CatalogoCombobox({
  value,
  onValueChange,
  options,
  placeholder = "Selecione uma opção",
  searchPlaceholder = "Digite para buscar...",
  disabled = false,
  allowCustom = true,
}: CatalogoComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const cleanOptions = useMemo(
    () =>
      Array.from(new Set(options.map((option) => option.trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [options],
  );
  const filtered = useMemo(() => {
    const term = normalize(search);
    if (!term) return cleanOptions;
    return cleanOptions.filter((option) => normalize(option).includes(term));
  }, [cleanOptions, search]);
  const exactMatch = cleanOptions.some((option) => normalize(option) === normalize(search));
  const customValue = search.trim();

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
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput value={search} onValueChange={setSearch} placeholder={searchPlaceholder} />
          <CommandList className="max-h-72">
            {!filtered.length && !(allowCustom && customValue) && (
              <CommandEmpty>Nenhuma opção encontrada.</CommandEmpty>
            )}
            <CommandGroup>
              {filtered.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => {
                    onValueChange(option);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "size-4",
                      normalize(value) === normalize(option) ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span>{option}</span>
                </CommandItem>
              ))}
              {allowCustom && customValue && !exactMatch && (
                <CommandItem
                  value={`custom-${customValue}`}
                  onSelect={() => {
                    onValueChange(customValue);
                    setOpen(false);
                  }}
                >
                  <Plus className="size-4 text-primary" />
                  <span>
                    Usar <strong>“{customValue}”</strong>
                  </span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
