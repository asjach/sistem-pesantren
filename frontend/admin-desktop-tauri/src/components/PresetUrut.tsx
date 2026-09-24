import { useCallback, useEffect, useRef, useState } from 'react';
import {
  muatUrutPreset,
  type PresetUrutData,
} from '@/api/urutPreset';
import FilterField from '@/components/FilterField';
import { Button } from '@/components/ui/button';
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
 *  Pengelolaan opsi hanya lewat dialog Kelola Halaman (tab Urutan). */
export default function PresetUrut({
  tableKey,
  urutAktif,
  arahUrut = 'naik',
  onUrut,
  lebarTrigger,
}: {
  tableKey: string;
  urutAktif?: string[];
  arahUrut?: 'naik' | 'turun';
  onUrut?: (nilai: string[], arah: 'naik' | 'turun') => void;
  /** Lebar trigger dropdown (px) dari tab Kontrol; kosong = 100 bawaan. */
  lebarTrigger?: number;
}) {
  const [data, setData] = useState<PresetUrutData | null>(null);
  /** table_key yang opsi bawaannya sudah diterapkan (sekali per tabel). */
  const sudahRef = useRef('');

  const muat = useCallback(async () => {
    try {
      const res = await muatUrutPreset(tableKey);
      setData(res.data);
    } catch {
      // Gagal memuat preset: dropdown tampil tanpa opsi (urutan tetap jalan).
      setData({ table_key: tableKey, opsi: [], tersedia: [] });
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
  useEffect(() => {
    if (!data || !onUrut) return;
    if ((urutAktif ?? []).length > 0 || sudahRef.current === tableKey) return;
    sudahRef.current = tableKey;
    const bawaan = data.opsi.find((o) => o.bawaan);
    if (bawaan) onUrut(bawaan.kode, bawaan.arah ?? arahUrut ?? 'naik');
  }, [data, tableKey, urutAktif, arahUrut, onUrut]);

  function pilihNilai(v: string) {
    if (v === TANPA) {
      onUrut?.([], arahUrut);
      return;
    }
    const it = opsi[Number(v)];
    if (it) onUrut?.(it.kode, it.arah ?? arahUrut ?? 'naik');
  }

  function balikArah() {
    if ((urutAktif ?? []).length === 0) return;
    onUrut?.(urutAktif ?? [], arahUrut === 'naik' ? 'turun' : 'naik');
  }

  return (
    <span className="flex items-end gap-1.5">
      <FilterField label="Urutkan" htmlFor={`select_urut_${tableKey}`} kelolaLebar={false}>
        <Select
          value={nilaiSelect || undefined}
          onValueChange={pilihNilai}
          onOpenChange={(buka) => { if (buka) void muat(); }}
        >
          <SelectTrigger
            id={`select_urut_${tableKey}`}
            style={{ width: `${lebarTrigger ?? 100}px` }}
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
      <Button
        id={`btn_arah_urut_${tableKey}`}
        variant="outline"
        size="icon-sm"
        title={`Balik arah urutan (kini: ${arahUrut === 'naik' ? 'naik' : 'turun'})`}
        aria-label={`Arah urutan: ${arahUrut === 'naik' ? 'naik' : 'turun'}`}
        disabled={(urutAktif ?? []).length === 0}
        onClick={balikArah}
      >
        {arahUrut === 'naik' ? <ChevronUp /> : <ChevronDown />}
      </Button>
    </span>
  );
}
