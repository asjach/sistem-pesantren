import { useCallback, useEffect, useRef, useState } from 'react';
import { useBagian, useAksiBagian } from '@/components/kelolaHalaman/kotor';
import { errorMessage } from '@/api/client';
import {
  muatToolbarPreset,
  simpanToolbarPreset,
  type VisibilitasToolbar,
} from '@/api/toolbarPreset';
import { kabariToolbar } from '@/components/kelolaTabel/jenis';
import {
  FILTER_TOOLBAR,
  buangKunciVisibilitas,
  gabungVisibilitas,
  type KunciFilterToolbar,
} from '@/components/excel/filterTabel';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

/** Section "Filter Tabel" di dialog Kelola Tabel: nyala/mati filter toolbar
 *  milik TABEL ini saja (Pencarian, Urutan, Kolom, Keaktifan) — terpisah dari
 *  filter topBar (lembaga/TA/semester/tingkat/kelas) yang ada di section lain
 *  tab yang sama.
 *
 *  Disimpan di `toolbar_preset.visibilitas` (peta kunci filter → boolean;
 *  absen/`true` = tampil), jadi tanpa migrasi dan otomatis terbaca ulang grid
 *  lewat `EVENT_TOOLBAR_BERUBAH`. Tanpa simpanan = ikut bawaan kode (semua
 *  filter yang tersedia tampil).
 *
 *  WAJIB merge: `simpanToolbarPreset` menimpa SATU PETA utuh, jadi kunci milik
 *  fitur lain (atau filter tabel lain yang kebetulan sebaris) harus dibaca
 *  ulang lalu digabung — menulis sebagian tanpa merge akan MENGHAPUS yang
 *  tidak ikut ditulis. */
export default function TabFilterToolbar({
  tableKey,
  filterTersedia,
  labelKembalikan = 'Kembalikan ke bawaan tabel',
}: {
  tableKey: string;
  /** Kunci filter yang tersedia di tabel ini (dihitung ExcelTable). */
  filterTersedia: readonly KunciFilterToolbar[];
  labelKembalikan?: string;
}) {
  /** Sakelar per kunci: `true` = tampil (bawaan), `false` = disembunyikan. */
  const [nilai, setNilai] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  /** Ada penanda "sembunyi" milik tabel ini di DB (acuan tombol Kembalikan). */
  const [adaSimpanan, setAdaSimpanan] = useState(false);
  const laporKotor = useBagian('filterToolbar', () => simpan());
  useAksiBagian('filterToolbar', {
    label: labelKembalikan,
    onClick: () => void kembalikan(),
    disabled: busy || !adaSimpanan,
  });
  /** Peta visibilitas persis seperti di server (untuk merge saat menulis). */
  const serverRef = useRef<VisibilitasToolbar>({});
  /** Peta terakhir yang sama dengan server (acuan deteksi kotor). */
  const acuanRef = useRef('{}');

  const muat = useCallback(async () => {
    try {
      const res = await muatToolbarPreset(tableKey);
      const server = res.data.visibilitas ?? {};
      serverRef.current = { ...server };
      const peta: Record<string, boolean> = {};
      for (const k of filterTersedia) peta[k] = server[k] !== false;
      setNilai(peta);
      setAdaSimpanan(filterTersedia.some((k) => server[k] === false));
      acuanRef.current = JSON.stringify(peta);
    } catch {
      // Gagal muat = anggap bawaan (semua tampil), sama seperti grid.
      const bawaan: Record<string, boolean> = {};
      for (const k of filterTersedia) bawaan[k] = true;
      setNilai(bawaan);
      setAdaSimpanan(false);
      acuanRef.current = JSON.stringify(bawaan);
    }
  }, [tableKey, filterTersedia]);

  useEffect(() => {
    void muat();
  }, [muat]);

  useEffect(() => {
    laporKotor(JSON.stringify(nilai) !== acuanRef.current);
  }, [nilai, laporKotor]);

  /** Peta lengkap setelah menerapkan sakelar section ini di atas isi server
   *  (lihat `gabungVisibilitas`: yang dihidupkan dihapus, yang dimatikan
 *  ditulis `false`). */
  function petaGabungan(): VisibilitasToolbar {
    return gabungVisibilitas(serverRef.current, nilai);
  }

  async function simpan(): Promise<boolean> {
    setBusy(true);
    try {
      const gabung = petaGabungan();
      await simpanToolbarPreset(tableKey, gabung);
      serverRef.current = gabung;
      acuanRef.current = JSON.stringify(nilai);
      laporKotor(false);
      setAdaSimpanan(Object.keys(nilai).some((k) => nilai[k] === false));
      toast.success('Filter tabel disimpan.');
      kabariToolbar(tableKey);
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function kembalikan() {
    setBusy(true);
    try {
      // Hapus penanda milik kunci tabel ini, kunci milik fitur lain dibiarkan —
      // grid kembali ke bawaan kode.
      const gabung = buangKunciVisibilitas(serverRef.current, filterTersedia);
      await simpanToolbarPreset(tableKey, gabung);
      serverRef.current = gabung;
      const bawaan: Record<string, boolean> = {};
      for (const k of filterTersedia) bawaan[k] = true;
      setNilai(bawaan);
      acuanRef.current = JSON.stringify(bawaan);
      laporKotor(false);
      setAdaSimpanan(false);
      toast.success('Filter tabel dikembalikan ke bawaan.');
      kabariToolbar(tableKey);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const tampil = FILTER_TOOLBAR.filter((f) => filterTersedia.includes(f.kunci));

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex flex-col rounded-md border">
        {tampil.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted-foreground">
            Tabel ini tidak memiliki filter toolbar yang bisa diatur.
          </p>
        ) : tampil.map(({ kunci, label, ket }) => (
          <div
            key={kunci}
            className="flex items-center gap-2 border-b px-2 py-1 last:border-0 hover:bg-accent/40"
          >
            <Checkbox
              id={`chk_filter_toolbar_${tableKey}_${kunci}`}
              checked={nilai[kunci] !== false}
              disabled={busy}
              aria-label={`Tampilkan filter ${label}`}
              title={`Tampilkan ${label} — ${nilai[kunci] === false ? 'tersembunyi' : 'tampil'}`}
              onCheckedChange={(c) => setNilai((v) => ({ ...v, [kunci]: !!c }))}
            />
            <span className="min-w-0 flex-1 truncate text-xs" title={ket}>
              {label}
            </span>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {nilai[kunci] === false ? 'Mati' : 'Nyala'}
            </span>
          </div>
        ))}
      </div>
      <p className="px-1 text-[11px] text-muted-foreground">
        Filter yang dimatikan hilang dari bilah judul tabel. Pencarian tabel berbeda
        dari pencarian topBar: pencarian topBar mencakup semua tabel di halaman ini.
      </p>
    </div>
  );
}
