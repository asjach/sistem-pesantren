import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { errorMessage } from '../api/client';
import {
  importRiwayatBelajar,
  keluarKelas,
  listRiwayatBelajar,
  periksaImportRiwayatBelajar,
  setKelas,
  unduhTemplateRiwayatBelajar,
  type RiwayatRow,
} from '../api/siklus';
import { listKelas, type Kelas } from '../api/master';
import type { ImportPeriksa } from '../api/santri';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { useTingkatAktif } from '@/tingkatAktif';
import { useKelasAktif } from '@/kelasAktif';
import { VisibilitasFilter } from '@/components/VisibilitasFilter';
import { TopBarSearch } from '@/components/TopBarSearch';
import FilterField from '@/components/FilterField';
import { useLembagaAwalString } from '@/hooks/useLembagaAwal';
import { useTahunAjaranAwalString } from '@/hooks/useTahunAjaranAwal';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import Pager from '@/components/Pager';
import { useDaftarTabel } from '@/hooks/useDaftarTabel';
import { ActionIcon } from '@/components/RowActions';
import ImportBertahapDialog from '@/components/ImportBertahapDialog';
import { ArrowRight, FileUp, Download, Undo2 } from '@/icons';
import {
  ROSTER_FIELDS,
  noopCommit,
  riwayatValues,
} from '@/components/siklus/bersama';
import { toast } from 'sonner';

/** Kolom panel kiri: riwayat aktif tanpa kelas (tanpa kolom kelas). */
const FIELDS_KIRI: ExcelField[] = [
  { key: 'santri', label: 'santri.nama_lengkap', width: 200, kind: 'static', sumber: { tabel: 'santri', kolom: 'nama_lengkap' } },
  { key: 'nis', label: 'nis_lokal', width: 110, kind: 'static', sumber: { tabel: 'lembaga_santri', kolom: 'nis_lokal' } },
  { key: 'jk', label: 'santri.jk', width: 70, kind: 'static', sumber: { tabel: 'santri', kolom: 'jk' } },
  { key: 'tingkat', label: 'tingkat', width: 80, kind: 'static', sumber: { tabel: 'riwayat_belajar', kolom: 'tingkat' } },
  { key: 'masuk', label: 'tgl_masuk', width: 110, kind: 'static', sumber: { tabel: 'riwayat_belajar', kolom: 'tgl_masuk' } },
];

function kiriValues(r: RiwayatRow): Record<string, string | null> {
  return {
    santri: r.santri?.nama_lengkap ?? String(r.santri_id),
    nis: r.nis_lokal ?? null,
    jk: r.santri?.jk ?? null,
    tingkat: r.tingkat,
    masuk: r.tgl_masuk ? r.tgl_masuk.slice(0, 10) : null,
  };
}

/**
 * Riwayat Belajar khusus awal tahun ajaran, dua panel sejajar:
 * kiri = riwayat aktif semester 1 yang belum memiliki kelas (aksi panah =
 *   set-kelas ke kelas terpilih di filter kanan),
 * kanan = riwayat semester 1 yang sudah masuk kelas (aksi = keluarkan dari
 *   kelas, baris kembali ke panel kiri; riwayat tidak dihapus).
 */
