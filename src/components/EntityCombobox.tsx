import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { compareByName } from "@/lib/sortByName";

export interface EntityComboboxItem {
  id: string;
  name: string;
}

interface EntityComboboxProps {
  items: EntityComboboxItem[];
  value: string;
  onValueChange: (id: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  allLabel?: string;
  allValue?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  /** Exibe o item "Todos" no topo (padrão: true). */
  showAll?: boolean;
}

const normalizeSearchText = (text: string) =>
  text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

// Busca por qualquer parte do nome, ignorando acentos e maiúsculas.
// O value de cada item é o id (evita colisão entre nomes repetidos); o nome vai em keywords.
const filterByName = (_value: string, search: string, keywords?: string[]) => {
  const term = normalizeSearchText(search);
  if (!term) return 1;
  return normalizeSearchText((keywords || []).join(" ")).includes(term) ? 1 : 0;
};

export function EntityCombobox({
  items,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder = "Buscar...",
  allLabel = "Todos",
  allValue = "all",
  emptyText = "Nenhum registro encontrado.",
  disabled,
  className,
  id,
  showAll = true,
}: EntityComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const sortedItems = React.useMemo(
    () => [...items].sort(compareByName),
    [items],
  );

  const isAll = showAll && (!value || value === allValue);
  const selectedName = items.find((item) => item.id === value)?.name;
  const triggerLabel = selectedName ?? (showAll && value === allValue ? allLabel : placeholder ?? allLabel);

  const handleSelect = (id: string) => {
    onValueChange(id);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className="truncate" title={selectedName}>
            {triggerLabel}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={8}
        className="w-[var(--radix-popover-trigger-width)] min-w-[min(18rem,calc(100vw-1rem))] p-0"
      >
        <Command filter={filterByName}>
          <CommandInput autoFocus placeholder={searchPlaceholder} className="max-md:text-base" />
          <CommandList className="max-h-[60dvh] overflow-y-auto md:max-h-[300px]">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {showAll && (
              <CommandItem
                value={allValue}
                keywords={[allLabel]}
                onSelect={() => handleSelect(allValue)}
                className="min-h-10"
              >
                <Check className={cn("mr-2 h-4 w-4 shrink-0", isAll ? "opacity-100" : "opacity-0")} />
                {allLabel}
              </CommandItem>
              )}
              {sortedItems.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  keywords={[item.name || ""]}
                  onSelect={() => handleSelect(item.id)}
                  className="min-h-10"
                >
                  <Check className={cn("mr-2 h-4 w-4 shrink-0", value === item.id ? "opacity-100" : "opacity-0")} />
                  <span className="break-words">{item.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default EntityCombobox;
