import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import {
  muatUrutPreset,
  type PresetUrutData,
} from '@/api/urutPreset';
import { useAuth } from '@/auth/AuthContext';
import FilterField from '@/components/FilterField';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronDown, ChevronUp } from '@/icons';
import type { PresetKolomApi } from '@/components/PresetKolom';
import TabUrutan from '@/components/kelolaTabel/TabUrutan';

const KELOLA = '_kelola';
const TANPA = '_tanpa';

/** Dropdown Urutkan yang sumbernya Preset Urut (global per tabel). Kelola opsi
 *  lewat dialog Kelola tabel (tab Urutan) milik PresetKolom — dibuka via
 *  `apiRef`; bila tak tersedia, dialog cadangan lokal dipakai. Opsi dropdown
 *  dimuat ulang setiap dibuka agar selalu segar seusai penyimpanan. */
export default function PresetUrut({
  tableKey,
  urutAktif,
  arahUrut = 'naik',
  onUrut,
  apiRef,
}: {
  tableKey: string;
  urutAktif?: string[];
  arahUrut?: 'naik' | 'turun';
  onUrut?: (nilai: string[], arah: 'naik' | 'turun') => void;
  apiRef?: MutableRefObject<PresetKolomApi | null>;
}) {
  const [data, setData] = useState<PresetUrutData | null>(null);
  const [open, setOpen] = useState(false);
  /** Kelola urutan = super_admin saja (global); memilih urutan tetap bisa semua. */
  const { user } = useAuth();
  const superAdmin = (user?.roles ?? []).some((r) => r.name === 'super_admin');
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
    if (v === KELOLA) {
      if (!apiRef?.current?.bukaKelola) {
        setOpen(true);
        return;
      }
      apiRef.current.bukaKelola('urutan');
      return;
    }
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
    <>
      <span className="flex items-end gap-1.5">
        <FilterField label="Urutkan" htmlFor={`select_urut_${tableKey}`}>
          <Select
            value={nilaiSelect || undefined}
            onValueChange={pilihNilai}
            onOpenChange={(buka) => { if (buka) void muat(); }}
          >
            <SelectTrigger id={`select_urut_${tableKey}`} className="w-44">
              <SelectValue placeholder="Urutkan…" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={TANPA}>Tanpa urutan</SelectItem>
                {opsi.map((o, i) => (
                  <SelectItem key={`${o.kode.join(',')}-${i}`} value={String(i)}>
                    {o.label}
                    {o.bawaan ? ' •' : ''}
                  </SelectItem>
                ))}
              </SelectGroup>
              {superAdmin ? (
                <>
                  <SelectSeparator />
                  <SelectItem value={KELOLA}>Kelola urutan…</SelectItem>
                </>
              ) : null}
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

      {/* Cadangan bila dialog utama (milik PresetKolom) tak tersedia. */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Kelola urutan</DialogTitle>
            <DialogDescription>
              Opsi urut untuk tabel ini (global, berlaku semua lembaga).
            </DialogDescription>
          </DialogHeader>
          <TabUrutan tableKey={tableKey} onTutup={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
