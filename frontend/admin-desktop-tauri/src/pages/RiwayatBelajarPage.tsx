import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { errorMessage } from '../api/client';
import {
  batalRiwayat,
  createRiwayatBelajar,
  importRiwayatBelajar,
  listBelumMasukRiwayat,
  listRiwayatBelajar,
  periksaImportRiwayatBelajar,
  unduhTemplateRiwayatBelajar,
  type RiwayatRow,
} from '../api/siklus';
import { listKelas, listLembaga, listTahunAjaran, type Kelas, type Lembaga, type TahunAjaran } from '../api/master';
import type { ImportPeriksa, LembagaSantri } from '../api/santri';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import FilterField from '@/components/FilterField';
import { useLembagaAwalString } from '@/hooks/useLembagaAwal';
import { useTahunAjaranAwalString } from '@/hooks/useTahunAjaranAwal';
import { useLembagaAktif } from '@/lembagaAktif';
import { useTahunAjaranAktif } from '@/tahunAjaranAktif';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import Pager from '@/components/Pager';
import { useDaftarTabel } from '@/hooks/useDaftarTabel';
import { ActionIcon, DeleteAction } from '@/components/RowActions';
import ConfirmDelete from '@/components/ConfirmDelete';
import { ArrowRight, FileUp, Download } from '@/icons';
import {
  ROSTER_FIELDS,
  noopCommit,
  riwayatValues,
} from '@/components/siklus/bersama';
import { toast } from 'sonner';

/** Kolom panel kiri: anggota aktif yang belum punya riwayat. */
const FIELDS_KIRI: ExcelField[] = [
  { key: 'nama', label: 'santri.nama_lengkap', width: 200, kind: 'static', sumber: { tabel: 'santri', kolom: 'nama_lengkap' } },
  { key: 'nis', label: 'nis_lokal', width: 110, kind: 'static', sumber: { tabel: 'lembaga_santri', kolom: 'nis_lokal' } },
  { key: 'jk', label: 'santri.jk', width: 70, kind: 'static', sumber: { tabel: 'santri', kolom: 'jk' } },
  { key: 'mulai', label: 'tgl_mulai', width: 110, kind: 'static', sumber: { tabel: 'lembaga_santri', kolom: 'tgl_mulai' } },
];

function belumMasukValues(r: LembagaSantri): Record<string, string | null> {
  return {
    nama: r.santri?.nama_lengkap ?? String(r.santri_id),
    nis: r.nis_lokal ?? null,
    jk: r.santri?.jk ?? null,
    mulai: r.tgl_mulai ? r.tgl_mulai.slice(0, 10) : null,
  };
}

/**
 * Riwayat Belajar khusus semester ganjil, dua panel sejajar:
 * kiri = anggota lembaga yang belum masuk riwayat (aksi panah masuk),
 * kanan = riwayat ganjil TA aktif (aksi batal = hard delete).
 */
