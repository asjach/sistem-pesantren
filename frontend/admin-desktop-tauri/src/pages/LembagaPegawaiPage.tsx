import { useCallback, useState } from 'react';
import { errorMessage } from '../api/client';
import {
  aktifkanPenempatan,
  listPegawai,
  listPenempatanPegawai,
  nonaktifkanPenempatan,
  tempatkanPegawai,
  updatePenempatanPegawai,
  type LembagaPegawai,
  type Pegawai,
} from '../api/pegawai';
import { listLembaga, type Lembaga } from '../api/master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import Pager from '@/components/Pager';
import { useDaftarTabel } from '@/hooks/useDaftarTabel';
import { targetTunggal, useFilterGlobalAktif } from '@/hooks/useFilterGlobalAktif';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import { TopBarSearch } from '@/components/TopBarSearch';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { ResizableAutoHidePanel, ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { ActionIcon } from '@/components/RowActions';
import { ArrowRight, X, RotateCcw } from '@/icons';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { toast } from 'sonner';
import { useEffect } from 'react';

const FIELDS_KIRI: ExcelField[] = [
  { key: 'nama_lengkap', label: 'pegawai.nama_lengkap', width: 220, kind: 'static', sumber: { tabel: 'pegawai', kolom: 'nama_lengkap' } },
  { key: 'nip', label: 'pegawai.nip', width: 180, kind: 'static', sumber: { tabel: 'pegawai', kolom: 'nip' } },
];

const FIELDS_KANAN: ExcelField[] = [
  { key: 'nama', label: 'pegawai.nama_lengkap', width: 220, kind: 'static', sumber: { tabel: 'pegawai', kolom: 'nama_lengkap' } },
  { key: 'nipp', label: 'NIPP', width: 130, kind: 'text', maxLength: 30, sumber: { tabel: 'lembaga_pegawai', kolom: 'nipp' } },
  { key: 'lembaga', label: 'lembaga.jenjang', width: 100, kind: 'static', sumber: { tabel: 'lembaga', kolom: 'jenjang' } },
  { key: 'tugas', label: 'Tugas', width: 160, kind: 'text', maxLength: 100, sumber: { tabel: 'lembaga_pegawai', kolom: 'tugas_utama' } },
  { key: 'aktif', label: 'Aktif', width: 90, kind: 'static', sumber: { tabel: 'lembaga_pegawai', kolom: 'is_active_lembaga' } },
  { key: 'tgl_masuk', label: 'Tgl Masuk', width: 130, kind: 'text', maxLength: 10, sumber: { tabel: 'lembaga_pegawai', kolom: 'tgl_masuk' } },
  { key: 'no_sk_awal_ptk', label: 'No. SK Awal PTK', width: 180, kind: 'text', maxLength: 100, sumber: { tabel: 'lembaga_pegawai', kolom: 'no_sk_awal_ptk' } },
  { key: 'tgl_sk_awal_ptk', label: 'Tgl SK Awal PTK', width: 140, kind: 'text', maxLength: 10, sumber: { tabel: 'lembaga_pegawai', kolom: 'tgl_sk_awal_ptk' } },
];

function nilaiKiri(p: Pegawai): Record<string, string | null> {
  return { nama_lengkap: p.nama_lengkap, nip: p.nip };
}

function nilaiKanan(r: LembagaPegawai): Record<string, string | null> {
  return {
    nama: r.pegawai?.nama_lengkap ?? '—',
    nipp: r.nipp,
    lembaga: r.lembaga?.jenjang ?? r.jenjang,
    tugas: r.tugas_utama,
    aktif: r.is_active_lembaga,
    tgl_masuk: r.tgl_masuk,
    no_sk_awal_ptk: r.no_sk_awal_ptk,
    tgl_sk_awal_ptk: r.tgl_sk_awal_ptk,
  };
}

/** Halaman Lembaga Pegawai: kiri = Buku Induk (aksi → tempatkan), kanan = penempatan di lembaga filter. */
export default function LembagaPegawaiPage() {
  const { user } = useAuth();
  const canUbah = bisa(user, 'pegawai.ubah');
  const { jenjangs } = useFilterGlobalAktif();
  const [cari, setCari] = useState('');
  const [lembagas, setLembagas] = useState<Lembaga[]>([]);

  const kiri = useDaftarTabel<Pegawai>({
    tableKey: 'pegawai',
    search: cari,
    ambil: (a) => listPegawai({
      q: a.search || undefined,
      sort: a.urut.length ? a.urut : undefined,
      arah: a.urut.length ? a.arah : undefined,
      page: a.page,
      per_page: a.perPage,
      signal: a.signal,
    }),
    deps: [],
  });

  const kanan = useDaftarTabel<LembagaPegawai>({
    tableKey: 'pegawai_lembaga',
    search: cari,
    ambil: (a) => listPenempatanPegawai({
      jenjang: jenjangs,
      q: a.search || undefined,
      sort: a.urut.length ? a.urut : undefined,
      arah: a.urut.length ? a.arah : undefined,
      page: a.page,
      per_page: a.perPage,
      signal: a.signal,
    }),
    deps: [jenjangs],
  });

  const [tempatRow, setTempatRow] = useState<Pegawai | null>(null);
  const [tLembaga, setTLembaga] = useState('');
  const [tNipp, setTNipp] = useState('');
  const [tTugas, setTTugas] = useState('Guru Pengampu');
  const [tMasuk, setTMasuk] = useState('');
  const [tNoSkPtk, setTNoSkPtk] = useState('');
  const [tTglSkPtk, setTTglSkPtk] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listLembaga({ per_page: 1000 }).then((p) => setLembagas(p.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const tunggal = targetTunggal(jenjangs);
    if (tunggal) setTLembaga(tunggal);
  }, [jenjangs]);

  const onTempatkan = useCallback(async () => {
    if (!tempatRow || !tLembaga) return;
    setBusy(true);
    try {
      await tempatkanPegawai(tempatRow.id, {
        jenjang: tLembaga,
        nipp: tNipp.trim() || null,
        tugas_utama: tTugas.trim() || 'Guru Pengampu',
        tgl_masuk: tMasuk || null,
        no_sk_awal_ptk: tNoSkPtk.trim() || null,
        tgl_sk_awal_ptk: tTglSkPtk || null,
      });
      toast.success('Pegawai ditempatkan.');
      setTempatRow(null);
      setTNipp('');
      setTNoSkPtk('');
      setTTglSkPtk('');
      await kanan.load(1);
      await kiri.load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [tempatRow, tLembaga, tNipp, tTugas, tMasuk, tNoSkPtk, tTglSkPtk, kanan, kiri]);

  const onNonaktif = useCallback(async (r: LembagaPegawai) => {
    try {
      await nonaktifkanPenempatan(r.id);
      toast.success('Penempatan dinonaktifkan.');
      await kanan.load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [kanan]);

  const onAktifkan = useCallback(async (r: LembagaPegawai) => {
    try {
      await aktifkanPenempatan(r.id);
      toast.success('Penempatan diaktifkan.');
      await kanan.load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [kanan]);

  async function commitKanan(id: number, f: Record<string, string | null>) {
    await updatePenempatanPegawai(id, {
      ...(f.nipp !== undefined ? { nipp: f.nipp || null } : {}),
      ...(f.tugas !== undefined ? { tugas_utama: f.tugas || 'Guru Pengampu' } : {}),
      ...(f.tgl_masuk !== undefined ? { tgl_masuk: f.tgl_masuk || null } : {}),
      ...(f.no_sk_awal_ptk !== undefined ? { no_sk_awal_ptk: f.no_sk_awal_ptk || null } : {}),
      ...(f.tgl_sk_awal_ptk !== undefined ? { tgl_sk_awal_ptk: f.tgl_sk_awal_ptk || null } : {}),
    });
  }

  const renderKiri = useCallback((p: Pegawai) => (
    <>
      {canUbah && (
        <ActionIcon
          id={`btn_tempatkan_pegawai_${p.id}`}
          title="Tempatkan ke lembaga (→)"
          aria-label={`Tempatkan ${p.nama_lengkap} ke lembaga`}
          onClick={() => setTempatRow(p)}
        >
          <ArrowRight size={16} />
        </ActionIcon>
      )}
    </>
  ), [canUbah]);

  const renderKanan = useCallback((r: LembagaPegawai) => (
    <>
      {canUbah && r.is_active_lembaga === 'Ya' && (
        <ActionIcon
          id={`btn_nonaktif_tempat_${r.id}`}
          title="Nonaktifkan penempatan"
          aria-label={`Nonaktifkan ${r.pegawai?.nama_lengkap}`}
          onClick={() => void onNonaktif(r)}
        >
          <X size={16} />
        </ActionIcon>
      )}
      {canUbah && r.is_active_lembaga !== 'Ya' && (
        <ActionIcon
          id={`btn_aktif_tempat_${r.id}`}
          title="Aktifkan lagi"
          aria-label={`Aktifkan ${r.pegawai?.nama_lengkap}`}
          onClick={() => void onAktifkan(r)}
        >
          <RotateCcw size={16} />
        </ActionIcon>
      )}
    </>
  ), [canUbah, onNonaktif, onAktifkan]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{kiri.err || kanan.err}</ErrorNotice>
      <PengaturanHalaman tampil={{ semester: false, tingkat: false }} tabel={[
        { key: 'pegawai', judul: 'Pegawai (sumber)', fields: FIELDS_KIRI },
        { key: 'pegawai_lembaga', judul: 'Penempatan', fields: FIELDS_KANAN },
      ]} />
      <TopBarSearch value={cari} onChange={setCari} placeholder="Cari nama / NIP / NIPP…" />
      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1" id="grup_pegawai_kolom">
        <ResizableAutoHidePanel id="panel_pegawai_sumber" defaultSize="40%" minSize="20%">
          <ExcelTable
            tableKey="pegawai"
            sumberTabel="pegawai"
            fields={FIELDS_KIRI}
            rows={kiri.rows}
            getValues={nilaiKiri}
            loading={kiri.loading}
            emptyText="Belum ada pegawai."
            canEdit={false}
            onCommit={async () => {}}
            onSaved={kiri.onSaved}
            urutAktif={kiri.urut}
            arahUrut={kiri.arahUrut}
            onUrut={kiri.terapkanUrut}
            renderActions={renderKiri}
          />
          <Pager page={kiri.pager.page} lastPage={kiri.lastPage} total={kiri.total} perPage={kiri.pager.perPage}
            onPage={(p) => { kiri.pager.setPage(p); kiri.load(p); }}
            onPerPage={(pp) => { kiri.pager.setPerPage(pp); kiri.load(1, pp); }} />
        </ResizableAutoHidePanel>
        <ResizableHandle orientation="horizontal" withHandle id="gagang_pegawai_kolom" />
        <ResizablePanel defaultSize="60%" minSize="20%">
          <ExcelTable
            tableKey="pegawai_lembaga"
            sumberTabel="lembaga_pegawai"
            fields={FIELDS_KANAN}
            rows={kanan.rows}
            getValues={nilaiKanan}
            loading={kanan.loading}
            emptyText="Belum ada penempatan di lembaga ini."
            canEdit={canUbah}
            onCommit={commitKanan}
            onSaved={kanan.onSaved}
            urutAktif={kanan.urut}
            arahUrut={kanan.arahUrut}
            onUrut={kanan.terapkanUrut}
            renderActions={renderKanan}
          />
          <Pager page={kanan.pager.page} lastPage={kanan.lastPage} total={kanan.total} perPage={kanan.pager.perPage}
            onPage={(p) => { kanan.pager.setPage(p); kanan.load(p); }}
            onPerPage={(pp) => { kanan.pager.setPerPage(pp); kanan.load(1, pp); }} />
        </ResizablePanel>
      </ResizablePanelGroup>
      <Dialog open={tempatRow !== null} onOpenChange={(o) => { if (!o) setTempatRow(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tempatkan: {tempatRow?.nama_lengkap}</DialogTitle>
            <DialogDescription>Input pegawai pesantren ke lembaga (satu baris per guru+lembaga).</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
            <FieldLabel htmlFor="select_tempat_lembaga">Lembaga</FieldLabel>
            <Select value={tLembaga} onValueChange={setTLembaga}>
              <SelectTrigger id="select_tempat_lembaga"><SelectValue placeholder="Pilih lembaga" /></SelectTrigger>
              <SelectContent><SelectGroup>
                {lembagas.map((l) => <SelectItem key={l.jenjang} value={l.jenjang}>{l.jenjang}</SelectItem>)}
              </SelectGroup></SelectContent>
            </Select>
            <FieldLabel htmlFor="input_tempat_nipp">NIPP</FieldLabel>
            <Input id="input_tempat_nipp" value={tNipp} onChange={(e) => setTNipp(e.target.value)} maxLength={30} placeholder="Nomor Induk Pegawai Pesantren" />
            <FieldLabel htmlFor="input_tempat_tugas">Tugas utama</FieldLabel>
            <Input id="input_tempat_tugas" value={tTugas} onChange={(e) => setTTugas(e.target.value)} maxLength={100} />
            <FieldLabel htmlFor="input_tempat_masuk">Tgl masuk</FieldLabel>
            <Input id="input_tempat_masuk" type="date" value={tMasuk} onChange={(e) => setTMasuk(e.target.value)} />
            <FieldLabel htmlFor="input_tempat_no_sk_ptk">No. SK awal PTK</FieldLabel>
            <Input id="input_tempat_no_sk_ptk" value={tNoSkPtk} onChange={(e) => setTNoSkPtk(e.target.value)} maxLength={100} placeholder="No. SK awal sebagai PTK" />
            <FieldLabel htmlFor="input_tempat_tgl_sk_ptk">Tgl SK awal PTK</FieldLabel>
            <Input id="input_tempat_tgl_sk_ptk" type="date" value={tTglSkPtk} onChange={(e) => setTTglSkPtk(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTempatRow(null)}>Batal</Button>
            <Button id="btn_eksekusi_tempatkan" disabled={!tLembaga || busy} onClick={() => void onTempatkan()}>Tempatkan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