export default function RiwayatBelajarPage() {
  const { user } = useAuth();
  const canTambah = bisa(user, 'riwayat_belajar.tambah');
  /** Penempatan/keluar kelas lewat pintu `pindah_kelas.ubah`. */
  const canKelas = bisa(user, 'pindah_kelas.ubah');
  /** Lembaga + TA selalu mengikuti topbar (satu-satunya sumber). */
  const [jenjang, setLembagaId] = useState('');
  useLembagaAwalString(setLembagaId);
  const [taId, setTaId] = useState('');
  useTahunAjaranAwalString(setTaId);
  /** Filter kanan sekaligus kelas tujuan panah (wajib spesifik untuk memasukkan santri). */
  const [kelasId, setKelasId] = useState('');
  /** Pencarian tunggal halaman (topBar) untuk kedua panel. */
  const [cari, setCari] = useState('');
  const [kelasOpsi, setKelasOpsi] = useState<Kelas[]>([]);
  /** Tingkat & Kelas = filter global topBar (setara lembaga/TA/semester):
   *  tingkat menyaring kedua panel; kelas menyaring panel "sudah masuk kelas". */
  const { tingkat: tingkatFilter } = useTingkatAktif();
  const { kelas: kelasFilter } = useKelasAktif();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  /** Baris tercentang per panel (diangkat via `onCheckedChange` agar tombol
   *  bulk bisa duduk di header panel). */
  const [centangKiri, setCentangKiri] = useState<RiwayatRow[]>([]);
  const [centangKanan, setCentangKanan] = useState<RiwayatRow[]>([]);
  /** Naikkan seusai aksi massal untuk me-remount grid (mereset centang internal). */
  const [nonceKiri, setNonceKiri] = useState(0);
  const [nonceKanan, setNonceKanan] = useState(0);

  /** Id kelas terpilih (dari nama di filter global) untuk param server. */
  const kelasFilterIds = useMemo(
    () => kelasOpsi.filter((k) => kelasFilter.includes(k.nama_kelas)).map((k) => k.id),
    [kelasOpsi, kelasFilter],
  );

  const kiri = useDaftarTabel<RiwayatRow>({
    tableKey: 'riwayat_belum_masuk',
    search: cari,
    ambil: (a) => {
      if (!jenjang || !taId) {
        return Promise.resolve({ data: [], current_page: 1, last_page: 1, per_page: a.perPage, total: 0 });
      }
      return listRiwayatBelajar({
        jenjang: jenjang,
        tahun_ajaran: taId,
        semester: '1',
        tanpa_kelas: true,
        tingkat: tingkatFilter.length ? tingkatFilter : undefined,
        is_active_riwayat: true,
        q: a.search || undefined,
        sort: a.urut.length ? a.urut : undefined,
        arah: a.urut.length ? a.arah : undefined,
        page: a.page,
        per_page: a.perPage,
        signal: a.signal,
      });
    },
    deps: [jenjang, taId, tingkatFilter],
  });

  const kanan = useDaftarTabel<RiwayatRow>({
    tableKey: 'riwayat_belajar',
    search: cari,
    ambil: (a) => {
      if (!jenjang || !taId) {
        return Promise.resolve({ data: [], current_page: 1, last_page: 1, per_page: a.perPage, total: 0 });
      }
      return listRiwayatBelajar({
        jenjang: jenjang,
        tahun_ajaran: taId,
        semester: '1',
        dengan_kelas: true,
        tingkat: tingkatFilter.length ? tingkatFilter : undefined,
        kelas_id: kelasFilterIds.length ? kelasFilterIds : undefined,
        is_active_riwayat: true,
        q: a.search || undefined,
        sort: a.urut.length ? a.urut : undefined,
        arah: a.urut.length ? a.arah : undefined,
        page: a.page,
        per_page: a.perPage,
        signal: a.signal,
      });
    },
    deps: [jenjang, taId, tingkatFilter, kelasFilterIds],
  });

  useEffect(() => {
    if (!jenjang || !taId) { setKelasOpsi([]); return; }
    listKelas({ jenjang: jenjang, tahun_ajaran: taId, per_page: 1000 })
      .then((p) => setKelasOpsi(p.data))
      .catch(() => setKelasOpsi([]));
    setKelasId('');
  }, [jenjang, taId]);

  const muatUlang = useCallback(async () => {
    await Promise.all([kiri.load(kiri.pager.page), kanan.load(kanan.pager.page)]);
  }, [kiri, kanan]);

  /** Kelas tujuan panah = kelas terpilih di filter kanan (harus spesifik). */
  const targetKelas = kelasOpsi.find((k) => String(k.id) === kelasId) ?? null;

  const cocokTingkat = useCallback((r: RiwayatRow): boolean => {
    if (!targetKelas) return false;
    const tKelas = targetKelas.tingkat !== null && targetKelas.tingkat !== undefined ? String(targetKelas.tingkat) : '';
    // Backend menolak bila keduanya terisi dan berbeda; kosong di salah satu sisi boleh.
    if (!r.tingkat || !tKelas) return true;
    return String(r.tingkat) === tKelas;
  }, [targetKelas]);

  const masukkan = useCallback(async (r: RiwayatRow) => {
    if (busyId !== null || !jenjang || !taId) return;
    if (!targetKelas) {
      toast.error('Pilih kelas di filter kanan dulu.');
      return;
    }
    if (!cocokTingkat(r)) {
      toast.error(`Tingkat santri (${r.tingkat ?? '—'}) tidak cocok dengan kelas ${targetKelas.nama_kelas}.`);
      return;
    }
    setBusyId(r.id);
    try {
      await setKelas(r.id, targetKelas.id);
      toast.success('Santri dimasukkan ke kelas.');
      await muatUlang();
    } catch (e) {
      toast.error(errorMessage(e));
      await muatUlang();
    } finally {
      setBusyId(null);
    }
  }, [busyId, jenjang, taId, targetKelas, cocokTingkat, muatUlang]);

  const keluarkan = useCallback(async (r: RiwayatRow) => {
    try {
      await keluarKelas(r.id);
      toast.success('Santri dikeluarkan dari kelas.');
      await muatUlang();
    } catch (e) { toast.error(errorMessage(e)); }
  }, [muatUlang]);

  /** Aksi massal kiri: masukkan yang tercentang ke kelas terpilih. */
  const masukBanyak = useCallback(async () => {
    if (bulkBusy || centangKiri.length === 0 || !jenjang || !taId) return;
    if (!targetKelas) {
      toast.error('Pilih kelas di filter kanan dulu.');
      return;
    }
    setBulkBusy(true);
    let ok = 0;
    const gagal: string[] = [];
    try {
      for (const r of centangKiri) {
        if (!cocokTingkat(r)) {
          gagal.push(`${r.santri?.nama_lengkap ?? r.santri_id}: tingkat tidak cocok`);
          continue;
        }
        try {
          await setKelas(r.id, targetKelas.id);
          ok++;
        } catch (e) {
          gagal.push(`${r.santri?.nama_lengkap ?? r.santri_id}: ${errorMessage(e)}`);
        }
      }
      if (gagal.length > 0) toast.error(`${ok} masuk, ${gagal.length} gagal: ${gagal.slice(0, 3).join(' · ')}${gagal.length > 3 ? ' …' : ''}`);
      else toast.success(`${ok} santri dimasukkan ke kelas.`);
      setCentangKiri([]);
      setNonceKiri((n) => n + 1);
      await muatUlang();
    } finally {
      setBulkBusy(false);
    }
  }, [bulkBusy, centangKiri, jenjang, taId, targetKelas, cocokTingkat, muatUlang]);

  /** Aksi massal kanan: keluarkan yang tercentang dari kelas (kembali ke kiri). */
  const keluarBanyak = useCallback(async () => {
    if (bulkBusy || centangKanan.length === 0) return;
    setBulkBusy(true);
    let ok = 0;
    const gagal: string[] = [];
    try {
      for (const r of centangKanan) {
        try {
          await keluarKelas(r.id);
          ok++;
        } catch (e) {
          gagal.push(`${r.santri?.nama_lengkap ?? r.id}: ${errorMessage(e)}`);
        }
      }
      if (gagal.length > 0) toast.error(`${ok} dikeluarkan, ${gagal.length} gagal: ${gagal.slice(0, 3).join(' · ')}${gagal.length > 3 ? ' …' : ''}`);
      else toast.success(`${ok} santri dikeluarkan dari kelas.`);
      setCentangKanan([]);
      setNonceKanan((n) => n + 1);
      await muatUlang();
    } finally {
      setBulkBusy(false);
    }
  }, [bulkBusy, centangKanan, muatUlang]);

  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [periksaHasil, setPeriksaHasil] = useState<ImportPeriksa | null>(null);
  const [busy, setBusy] = useState(false);
  const [bertahapOpen, setBertahapOpen] = useState(false);

  const siap = jenjang !== '' && taId !== '';

  const panel = (
    key: string,
    judul: string,
    jumlah: number,
    tabel: ReactNode,
    pagerNode: ReactNode,
    aksiKepala?: ReactNode,
    bawahJudul?: ReactNode,
  ) => (
    <section className="flex min-h-0 min-w-0 flex-col rounded-md border">
      <header className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2 text-sm font-medium">
        <span>{judul} ({jumlah})</span>
        {aksiKepala}
      </header>
      {bawahJudul}
      <div className="flex min-h-0 flex-1 flex-col px-2 pb-2">
        {tabel}
        {pagerNode}
      </div>
    </section>
  );

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{kiri.err || kanan.err}</ErrorNotice>
      <TopBarSearch value={cari} onChange={setCari} placeholder="Cari santri…" />
      <VisibilitasFilter tampil={{ tingkat: true, kelas: true }} />
      {!siap ? (
        <p className="text-sm text-muted-foreground">Pilih lembaga dan tahun ajaran di topbar dulu untuk memuat kedua tabel.</p>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fit,minmax(min(420px,100%),1fr))] gap-4">
          {panel(
            'belum',
            'Belum memiliki kelas',
            kiri.total,
            <ExcelTable<RiwayatRow>
              tableKey="riwayat_belum_masuk"
              fields={FIELDS_KIRI}
              rows={kiri.rows}
              getValues={kiriValues}
              loading={kiri.loading}
              emptyText="Semua santri sudah masuk kelas."
              canEdit={false}
              onCommit={noopCommit}
              onSaved={noopCommit}
              renderActions={(r) => (
                canKelas ? (
                  <ActionIcon
                    id={`btn_masuk_kelas_${r.id}`}
                    title={targetKelas ? `Masukkan ke ${targetKelas.nama_kelas}` : 'Pilih kelas di filter kanan dulu'}
                    disabled={!targetKelas || busyId !== null}
                    onClick={() => void masukkan(r)}
                  >
                    <ArrowRight size={16} />
                  </ActionIcon>
                ) : null
              )}
              key={`riwayat_belum_masuk_${nonceKiri}`}
              onCheckedChange={setCentangKiri}
            />,
            <Pager
              page={kiri.pager.page}
              lastPage={kiri.lastPage}
              total={kiri.total}
              perPage={kiri.pager.perPage}
              onPage={(p) => { kiri.pager.setPage(p); void kiri.load(p); }}
              onPerPage={(pp) => { kiri.pager.setPerPage(pp); void kiri.load(1, pp); }}
            />,
            canKelas ? (
              <Button
                id="btn_bulk_masuk_kelas"
                size="sm"
                disabled={bulkBusy || centangKiri.length === 0 || !targetKelas}
                title={targetKelas ? 'Masukkan yang tercentang ke kelas terpilih' : 'Pilih kelas di filter kanan dulu'}
                onClick={() => void masukBanyak()}
              >
                Masuk ({centangKiri.length})
              </Button>
            ) : undefined,
          )}
          {panel(
            'sudah',
            'Sudah masuk kelas',
            kanan.total,
            <ExcelTable<RiwayatRow>
              tableKey="riwayat_belajar"
              fields={ROSTER_FIELDS}
              rows={kanan.rows}
              getValues={riwayatValues}
              loading={kanan.loading}
              emptyText="Tidak ada santri berkelas pada filter ini."
              canEdit={false}
              onCommit={noopCommit}
              onSaved={noopCommit}
              renderActions={(r) => (
                canKelas ? (
                  <ActionIcon
                    id={`btn_keluar_kelas_${r.id}`}
                    title="Keluarkan dari kelas (kembali ke panel kiri)"
                    onClick={() => void keluarkan(r)}
                  >
                    <Undo2 size={16} />
                  </ActionIcon>
                ) : null
              )}
              key={`riwayat_belajar_${nonceKanan}`}
              onCheckedChange={setCentangKanan}
              filter={(
                <FilterField label="Kelas tujuan" htmlFor="select_kelas_riwayat_belajar">
                  <Select value={kelasId === '' ? '_semua' : kelasId} onValueChange={(v) => setKelasId(v === '_semua' ? '' : v)}>
                    <SelectTrigger id="select_kelas_riwayat_belajar" title="Kelas tujuan aksi panah (pilih spesifik untuk memasukkan santri)" aria-label="Kelas tujuan" size="sm" className="w-32">
                      <SelectValue placeholder="Semua" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="_semua">Semua</SelectItem>
                        {kelasOpsi.map((k) => <SelectItem key={k.id} value={String(k.id)}>{k.nama_kelas}</SelectItem>)}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </FilterField>
              )}
            />,
            <Pager
              page={kanan.pager.page}
              lastPage={kanan.pager.page}
              total={kanan.total}
              perPage={kanan.pager.perPage}
              onPage={(p) => { kanan.pager.setPage(p); void kanan.load(p); }}
              onPerPage={(pp) => { kanan.pager.setPerPage(pp); void kanan.load(1, pp); }}
            />,
            (canKelas || canTambah) ? (
              <div className="flex items-center gap-2">
                {canKelas ? (
                  <Button
                    id="btn_bulk_keluar_kelas"
                    size="sm"
                    variant="outline"
                    disabled={bulkBusy || centangKanan.length === 0}
                    title="Keluarkan yang tercentang dari kelas (kembali ke panel kiri)"
                    onClick={() => void keluarBanyak()}
                  >
                    Keluarkan ({centangKanan.length})
                  </Button>
                ) : null}
                {canTambah ? (
                  <>
                    <Button id="btn_buka_import_riwayat" size="sm" variant="outline" onClick={() => { setImportFile(null); setPeriksaHasil(null); setImportOpen(true); }}>
                      <FileUp data-icon="inline-start" size={16} /> Import
                    </Button>
                    <Button id="btn_buka_import_bertahap" size="sm" variant="outline" title="Untuk file besar (puluhan hingga ratusan ribu baris)"
                      onClick={() => setBertahapOpen(true)}>
                      <FileUp data-icon="inline-start" size={16} /> Import bertahap
                    </Button>
                  </>
                ) : null}
              </div>
            ) : undefined,
            undefined,
          )}
        </div>
      )}

      {/* Import riwayat (dipertahankan; penyesuaian alur ganjil menyusul) */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import riwayat belajar</DialogTitle>
            <DialogDescription>Kolom mengikuti tabel riwayat (kelas cukup diisi nama); kunci: NIS lokal + lembaga. Baris cocok (santri+TA+jenjang+semester) diperbarui, hanya kolom terisi.</DialogDescription>
          </DialogHeader>
          <form className="grid grid-cols-2 gap-3" onSubmit={async (e) => {
            e.preventDefault();
            if (!importFile || !periksaHasil?.siap_import) return;
            setBusy(true);
            try {
              const res = await importRiwayatBelajar({ file: importFile });
              if (res.errors?.length) toast.error(res.errors.map((x) => `Baris ${x.row} (${x.attribute}): ${x.errors.join(', ')}`).join(' · '));
              else {
                toast.success(res.pesan ?? 'Import selesai.');
                setImportOpen(false);
                await muatUlang();
              }
            } catch (e2) { toast.error(errorMessage(e2)); } finally { setBusy(false); }
          }}>
            <Button id="btn_unduh_template_riwayat" type="button" variant="link" className="col-span-2 h-auto justify-start px-0"
              onClick={() => void unduhTemplateRiwayatBelajar().catch((e) => toast.error(errorMessage(e)))}>
              <Download data-icon="inline-start" size={16} /> Unduh template Excel riwayat
            </Button>
            <Input id="input_file_import_riwayat" className="col-span-2" type="file" accept=".xlsx,.xls,.csv"
              onChange={(e) => { setImportFile(e.target.files?.[0] ?? null); setPeriksaHasil(null); }} required />
            {periksaHasil ? (
              <div className="col-span-2 rounded-md border p-3 text-sm" id="hasil_periksa_import_riwayat">
                <p className="font-medium">
                  {periksaHasil.ringkasan.baris_diproses} baris diperiksa · {periksaHasil.ringkasan.baris_valid} valid · {periksaHasil.ringkasan.baris_gagal} bermasalah
                  {(periksaHasil.ringkasan.dibuat !== undefined || periksaHasil.ringkasan.diperbarui !== undefined) && (
                    <> · {periksaHasil.ringkasan.dibuat ?? 0} dibuat · {periksaHasil.ringkasan.diperbarui ?? 0} diperbarui</>
                  )}
                </p>
                {periksaHasil.errors.length > 0 ? (
                  <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-destructive">
                    {periksaHasil.errors.slice(0, 50).map((x, i) => <li key={`${x.row}-${x.attribute}-${i}`}>Baris {x.row} ({x.attribute}): {x.errors.join(', ')}</li>)}
                  </ul>
                ) : <p className="mt-1 text-xs text-emerald-600">Tidak ada masalah — siap diimport.</p>}
              </div>
            ) : null}
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>Batal</Button>
              <Button id="btn_periksa_import_riwayat" type="button" variant="outline" disabled={!importFile || busy}
                onClick={async () => {
                  if (!importFile) return;
                  setBusy(true);
                  try {
                    const res = await periksaImportRiwayatBelajar({ file: importFile });
                    setPeriksaHasil(res);
                    if (res.siap_import) toast.success(res.pesan); else toast.error(res.pesan);
                  } catch (e2) { setPeriksaHasil(null); toast.error(errorMessage(e2)); } finally { setBusy(false); }
                }}>Periksa</Button>
              <Button id="btn_import_riwayat" type="submit" disabled={busy || !periksaHasil?.siap_import}>Import</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* Import bertahap (file besar): baca di browser, kirim per potongan */}
      <ImportBertahapDialog open={bertahapOpen} onOpenChange={setBertahapOpen} onSelesai={() => void muatUlang()} />
    </div>
  );
}