export default function RiwayatBelajarPage() {
  const { user } = useAuth();
  const canTambah = bisa(user, 'riwayat_belajar.tambah');
  const canBatal = bisa(user, 'riwayat_belajar.hapus');
  const [lembagaId, setLembagaId] = useState('');
  useLembagaAwalString(setLembagaId);
  const [taId, setTaId] = useState('');
  useTahunAjaranAwalString(setTaId);
  /** Topbar kosong (mis. mode "Semua lembaga") → pilih lokal di halaman. */
  const { lembagaId: lembagaTop } = useLembagaAktif();
  const { tahunAjaranId: taTop } = useTahunAjaranAktif();
  const [lembagaOpsi, setLembagaOpsi] = useState<Lembaga[]>([]);
  const [taOpsi, setTaOpsi] = useState<TahunAjaran[]>([]);

  useEffect(() => {
    if (lembagaTop != null) { setLembagaOpsi([]); return; }
    listLembaga({ per_page: 1000 })
      .then((p) => setLembagaOpsi(p.data.filter((l) => l.parent != null)))
      .catch(() => setLembagaOpsi([]));
  }, [lembagaTop]);

  useEffect(() => {
    if (taTop != null || !lembagaId) { setTaOpsi([]); return; }
    listTahunAjaran({ lembaga_id: Number(lembagaId), per_page: 1000 })
      .then((p) => setTaOpsi(p.data))
      .catch(() => setTaOpsi([]));
  }, [taTop, lembagaId]);
  const [kelasId, setKelasId] = useState('');
  const [kelasOpsi, setKelasOpsi] = useState<Kelas[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  /** Tgl masuk bawaan untuk aksi panah (toolbar panel kiri); default hari ini (lokal). */
  const [tglMasuk, setTglMasuk] = useState(() => {
    const now = new Date();
    const lokal = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return lokal.toISOString().slice(0, 10);
  });

  const kiri = useDaftarTabel<LembagaSantri>({
    tableKey: 'riwayat_belum_masuk',
    ambil: (a) => {
      if (!lembagaId || !taId) {
        return Promise.resolve({ data: [], current_page: 1, last_page: 1, per_page: a.perPage, total: 0 });
      }
      return listBelumMasukRiwayat({
        lembaga_id: Number(lembagaId),
        tahun_ajaran_id: Number(taId),
        q: a.search || undefined,
        page: a.page,
        per_page: a.perPage,
        signal: a.signal,
      });
    },
    deps: [lembagaId, taId],
  });

  const kanan = useDaftarTabel<RiwayatRow>({
    tableKey: 'riwayat_belajar',
    ambil: (a) => {
      if (!lembagaId || !taId) {
        return Promise.resolve({ data: [], current_page: 1, last_page: 1, per_page: a.perPage, total: 0 });
      }
      return listRiwayatBelajar({
        lembaga_id: Number(lembagaId),
        tahun_ajaran_id: Number(taId),
        semester: '1',
        kelas_id: kelasId ? Number(kelasId) : undefined,
        is_aktif: true,
        q: a.search || undefined,
        sort: a.urut.length ? a.urut : undefined,
        arah: a.urut.length ? a.arah : undefined,
        page: a.page,
        per_page: a.perPage,
        signal: a.signal,
      });
    },
    deps: [lembagaId, taId, kelasId],
  });

  useEffect(() => {
    if (!lembagaId || !taId) { setKelasOpsi([]); return; }
    listKelas({ lembaga_id: Number(lembagaId), tahun_ajaran_id: Number(taId), per_page: 1000 })
      .then((p) => setKelasOpsi(p.data))
      .catch(() => setKelasOpsi([]));
    setKelasId('');
  }, [lembagaId, taId]);

  const muatUlang = useCallback(async () => {
    await Promise.all([kiri.load(kiri.pager.page), kanan.load(kanan.pager.page)]);
  }, [kiri, kanan]);

  const masukkan = useCallback(async (r: LembagaSantri) => {
    if (busyId !== null || !lembagaId || !taId) return;
    if (!kelasId) {
      toast.error('Pilih kelas di toolbar tabel kanan dulu.');
      return;
    }
    setBusyId(r.id);
    try {
      const kelas = kelasOpsi.find((k) => String(k.id) === kelasId);
      await createRiwayatBelajar({
        santri_id: r.santri_id,
        lembaga_id: Number(lembagaId),
        tahun_ajaran_id: Number(taId),
        kelas_id: Number(kelasId),
        tingkat: kelas?.tingkat ?? null,
        tgl_masuk: tglMasuk || null,
      });
      toast.success('Santri dimasukkan ke riwayat ganjil.');
      await muatUlang();
    } catch (e) {
      toast.error(errorMessage(e));
      await muatUlang();
    } finally {
      setBusyId(null);
    }
  }, [busyId, lembagaId, taId, kelasId, kelasOpsi, tglMasuk, muatUlang]);

  const batalkan = useCallback(async (r: RiwayatRow) => {
    try {
      await batalRiwayat(r.id);
      toast.success('Riwayat dibatalkan.');
      await muatUlang();
    } catch (e) { toast.error(errorMessage(e)); }
  }, [muatUlang]);

  /** Aksi massal kiri: masukkan yang tercentang ke kelas terpilih. */
  const masukBanyak = useCallback(async (checked: LembagaSantri[], clear: () => void) => {
    if (bulkBusy || checked.length === 0 || !lembagaId || !taId) return;
    if (!kelasId) {
      toast.error('Pilih kelas di toolbar tabel kanan dulu.');
      return;
    }
    setBulkBusy(true);
    const kelas = kelasOpsi.find((k) => String(k.id) === kelasId);
    let ok = 0;
    const gagal: string[] = [];
    try {
      for (const r of checked) {
        try {
          await createRiwayatBelajar({
            santri_id: r.santri_id,
            lembaga_id: Number(lembagaId),
            tahun_ajaran_id: Number(taId),
            kelas_id: Number(kelasId),
            tingkat: kelas?.tingkat ?? null,
            tgl_masuk: tglMasuk || null,
          });
          ok++;
        } catch (e) {
          gagal.push(`${r.santri?.nama_lengkap ?? r.santri_id}: ${errorMessage(e)}`);
        }
      }
      if (gagal.length > 0) toast.error(`${ok} masuk, ${gagal.length} gagal: ${gagal.slice(0, 3).join(' · ')}${gagal.length > 3 ? ' …' : ''}`);
      else toast.success(`${ok} santri dimasukkan ke kelas.`);
      clear();
      await muatUlang();
    } finally {
      setBulkBusy(false);
    }
  }, [bulkBusy, lembagaId, taId, kelasId, kelasOpsi, tglMasuk, muatUlang]);

  /** Aksi massal kanan: batalkan yang tercentang (hard delete). */
  const batalBanyak = useCallback(async (checked: RiwayatRow[], clear: () => void) => {
    if (bulkBusy || checked.length === 0) return;
    setBulkBusy(true);
    let ok = 0;
    const gagal: string[] = [];
    try {
      for (const r of checked) {
        try {
          await batalRiwayat(r.id);
          ok++;
        } catch (e) {
          gagal.push(`${r.santri?.nama_lengkap ?? r.id}: ${errorMessage(e)}`);
        }
      }
      if (gagal.length > 0) toast.error(`${ok} dibatalkan, ${gagal.length} gagal: ${gagal.slice(0, 3).join(' · ')}${gagal.length > 3 ? ' …' : ''}`);
      else toast.success(`${ok} riwayat dibatalkan.`);
      clear();
      await muatUlang();
    } finally {
      setBulkBusy(false);
    }
  }, [bulkBusy, muatUlang]);

  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [periksaHasil, setPeriksaHasil] = useState<ImportPeriksa | null>(null);
  const [busy, setBusy] = useState(false);

  const siap = lembagaId !== '' && taId !== '';

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
      {(lembagaTop == null || taTop == null) && (
        <div className="mb-3 flex flex-wrap items-end gap-2">
          {lembagaTop == null && (
            <FilterField label="Lembaga" htmlFor="select_lembaga_riwayat_belajar">
              <Select value={lembagaId === '' ? '_kosong' : lembagaId} onValueChange={(v) => {
                const next = v === '_kosong' ? '' : v;
                setLembagaId(next);
                if (taTop == null) setTaId('');
                setKelasId('');
                kiri.pager.goFirst(); kanan.pager.goFirst();
              }}>
                <SelectTrigger id="select_lembaga_riwayat_belajar" title="Filter lembaga" aria-label="Filter lembaga" size="sm" className="w-44">
                  <SelectValue placeholder="Pilih lembaga" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="_kosong">Pilih lembaga</SelectItem>
                    {lembagaOpsi.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.kode ?? l.nama}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FilterField>
          )}
          {taTop == null && lembagaId !== '' && (
            <FilterField label="Tahun ajaran" htmlFor="select_ta_riwayat_belajar">
              <Select value={taId === '' ? '_kosong' : taId} onValueChange={(v) => {
                setTaId(v === '_kosong' ? '' : v);
                setKelasId('');
                kiri.pager.goFirst(); kanan.pager.goFirst();
              }}>
                <SelectTrigger id="select_ta_riwayat_belajar" title="Filter tahun ajaran" aria-label="Filter tahun ajaran" size="sm" className="w-44">
                  <SelectValue placeholder="Pilih tahun ajaran" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="_kosong">Pilih tahun ajaran</SelectItem>
                    {taOpsi.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.nama}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FilterField>
          )}
        </div>
      )}
      {!siap ? (
        <p className="text-sm text-muted-foreground">Pilih lembaga dan tahun ajaran dulu untuk memuat kedua tabel.</p>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fit,minmax(min(420px,100%),1fr))] gap-4">
          {panel(
            'belum',
            'Belum masuk riwayat',
            kiri.total,
            <ExcelTable<LembagaSantri>
              tableKey="riwayat_belum_masuk"
              fields={FIELDS_KIRI}
              rows={kiri.rows}
              getValues={belumMasukValues}
              loading={kiri.loading}
              emptyText="Semua anggota sudah masuk riwayat."
              canEdit={false}
              onCommit={noopCommit}
              onSaved={noopCommit}
              renderActions={(r) => (
                canTambah ? (
                  <ActionIcon
                    id={`btn_masuk_riwayat_${r.id}`}
                    title={kelasId ? 'Masukkan ke kelas terpilih' : 'Pilih kelas di tabel kanan dulu'}
                    disabled={kelasId === '' || busyId !== null}
                    onClick={() => void masukkan(r)}
                  >
                    <ArrowRight size={16} />
                  </ActionIcon>
                ) : null
              )}
              searchValue={kiri.search}
              onSearchChange={kiri.onSearchChange}
              onSearchSubmit={kiri.onSearchSubmit}
              searchPlaceholder="Nama / NIK / NIS lokal"
              searchIds={{ form: 'form_cari_belum_riwayat', input: 'input_cari_belum_riwayat', button: 'btn_cari_belum_riwayat' }}
              renderBulkActions={canTambah ? (checked, clear) => (
                <Button
                  id="btn_bulk_masuk_riwayat"
                  size="sm"
                  disabled={bulkBusy || !kelasId}
                  title={kelasId ? 'Masukkan yang tercentang ke kelas terpilih' : 'Pilih kelas di tabel kanan dulu'}
                  onClick={() => void masukBanyak(checked, clear)}
                >
                  Masuk ({checked.length})
                </Button>
              ) : undefined}
              akhirToolbar={(
                <FilterField label="Tgl masuk" htmlFor="input_tgl_masuk_belum_riwayat">
                  <Input
                    id="input_tgl_masuk_belum_riwayat"
                    type="date"
                    title="Tanggal masuk untuk aksi panah"
                    aria-label="Tanggal masuk untuk aksi panah"
                    className="w-36"
                    value={tglMasuk}
                    onChange={(e) => setTglMasuk(e.target.value)}
                  />
                </FilterField>
              )}
            />,
            <Pager
              page={kiri.pager.page}
              lastPage={kiri.lastPage}
              total={kiri.total}
              perPage={kiri.pager.perPage}
              onPage={(p) => { kiri.pager.setPage(p); void kiri.load(p); }}
              onPerPage={(pp) => { kiri.pager.setPerPage(pp); void kiri.load(1, pp); }}
            />,
          )}
          {panel(
            'ganjil',
            'Riwayat ganjil TA aktif',
            kanan.total,
            <ExcelTable<RiwayatRow>
              tableKey="riwayat_belajar"
              fields={ROSTER_FIELDS}
              rows={kanan.rows}
              getValues={riwayatValues}
              loading={kanan.loading}
              emptyText="Tidak ada riwayat ganjil pada filter ini."
              canEdit={false}
              onCommit={noopCommit}
              onSaved={noopCommit}
              renderActions={(r) => (
                canBatal ? (
                  <DeleteAction
                    id={`btn_batal_riwayat_${r.id}`}
                    title="Batalkan riwayat"
                    description={`Batalkan riwayat ganjil ${r.santri?.nama_lengkap ?? ''}? Baris dihapus permanen dan santri kembali ke panel kiri.`}
                    onConfirm={() => void batalkan(r)}
                  />
                ) : null
              )}
              searchValue={kanan.search}
              onSearchChange={kanan.onSearchChange}
              onSearchSubmit={kanan.onSearchSubmit}
              searchPlaceholder="Nama / NIK"
              searchIds={{ form: 'form_cari_riwayat_belajar', input: 'input_cari_riwayat_belajar', button: 'btn_cari_riwayat_belajar' }}
              renderBulkActions={canBatal ? (checked, clear) => (
                <ConfirmDelete
                  title={`Batalkan ${checked.length} riwayat?`}
                  description="Baris yang tercentang dihapus permanen dan santri kembali ke panel kiri."
                  onConfirm={() => void batalBanyak(checked, clear)}
                >
                  <Button
                    id="btn_bulk_batal_riwayat"
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    disabled={bulkBusy}
                    title="Batalkan yang tercentang (hapus permanen)"
                  >
                    Batalkan ({checked.length})
                  </Button>
                </ConfirmDelete>
              ) : undefined}
              urutAktif={kanan.urut}
              arahUrut={kanan.arahUrut}
              onUrut={kanan.terapkanUrut}
              filter={(
                <FilterField label="Kelas *" htmlFor="select_kelas_riwayat_belajar">
                  <Select value={kelasId === '' ? '_semua' : kelasId} onValueChange={(v) => { setKelasId(v === '_semua' ? '' : v); kanan.pager.goFirst(); }}>
                    <SelectTrigger id="select_kelas_riwayat_belajar" title="Filter tabel + kelas tujuan panah (wajib untuk memasukkan santri)" aria-label="Filter kelas" size="sm" className="w-40">
                      <SelectValue placeholder="Semua kelas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="_semua">Semua kelas</SelectItem>
                        {kelasOpsi.map((k) => <SelectItem key={k.id} value={String(k.id)}>{k.nama_kelas}</SelectItem>)}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </FilterField>
              )}
            />,
            <Pager
              page={kanan.pager.page}
              lastPage={kanan.lastPage}
              total={kanan.total}
              perPage={kanan.pager.perPage}
              onPage={(p) => { kanan.pager.setPage(p); void kanan.load(p); }}
              onPerPage={(pp) => { kanan.pager.setPerPage(pp); void kanan.load(1, pp); }}
            />,
            canTambah ? (
              <Button id="btn_buka_import_riwayat" size="sm" variant="outline" onClick={() => { setImportFile(null); setPeriksaHasil(null); setImportOpen(true); }}>
                <FileUp data-icon="inline-start" size={16} /> Import
              </Button>
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
            <DialogDescription>Kolom mengikuti tabel riwayat; kunci: NIK → fallback NIS lokal + lembaga.</DialogDescription>
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
    </div>
  );
}
