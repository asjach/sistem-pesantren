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
import { listKelas, type Kelas } from '../api/master';
import type { ImportPeriksa, LembagaSantri } from '../api/santri';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import FilterField from '@/components/FilterField';
import { useLembagaAwalString } from '@/hooks/useLembagaAwal';
import { useTahunAjaranAwalString } from '@/hooks/useTahunAjaranAwal';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import Pager from '@/components/Pager';
import { useDaftarTabel } from '@/hooks/useDaftarTabel';
import { ActionIcon, DeleteAction } from '@/components/RowActions';
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
  const [kelasId, setKelasId] = useState('');
  const [kelasOpsi, setKelasOpsi] = useState<Kelas[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);

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
  }, [lembagaId, taId]);

  const muatUlang = useCallback(async () => {
    await Promise.all([kiri.load(kiri.pager.page), kanan.load(kanan.pager.page)]);
  }, [kiri, kanan]);

  const masukkan = useCallback(async (r: LembagaSantri) => {
    if (busyId !== null || !lembagaId || !taId) return;
    setBusyId(r.id);
    try {
      await createRiwayatBelajar({
        santri_id: r.santri_id,
        lembaga_id: Number(lembagaId),
        tahun_ajaran_id: Number(taId),
      });
      toast.success('Santri dimasukkan ke riwayat ganjil.');
      await muatUlang();
    } catch (e) {
      toast.error(errorMessage(e));
      await muatUlang();
    } finally {
      setBusyId(null);
    }
  }, [busyId, lembagaId, taId, muatUlang]);

  const batalkan = useCallback(async (r: RiwayatRow) => {
    try {
      await batalRiwayat(r.id);
      toast.success('Riwayat dibatalkan.');
      await muatUlang();
    } catch (e) { toast.error(errorMessage(e)); }
  }, [muatUlang]);

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
      {!siap ? (
        <p className="text-sm text-muted-foreground">Pilih lembaga dan tahun ajaran aktif di bilah atas dulu.</p>
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
              hideCheckbox
              renderActions={(r) => (
                canTambah ? (
                  <ActionIcon
                    id={`btn_masuk_riwayat_${r.id}`}
                    title="Masukkan ke riwayat ganjil"
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
              hideCheckbox
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
              urutAktif={kanan.urut}
              arahUrut={kanan.arahUrut}
              onUrut={kanan.terapkanUrut}
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
            <div className="px-2 pt-2">
              <FilterField label="Kelas" htmlFor="select_kelas_riwayat_belajar">
                <Select value={kelasId === '' ? '_semua' : kelasId} onValueChange={(v) => { setKelasId(v === '_semua' ? '' : v); kanan.pager.goFirst(); }}>
                  <SelectTrigger id="select_kelas_riwayat_belajar" title="Filter kelas" aria-label="Filter kelas" size="sm" className="w-40">
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
            </div>,
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
