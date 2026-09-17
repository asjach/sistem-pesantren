import { useMemo, useRef, useState } from 'react';
import { Check as CheckIcon, ChevronDown as ChevronDownIcon } from '@/icons';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface ComboOpsi {
  value: string;
  label: string;
}

interface Props {
  /** id tombol pemicu (snake_case). */
  id?: string;
  /** id kotak pencarian di dalam popover. */
  inputId?: string;
  value: string;
  onChange: (v: string) => void;
  options: ComboOpsi[];
  placeholder?: string;
  kosongText?: string;
  /** Kelas lebar pemicu, mis. `w-56`. */
  className?: string;
  disabled?: boolean;
}

/** Dropdown pilihan dengan kotak pencarian (mis. daftar tabel yang panjang).
 *  Dibangun dari Popover radix + Input, tanpa dependency tambahan. */
export default function ComboCari({
  id,
  inputId,
  value,
  onChange,
  options,
  placeholder = 'Pilih…',
  kosongText = 'Tidak ada hasil.',
  className,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [cari, setCari] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const terpilih = options.find((o) => o.value === value);
  const hasil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (q === '') return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [options, cari]);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setCari('');
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          disabled={disabled}
          className={cn(
            'flex h-9 w-56 items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        >
          <span className={cn('truncate', !terpilih && 'text-muted-foreground')}>
            {terpilih?.label ?? placeholder}
          </span>
          <ChevronDownIcon className="size-4 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)]"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
      >
        <input
          ref={inputRef}
          id={inputId}
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="Cari…"
          aria-label="Cari pilihan"
          className="mb-1 h-8 w-full min-w-0 rounded-md border border-input bg-transparent px-2 text-xs shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        />
        <div role="listbox" className="max-h-64 overflow-y-auto">
          {hasil.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">{kosongText}</p>
          ) : (
            hasil.map((o) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                  setCari('');
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground',
                  o.value === value && 'bg-accent/60',
                )}
              >
                <CheckIcon className={cn('size-3.5 shrink-0', o.value === value ? 'opacity-100' : 'opacity-0')} />
                <span className="truncate">{o.label}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
