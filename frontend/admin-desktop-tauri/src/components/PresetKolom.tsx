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
import { Pin } from '@/icons';
import { toast } from 'sonner';
import FilterField from './FilterField';
import { EVENT_PRESET_BERUBAH } from './kelolaTabel/jenis';

const LENGKAP = '_lengkap';

/** API imperatif PresetKolom untuk dipakai pemanggil (mis. context menu header
 *  tabel: tampil/sembunyikan kolom pada preset tanpa membuka dialog).
 *  Pengelolaan preset (tambah/ubah/hapus) hanya lewat dialog Kelola Tabel. */
export interface PresetKolomApi {
  presets: PresetTabel[];
  /** Susunan yang sedang berlaku: preset personal, preset bawaan, atau
   *  "Lengkap" (custom). `null` = semua kolom tampil. */
  terapan: SusunanBerlaku;
  toggleKolom: (presetId: number, key: string, tampil: boolean) => Promise<void>;
  /** Tampilkan/sembunyikan kolom pada susunan yang SEDANG berlaku (preset
   *  aktif bila ada, simpanan "Lengkap kustom" bila tidak). Dipakai menu
   *  klik kanan header tabel. */
  toggleKolomAktif: (key: string, tampil: boolean) => Promise<void>;
}

/** Susunan kolom yang sedang dipakai tabel. */
export interface SusunanBerlaku {
  /** Key kolom yang tampil; `null` = semua kolom (mode Lengkap). */
  kolom: string[] | null;
  /** Label kustom per key (ikut tersimpan bila susunan tanpa preset). */
  label: Record<string, string> | null;
  /** Id preset sumber susunan; `null` = susunan "Lengkap" tanpa preset. */
  presetId: number | null;
}

