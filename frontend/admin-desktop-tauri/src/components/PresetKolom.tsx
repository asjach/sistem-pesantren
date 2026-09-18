import { useCallback, useEffect, useMemo, useState, type MutableRefObject } from 'react';
import { errorMessage } from '../api/client';
import {
  listPresetTabel,
  setPresetAktif,
  updatePresetTabel,
  type PresetTabel,
} from '../api/preset';
import { listLembaga, type Lembaga } from '../api/master';
import { useAuth } from '../auth/AuthContext';
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
import KelolaPresetDialog from './presetkolom/KelolaPresetDialog';

const LENGKAP = '_lengkap';
const KELOLA = '_kelola';

/** API imperatif PresetKolom untuk dipakai pemanggil (mis. context menu header
 *  tabel: tampil/sembunyikan kolom pada preset tanpa membuka dialog). */
export interface PresetKolomApi {
  presets: PresetTabel[];
  toggleKolom: (presetId: number, key: string, tampil: boolean) => Promise<void>;
}

/** Combobox preset kolom tampilan tabel + dialog kelola (tersimpan di DB per lembaga). */
export default function PresetKolom({
  tableKey,
  fields,
  onApply,
  apiRef,
}: {
  tableKey: string;
  fields: ExcelField[];
  onApply: (keys: string[] | null, label?: Record<string, string> | null) => void;
  apiRef?: MutableRefObject<PresetKolomApi | null>;
}) {
  const { user: me } = useAuth();
  const isPesantren = me?.roles.some((r) => r.name === 'super_admin')
    || ((me?.roles.some((r) => r.name === 'admin') ?? false) && (me?.lembagas?.length ?? 0) === 0);

  const [presets, setPresets] = useState<PresetTabel[]>([]);
  const [aktifId, setAktifId] = useState<number | null>(null);
  const [lembagas, setLembagas] = useState<Lembaga[]>([]);

  const [dokOpen, setDokOpen] = useState(false);
  /** Preset yang dibuka + penanda remount dialog (agar state lokalnya ter-reset). */
  const [seed, setSeed] = useState<{ preset: PresetTabel | null; nonce: number }>({ preset: null, nonce: 0 });

  const fieldKeys = useMemo(() => new Set(fields.map((f) => f.key)), [fields]);
  const { tampilan: standar, isPribadi, tandai, hapus: hapusPribadi, merekam, simpanKeStandar } = useStandarTampilan();
  /** Preset aktif bawaan dari standar lembaga (nama), bila user belum memilih. */
  const stdNama = standar?.presetAktif?.[tableKey] ?? null;
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
      const targetId = pilihId !== undefined ? pilihId : res.data.aktif_preset_id;
      let target = targetId === null ? null : daftar.find((p) => p.id === targetId) ?? null;
      // Belum dipilih user → pakai preset aktif dari standar lembaga (bila ada).
      if (target === null && stdNama && !isPribadi(`preset.${tableKey}`)) {
        target = daftar.find((p) => p.nama === stdNama) ?? null;
      }
      setAktifId(target?.id ?? null);
      terapkan(target);
    } catch (e) {
      setPresets([]);
      setAktifId(null);
      terapkan(null);
      toast.error(errorMessage(e));
    }
  }, [tableKey, terapkan, stdNama, isPribadi]);

  useEffect(() => {
    void muat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableKey]);

  // Standar lembaga datang belakangan (setelah muat awal) → terapkan ulang.
  useEffect(() => {
    if (stdNama) void muat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stdNama]);

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
    apiRef.current = { presets, toggleKolom: toggleKolomPreset };
  }, [apiRef, presets, toggleKolomPreset]);

  useEffect(() => {
    listLembaga({ per_page: 100 }).then((p) => setLembagas(p.data)).catch(() => {});
  }, []);

  async function pilihPreset(v: string) {
    if (v === KELOLA) {
      bukaKelola(null);
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

  function bukaKelola(preset: PresetTabel | null) {
    setSeed((s) => ({ preset, nonce: s.nonce + 1 }));
    setDokOpen(true);
  }

  const labelPreset = (p: PresetTabel) => (
    p.lembaga_id === null ? p.nama : `${p.nama} (${p.lembaga?.kode ?? p.lembaga?.nama ?? p.lembaga_id})`
  );

  return (
    <>
      <FilterField label="Kolom" htmlFor={`select_preset_kolom_${tableKey}`}>
      <Select value={aktifId === null ? LENGKAP : String(aktifId)} onValueChange={(v) => void pilihPreset(v)}>
        <SelectTrigger
          id={`select_preset_kolom_${tableKey}`}
          title="Preset kolom tampilan"
          aria-label="Preset kolom tampilan"
          className="w-44"
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
          <SelectSeparator />
          <SelectItem value={KELOLA}>Kelola preset…</SelectItem>
        </SelectContent>
      </Select>
      </FilterField>
      {dokOpen && (
        <KelolaPresetDialog
          key={seed.nonce}
          open={dokOpen}
          onOpenChange={setDokOpen}
          tableKey={tableKey}
          fields={fields}
          fieldKeys={fieldKeys}
          presets={presets}
          lembagas={lembagas}
          isPesantren={isPesantren}
          banyakKolom={banyakKolom}
          presetAwal={seed.preset}
          onPilihPreset={bukaKelola}
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
