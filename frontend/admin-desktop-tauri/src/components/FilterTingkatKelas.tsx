import { useMemo, useState } from 'react';
import { Check, ChevronDown } from '@/icons';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { TopBarFilter } from '@/components/TopBarFilter';

/** Gaya tombol trigger filter di topBar — seragam dropdown lembaga/TA/semester. */
const navBase =
  'flex items-center gap-2 rounded-md px-2.5 py-1 text-xs whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-foreground)]/60';
const navIdle =
  'text-[var(--sidebar-foreground)] hover:bg-[color-mix(in_srgb,var(--sidebar-foreground)_14%,transparent)] hover:text-white';

/** Urut alami (angka di dalam teks ikut diurut). */
const banding = (a: string, b: string) => a.localeCompare(b, 'id', { numeric: true });

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

export interface FilterTingkatKelasProps {
  tingkat: string[];
  kelas: string[];
  tingkatOpsi: string[];
  kelasOpsi: string[];
  togolTingkat: (v: string) => void;
  togolKelas: (v: string) => void;
  kosongkanTingkat: () => void;
  kosongkanKelas: () => void;
}

/**
 * State filter tingkat + kelas untuk satu daftar baris: opsi diturunkan dari
 * baris, pilihan multi, kelas menyempit mengikuti tingkat terpilih.
 * `getTingkat`/`getKelas` mengekstrak nilai dari tiap baris.
 */
export function useFilterTingkatKelas<T>(
  rows: T[],
  getTingkat: (r: T) => string | null | undefined,
  getKelas: (r: T) => string | null | undefined,
) {
  const [tingkat, setTingkat] = useState<string[]>([]);
  const [kelas, setKelas] = useState<string[]>([]);

  const bersih = (v: string | null | undefined) => (v ?? '').trim();

  const tingkatOpsi = useMemo(
    () => [...new Set(rows.map((r) => bersih(getTingkat(r))).filter(Boolean))].sort(banding),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows],
  );
  const kelasOpsi = useMemo(
    () => [...new Set(
      rows
        .filter((r) => tingkat.length === 0 || tingkat.includes(bersih(getTingkat(r))))
        .map((r) => bersih(getKelas(r)))
        .filter(Boolean),
    )].sort(banding),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, tingkat],
  );
  const tersaring = useMemo(
    () => rows.filter((r) => {
      if (tingkat.length > 0 && !tingkat.includes(bersih(getTingkat(r)))) return false;
      if (kelas.length > 0 && !kelas.includes(bersih(getKelas(r)))) return false;
      return true;
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, tingkat, kelas],
  );

  /** Pilih/lepas satu tingkat; kelas yang tak lagi relevan ikut dibuang. */
  function togolTingkat(v: string) {
    const next = tingkat.includes(v) ? tingkat.filter((x) => x !== v) : [...tingkat, v];
    setTingkat(next);
    const valid = new Set(
      rows
        .filter((r) => next.length === 0 || next.includes(bersih(getTingkat(r))))
        .map((r) => bersih(getKelas(r))),
    );
    setKelas((k) => k.filter((x) => valid.has(x)));
  }

  function togolKelas(v: string) {
    setKelas((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }

  return {
    tingkat,
    kelas,
    tingkatOpsi,
    kelasOpsi,
    togolTingkat,
    togolKelas,
    kosongkanTingkat: () => { setTingkat([]); setKelas([]); },
    kosongkanKelas: () => setKelas([]),
    tersaring,
  };
}

/** Tampilkan filter tingkat & kelas (multi-pilih) di baris atas topBar. */
export function FilterTingkatKelas({ filter }: { filter: FilterTingkatKelasProps }) {
  return (
    <TopBarFilter>
      <FilterMulti
        id="filter_tingkat_topbar"
        label="Tingkat"
        opsi={filter.tingkatOpsi}
        dipilih={filter.tingkat}
        onToggle={filter.togolTingkat}
        onSemua={filter.kosongkanTingkat}
      />
      <FilterMulti
        id="filter_kelas_topbar"
        label="Kelas"
        opsi={filter.kelasOpsi}
        dipilih={filter.kelas}
        onToggle={filter.togolKelas}
        onSemua={filter.kosongkanKelas}
      />
    </TopBarFilter>
  );
}