/** Combobox preset kolom tampilan tabel (kelola global via Kelola Tabel). */
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
  /** Timpa lebar trigger (bawaan 120px), mis. tabel sempit dua panel. */
  triggerClassName?: string;
  wrapperClassName?: string;
  /** Lebar trigger dropdown (px) dari tab Kontrol; menang atas triggerClassName. */
  lebarTrigger?: number;
}) {
  /** Memilih preset untuk dilihat bisa semua role (kelola via Kelola Tabel). */

  const [presets, setPresets] = useState<PresetTabel[]>([]);
  const [aktifId, setAktifId] = useState<number | null>(null);
  /** Preset bawaan tabel (dipakai bila user belum memilih dan ada preset). */
  const [bawaanId, setBawaanId] = useState<number | null>(null);
  /** Muat pertama selesai? Gerbang tampil/sembunyi dropdown. */
  const [muatSelesai, setMuatSelesai] = useState(false);

  const fieldKeys = useMemo(() => new Set(fields.map((f) => f.key)), [fields]);

  /** Susunan yang sedang dipakai (diungkap ke API agar menu konteks tahu
   *  sumber kolom: preset aktif atau "Lengkap" tanpa preset). */
  const [terapan, setTerapan] = useState<SusunanBerlaku>({ kolom: null, label: null, presetId: null });

  const terapkan = useCallback((preset: PresetTabel | null) => {
    if (!preset) {
      onApply(null, null, null);
      setTerapan({ kolom: null, label: null, presetId: null });
      return;
    }
    const keys = preset.kolom.filter((k) => fieldKeys.has(k));
    const label: Record<string, string> = {};
    for (const [k, v] of Object.entries(preset.label ?? {})) {
      if (fieldKeys.has(k) && v.trim() !== '') label[k] = v.trim();
    }
    const labelHasil = Object.keys(label).length > 0 ? label : null;
    onApply(keys.length > 0 ? keys : null, labelHasil, preset.id);
    setTerapan({ kolom: keys.length > 0 ? keys : null, label: labelHasil, presetId: preset.id ?? null });
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
      // Susunan "Lengkap kustom" tersimpan (mis. sebagian kolom disembunyikan)
      // dipakai saat memang tidak ada preset aktif/bawaan. Hanya pada muat
      // alami - saat pemanggil menentukan `pilihId`, pilihan itu yang berlaku.
      const kolomKustom = pilihId === undefined && target === null ? res.data.aktif_kolom : null;
      if (kolomKustom && kolomKustom.length > 0) {
        terapkan({ kolom: kolomKustom, label: res.data.aktif_label ?? {} } as PresetTabel);
        return;
      }
      terapkan(target);
    } catch (e) {
      setPresets([]);
      setAktifId(null);
      setBawaanId(null);
      terapkan(null);
      toast.error(errorMessage(e));
    } finally {
      setMuatSelesai(true);
    }
  }, [tableKey, terapkan]);

  useEffect(() => {
    void muat();
    const segarkan = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.tableKey !== tableKey) return;
      // Muat ulang: susunan aktif (termasuk Lengkap kustom) dibaca dari server.
      void muat();
    };
    window.addEventListener(EVENT_PRESET_BERUBAH, segarkan);
    return () => window.removeEventListener(EVENT_PRESET_BERUBAH, segarkan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableKey]);

  /** Tulis susunan baru: preset bila ada sumber preset, simpanan
   *  "Lengkap kustom" pribadi bila tanpa preset. Simpan langsung ke DB, lalu
   *  segarkan + terapkan ulang. */
  const simpanSusunan = useCallback(async (
    targetPresetId: number | null, next: Set<string>, label: Record<string, string> | null,
    pesanSukses: string,
  ) => {
    if (next.size === 0) {
      toast.error('Tabel harus menyisakan minimal satu kolom.');
      return;
    }
    try {
      if (targetPresetId === null) {
        // Tanpa preset: simpanan pribadi per tabel (bukan global) — setiap
        // role boleh memakainya. DITERAPKAN LOKAL, bukan `muat()` ulang:
        // muat dengan pilihan eksplisit tidak membaca `aktif_kolom`
        // (lihat `muat`), sehingga tabel akan snap-back ke semua kolom.
        await setPresetAktif(tableKey, null, [...next], label);
        toast.success(pesanSukses);
        terapkan({ kolom: [...next], label: label ?? {} } as PresetTabel);
      } else {
        await updatePresetTabel(targetPresetId, { kolom: [...next] });
        toast.success(pesanSukses);
        await muat(aktifId);
      }
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [tableKey, aktifId, muat, terapkan]);

  /** Tampilkan/sembunyikan satu kolom pada preset (dipakai context menu
   *  header tabel): simpan langsung ke DB, lalu segarkan + terapkan ulang. */
  const toggleKolomPreset = useCallback(async (presetId: number, key: string, tampil: boolean) => {
    const p = presets.find((x) => x.id === presetId);
    if (!p) return;
    const next = new Set(p.kolom);
    if (tampil) next.add(key);
    else next.delete(key);
    await simpanSusunan(p.id, next, null,
      tampil ? 'Kolom ditampilkan pada preset.' : 'Kolom disembunyikan dari preset.');
  }, [presets, simpanSusunan]);

  /** Tampilkan/sembunyikan satu kolom pada susunan yang SEDANG berlaku:
   *  preset aktif bila ada, simpanan "Lengkap kustom" bila tidak. Dipakai menu
   *  klik kanan header tabel — tanpa harus membuka dialog Kelola Tabel. */
  const toggleKolomAktif = useCallback(async (key: string, tampil: boolean) => {
    const dasar = terapan.kolom ?? [...fieldKeys];
    const next = new Set(dasar);
    if (tampil) next.add(key);
    else next.delete(key);
    await simpanSusunan(terapan.presetId, next, terapan.label,
      tampil ? 'Kolom ditampilkan.' : 'Kolom disembunyikan.');
  }, [terapan, fieldKeys, simpanSusunan]);

  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      presets,
      terapan,
      toggleKolom: toggleKolomPreset,
      toggleKolomAktif,
    };
  }, [apiRef, presets, terapan, toggleKolomPreset, toggleKolomAktif]);

  async function pilihPreset(v: string) {
    const id = v === LENGKAP ? null : Number(v);
    const target = id === null ? null : presets.find((p) => p.id === id) ?? null;
    setAktifId(target?.id ?? null);
    terapkan(target);
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

  // Tanpa preset (hanya "Lengkap") dropdown tak berguna: sembunyikan setelah
  // muat pertama; tabel berpreset tetap menampilkannya.
  if (muatSelesai && presets.length === 0) return null;

  return (
    <>
      <FilterField label="Kolom" htmlFor={`select_preset_kolom_${tableKey}`} kelolaLebar={false} className={wrapperClassName}>
      <Select value={aktifId === null ? LENGKAP : String(aktifId)} onValueChange={(v) => void pilihPreset(v)}>
        <SelectTrigger
          id={`select_preset_kolom_${tableKey}`}
          title="Preset kolom tampilan"
          aria-label="Preset kolom tampilan"
          className={triggerClassName}
           style={lebarTrigger !== undefined ? { width: `${lebarTrigger}px` } : triggerClassName ? undefined : { width: '120px' }}
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
