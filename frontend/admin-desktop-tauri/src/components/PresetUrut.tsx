import { useCallback, useEffect, useRef, useState } from 'react';
import {
  arahKolomDariOpsi,
  muatUrutPreset,
  type ArahUrut,
  type PresetUrutData,
} from '@/api/urutPreset';
import FilterField from '@/components/FilterField';
import TombolIkon from '@/components/TombolIkon';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronDown, ChevronUp, Pin } from '@/icons';

const TANPA = '_tanpa';

/** Dropdown Urutkan yang sumbernya Preset Urut (global per tabel).
 *  Pengelolaan opsi hanya lewat dialog Kelola Tabel (section Urutan).
 *  Opsi dengan `arah_kolom` mengirim arah per kode ke `onUrut` (token
 *  `kode:arah`) sehingga tiap kolom bisa beda orientasi (mis. aktif DESC,
 *  nama ASC). */ 
export default function PresetUrut({
  tableKey,
  urutAktif,
  arahUrut = 'naik',
  onUrut,
  wrapperClassName,
  lebarTrigger,
}: {
  tableKey: string;
  urutAktif?: string[];
  arahUrut?: 'naik' | 'turun';
  /** `arahKolom` = arah per kode (bila opsi preset punya pengaturan sendiri). */
  onUrut?: (nilai: string[], arah: 'naik' | 'turun', arahKolom?: Record<string, ArahUrut>) => void;
  wrapperClassName?: string;
  /** Lebar trigger dropdown (px) dari tab Kontrol; kosong = 100 bawaan. */
  lebarTrigger?: number;
}) {
  const [data, setData] = useState<PresetUrutData | null>(null);
  /** table_key yang opsi bawaannya sudah diterapkan (sekali per tabel). */
  const sudahRef = useRef('');
  /** Sudah selesai muat pertama? Dipakai gerbang tampil/sembunyi dropdown. */
  const [muatSelesai, setMuatSelesai] = useState(false);
  const [gagalMuat, setGagalMuat] = useState(false);

  const muat = useCallback(async () => {
    // Termemo per tabel: berbagi satu request dengan hook data.
    try {
      const res = await muatUrutPreset(tableKey);
      setData(res.data);
      setGagalMuat(false);
    } catch {
      // Gagal memuat preset: dropdown tampil tanpa opsi (urutan tetap jalan).
      setData({ table_key: tableKey, opsi: [], tersedia: [] });
      setGagalMuat(true);
    } finally {
      setMuatSelesai(true);
    }
  }, [tableKey]);

  useEffect(() => {
    void muat();
    sudahRef.current = '';
  }, [muat]);

  const opsi = data?.opsi ?? [];
  const kunciAktif = (urutAktif ?? []).join(',');
  const idxAktif = opsi.findIndex((o) => o.kode.join(',') === kunciAktif);
  const nilaiSelect = idxAktif >= 0 ? String(idxAktif) : kunciAktif === '' ? TANPA : '';

  // Terapkan opsi bawaan sekali saat preset termuat & halaman belum punya urutan.
  // (Bila hook data sudah membenihkan urutan yang sama, penjaga urutAktif
  // di bawah membuatnya nir-op: tidak ada muat ulang kedua.)
  useEffect(() => {
    if (!data || !onUrut) return;
    if ((urutAktif ?? []).length > 0 || sudahRef.current === tableKey) return;
    sudahRef.current = tableKey;
    const bawaan = data.opsi.find((o) => o.bawaan);
    if (bawaan) {
      const globalArah = bawaan.arah ?? arahUrut ?? 'naik';
      onUrut(bawaan.kode, globalArah, arahKolomDariOpsi(bawaan));
    }
  }, [data, tableKey, urutAktif, arahUrut, onUrut]);

  function pilihNilai(v: string) {
    if (v === TANPA) {
      onUrut?.([], arahUrut);
      return;
    }
    const it = opsi[Number(v)];
    if (it) onUrut?.(it.kode, it.arah ?? arahUrut ?? 'naik', arahKolomDariOpsi(it));
  }

  function balikArah() {
    if ((urutAktif ?? []).length === 0) return;
    onUrut?.(urutAktif ?? [], arahUrut === 'naik' ? 'turun' : 'naik');
  }

  // Tanpa opsi nyata (hanya "—") dropdown tak berguna: sembunyikan. Tetap
  // tampil saat masih memuat, saat muat gagal, atau saat ada urutan aktif
  // (agar arah masih bisa dibalik).
  const tampil = !muatSelesai || gagalMuat || opsi.length > 0 || (urutAktif ?? []).length > 0;
  if (!tampil) return null;

  return (
    <span className="flex items-end gap-0">
      <FilterField label="Urutkan" htmlFor={`select_urut_${tableKey}`} kelolaLebar={false} className={wrapperClassName}>
        <Select
          value={nilaiSelect || undefined}
          onValueChange={pilihNilai}
          onOpenChange={(buka) => { if (buka) void muat(); }}
        >
          <SelectTrigger
            id={`select_urut_${tableKey}`}
            className="rounded-r-none border-r-0"
            style={{ width: `${lebarTrigger ?? 120}px` }}
          >
            <SelectValue placeholder="Urutkan…" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value={TANPA}>—</SelectItem>
              {opsi.map((o, i) => (
                <SelectItem key={`${o.kode.join(',')}-${i}`} value={String(i)}>
                  {o.bawaan ? (
                    <span className="flex items-center gap-1.5">
                      <Pin size={12} className="shrink-0 text-muted-foreground" aria-label="Urutan bawaan" />
                      {o.label}
                    </span>
                  ) : o.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </FilterField>
      <TombolIkon
        id={`btn_arah_urut_${tableKey}`}
        variant="outline"
        size="icon-sm"
        className="rounded-l-none border-l"
        tip={`Balik arah urutan (kini: ${arahUrut === 'naik' ? 'naik' : 'turun'})`}
        disabled={(urutAktif ?? []).length === 0}
        onClick={balikArah}
      >
        {arahUrut === 'naik' ? <ChevronUp /> : <ChevronDown />}
      </TombolIkon>
    </span>
  );
}
