import { Check, ChevronDown } from '@/icons';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { ModeFilterGlobal } from '@/lib/filterHalaman';

const navBase =
  'flex items-center gap-2 rounded-md px-2.5 py-1 text-xs whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-foreground)]/60';
const navIdle =
  'text-[var(--sidebar-foreground)] hover:bg-[color-mix(in_srgb,var(--sidebar-foreground)_14%,transparent)] hover:text-white';

export interface OpsiFilterDropdown {
  nilai: string;
  label: string;
  id?: string;
}

export interface FilterDropdownProps {
  id: string;
  label: string;
  mode: ModeFilterGlobal;
  opsi: readonly OpsiFilterDropdown[];
  dipilih: readonly string[];
  onPilih: (nilai: string) => void;
  onSemua: () => void;
  tampilSemua?: boolean;
  labelTerpilih?: string | null;
  ariaLabel?: string;
  title?: string;
  idSemua?: string;
}

export function FilterDropdown({
  id,
  label,
  mode,
  opsi,
  dipilih,
  onPilih,
  onSemua,
  tampilSemua = true,
  labelTerpilih,
  ariaLabel,
  title,
  idSemua,
}: FilterDropdownProps) {
  const judul = mode === 'single'
    ? title ?? labelTerpilih ?? label
    : dipilih.length > 0 ? `${label}: ${dipilih.join(', ')}` : label;
  const teks = mode === 'single'
    ? labelTerpilih ?? 'Semua'
    : dipilih.length > 0 ? `${label} (${dipilih.length})` : label;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          id={id}
          type="button"
          title={judul}
          aria-label={ariaLabel ?? label}
          className={cn(navBase, navIdle, 'mr-1 data-[state=open]:bg-white/15')}
        >
          <span className="hidden max-w-[9rem] truncate sm:inline">{teks}</span>
          <ChevronDown size={13} className="opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 min-w-[12rem] overflow-y-auto">
        {tampilSemua && (
          <DropdownMenuItem
            id={idSemua ?? `${id}_semua`}
            onSelect={(event) => {
              if (mode === 'multiple') event.preventDefault();
              onSemua();
            }}
          >
            <span className="flex-1">Semua</span>
            {dipilih.length === 0 && <Check data-icon="inline-end" size={14} />}
          </DropdownMenuItem>
        )}
        {opsi.map((opsi) => (
          <DropdownMenuItem
            key={opsi.nilai}
            id={opsi.id ?? `${id}_${opsi.nilai.replace(/[^a-z0-9]+/gi, '_').toLowerCase() || 'opsi'}`}
            onSelect={(event) => {
              if (mode === 'multiple') event.preventDefault();
              onPilih(opsi.nilai);
            }}
          >
            <span className="flex-1 truncate">{opsi.label}</span>
            {dipilih.includes(opsi.nilai) && <Check data-icon="inline-end" size={14} />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FilterMulti({
  id,
  label,
  opsi,
  dipilih,
  onToggle,
  onSemua,
}: {
  id: string;
  label: string;
  opsi: string[];
  dipilih: string[];
  onToggle: (v: string) => void;
  onSemua: () => void;
}) {
  return (
    <FilterDropdown
      id={id}
      label={label}
      mode="multiple"
      opsi={opsi.map((nilai) => ({ nilai, label: nilai }))}
      dipilih={dipilih}
      onPilih={onToggle}
      onSemua={onSemua}
    />
  );
}