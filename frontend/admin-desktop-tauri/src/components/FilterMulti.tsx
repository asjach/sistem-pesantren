import { Check, ChevronDown } from '@/icons';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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
  disabled?: boolean;
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
  disabled = false,
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
          disabled={disabled}
          title={judul}
          aria-label={ariaLabel ?? label}
          className={cn(navBase, navIdle, 'mr-1 data-[state=open]:bg-white/15')}
        >
          <span className="hidden max-w-[9rem] truncate sm:inline">{teks}</span>
          <ChevronDown size={13} className="opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="max-h-80 min-w-[12rem] overflow-y-auto">
        {tampilSemua && (
          <DropdownMenuItem
            id={idSemua ?? `${id}_semua`}
            className="relative justify-center"
            onSelect={(event) => {
              if (mode === 'multiple') event.preventDefault();
              onSemua();
            }}
          >
            <span className="w-full truncate text-center">Semua</span>
            {dipilih.length === 0 && <Check data-icon="inline-end" className="absolute right-2" size={14} />}
          </DropdownMenuItem>
        )}
        {opsi.map((opsi) => (
          <DropdownMenuItem
            key={opsi.nilai}
            id={opsi.id ?? `${id}_${opsi.nilai.replace(/[^a-z0-9]+/gi, '_').toLowerCase() || 'opsi'}`}
            className="relative justify-center"
            onSelect={(event) => {
              if (mode === 'multiple') event.preventDefault();
              onPilih(opsi.nilai);
            }}
          >
            <span className="w-full truncate text-center">{opsi.label}</span>
            {dipilih.includes(opsi.nilai) && <Check data-icon="inline-end" className="absolute right-2" size={14} />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const NILAI_SEMUA = '__semua__';

export function FilterSelect({
  id,
  label,
  mode,
  opsi,
  dipilih,
  onPilih,
  onSemua,
  tampilkanSemua = true,
  ariaLabel,
  title,
  idSemua,
  className,
  disabled = false,
}: {
  id: string;
  label: string;
  mode: ModeFilterGlobal;
  opsi: readonly OpsiFilterDropdown[];
  dipilih: readonly string[];
  onPilih: (nilai: string) => void;
  onSemua: () => void;
  tampilkanSemua?: boolean;
  ariaLabel?: string;
  title?: string;
  idSemua?: string;
  className?: string;
  disabled?: boolean;
}) {
  if (mode === 'multiple') {
    return (
      <FilterDropdown
        id={id}
        label={label}
        mode={mode}
        opsi={opsi}
        dipilih={dipilih}
        onPilih={onPilih}
        onSemua={onSemua}
        tampilSemua={tampilkanSemua}
        ariaLabel={ariaLabel}
        title={title}
        idSemua={idSemua}
        disabled={disabled}
      />
    );
  }

  const semuaTerpilih = dipilih.length === 0;
  const value = semuaTerpilih ? (tampilkanSemua ? NILAI_SEMUA : '') : dipilih[0] ?? '';
  return (
    <Select
      disabled={disabled}
      value={value}
      onValueChange={(next) => {
        if (!next || next === NILAI_SEMUA) onSemua();
        else onPilih(next);
      }}
    >
      <SelectTrigger
        id={id}
        title={title ?? labelTerpilihFallback(dipilih, label)}
        aria-label={ariaLabel ?? label}
        className={cn(
          'mr-1 h-6 max-w-[12rem] border-0 bg-transparent px-2.5 text-white/90 hover:bg-white/10 data-[placeholder]:text-white/70',
          className,
        )}
      >
        <SelectValue placeholder={tampilkanSemua ? 'Semua' : label} />
      </SelectTrigger>
      <SelectContent align="center" position="popper" sideOffset={4} className="min-w-[12rem]">
        <SelectGroup>
          {tampilkanSemua ? (
            <SelectItem id={idSemua ?? `${id}_semua`} value={NILAI_SEMUA} className="justify-center pr-8 pl-8">
              Semua
            </SelectItem>
          ) : null}
          {opsi.map((item) => (
            <SelectItem
              key={item.nilai}
              id={item.id ?? `${id}_${item.nilai.replace(/[^a-z0-9]+/gi, '_').toLowerCase() || 'opsi'}`}
              value={item.nilai}
              className="justify-center pr-8 pl-8"
            >
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function labelTerpilihFallback(dipilih: readonly string[], label: string): string {
  return dipilih[0] ?? label;
}

export function FilterToggleGroup({
  id,
  label,
  mode,
  opsi,
  dipilih,
  onPilih,
  onSemua,
  ariaLabel,
  idSemua,
  tampilkanSemua = true,
  itemClassName,
  className,
  disabled = false,
}: {
  id: string;
  label: string;
  mode: ModeFilterGlobal;
  opsi: readonly OpsiFilterDropdown[];
  dipilih: readonly string[];
  onPilih: (nilai: string) => void;
  onSemua: () => void;
  ariaLabel?: string;
  idSemua?: string;
  tampilkanSemua?: boolean;
  itemClassName?: string;
  className?: string;
  disabled?: boolean;
}) {
  const semuaTerpilih = dipilih.length === 0;
  const valueSingle = semuaTerpilih
    ? (tampilkanSemua ? NILAI_SEMUA : '')
    : dipilih[0] ?? '';
  const valueMultiple = semuaTerpilih
    ? (tampilkanSemua ? [NILAI_SEMUA] : [])
    : [...dipilih];

  function ubahNilai(next: string | string[]) {
    const nilai = Array.isArray(next) ? next : next ? [next] : [];
    if (mode === 'single') {
      const pilihan = nilai[0];
      if (!pilihan || pilihan === NILAI_SEMUA) onSemua();
      else onPilih(pilihan);
      return;
    }
    const selainSemua = nilai.filter((item) => item !== NILAI_SEMUA);
    if (nilai.includes(NILAI_SEMUA)) {
      if (semuaTerpilih && selainSemua.length > 0) onPilih(selainSemua[0]);
      else onSemua();
      return;
    }
    const berikutnya = new Set(selainSemua);
    const ditambah = selainSemua.find((item) => !dipilih.includes(item));
    const dihapus = dipilih.find((item) => !berikutnya.has(item));
    if (ditambah) onPilih(ditambah);
    else if (dihapus) onPilih(dihapus);
    else if (nilai.length === 0) onSemua();
  }

  const isi = (
    <>
      {tampilkanSemua ? (
        <ToggleGroupItem
          id={idSemua ?? `${id}_semua`}
          value={NILAI_SEMUA}
          title="Semua"
          aria-label={`${label}: Semua`}
          className="h-6 rounded-none px-2 text-xs font-normal"
        >
          Semua
        </ToggleGroupItem>
      ) : null}
      {opsi.map((item) => (
        <ToggleGroupItem
          key={item.nilai}
          id={item.id ?? `${id}_${item.nilai.replace(/[^a-z0-9]+/gi, '_').toLowerCase() || 'opsi'}`}
          value={item.nilai}
          title={item.label}
          aria-label={`${label}: ${item.label}`}
          className={cn('h-6 max-w-full rounded-none px-2 text-xs font-normal', itemClassName)}
        >
          <span className="max-w-full truncate">{item.label}</span>
        </ToggleGroupItem>
      ))}
    </>
  );
  const common = {
    id,
    disabled,
    spacing: 0,
    'aria-label': ariaLabel ?? label,
    className: cn('mr-1 flex h-6 max-w-full gap-0 overflow-hidden rounded-md', className),
  };

  return mode === 'single' ? (
    <ToggleGroup
      {...common}
      type="single"
      value={valueSingle}
      onValueChange={(next) => { ubahNilai(next); }}
    >
      {isi}
    </ToggleGroup>
  ) : (
    <ToggleGroup
      {...common}
      type="multiple"
      value={valueMultiple}
      onValueChange={(next) => { ubahNilai(next); }}
    >
      {isi}
    </ToggleGroup>
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