import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage, prefGet, prefSet } from '@/api/client';
import { hapusToolbarPreset, muatToolbarPreset } from '@/api/toolbarPreset';
import { listPresetTabel, setPresetAktif } from '@/api/preset';
import { useBagian, useAksiBagian } from '@/components/kelolaHalaman/kotor';
import { freezeKey, loadFreeze, widthsKey, writeWidthCache } from '@/components/excel/helpers';
import { autoBarisKey, tinggiBarisKey } from '@/components/excel/useTinggiBaris';
import {
  EVENT_PRESET_BERUBAH,
  EVENT_TAMPILAN_PERANGKAT_BERUBAH,
  EVENT_TOOLBAR_BERUBAH,
  kabariPreset,
  kabariTampilanPerangkat,
  kabariToolbar,
} from './jenis';
import { useLembagaAktif } from '@/lembagaAktif';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import ConfirmDelete from '@/components/ConfirmDelete';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { ExcelField } from '../excel/types';

/** Batas kolom beku: tak lebih dari jumlah kolom tampil. */
function jepitBeku(n: number, maks: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(maks, Math.round(n)));
}

/** Tab "Umum" dialog Kelola Tabel: identitas tabel + tampilan perangkat +
 *  kembalikan bawaan total.
 *
 *  Tiga bagian dengan tiga sifat simpan berbeda:
 *  - "Tabel ini": info read-only (tanpa simpan, tanpa bagian kotor).
 *  - "Tampilan di perangkat ini": freeze + baris-ikut-isi, simpan LANGSUNG
 *    ke pref perangkat tiap diubah (semua pengguna boleh) lalu kabari grid
 *    lewat event agar tabel di belakang ikut berubah tanpa reload.
 *  - "Kembalikan bawaan": reset server (super_admin efektif) + reset
 *    perangkat (semua pengguna), di balik konfirmasi karena merusak.
 */
