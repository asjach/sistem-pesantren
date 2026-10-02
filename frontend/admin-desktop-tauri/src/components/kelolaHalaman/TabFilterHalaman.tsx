import { useCallback, useEffect, useRef, useState } from 'react';
import { useLaporKotor } from '@/components/kelolaHalaman/kotor';
import { errorMessage } from '@/api/client';
import {
  hapusPengaturanHalaman,
  muatPengaturanHalaman,
  simpanPengaturanHalaman,
  type FilterHalaman,
  type FilterModeHalaman,
} from '@/api/halaman';
import { useLembagaAktif } from '@/lembagaAktif';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  EVENT_HALAMAN_BERUBAH,
  type KunciFilterGlobal,
} from '@/components/VisibilitasFilter';
import type { ModeSemuaFilterGlobal, TampilFilterGlobal } from '@/lib/filterHalaman';

const LABEL_FILTER: { kunci: KunciFilterGlobal; label: string; ket: string }[] = [
  { kunci: 'lembaga', label: 'Lembaga', ket: 'Dropdown lembaga aktif' },
  { kunci: 'tahun_ajaran', label: 'Tahun Ajaran', ket: 'Dropdown tahun ajaran aktif' },
  { kunci: 'semester', label: 'Semester', ket: 'Dropdown semester aktif' },
  { kunci: 'tingkat', label: 'Tingkat', ket: 'Filter tingkat global' },
  { kunci: 'kelas', label: 'Kelas', ket: 'Filter kelas global' },
];

/** Tab Filter dialog Kelola Halaman: tampil/sembunyikan filter topBar per
 *  halaman — GLOBAL untuk seluruh lembaga, khusus super_admin. Tanpa
 *  simpanan = halaman ikut bawaan kode. */
