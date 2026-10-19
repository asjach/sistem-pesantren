import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage, prefGet, prefSet } from '@/api/client';
import { hapusToolbarPreset } from '@/api/toolbarPreset';
import { listPresetTabel, setPresetAktif } from '@/api/preset';
import { useBagian } from '@/components/kelolaHalaman/kotor';
import { freezeKey, loadFreeze, widthsKey, writeWidthCache } from '@/components/excel/helpers';
import { autoBarisKey, tinggiBarisKey, tinggiDasarKey } from '@/components/excel/useTinggiBaris';
import { isiLebarKey, setIsiLebar } from '@/components/excel/useIsiLebar';
import { MAX_BARIS_H, MIN_BARIS_H, TINGGI_BARIS_BAWAAN } from '@/components/excel/tinggiBaris';
import { useGridPrefs } from '@/components/GridPrefs';
import {
  EVENT_PRESET_BERUBAH,
  EVENT_TAMPILAN_PERANGKAT_BERUBAH,
  kabariPreset,
  kabariTampilanPerangkat,
  kabariToolbar,
} from './jenis';
import { useLembagaAktif } from '@/lembagaAktif';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import ConfirmDelete from '@/components/ConfirmDelete';
import LabeledStepper from '@/components/LabeledStepper';
import { RotateCcw } from '@/icons';
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
 *
 *  Section "Visibilitas bagian tabel" (server) adalah SAUDARA komponen ini,
 *  bukan anaknya: ia daftar/simpan sendiri di tab yang sama (lihat
 *  `TabBagianTabel`) supaya satu tab bisa punya dua bagian terdaftar. */
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
  /** "Tabel mengisi lebar pembungkus" (pref perangkat, bawaan ikut halaman). */
  const [isiLebar, setIsiLebarState] = useState(false);
  const [sibukPerangkat, setSibukPerangkat] = useState(false);
  /** Tinggi dasar tabel ini; null = mengikuti bawaan global (atau 24px). */
  const [tinggiDasar, setTinggiDasar] = useState<number | null>(null);
  /** Bawaan global — hanya untuk menampilkan nilai saat tabel belum diatur. */
  const rowHGlobal = useGridPrefs().rowH;
  const tinggiBawaan = rowHGlobal ?? TINGGI_BARIS_BAWAAN;
  /** Yang benar-benar dipakai tabel ini sekarang. */
  const tinggiEfektif = tinggiDasar ?? tinggiBawaan;

  const muatPerangkat = useCallback(async () => {
    try {
      const [f, a, h, l] = await Promise.all([
        loadFreeze(freezeKey(tableKey)),
        prefGet(autoBarisKey(tableKey)),
        prefGet(tinggiDasarKey(tableKey)),
        prefGet(isiLebarKey(tableKey)),
      ]);
      setBeku(jepitBeku(f, jumlahKolom));
      setIkutIsi(a === '1');
      setIsiLebarState(l === '1');
      const n = Number(h);
      setTinggiDasar(
        h != null && h.trim() !== '' && Number.isFinite(n)
          ? Math.min(MAX_BARIS_H, Math.max(MIN_BARIS_H, Math.round(n)))
          : null,
      );
    } catch {
      setBeku(0);
      setIkutIsi(false);
      setTinggiDasar(null);
      setIsiLebarState(false);
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

  function ubahIsiLebar(nyala: boolean) {
    setIsiLebarState(nyala);
    setSibukPerangkat(true);
    setIsiLebar(tableKey, nyala)
      .catch(() => toast.error('Gagal menyimpan pengaturan lebar tabel.'))
      .finally(() => setSibukPerangkat(false));
    kabariTampilanPerangkat(tableKey);
  }

  /** Ubah tinggi dasar tabel ini. Kosong = kembali ke bawaan global. */
  function ubahTinggi(n: number | null) {
    const v = n == null
      ? null
      : Math.min(MAX_BARIS_H, Math.max(MIN_BARIS_H, Math.round(n)));
    setTinggiDasar(v);
    setSibukPerangkat(true);
    prefSet(tinggiDasarKey(tableKey), v == null ? '' : String(v))
      .catch(() => toast.error('Gagal menyimpan tinggi baris.'))
      .finally(() => setSibukPerangkat(false));
    kabariTampilanPerangkat(tableKey);
  }
  const [sibukReset, setSibukReset] = useState(false);
  const laporKotor = useBagian('umum', () => Promise.resolve(true));

  const laporKotorRef = useRef(laporKotor);
  laporKotorRef.current = laporKotor;

  useEffect(() => {
    const segarkanPerangkat = (e: Event) => {
      if ((e as CustomEvent).detail?.tableKey === tableKey) void muatPerangkat();
    };
    window.addEventListener(EVENT_TAMPILAN_PERANGKAT_BERUBAH, segarkanPerangkat);
    return () => window.removeEventListener(EVENT_TAMPILAN_PERANGKAT_BERUBAH, segarkanPerangkat);
  }, [tableKey, muatPerangkat]);

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
        prefSet(tinggiDasarKey(tableKey), ''),
        prefSet(autoBarisKey(tableKey), '0'),
        prefSet(isiLebarKey(tableKey), ''),
        prefSet(`simpes_page_${tableKey}`, '1'),
      ]);
      writeWidthCache(tableKey, { widths: {}, autoWidths: {} });
      setBeku(0);
      setIkutIsi(false);
      setIsiLebarState(false);
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

        <LabeledStepper
          id={`input_beku_${tableKey}`}
          htmlFor={`input_beku_${tableKey}`}
          kelolaLebar={false}
          label="Kolom beku"
          min={0}
          max={jumlahKolom}
          value={beku}
          disabled={sibukPerangkat || jumlahKolom === 0}
          title="Kolom beku dari kiri"
          aria-label="Kolom beku dari kiri"
          onChange={(n) => ubahBeku(n)}
        />
        {/* Tinggi baris: stepper yang sama, plus tombol ↺ untuk kembali ke
            bawaan global tabel lain. */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <LabeledStepper
              id={`tinggi_baris_${tableKey}`}
              htmlFor={`tinggi_baris_${tableKey}`}
              kelolaLebar={false}
              label="Tinggi baris"
              min={MIN_BARIS_H}
              max={MAX_BARIS_H}
              value={tinggiEfektif}
              disabled={sibukPerangkat}
              title="Tinggi baris tabel ini (px)"
              aria-label="Tinggi baris tabel ini (px)"
              onChange={(n) => ubahTinggi(n)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              id={`btn_reset_tinggi_baris_${tableKey}`}
              aria-label="Kembalikan tinggi baris ke bawaan"
              title="Kembalikan tinggi baris ke bawaan"
              disabled={sibukPerangkat || tinggiDasar === null}
              onClick={() => ubahTinggi(null)}
              className="shrink-0 text-muted-foreground"
            >
              <RotateCcw size={13} />
            </Button>
          </div>
          <p className="px-1 text-[11px] text-muted-foreground">
            {tinggiDasar === null
              ? `Mengikuti bawaan ${tinggiBawaan}px.`
              : 'Atur tabel ini saja, tidak berlaku ke tabel lain.'}
          </p>
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
        <div className="flex items-center gap-2">
          <label htmlFor={`sakelar_isi_lebar_${tableKey}`} className="min-w-0 flex-1 text-xs">
            Tabel mengisi lebar
            <span className="block text-[11px] text-muted-foreground">
              Lebar kolom diskalakan dengan satu rasio agar tabel menutup
              pembungkusnya (perbandingan antar kolom tetap sesuai isi).
            </span>
          </label>
          <Switch
            id={`sakelar_isi_lebar_${tableKey}`}
            checked={isiLebar}
            disabled={sibukPerangkat}
            onCheckedChange={(c) => ubahIsiLebar(!!c)}
          />
        </div>
        <p className="px-1 text-[11px] text-muted-foreground">
          Semua di atas hanya di perangkat ini — pengguna lain tidak ikut
          berubah. Sakelar gestur (seret isi sel &amp; geser judul kolom) ada di
          bilah Mode Ubah di kaki tabel, karena hanya berlaku saat mode itu
          menyala.
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
