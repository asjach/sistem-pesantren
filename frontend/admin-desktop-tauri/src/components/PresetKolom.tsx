import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bisa } from '../api/auth';
import { errorMessage } from '../api/client';
import {
  createPresetTabel,
  listPresetTabel,
  setPresetAktif,
  type PresetTabel,
} from '../api/preset';
import { useAuth } from '../auth/AuthContext';
import type { ExcelField } from './ExcelTable';
import { toast } from 'sonner';
import LabeledCombobox from './LabeledCombobox';
import {
  ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxRoot, ComboboxTrigger,
} from './ui/combobox';
import { EVENT_PRESET_BERUBAH, LEBAR_BAWAHAN_FILTER } from './kelolaTabel/jenis';

const LENGKAP = '_lengkap';

/** Nama preset semua kolom yang dipastikan ada di setiap tabel. */
const NAMA_LENGKAP = 'Lengkap';

/** Samakan nama preset tanpa peduli besar-kecil huruf. */
function namaLengkap(nama: string): boolean {
  return nama.trim().toLowerCase() === NAMA_LENGKAP.toLowerCase();
}

/** Combobox preset kolom tampilan tabel (kelola global via Kelola Tabel). */
export default function PresetKolom({
  tableKey,
  fields,
  onApply,
  wrapperClassName,
}: {
  tableKey: string;
  fields: ExcelField[];
  onApply: (keys: string[] | null, presetId?: number | null) => void;
  /** Timpa lebar trigger (bawaan 120px), mis. tabel sempit dua panel. */
  triggerClassName?: string;
  wrapperClassName?: string;
}) {
  /** Memilih preset untuk dilihat bisa semua role (kelola via Kelola Tabel). */
  const { user } = useAuth();
  /** Buat/ubah preset = super_admin (izin `preset_tabel.tambah`). */
  const bolehKelola = bisa(user, 'preset_tabel.tambah');
  /** Tabel yang sudah dipastikan punya preset "Lengkap" (cegah permintaan ulang). */
  const sudahPastikan = useRef<Set<string>>(new Set());

  const [presets, setPresets] = useState<PresetTabel[]>([]);
  const [aktifId, setAktifId] = useState<number | null>(null);
  const fieldKeys = useMemo(() => new Set(fields.map((f) => f.key)), [fields]);

  /** Pilih preset dari daftar (punya `nama`/`id`), atau terapkan susunan yang
   *  sudah tersimpan tanpa preset (`presetId`). Keduanya berbagi `kolom`. */
  const terapkan = useCallback((preset: PresetTabel | null | { kolom: string[]; presetId: number | null }) => {
    if (!preset) {
      onApply(null, null);
      return;
    }
    const dikenal = preset.kolom.filter((k) => fieldKeys.has(k));

    const nama = 'nama' in preset ? preset.nama : null;
    const keys = namaLengkap(nama ?? '')
      ? [...dikenal, ...[...fieldKeys].filter((k) => !dikenal.includes(k))]
      : dikenal;

    const idAktif = 'id' in preset ? preset.id : preset.presetId;
    onApply(keys.length > 0 ? keys : null, idAktif ?? null);
  }, [fieldKeys, onApply]);

  const muat = useCallback(async (pilihId?: number | null) => {
    try {
      const res = await listPresetTabel(tableKey);
      let daftar = res.data.presets;

      if (bolehKelola && !sudahPastikan.current.has(tableKey) && !daftar.some((p) => namaLengkap(p.nama))) {
        sudahPastikan.current.add(tableKey);
        try {
          await createPresetTabel({
            table_key: tableKey,
            nama: NAMA_LENGKAP,
            kolom: [...fieldKeys],
          });
          daftar = (await listPresetTabel(tableKey)).data.presets;
        } catch {

        }
      }

      setPresets(daftar);

      const targetId = pilihId !== undefined ? pilihId : res.data.aktif_preset_id;
      let target = targetId === null ? null : daftar.find((p) => p.id === targetId) ?? null;

      const kolomKustom = pilihId === undefined && target === null ? res.data.aktif_kolom : null;
      if (kolomKustom && kolomKustom.length > 0) {
        setAktifId(null);
        terapkan({ kolom: kolomKustom, presetId: null });
        return;
      }

      if (target === null) {
        target = daftar.find((p) => namaLengkap(p.nama)) ?? null;
      }
      setAktifId(target?.id ?? null);
      terapkan(target);
    } catch (e) {
      setPresets([]);
      setAktifId(null);
      terapkan(null);
      toast.error(errorMessage(e));
    }
  }, [tableKey, terapkan, bolehKelola, fieldKeys]);

  useEffect(() => {
    void muat();
    const segarkan = (e: Event) => {
      const d = (e as CustomEvent).detail;

      if (d?.tableKey !== tableKey || d?.sumber === 'presetKolom') return;

      void muat();
    };
    window.addEventListener(EVENT_PRESET_BERUBAH, segarkan);
    return () => window.removeEventListener(EVENT_PRESET_BERUBAH, segarkan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableKey]);

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

  const opsiKolom = [
    ...(presets.some((p) => namaLengkap(p.nama)) ? [] : [{ label: 'Lengkap', nilai: LENGKAP }]),
    ...presets.map((p) => ({ label: p.nama, nilai: String(p.id) })),
  ];

  return (

    <LabeledCombobox
      label="Kolom"
      htmlFor={`select_preset_kolom_${tableKey}`}
      kelolaLebar={false}

      lebarKotak={LEBAR_BAWAHAN_FILTER}

      className={`${wrapperClassName ?? ''} gap-0 items-stretch`}
    >
      <ComboboxRoot
        items={opsiKolom}
        autoHighlight
        itemToStringLabel={(o) => o.label}
        isItemEqualToValue={(a, b) => a.nilai === b.nilai}
        value={opsiKolom.find((o) => o.nilai === (aktifId === null ? LENGKAP : String(aktifId))) ?? opsiKolom[0]}
        onValueChange={(o) => { if (o !== null) void pilihPreset(o.nilai); }}
      >
        <ComboboxInput id={`select_preset_kolom_${tableKey}`} aria-label="Preset kolom tampilan" placeholder="Cari kolom…" />
        <ComboboxTrigger aria-label="Buka daftar kolom" />
        <ComboboxContent className="max-h-80">
          <ComboboxEmpty>Tidak ada preset kolom.</ComboboxEmpty>
          <ComboboxList>
            {(o) => <ComboboxItem key={o.nilai} value={o}>{o.label}</ComboboxItem>}
          </ComboboxList>
        </ComboboxContent>
      </ComboboxRoot>
    </LabeledCombobox>
  );
}
