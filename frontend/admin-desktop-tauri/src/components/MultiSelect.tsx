import { Check, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface MultiSelectOption {
  value: string;
  label: string;
}

export default function MultiSelect({
  id,
  options,
  values,
  onChange,
  placeholder = 'Pilih…',
  title,
  disabled = false,
}: {
  id: string;
  options: MultiSelectOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  title?: string;
  disabled?: boolean;
}) {
  const toggle = (value: string) => {
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
  };
  const teks = options
    .filter((o) => values.includes(o.value))
    .map((o) => o.label)
    .join(', ');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          id={id}
          type="button"
          title={title}
          aria-label={title}
          disabled={disabled}
          className={cn(
            'flex h-[30px] w-full items-center justify-between gap-1 rounded-md border border-input bg-transparent px-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none',
            'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30',
          )}
        >
          <span className={cn('line-clamp-1 text-left', !teks && 'text-muted-foreground')}>
            {teks || placeholder}
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-64 w-(--radix-dropdown-menu-trigger-width) min-w-56 overflow-auto">
        {options.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onSelect={(e) => {
              e.preventDefault();
              toggle(o.value);
            }}
          >
            <Check className={cn('size-4', !values.includes(o.value) && 'opacity-0')} />
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
