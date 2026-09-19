import { useCallback, useEffect, useMemo, useState, type MutableRefObject } from 'react';
import { errorMessage } from '../api/client';
import {
  listPresetTabel,
  setPresetAktif,
  setPresetBawaan,
  updatePresetTabel,
  type PresetTabel,
} from '../api/preset';
import { useLembagaAktif } from '@/lembagaAktif';
import type { ExcelField } from './ExcelTable';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useStandarTampilan } from '../standarTampilan';
import { toast } from 'sonner';
import FilterField from './FilterField';
import DialogKelolaTabel from './kelolaTabel/DialogKelolaTabel';
import type { TabKelola } from './kelolaTabel/jenis';

const LENGKAP = '_lengkap';
const KELOLA = '_kelola';

/** API imperatif PresetKolom untuk dipakai pemanggil (mis. context menu header
 *  tabel: tampil/sembunyikan kolom pada preset tanpa membuka dialog; atau
 *  membuka dialog Kelola tabel dari entry lain seperti ribbon/toolbar urut). */
export interface PresetKolomApi {
  presets: PresetTabel[];
  toggleKolom: (presetId: number, key: string, tampil: boolean) => Promise<void>;
  bukaKelola: (tab?: TabKelola) => void;
}

/** Combobox preset kolom tampilan tabel + dialog kelola (global, super_admin). */
export default function PresetKolom({
  tableKey,
  fields,
  onApply,
  apiRef,
  triggerClassName,
  lebarTrigger,
}: {
  tableKey: string;
  fields: ExcelField[];
  onApply: (keys: string[] | null, label?: Record<string, string> | null) => void;
  apiRef?: MutableRefObject<PresetKolomApi | null>;
  /** Timpa lebar trigger (bawaan 100px), mis. tabel sempit dua panel. */
  triggerClassName?: string;
  /** Lebar trigger dropdown (px) dari tab Kontrol; menang atas triggerClassName. */
  lebarTrigger?: number;
}) {
  /** Kelola preset = super_admin EFEKTIF (global; mati saat bertindak).
   *  Memilih preset untuk dilihat tetap bisa semua role. */
  const { efektifSuper: superAdmin } = useLembagaAktif();

  const [presets, setPresets] = useState<PresetTabel[]>([]);
  const [aktifId, setAktifId] = useState<number | null>(null);
  /** Preset bawaan tabel (dipakai bila user belum memilih dan ada preset). */
  const [bawaanId, setBawaanId] = useState<number | null>(null);

  const [dokOpen, setDokOpen] = useState(false);
  /** Preset yang dibuka + tab awal + mulai-lengkap + penanda remount dialog
   *  (agar state lokalnya ter-reset). */
  const [kelola, setKelola] = useState<{ preset: PresetTabel | null; tab: TabKelola; lengkap: boolean; nonce: number }>({
    preset: null, tab: 'kolom', lengkap: false, nonce: 0,
  });

  const fieldKeys = useMemo(() => new Set(fields.map((f) => f.key)), [fields]);
  const { tandai, hapus: hapusPribadi, merekam, simpanKeStandar } = useStandarTampilan();
  /** Tabel berkolom sangat banyak (mis. Santri 72 kolom) memakai dialog tinggi
   *  penuh agar panel-panelnya punya area gulir sendiri. */
  const banyakKolom = fields.length > 30;

  const terapkan = useCallback((preset: PresetTabel | null) => {
    if (!preset) {
      onApply(null, null);
      return;
    }
    const keys = preset.kolom.filter((k) => fieldKeys.has(k));
    const label: Record<string, string> = {};
    for (const [k, v] of Object.entries(preset.label ?? {})) {
      if (fieldKeys.has(k) && v.trim() !== '') label[k] = v.trim();
    }
    onApply(keys.length > 0 ? keys : null, Object.keys(label).length > 0 ? label : null);
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

  /** Terapkan susunan Lengkap kustom langsung ke tabel (tanpa menyimpan
   *  preset): pilihan pribadi dikosongkan (= Lengkap), dialog ditutup. */
  const pakaiLengkap = useCallback((keys: string[], label: Record<string, string>) => {
    const efektif = keys.filter((k) => fieldKeys.has(k));
    const labelBersih: Record<string, string> = {};
    for (const [k, v] of Object.entries(label)) {
      if (fieldKeys.has(k) && v.trim() !== '') labelBersih[k] = v.trim();
    }
    setAktifId(null);
    terapkan({ kolom: efektif, label: labelBersih } as PresetTabel);
    if (merekam) {
      hapusPribadi(`preset.${tableKey}`);
      simpanKeStandar({ presetAktif: { [tableKey]: null } });
    } else {
      tandai(`preset.${tableKey}`);
      void setPresetAktif(tableKey, null).catch((e: unknown) => toast.error(errorMessage(e)));
    }
    setDokOpen(false);
    toast.success('Susunan kolom diterapkan.');
  }, [fieldKeys, terapkan, merekam, hapusPribadi, simpanKeStandar, tableKey, tandai]);
  /** Buka dialog Kelola tabel (preset tertentu + tab awal; lengkap = mulai
   *  dari semua kolom agar bisa dimodifikasi). */
  const bukaKelola = useCallback((preset: PresetTabel | null, tab: TabKelola = 'kolom', lengkap = false) => {
    setKelola((s) => ({ preset, tab, lengkap, nonce: s.nonce + 1 }));
    setDokOpen(true);
  }, []);

  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      presets,
      toggleKolom: toggleKolomPreset,
      bukaKelola: (tab: TabKelola = 'kolom') => bukaKelola(null, tab),
    };
  }, [apiRef, presets, toggleKolomPreset, bukaKelola]);

  async function pilihPreset(v: string) {
    if (v === KELOLA) {
      bukaKelola(null, 'kolom');
      return;
    }
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

  const labelPreset = (p: PresetTabel) => (
    p.id === bawaanId ? `${p.nama} (bawaan)` : p.nama
  );

  /** Tandai/cabut preset bawaan tabel (super_admin; satu per tabel). */
  const togolBawaan = useCallback(async (preset: PresetTabel) => {
    try {
      const res = await setPresetBawaan(preset.id, preset.id !== bawaanId);
      toast.success(res.pesan);
      await muat(aktifId);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [bawaanId, aktifId, muat]);

  return (
    <>
      <FilterField label="Kolom" htmlFor={`select_preset_kolom_${tableKey}`} kelolaLebar={false}>
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
          {superAdmin ? (
            <>
              <SelectSeparator />
              <SelectItem value={KELOLA}>Kelola preset…</SelectItem>
            </>
          ) : null}
        </SelectContent>
      </Select>
      </FilterField>
      {dokOpen && (
        <DialogKelolaTabel
          key={kelola.nonce}
          open={dokOpen}
          onOpenChange={setDokOpen}
          tableKey={tableKey}
          tabAwal={kelola.tab}
          banyakKolom={banyakKolom}
          fields={fields}
          fieldKeys={fieldKeys}
          presets={presets}
          presetAwal={kelola.preset}
          mulaiLengkap={kelola.lengkap}
          onPilihLengkap={() => bukaKelola(null, 'kolom', true)}
          onPilihPreset={(p) => bukaKelola(p, 'kolom')}
          onPakaiLengkap={(keys, label) => pakaiLengkap(keys, label)}
          bawaanId={bawaanId}
          onTogolBawaan={(p) => void togolBawaan(p)}
          onTersimpan={async (id) => {
            await muat(id);
            await setPresetAktif(tableKey, id);
          }}
          onDihapus={async () => {
            await muat(null);
            await setPresetAktif(tableKey, null);
          }}
        />
      )}
    </>
  );
}
