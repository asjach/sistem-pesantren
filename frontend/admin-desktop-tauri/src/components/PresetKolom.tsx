import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { bisa } from '../api/auth';
import { errorMessage } from '../api/client';
import {
  createPresetTabel,
  listPresetTabel,
  setPresetAktif,
  setPresetBawaan,
  updatePresetTabel,
  type PresetTabel,
} from '../api/preset';
import { useAuth } from '../auth/AuthContext';
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

/** Nama preset semua kolom yang dipastikan ada di setiap tabel. */
const NAMA_LENGKAP = 'Lengkap';

/** Samakan nama preset tanpa peduli besar-kecil huruf. */
function namaLengkap(nama: string): boolean {
  return nama.trim().toLowerCase() === NAMA_LENGKAP.toLowerCase();
}

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
  sejajarLabel = false,
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
  /** Label mendatar di samping kontrol (bukan di atasnya). */
  sejajarLabel?: boolean;
}) {
  /** Memilih preset untuk dilihat bisa semua role (kelola via Kelola Tabel). */
  const { user } = useAuth();
  /** Buat/ubah preset = super_admin (izin `preset_tabel.tambah`). */
  const bolehKelola = bisa(user, 'preset_tabel.tambah');
  /** Tabel yang sudah dipastikan punya preset "Lengkap" (cegah permintaan ulang). */
  const sudahPastikan = useRef<Set<string>>(new Set());

  const [presets, setPresets] = useState<PresetTabel[]>([]);
  const [aktifId, setAktifId] = useState<number | null>(null);
  /** Preset bawaan tabel (dipakai bila user belum memilih dan ada preset). */
  const [bawaanId, setBawaanId] = useState<number | null>(null);
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
    const dikenal = preset.kolom.filter((k) => fieldKeys.has(k));
    // Preset "Lengkap" = semua kolom: kolom baru yang belum tersimpan ikut
    // tampil di akhir (tanpa mengubah simpanan). Preset kustom lain
    // menghormati sembunyian eksplisit penggunanya.
    const keys = namaLengkap(preset.nama ?? '')
      ? [...dikenal, ...[...fieldKeys].filter((k) => !dikenal.includes(k))]
      : dikenal;
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
      let daftar = res.data.presets;
      let bawaan = res.data.default_preset_id;

      // Tiap tabel wajib punya preset "Lengkap" (semua kolom) sebagai bawaan.
      // Dibuat sekali saat tabel pertama dibuka oleh pengelola preset; tabel
      // yang belum sempat dibuatkan tetap memakai "Lengkap" bawaan sistem.
      if (bolehKelola && !sudahPastikan.current.has(tableKey) && !daftar.some((p) => namaLengkap(p.nama))) {
        sudahPastikan.current.add(tableKey);
        try {
          const dibuat = await createPresetTabel({
            table_key: tableKey,
            nama: NAMA_LENGKAP,
            kolom: [...fieldKeys],
          });
          const idBaru = dibuat.data[0]?.id ?? null;
          if (idBaru !== null) await setPresetBawaan(idBaru, true);
          const ulang = await listPresetTabel(tableKey);
          daftar = ulang.data.presets;
          bawaan = ulang.data.default_preset_id;
        } catch {
          // Tanpa izin atau gagal: pakai "Lengkap" bawaan sistem.
        }
      }

      setPresets(daftar);
      setBawaanId(bawaan);

      const targetId = pilihId !== undefined ? pilihId : res.data.aktif_preset_id;
      let target = targetId === null ? null : daftar.find((p) => p.id === targetId) ?? null;

      // Susunan pribadi tersimpan (preset_id null + kolom) = pilihan eksplisit
      // terakhir pengguna, jadi menang atas preset bawaan. Hanya pada muat
      // alami — saat pemanggil menentukan `pilihId`, pilihan itu yang berlaku.
      const kolomKustom = pilihId === undefined && target === null ? res.data.aktif_kolom : null;
      if (kolomKustom && kolomKustom.length > 0) {
        setAktifId(null);
        terapkan({ kolom: kolomKustom, label: res.data.aktif_label ?? {} } as PresetTabel);
        return;
      }

      // Belum ada pilihan pengguna: pakai preset bawaan — idealnya "Lengkap"
      // yang dibuat di atas — lalu jatuh ke preset bernama "Lengkap" bila ada.
      if (target === null && bawaan !== null) {
        target = daftar.find((p) => p.id === bawaan) ?? null;
      }
      if (target === null) {
        target = daftar.find((p) => namaLengkap(p.nama)) ?? null;
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
  }, [tableKey, terapkan, bolehKelola, fieldKeys]);

  useEffect(() => {
    void muat();
    const segarkan = (e: Event) => {
      const d = (e as CustomEvent).detail;
      // Abaikan event dari diri sendiri: `simpanSusunan` sudah menerapkan lokal
      // (memuat ulang justru bisa mengembalikan susunan lama sebelum tersimpan).
      if (d?.tableKey !== tableKey || d?.sumber === 'presetKolom') return;
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
      // Kabari pemilih lain dan dialog Kelola Tabel agar memuat ulang. Diri
      // sendiri sengaja tidak ikut memuat ulang (lihat listener di bawah) karena
      // susunan barusan sudah diterapkan lokal.
      window.dispatchEvent(new CustomEvent(EVENT_PRESET_BERUBAH, { detail: { tableKey, sumber: 'presetKolom' } }));
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

  // Pemilih selalu tampil: "Lengkap" (semua kolom) adalah awalan tiap tabel,
  // jadi tabel tanpa preset pun tetap punya pilihan yang terlihat.

  return (
    <>
      <FilterField label="Kolom" htmlFor={`select_preset_kolom_${tableKey}`} kelolaLebar={false} className={wrapperClassName} sejajar={sejajarLabel}>
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
            {/* Bila tabel sudah punya preset "Lengkap" (baris DB), opsi bawaan
                sistem disembunyikan supaya tidak ada dua entri "Lengkap". */}
            {presets.some((p) => namaLengkap(p.nama)) ? null : (
              <SelectItem value={LENGKAP}>Lengkap</SelectItem>
            )}
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
