import { useCallback, useEffect, useMemo, useState, type MutableRefObject } from 'react';
import { errorMessage } from '../api/client';
import {
  listPresetTabel,
  setPresetAktif,
  updatePresetTabel,
  type PresetTabel,
} from '../api/preset';
import type { ExcelField } from './ExcelTable';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useStandarTampilan } from '../standarTampilan';
import { Pin } from '@/icons';
import { toast } from 'sonner';
import FilterField from './FilterField';
import { EVENT_PRESET_BERUBAH } from './kelolaTabel/jenis';

const LENGKAP = '_lengkap';

/** API imperatif PresetKolom untuk dipakai pemanggil (mis. context menu header
 *  tabel: tampil/sembunyikan kolom pada preset tanpa membuka dialog).
 *  Pengelolaan preset (tambah/ubah/hapus) hanya lewat dialog Kelola Halaman. */
export interface PresetKolomApi {
  presets: PresetTabel[];
  toggleKolom: (presetId: number, key: string, tampil: boolean) => Promise<void>;
}

/** Combobox preset kolom tampilan tabel (kelola global via Kelola Halaman). */
export default function PresetKolom({
  tableKey,
  fields,
  onApply,
  apiRef,
  triggerClassName,
  wrapperClassName,
  lebarTrigger,
}: {
  tableKey: string;
  fields: ExcelField[];
  onApply: (keys: string[] | null, label?: Record<string, string> | null, presetId?: number | null) => void;
  apiRef?: MutableRefObject<PresetKolomApi | null>;
  /** Timpa lebar trigger (bawaan 100px), mis. tabel sempit dua panel. */
  triggerClassName?: string;
  wrapperClassName?: string;
  /** Lebar trigger dropdown (px) dari tab Kontrol; menang atas triggerClassName. */
  lebarTrigger?: number;
}) {
  /** Memilih preset untuk dilihat bisa semua role (kelola via Kelola Halaman). */

  const [presets, setPresets] = useState<PresetTabel[]>([]);
  const [aktifId, setAktifId] = useState<number | null>(null);
  /** Preset bawaan tabel (dipakai bila user belum memilih dan ada preset). */
  const [bawaanId, setBawaanId] = useState<number | null>(null);

  const fieldKeys = useMemo(() => new Set(fields.map((f) => f.key)), [fields]);
  const { tandai, hapus: hapusPribadi, merekam, simpanKeStandar } = useStandarTampilan();

  const terapkan = useCallback((preset: PresetTabel | null) => {
    if (!preset) {
      onApply(null, null, null);
      return;
    }
    const keys = preset.kolom.filter((k) => fieldKeys.has(k));
    const label: Record<string, string> = {};
    for (const [k, v] of Object.entries(preset.label ?? {})) {
      if (fieldKeys.has(k) && v.trim() !== '') label[k] = v.trim();
    }
    onApply(keys.length > 0 ? keys : null, Object.keys(label).length > 0 ? label : null, preset.id);
  }, [fieldKeys, onApply]);

  const muat = useCallback(async (pilihId?: number | null) => {
    try {
      const res = await listPresetTabel(tableKey);
      const daftar = res.data.presets;
      setPresets(daftar);
      setBawaanId(res.data.default_preset_id);
      const targetId = pilihId !== undefined ? pilihId : res.data.aktif_preset_id;
      let target = targetId === null ? null : daftar.find((p) => p.id === targetId) ?? null;
      // Tanpa pilihan pribadi: preset bawaan bila ada, bila tidak = Lengkap.
      if (target === null && res.data.default_preset_id !== null) {
        target = daftar.find((p) => p.id === res.data.default_preset_id) ?? null;
      }
      setAktifId(target?.id ?? null);
      terapkan(target);
    } catch (e) {
      setPresets([]);
      setAktifId(null);
      setBawaanId(null);
      terapkan(null);
      toast.error(errorMessage(e));
    }
  }, [tableKey, terapkan]);

  useEffect(() => {
    void muat();
    const segarkan = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.tableKey !== tableKey) return;
      // Susunan Lengkap kustom dari dialog Kelola Halaman: terapkan langsung
      // (server sudah di-nol-kan pemanggil sebelum event dikirim).
      if (d?.lengkap) {
        terapkan({ kolom: d.lengkap.keys ?? [], label: d.lengkap.label ?? {} } as PresetTabel);
        return;
      }
      void muat();
    };
    window.addEventListener(EVENT_PRESET_BERUBAH, segarkan);
    return () => window.removeEventListener(EVENT_PRESET_BERUBAH, segarkan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableKey]);

  /** Tampilkan/sembunyikan satu kolom pada preset (dipakai context menu
   *  header tabel): simpan langsung ke DB, lalu segarkan + terapkan ulang. */
  const toggleKolomPreset = useCallback(async (presetId: number, key: string, tampil: boolean) => {
    const p = presets.find((x) => x.id === presetId);
    if (!p) return;
    const next = new Set(p.kolom);
    if (tampil) next.add(key);
    else next.delete(key);
    if (next.size === 0) {
      toast.error('Preset harus menyisakan minimal satu kolom.');
      return;
    }
    try {
      await updatePresetTabel(presetId, { kolom: [...next] });
      toast.success(tampil ? 'Kolom ditampilkan pada preset.' : 'Kolom disembunyikan dari preset.');
      await muat(aktifId);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [presets, aktifId, muat]);

  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      presets,
      toggleKolom: toggleKolomPreset,
    };
  }, [apiRef, presets, toggleKolomPreset]);

  async function pilihPreset(v: string) {
    const id = v === LENGKAP ? null : Number(v);
    const target = id === null ? null : presets.find((p) => p.id === id) ?? null;
    setAktifId(target?.id ?? null);
    terapkan(target);
    if (merekam) {
      // Bertindak sebagai lembaga → preset aktif ikut disimpan ke standar lembaga.
      hapusPribadi(`preset.${tableKey}`);
      simpanKeStandar({ presetAktif: { [tableKey]: target?.nama ?? null } });
      return;
    }
    // Pilihan user menang atas preset aktif dari standar lembaga.
    tandai(`preset.${tableKey}`);
    try {
      await setPresetAktif(tableKey, target?.id ?? null);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  /** Preset bawaan ditandai ikon pin saja (tanpa sufiks teks, tanpa tebal). */
  const labelPreset = (p: PresetTabel) => (
    p.id === bawaanId ? (
      <span className="flex items-center gap-1.5">
        <Pin size={12} className="shrink-0 text-muted-foreground" aria-label="Preset bawaan" />
        {p.nama}
      </span>
    ) : p.nama
  );

  return (
    <>
      <FilterField label="Kolom" htmlFor={`select_preset_kolom_${tableKey}`} kelolaLebar={false} className={wrapperClassName}>
      <Select value={aktifId === null ? LENGKAP : String(aktifId)} onValueChange={(v) => void pilihPreset(v)}>
        <SelectTrigger
          id={`select_preset_kolom_${tableKey}`}
          title="Preset kolom tampilan"
          aria-label="Preset kolom tampilan"
          className={triggerClassName}
          style={lebarTrigger !== undefined ? { width: `${lebarTrigger}px` } : triggerClassName ? undefined : { width: '100px' }}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value={LENGKAP}>Lengkap</SelectItem>
            {presets.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>{labelPreset(p)}</SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      </FilterField>
    </>
  );
}