export default function TabFilterHalaman({
  pageKey,
  filterRelevan,
  bawaan,
  modeBawaan,
}: {
  pageKey: string;
  filterRelevan: readonly KunciFilterGlobal[];
  bawaan: TampilFilterGlobal;
  modeBawaan: ModeSemuaFilterGlobal;
}) {
  /** Visibilitas filter = super_admin EFEKTIF (mati saat bertindak). */
  const { efektifSuper: bolehUbah } = useLembagaAktif();

  const [nilai, setNilai] = useState<TampilFilterGlobal>(bawaan);
  const [nilaiMode, setNilaiMode] = useState<ModeSemuaFilterGlobal>(modeBawaan);
  /** Ada baris tersimpan di DB (untuk status tombol Kembalikan). */
  const [adaSimpanan, setAdaSimpanan] = useState(false);
  const [busy, setBusy] = useState(false);
  const laporKotor = useLaporKotor('filter');
  /** Nilai terakhir yang sama dengan isi server (acuan deteksi kotor).
   *  Diisi nilai bawaan sejak awal supaya tab tidak sempat dianggap kotor
   *  sebelum permintaan muat selesai. */
  const acuanRef = useRef(JSON.stringify({ nilai: bawaan, mode: modeBawaan }));

  const muat = useCallback(async () => {
    try {
      const res = await muatPengaturanHalaman(pageKey);
      const bersih: TampilFilterGlobal = { ...bawaan };
      const modeBersih: ModeSemuaFilterGlobal = { ...modeBawaan };
      let ada = false;
      for (const k of filterRelevan) {
        const v = res.data.filter?.[k];
        const m = res.data.filter_mode?.[k];
        if (typeof v === 'boolean') {
          bersih[k] = v;
          ada = true;
        }
        if (m === 'single' || m === 'multiple') modeBersih[k] = m;
      }
      setNilai(bersih);
      setNilaiMode(modeBersih);
      setAdaSimpanan(ada);
      acuanRef.current = JSON.stringify({ nilai: bersih, mode: modeBersih });
    } catch {
      const nilaiBawaan = { ...bawaan };
      const modeBawaanSemua = { ...modeBawaan };
      setNilai(nilaiBawaan);
      setNilaiMode(modeBawaanSemua);
      setAdaSimpanan(false);
      acuanRef.current = JSON.stringify({ nilai: nilaiBawaan, mode: modeBawaanSemua });
    }
  }, [pageKey, filterRelevan, bawaan, modeBawaan]);

  useEffect(() => {
    void muat();
  }, [muat]);

  useEffect(() => {
    laporKotor(JSON.stringify({ nilai, mode: nilaiMode }) !== acuanRef.current);
  }, [nilai, nilaiMode, laporKotor]);

  function kabariBerubah() {
    window.dispatchEvent(new CustomEvent(EVENT_HALAMAN_BERUBAH, { detail: { pageKey } }));
  }

  async function simpan() {
    if (!bolehUbah || filterRelevan.length === 0) return;
    setBusy(true);
    try {
      const filter: FilterHalaman = {};
      const filterMode: FilterModeHalaman = {};
      for (const k of filterRelevan) {
        filter[k] = nilai[k];
        filterMode[k] = nilaiMode[k];
      }
      const res = await simpanPengaturanHalaman(pageKey, filter, filterMode);
      // Nilai kini = isi server. Efek pemantau tidak akan jalan (nilai tidak
      // berubah), jadi lapor bersih secara eksplisit.
      acuanRef.current = JSON.stringify({ nilai, mode: nilaiMode });
      laporKotor(false);
      setAdaSimpanan(true);
      toast.success(res.pesan);
      kabariBerubah();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function kembalikan() {
    if (!bolehUbah) return;
    setBusy(true);
    try {
      const res = await hapusPengaturanHalaman(pageKey);
      const nilaiBawaan = { ...bawaan };
      const modeBawaanSemua = { ...modeBawaan };
      setNilai(nilaiBawaan);
      setNilaiMode(modeBawaanSemua);
      acuanRef.current = JSON.stringify({ nilai: nilaiBawaan, mode: modeBawaanSemua });
      laporKotor(false);
      setAdaSimpanan(false);
      toast.success(res.pesan);
      kabariBerubah();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const filterTampil = LABEL_FILTER.filter(({ kunci }) => filterRelevan.includes(kunci));

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {!bolehUbah ? (
        <p className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
          Hanya super_admin yang dapat mengubah filter halaman.
        </p>
      ) : null}
      <div className="flex max-h-[50vh] flex-col overflow-auto rounded-md border">
        {filterTampil.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            Halaman ini tidak memiliki filter global yang relevan.
          </p>
        ) : filterTampil.map(({ kunci, label, ket }) => (
          <div
            key={kunci}
            className="flex flex-wrap items-center gap-3 rounded-md px-2 py-2 hover:bg-accent/40"
          >
            <Switch
              id={`switch_filter_halaman_${pageKey}_${kunci}`}
              checked={nilai[kunci]}
              disabled={!bolehUbah || busy}
              aria-label={`Tampilkan filter ${label}`}
              onCheckedChange={(c) => setNilai((v) => ({ ...v, [kunci]: !!c }))}
            />
            <span className="min-w-40 flex-1">
              <span className="block text-sm">{label}</span>
              <span className="block truncate text-xs text-muted-foreground" title={ket}>{ket}</span>
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {nilai[kunci] ? 'Tampil' : 'Tersembunyi'}
            </span>
            <label
              htmlFor={`switch_mode_filter_halaman_${pageKey}_${kunci}`}
              className="flex shrink-0 items-center gap-2"
            >
              <span className="text-xs text-muted-foreground">Mode</span>
              <Switch
                id={`switch_mode_filter_halaman_${pageKey}_${kunci}`}
                size="sm"
                checked={nilaiMode[kunci] === 'multiple'}
                disabled={!bolehUbah || busy}
                aria-label={`Mode filter ${label}: ${nilaiMode[kunci] === 'multiple' ? 'jamak' : 'tunggal'}`}
                onCheckedChange={(c) => setNilaiMode((v) => ({
                  ...v,
                  [kunci]: c ? 'multiple' : 'single',
                }))}
              />
              <span className="min-w-14 text-xs">
                {nilaiMode[kunci] === 'multiple' ? 'Jamak' : 'Tunggal'}
              </span>
            </label>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {adaSimpanan
          ? 'Halaman ini memakai pengaturan tersimpan (menang atas bawaan kode).'
          : 'Belum ada pengaturan tersimpan — halaman ikut bawaan kode.'}
      </p>

      <DialogFooter className="mt-auto gap-2 sm:justify-between">
        <Button
          type="button"
          variant="outline"
          id={`btn_filter_halaman_bawaan_${pageKey}`}
          disabled={!bolehUbah || busy || !adaSimpanan}
          onClick={() => void kembalikan()}
        >
          Kembalikan bawaan
        </Button>
        <span className="flex gap-2">
                    <Button
            type="button"
            id={`btn_filter_halaman_simpan_${pageKey}`}
            disabled={!bolehUbah || busy || filterRelevan.length === 0}
            onClick={() => void simpan()}
          >
            {busy ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </span>
      </DialogFooter>
    </div>
  );
}
