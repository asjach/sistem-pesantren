import { Check, ChevronDown } from '@/icons';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

/** Gaya tombol trigger filter di topBar — seragam dropdown lembaga/TA/semester. */
const navBase =
  'flex items-center gap-2 rounded-md px-2.5 py-1 text-xs whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-foreground)]/60';
const navIdle =
  'text-[var(--sidebar-foreground)] hover:bg-[color-mix(in_srgb,var(--sidebar-foreground)_14%,transparent)] hover:text-white';

/** Dropdown filter multi-pilih (centang banyak): tetap terbuka saat memilih. */
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          id={id}
          type="button"
          title={dipilih.length ? `${label}: ${dipilih.join(', ')}` : label}
          aria-label={label}
          className={cn(navBase, navIdle, 'mr-1 data-[state=open]:bg-white/15')}
        >
          <span className="hidden max-w-[9rem] truncate sm:inline">
            {dipilih.length ? `${label} (${dipilih.length})` : label}
          </span>
          <ChevronDown size={13} className="opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 min-w-[12rem] overflow-y-auto">
        <DropdownMenuItem id={`${id}_semua`} onSelect={(e) => { e.preventDefault(); onSemua(); }}>
          <span className="flex-1">Semua</span>
          {dipilih.length === 0 && <Check data-icon="inline-end" size={14} />}
        </DropdownMenuItem>
        {opsi.map((o) => (
          <DropdownMenuItem key={o} id={`${id}_${o}`} onSelect={(e) => { e.preventDefault(); onToggle(o); }}>
            <span className="flex-1 truncate">{o}</span>
            {dipilih.includes(o) && <Check data-icon="inline-end" size={14} />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
