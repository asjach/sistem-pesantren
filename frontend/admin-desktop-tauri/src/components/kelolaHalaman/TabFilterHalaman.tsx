import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '@/api/client';
import {
  hapusPengaturanHalaman,
  muatPengaturanHalaman,
  simpanPengaturanHalaman,
} from '@/api/halaman';
import { useLembagaAktif } from '@/lembagaAktif';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  EVENT_HALAMAN_BERUBAH,
  KUNCI_FILTER_HALAMAN,
  type KunciFilterGlobal,
} from '@/components/VisibilitasFilter';

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
  bawaan,
  onTutup,
}: {
  pageKey: string;
  bawaan: Record<KunciFilterGlobal, boolean>;
  onTutup: () => void;
}) {
  /** Visibilitas filter = super_admin EFEKTIF (mati saat bertindak). */
  const { efektifSuper: bolehUbah } = useLembagaAktif();

  const [nilai, setNilai] = useState<Record<KunciFilterGlobal, boolean>>(bawaan);
  /** Ada baris tersimpan di DB (untuk status tombol Kembalikan). */
  const [adaSimpanan, setAdaSimpanan] = useState(false);
  const [busy, setBusy] = useState(false);

  const muat = useCallback(async () => {
    try {
      const res = await muatPengaturanHalaman(pageKey);
      const bersih: Record<KunciFilterGlobal, boolean> = { ...bawaan };
      let ada = false;
      for (const k of KUNCI_FILTER_HALAMAN) {
        const v = res.data.filter?.[k];
        if (typeof v === 'boolean') {
          bersih[k] = v;
          ada = true;
        }
      }
      setNilai(bersih);
      setAdaSimpanan(ada);
    } catch {
      setNilai({ ...bawaan });
      setAdaSimpanan(false);
    }
  }, [pageKey, JSON.stringify(bawaan)]);

  useEffect(() => {
    void muat();
  }, [muat]);

  function kabariBerubah() {
    window.dispatchEvent(new CustomEvent(EVENT_HALAMAN_BERUBAH, { detail: { pageKey } }));
  }

  async function simpan() {
    if (!bolehUbah) return;
    setBusy(true);
    try {
      const res = await simpanPengaturanHalaman(pageKey, { ...nilai });
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
      setNilai({ ...bawaan });
      setAdaSimpanan(false);
      toast.success(res.pesan);
      kabariBerubah();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {!bolehUbah ? (
        <p className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
          Hanya super_admin yang dapat mengubah filter halaman.
        </p>
      ) : null}
      <div className="flex flex-col gap-1 overflow-auto rounded-md border p-1">
        {LABEL_FILTER.map(({ kunci, label, ket }) => (
          <label
            key={kunci}
            htmlFor={`switch_filter_halaman_${pageKey}_${kunci}`}
            className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-accent/40"
          >
            <Switch
              id={`switch_filter_halaman_${pageKey}_${kunci}`}
              checked={nilai[kunci]}
              disabled={!bolehUbah || busy}
              onCheckedChange={(c) => setNilai((v) => ({ ...v, [kunci]: !!c }))}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm">{label}</span>
              <span className="block truncate text-xs text-muted-foreground" title={ket}>{ket}</span>
            </span>
            {!nilai[kunci] ? (
              <span className="shrink-0 text-xs text-muted-foreground">tersembunyi</span>
            ) : null}
          </label>
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
          <Button type="button" variant="outline" onClick={onTutup}>Tutup</Button>
          <Button
            type="button"
            id={`btn_filter_halaman_simpan_${pageKey}`}
            disabled={!bolehUbah || busy}
            onClick={() => void simpan()}
          >
            {busy ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </span>
      </DialogFooter>
    </div>
  );
}
