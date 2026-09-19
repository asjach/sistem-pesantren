import { useEffect } from 'react';
import { Check, ChevronDown, ChevronLeft, ChevronRight } from '@/icons';
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
  onMove,
  placeholder = 'Pilih…',
  title,
  disabled = false,
}: {
  id: string;
  options: MultiSelectOption[];
  values: string[];
  onChange: (values: string[]) => void;
  /** Geser posisi nilai terpilih (untuk urutan bermakna, mis. kolom urut). */
  onMove?: (from: number, to: number) => void;
  placeholder?: string;
  title?: string;
  disabled?: boolean;
}) {
  const toggle = (value: string) => {
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
  };
  // Default: bila pilihan hanya satu, nilainya dipakai otomatis — pengguna tak
  // perlu membukanya dulu. Hanya saat belum ada nilai & tidak nonaktif.
  const opsi = options.map((o) => o.value).join('|');
  useEffect(() => {
    if (disabled || values.length > 0 || options.length !== 1) return;
    onChange([options[0].value]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, values.length, opsi]);
  /** Teks trigger mengikuti urutan pilih (klik), bukan urutan opsi. */
  const teks = values
    .map((v) => options.find((o) => o.value === v)?.label ?? v)
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
          data-part="multiselect"
          className={cn(
            'flex h-6 w-full items-center justify-between gap-1 rounded-md border border-input bg-transparent px-2 text-xs whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none',
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
        {options.map((o) => {
          const pos = values.indexOf(o.value);
          const terpilih = pos >= 0;
          return (
            <DropdownMenuItem
              key={o.value}
              onSelect={(e) => {
                e.preventDefault();
                toggle(o.value);
              }}
            >
              <Check className={cn('size-4', !terpilih && 'opacity-0')} />
              {terpilih ? (
                <span className="grid size-4 shrink-0 place-items-center rounded-full bg-accent text-[10px] font-medium">
                  {pos + 1}
                </span>
              ) : null}
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              {terpilih && onMove ? (
                <span className="flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    title="Geser ke kiri (lebih utama)"
                    aria-label={`Geser ${o.label} ke kiri`}
                    disabled={disabled || pos === 0}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMove(pos, pos - 1); }}
                    className="grid size-5 place-items-center rounded hover:bg-accent disabled:opacity-30"
                  >
                    <ChevronLeft size={12} />
                  </button>
                  <button
                    type="button"
                    title="Geser ke kanan"
                    aria-label={`Geser ${o.label} ke kanan`}
                    disabled={disabled || pos === values.length - 1}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMove(pos, pos + 1); }}
                    className="grid size-5 place-items-center rounded hover:bg-accent disabled:opacity-30"
                  >
                    <ChevronRight size={12} />
                  </button>
                </span>
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