export default function TabUmum({
  tableKey,
  judul,
  fields,
}: {
  tableKey: string;
  judul: React.ReactNode;
  fields?: ExcelField[];
}) {
  const { efektifSuper: bolehResetServer } = useLembagaAktif();
  const jumlahKolom = fields?.length ?? 0;

  const [namaPresetAktif, setNamaPresetAktif] = useState<string | null>(null);
  const [namaPresetBawaan, setNamaPresetBawaan] = useState<string | null>(null);

  const muatPreset = useCallback(async () => {
    try {
      const res = await listPresetTabel(tableKey);
      const aktif = res.data.aktif_preset_id === null
        ? 'Lengkap (semua kolom)'
        : (res.data.presets.find((p) => p.id === res.data.aktif_preset_id)?.nama ?? '—');
      const bawaan = res.data.presets.find((p) => p.id === res.data.default_preset_id)?.nama ?? '—';
      setNamaPresetAktif(aktif);
      setNamaPresetBawaan(bawaan);
    } catch {
      setNamaPresetAktif('—');
      setNamaPresetBawaan('—');
    }
  }, [tableKey]);

  useEffect(() => {
    void muatPreset();
    const segarkan = (e: Event) => {
      if ((e as CustomEvent).detail?.tableKey === tableKey) void muatPreset();
    };
    window.addEventListener(EVENT_PRESET_BERUBAH, segarkan);
    return () => window.removeEventListener(EVENT_PRESET_BERUBAH, segarkan);
  }, [tableKey, muatPreset]);

  const [beku, setBeku] = useState(0);
  const [ikutIsi, setIkutIsi] = useState(false);
  const [sibukPerangkat, setSibukPerangkat] = useState(false);

  const muatPerangkat = useCallback(async () => {
    try {
      const [f, a] = await Promise.all([
        loadFreeze(freezeKey(tableKey)),
        prefGet(autoBarisKey(tableKey)),
      ]);
      setBeku(jepitBeku(f, jumlahKolom));
      setIkutIsi(a === '1');
    } catch {
      setBeku(0);
      setIkutIsi(false);
    }
  }, [tableKey, jumlahKolom]);

  useEffect(() => {
    void muatPerangkat();
  }, [muatPerangkat]);

  function ubahBeku(n: number) {
    const v = jepitBeku(n, jumlahKolom);
    setBeku(v);
    setSibukPerangkat(true);
    prefSet(freezeKey(tableKey), String(v))
      .catch(() => toast.error('Gagal menyimpan kolom beku.'))
      .finally(() => setSibukPerangkat(false));
    // Grid membaca ulang freeze-nya sendiri saat event ini tiba.
    kabariTampilanPerangkat(tableKey);
  }

  function ubahIkutIsi(nyala: boolean) {
    setIkutIsi(nyala);
    setSibukPerangkat(true);
    prefSet(autoBarisKey(tableKey), nyala ? '1' : '0')
      .catch(() => toast.error('Gagal menyimpan pengaturan baris.'))
      .finally(() => setSibukPerangkat(false));
    kabariTampilanPerangkat(tableKey);
  }
  const [sibukReset, setSibukReset] = useState(false);
  const [adaSetelanServer, setAdaSetelanServer] = useState(false);
  const laporKotor = useBagian('umum', () => Promise.resolve(true));
  useAksiBagian('umum', {
    label: 'Kembalikan bawaan tabel',
    onClick: () => void kembalikanSemua(),
    disabled: sibukReset || (!adaSetelanServer && !bolehResetServer),
  });
  const laporKotorRef = useRef(laporKotor);
  laporKotorRef.current = laporKotor;

  const muatSetelanServer = useCallback(async () => {
    try {
      const res = await muatToolbarPreset(tableKey);
      const d = res.data;
      setAdaSetelanServer(
        Object.keys(d.visibilitas ?? {}).length > 0
        || (d.urutan ?? []).length > 0
        || Object.keys(d.align ?? {}).length > 0
        || Object.keys(d.label ?? {}).length > 0,
      );
    } catch {
      setAdaSetelanServer(false);
    }
  }, [tableKey]);

  useEffect(() => {
    void muatSetelanServer();
    const segarkanToolbar = (e: Event) => {
      if ((e as CustomEvent).detail?.tableKey === tableKey) void muatSetelanServer();
    };
    const segarkanPerangkat = (e: Event) => {
      if ((e as CustomEvent).detail?.tableKey === tableKey) void muatPerangkat();
    };
    window.addEventListener(EVENT_TOOLBAR_BERUBAH, segarkanToolbar);
    window.addEventListener(EVENT_TAMPILAN_PERANGKAT_BERUBAH, segarkanPerangkat);
    return () => {
      window.removeEventListener(EVENT_TOOLBAR_BERUBAH, segarkanToolbar);
      window.removeEventListener(EVENT_TAMPILAN_PERANGKAT_BERUBAH, segarkanPerangkat);
    };
  }, [tableKey, muatSetelanServer, muatPerangkat]);

  async function kembalikanSemua(): Promise<boolean> {
    setSibukReset(true);
    laporKotorRef.current(true);
    try {
      if (bolehResetServer) {
        await hapusToolbarPreset(tableKey);
        await setPresetAktif(tableKey, null, []);
      }
      await Promise.all([
        prefSet(widthsKey(tableKey), '{}'),
        prefSet(freezeKey(tableKey), '0'),
        prefSet(tinggiBarisKey(tableKey), '{}'),
        prefSet(autoBarisKey(tableKey), '0'),
        prefSet(`simpes_page_${tableKey}`, '1'),
      ]);
      writeWidthCache(tableKey, { widths: {}, autoWidths: {} });
      setBeku(0);
      setIkutIsi(false);
      setAdaSetelanServer(false);
      toast.success('Tabel dikembalikan ke bawaan.');
      kabariToolbar(tableKey);
      kabariPreset(tableKey);
      kabariTampilanPerangkat(tableKey);
      await muatPreset();
      laporKotorRef.current(false);
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    } finally {
      setSibukReset(false);
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <dl className="rounded-md border px-3 py-2 text-xs">
        <div className="flex items-center justify-between gap-2 py-0.5">
          <dt className="text-muted-foreground">Tabel</dt>
          <dd className="font-medium">{judul}</dd>
        </div>
        <div className="flex items-center justify-between gap-2 py-0.5">
          <dt className="text-muted-foreground">Kunci tabel</dt>
          <dd id={`nilai_umum_kunci_${tableKey}`} className="font-mono">{tableKey}</dd>
        </div>
        <div className="flex items-center justify-between gap-2 py-0.5">
          <dt className="text-muted-foreground">Jumlah kolom</dt>
          <dd id={`nilai_umum_jumlah_kolom_${tableKey}`}>{jumlahKolom}</dd>
        </div>
        <div className="flex items-center justify-between gap-2 py-0.5">
          <dt className="text-muted-foreground">Preset aktif</dt>
          <dd id={`nilai_umum_preset_aktif_${tableKey}`}>{namaPresetAktif ?? '…'}</dd>
        </div>
        <div className="flex items-center justify-between gap-2 py-0.5">
          <dt className="text-muted-foreground">Preset bawaan</dt>
          <dd id={`nilai_umum_preset_bawaan_${tableKey}`}>{namaPresetBawaan ?? '…'}</dd>
        </div>
      </dl>
      <div className="flex flex-col gap-2 rounded-md border px-3 py-2">
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Tampilan di perangkat ini
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor={`input_beku_${tableKey}`} className="min-w-0 flex-1 truncate text-xs">
            Kolom beku dari kiri
          </label>
          <Input
            id={`input_beku_${tableKey}`}
            type="number"
            min={0}
            max={jumlahKolom}
            value={beku}
            disabled={sibukPerangkat || jumlahKolom === 0}
            onChange={(e) => ubahBeku(Number(e.target.value))}
            className="h-7 w-20"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={`sakelar_ikut_isi_${tableKey}`} className="min-w-0 flex-1 text-xs">
            Baris ikut isi
            <span className="block text-[11px] text-muted-foreground">
              Teks panjang membungkus, baris membesar sendiri.
            </span>
          </label>
          <Switch
            id={`sakelar_ikut_isi_${tableKey}`}
            checked={ikutIsi}
            disabled={sibukPerangkat}
            onCheckedChange={(c) => ubahIkutIsi(!!c)}
          />
        </div>
        <p className="px-1 text-[11px] text-muted-foreground">
          Hanya di perangkat ini — pengguna lain tidak ikut berubah.
        </p>
      </div>
      <div className={cn('flex flex-col gap-2 rounded-md border px-3 py-2', !bolehResetServer && 'opacity-70')}>
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Kembalikan bawaan
        </p>
        <p className="text-[11px] text-muted-foreground">
          {bolehResetServer
            ? 'Menghapus setelan server tabel ini dan tampilan perangkat ini.'
            : 'Menghapus tampilan perangkat ini. Setelan server hanya bisa dikembalikan super_admin.'}
        </p>
        <div>
          <ConfirmDelete
            title="Kembalikan tabel ke bawaan?"
            description="Setelan tabel ini akan dihapus dan kembali ke bawaan. Tindakan ini tidak bisa dibatalkan."
            confirmLabel="Kembalikan"
            onConfirm={() => void kembalikanSemua()}
            tip="Kembalikan tabel ini ke bawaan"
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              id={`btn_kembalikan_umum_${tableKey}`}
              disabled={sibukReset}
              className="text-destructive"
            >
              {sibukReset ? 'Mengembalikan…' : 'Kembalikan tabel ini'}
            </Button>
          </ConfirmDelete>
        </div>
      </div>
    </div>
  );
}
