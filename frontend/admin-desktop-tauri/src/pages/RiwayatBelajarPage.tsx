import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { errorMessage } from '../api/client';
import {
  batalSalinMassal,
  listRiwayatBelajar,
  ringkasanPindahGenap,
  salinGenapMassal,
  type RingkasanPindahGenap,
  type RiwayatRow,
} from '../api/siklus';
import { daftarSemester } from '../api/semesterAktif';
import { listKelas, listTahunAjaran, type Kelas } from '../api/master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { useFilterGlobalAktif } from '@/hooks/useFilterGlobalAktif';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import { TopBarSearch } from '@/components/TopBarSearch';
import FilterField from '@/components/FilterField';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import Pager from '@/components/Pager';
import { useDaftarTabel } from '@/hooks/useDaftarTabel';
import { ResizableAutoHidePanel, ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import ImportBertahapDialog from '@/components/ImportBertahapDialog';
import { FileUp } from '@/icons';
import { noopCommit } from '@/components/siklus/bersama';
import { formatStatus } from '@/lib/nilaiTampil';
import { toast } from 'sonner';
import { useAksiProfilSantri } from '@/components/santri/useAksiProfilSantri';

const FIELDS_RIWAYAT: ExcelField[] = [
  { key: 'nama_lengkap', label: 'nama_lengkap', width: 200, kind: 'static', sumber: { tabel: 'santri', kolom: 'nama_lengkap' } },
  { key: 'kelas', label: 'kelas', width: 140, kind: 'static', sumber: { tabel: 'kelas', kolom: 'nama_kelas' } },
  { key: 'status_awal', label: 'status_awal', width: 130, kind: 'static', sumber: { tabel: 'riwayat_belajar', kolom: 'status_awal' } },
  { key: 'status_akhir', label: 'status_akhir', width: 130, kind: 'static', sumber: { tabel: 'riwayat_belajar', kolom: 'status_akhir' } },
  { key: 'is_active_riwayat', label: 'AKTIF', width: 130, kind: 'static', sumber: { tabel: 'riwayat_belajar', kolom: 'is_active_riwayat' } },
];

function riwayatBelajarValues(r: RiwayatRow): Record<string, string | null> {
  return {
    nama_lengkap: r.santri?.nama_lengkap ?? String(r.santri_id),
    kelas: r.kelas?.nama_kelas ?? '—',
    status_awal: formatStatus(r.status_awal),
    status_akhir: formatStatus(r.status_akhir),
    is_active_riwayat: r.is_active_riwayat,
  };
}


export default function RiwayatBelajarPage() {
  const { user } = useAuth();
  const canTambah = bisa(user, 'riwayat_belajar.tambah');
  const canPindah = bisa(user, 'kenaikan.ubah');
  const [keaktifan, setKeaktifan] = useState<'aktif' | 'nonaktif' | 'semua'>('semua');
  const filterRiwayatAktif = keaktifan;
  const [cari, setCari] = useState('');
  const { aksiProfil, dialogProfil } = useAksiProfilSantri();
  const [pindahOpen, setPindahOpen] = useState(false);
  const [pindahBusy, setPindahBusy] = useState(false);
  const [ringkasanPindah, setRingkasanPindah] = useState<RingkasanPindahGenap | null>(null);
  const [ringkasanPindahLoading, setRingkasanPindahLoading] = useState(false);
  const [ringkasanPindahError, setRingkasanPindahError] = useState('');
  const [batalOpen, setBatalOpen] = useState(false);
  const [batalBusy, setBatalBusy] = useState(false);
  const [bertahapOpen, setBertahapOpen] = useState(false);
  const [tglMasuk, setTglMasuk] = useState(() => {
    const now = new Date();
    const lokal = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return lokal.toISOString().slice(0, 10);
  });
  const {
    jenjangs,
    tahunAjaranNames,
    tingkat: tingkatFilter,
    kelas: kelasFilter,
    loading: filterLoading,
  } = useFilterGlobalAktif();
  const [kelasOpsi, setKelasOpsi] = useState<Kelas[]>([]);
  const [konteksPindah, setKonteksPindah] = useState<{
    tahun: Record<string, string | null>;
    semester: Record<string, string | null>;
  }>({ tahun: {}, semester: {} });
  const [konteksPindahLoading, setKonteksPindahLoading] = useState(false);
  const kelasFilterIds = useMemo(
    () => kelasOpsi.filter((k) => kelasFilter.includes(k.nama_kelas)).map((k) => k.id),
    [kelasOpsi, kelasFilter],
  );

  useEffect(() => {
    if (filterLoading) {
      setKelasOpsi([]);
      return;
    }
    let hidup = true;
    listKelas({ jenjang: jenjangs, tahun_ajaran: tahunAjaranNames, per_page: 1000 })
      .then((p) => { if (hidup) setKelasOpsi(p.data); })
      .catch(() => { if (hidup) setKelasOpsi([]); });
    return () => { hidup = false; };
  }, [filterLoading, jenjangs, tahunAjaranNames]);

  useEffect(() => {
    if (filterLoading || jenjangs.length === 0) {
      setKonteksPindah({ tahun: {}, semester: {} });
      setKonteksPindahLoading(false);
      return;
    }
    let hidup = true;
    setKonteksPindahLoading(true);
    Promise.all([
      daftarSemester(),
      ...jenjangs.map((jenjang) => listTahunAjaran({ jenjang, per_page: 1000 })),
    ]).then(([semester, ...tahun]) => {
      if (!hidup) return;
      const semesterMap: Record<string, string | null> = {};
      for (const item of semester.data) semesterMap[item.jenjang] = item.semester;
      const tahunMap: Record<string, string | null> = {};
      jenjangs.forEach((jenjang, index) => {
        tahunMap[jenjang] = tahun[index]?.data.find((item) => item.is_aktif)?.nama ?? null;
      });
      setKonteksPindah({ tahun: tahunMap, semester: semesterMap });
    }).catch(() => {
      if (hidup) setKonteksPindah({ tahun: {}, semester: {} });
    }).finally(() => {
      if (hidup) setKonteksPindahLoading(false);
    });
    return () => { hidup = false; };
  }, [filterLoading, jenjangs]);

  const kiri = useDaftarTabel<RiwayatRow>({
    tableKey: 'riwayat_belum_masuk',
    search: cari,
    ambil: (a) => {
      if (filterLoading) {
        return Promise.resolve({ data: [], current_page: 1, last_page: 1, per_page: a.perPage, total: 0 });
      }
      return listRiwayatBelajar({
        jenjang: jenjangs,
        tahun_ajaran: tahunAjaranNames,
        semester: '1',
        tingkat: tingkatFilter,
        kelas_id: kelasFilterIds.length ? kelasFilterIds : undefined,
        keaktifan: filterRiwayatAktif,
        q: a.search || undefined,
        sort: a.urut.length ? a.urut : undefined,
        arah: a.urut.length ? a.arah : undefined,
        page: a.page,
        per_page: a.perPage,
        signal: a.signal,
      });
    },
     deps: [filterLoading, jenjangs, tahunAjaranNames, tingkatFilter, kelasFilterIds, filterRiwayatAktif],
  });

  const kanan = useDaftarTabel<RiwayatRow>({
    tableKey: 'riwayat_belajar',
    search: cari,
    ambil: (a) => {
      if (filterLoading) {
        return Promise.resolve({ data: [], current_page: 1, last_page: 1, per_page: a.perPage, total: 0 });
      }
      return listRiwayatBelajar({
        jenjang: jenjangs,
        tahun_ajaran: tahunAjaranNames,
        semester: '2',
        tingkat: tingkatFilter,
        kelas_id: kelasFilterIds.length ? kelasFilterIds : undefined,
        keaktifan: filterRiwayatAktif,
        q: a.search || undefined,
        sort: a.urut.length ? a.urut : undefined,
        arah: a.urut.length ? a.arah : undefined,
        page: a.page,
        per_page: a.perPage,
        signal: a.signal,
      });
    },
     deps: [filterLoading, jenjangs, tahunAjaranNames, tingkatFilter, kelasFilterIds, filterRiwayatAktif],
  });

  const muatUlang = useCallback(async () => {
    await Promise.all([kiri.load(kiri.pager.page), kanan.load(kanan.pager.page)]);
  }, [kiri, kanan]);

  /** Urutan tiap tabel asal untuk navigasi tetangga pada dialog profil. */
  const daftarGanjil = useMemo(() => kiri.rows.map((r) => r.santri_id), [kiri.rows]);
  const daftarGenap = useMemo(() => kanan.rows.map((r) => r.santri_id), [kanan.rows]);

  const targetJenjang = jenjangs.length === 1 ? jenjangs[0] : null;
  const targetTahunAjaran = tahunAjaranNames.length === 1 ? tahunAjaranNames[0] : null;
  const pindahAktif = Boolean(
    canPindah
    && !konteksPindahLoading
    && targetJenjang
    && targetTahunAjaran
    && konteksPindah.tahun[targetJenjang] === targetTahunAjaran
    && konteksPindah.semester[targetJenjang] === '1',
  );

  const batalAktif = Boolean(
    canPindah
    && !konteksPindahLoading
    && targetJenjang
    && targetTahunAjaran
    && konteksPindah.tahun[targetJenjang] === targetTahunAjaran,
  );

  const bukaPindah = useCallback(async () => {
    if (!pindahAktif || !targetJenjang || !targetTahunAjaran) return;
    setPindahOpen(true);
    setRingkasanPindah(null);
    setRingkasanPindahError('');
    setRingkasanPindahLoading(true);
    try {
      const res = await ringkasanPindahGenap({
        jenjang: targetJenjang,
        tahun_ajaran: targetTahunAjaran,
        q: cari || undefined,
      });
      setRingkasanPindah(res.data);
    } catch (e) {
      setRingkasanPindahError(errorMessage(e));
    } finally {
      setRingkasanPindahLoading(false);
    }
  }, [pindahAktif, targetJenjang, targetTahunAjaran, cari]);

  const pindahkan = useCallback(async () => {
    if (!pindahAktif || !targetJenjang || !targetTahunAjaran || pindahBusy || !ringkasanPindah || ringkasanPindah.aktif === 0) return;
    if (!tglMasuk) {
      toast.error('Isi tanggal masuk semester 2 dulu.');
      return;
    }
    setPindahBusy(true);
    try {
      const res = await salinGenapMassal({
        jenjang: targetJenjang,
        tanggal_masuk: tglMasuk,
        konteks_aktif: true,
        tahun_ajaran: targetTahunAjaran,
        q: cari || undefined,
      });
      if (res.gagal.length > 0) {
        toast.error(`${res.berhasil} berhasil, ${res.gagal.length} gagal: ${res.gagal[0]?.pesan ?? 'Data tidak dapat dipindahkan.'}`);
      } else {
        toast.success(`${res.berhasil} siswa dipindahkan ke semester 2.`);
      }
      setPindahOpen(false);
      await muatUlang();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPindahBusy(false);
    }
  }, [pindahAktif, targetJenjang, targetTahunAjaran, pindahBusy, ringkasanPindah, tglMasuk, cari, muatUlang]);

  const batalkan = useCallback(async () => {
    if (!batalAktif || !targetJenjang || !targetTahunAjaran || batalBusy) return;
    setBatalBusy(true);
    try {
      const res = await batalSalinMassal({
        jenjang: targetJenjang,
        tahun_ajaran: targetTahunAjaran,
        tingkat: tingkatFilter,
        kelas_id: kelasFilterIds.length ? kelasFilterIds : undefined,
        q: cari || undefined,
      });
      if (res.gagal.length > 0) {
        toast.error(`${res.berhasil} berhasil, ${res.gagal.length} gagal: ${res.gagal[0]?.pesan ?? 'Data tidak dapat dibatalkan.'}`);
      } else {
        toast.success(`${res.berhasil} siswa dikembalikan ke semester 1.`);
      }
      setBatalOpen(false);
      await muatUlang();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBatalBusy(false);
    }
  }, [batalAktif, targetJenjang, targetTahunAjaran, batalBusy, tingkatFilter, kelasFilterIds, cari, muatUlang]);

  const siap = !filterLoading;

  function ubahKeaktifan(value: string) {
    setKeaktifan(value as 'aktif' | 'nonaktif' | 'semua');
    kiri.pager.goFirst();
    kanan.pager.goFirst();
    setPindahOpen(false);
  }

  const panel = (tabel: ReactNode, pagerNode: ReactNode) => (
    <section className="flex h-full min-h-0 min-w-0 flex-col rounded-md">
      <div className="flex min-h-0 flex-1 flex-col pb-0">
        {tabel}
        {pagerNode}
      </div>
    </section>
  );

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{kiri.err || kanan.err}</ErrorNotice>
      <TopBarSearch value={cari} onChange={setCari} placeholder="Cari santri…" />
      <PengaturanHalaman tampil={{ tingkat: true, kelas: true }} tabel={[{ key: 'riwayat_belum_masuk', judul: 'Semester Ganjil', fields: FIELDS_RIWAYAT }, { key: 'riwayat_belajar', judul: 'Semester Genap', fields: FIELDS_RIWAYAT }]} />
      {!siap ? (
        <p className="text-sm text-muted-foreground">Pilih lembaga dan tahun ajaran di topbar dulu untuk memuat kedua tabel.</p>
      ) : (
         <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1" id="grup_riwayat_belajar">
           <ResizableAutoHidePanel id="panel_riwayat_ganjil" defaultSize="50%" minSize="20%">
          {panel(
            <ExcelTable<RiwayatRow>
               tableKey="riwayat_belum_masuk"
                 header={<span>Semester Ganjil</span>}
                 filter={(
                   <FilterField label="Keaktifan" htmlFor="select_keaktifan_riwayat_belajar">
                     <Select value={keaktifan} onValueChange={ubahKeaktifan}>
                       <SelectTrigger id="select_keaktifan_riwayat_belajar" title="Filter status akhir" aria-label="Filter keaktifan" size="sm">
                         <SelectValue />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectGroup>
                           <SelectItem value="semua">Semua</SelectItem>
                           <SelectItem value="aktif">Aktif</SelectItem>
                           <SelectItem value="nonaktif">Tidak aktif</SelectItem>
                         </SelectGroup>
                       </SelectContent>
                     </Select>
                   </FilterField>
                 )}
                 addButton={canPindah ? (
                   <Button
                     id="btn_pindah_semester_riwayat"
                     size="sm"
                     disabled={!pindahAktif || pindahBusy || ringkasanPindahLoading}
                     title={!pindahAktif ? 'Pindah hanya aktif pada tahun ajaran aktif dan semester aktif Ganjil.' : 'Pindahkan semua data aktif pada filter ini'}
                     onClick={() => void bukaPindah()}
                   >
                     Salin ke Genap
                   </Button>
                 ) : undefined}
                fields={FIELDS_RIWAYAT}
               rows={kiri.rows}
               getValues={riwayatBelajarValues}
               loading={kiri.loading}
               emptyText="Tidak ada data semester ganjil."
               canEdit={false}
               hideCheckbox
               hideActions
               hidePreset
               onCommit={noopCommit}
               onSaved={noopCommit}
               renderActions={(r) => aksiProfil(r.santri_id, { prefix: 'ganjil', daftar: daftarGanjil })}
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
           </ResizableAutoHidePanel>
           <ResizableHandle orientation="horizontal" withHandle id="gagang_riwayat_belajar" />
           <ResizablePanel id="panel_riwayat_genap" defaultSize="50%" minSize="20%">
           {panel(
            <ExcelTable<RiwayatRow>
               tableKey="riwayat_belajar"
                 header={<span>Semester Genap</span>}
               addButton={canPindah || canTambah ? (
                 <>
                   {canPindah ? (
                     <Button
                       id="btn_batal_semester_riwayat"
                       size="sm"
                       variant="outline"
                       disabled={!batalAktif || batalBusy}
                       title={!batalAktif ? 'Batal hanya tersedia pada tahun ajaran aktif.' : 'Batalkan pemindahan semester 2 pada filter ini'}
                       onClick={() => setBatalOpen(true)}
                     >
                       Batal
                     </Button>
                   ) : null}
                   {canTambah ? (
                     <Button
                       id="btn_buka_import_bertahap"
                       size="sm"
                       variant="outline"
                       title="Untuk file besar (puluhan hingga ratusan ribu baris)"
                       onClick={() => setBertahapOpen(true)}
                     >
                       <FileUp data-icon="inline-start" size={16} /> Import bertahap
                     </Button>
                   ) : null}
                 </>
               ) : undefined}
               fields={FIELDS_RIWAYAT}
               rows={kanan.rows}
               getValues={riwayatBelajarValues}
               loading={kanan.loading}
               emptyText="Tidak ada data semester genap."
               canEdit={false}
               hideCheckbox
               hideActions
               hidePreset
               onCommit={noopCommit}
               onSaved={noopCommit}
               renderActions={(r) => aksiProfil(r.santri_id, { prefix: 'genap', daftar: daftarGenap })}
            />,
            <Pager
              page={kanan.pager.page}
               lastPage={kanan.lastPage}
              total={kanan.total}
              perPage={kanan.pager.perPage}
              onPage={(p) => { kanan.pager.setPage(p); void kanan.load(p); }}
               onPerPage={(pp) => { kanan.pager.setPerPage(pp); void kanan.load(1, pp); }}
              />,
            )}
           </ResizablePanel>
         </ResizablePanelGroup>
      )}

      <Dialog open={pindahOpen} onOpenChange={setPindahOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pindah ke semester 2</DialogTitle>
            <DialogDescription>Semua data Semester 1 dengan status akhir selain Pindah/Keluar pada filter halaman akan dipindahkan. Data Semester 1 diarsipkan dan dibuatkan baris Semester 2 pada tahun ajaran yang sama.</DialogDescription>
          </DialogHeader>
          {ringkasanPindahLoading ? (
            <p className="text-sm text-muted-foreground">Memuat ringkasan siswa…</p>
          ) : ringkasanPindahError ? (
            <p className="text-sm text-destructive">{ringkasanPindahError}</p>
          ) : ringkasanPindah ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Santri aktif</p>
                  <p className="text-2xl font-semibold">{ringkasanPindah.aktif}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Santri tidak aktif</p>
                  <p className="text-2xl font-semibold">{ringkasanPindah.tidak_aktif}</p>
                </div>
              </div>
              {ringkasanPindah.nama_tidak_aktif.length > 0 ? (
                <div className="rounded-md border p-3">
                  <p className="mb-2 text-sm font-medium">Nama siswa tidak aktif</p>
                  <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-muted-foreground">
                    {ringkasanPindah.nama_tidak_aktif.map((nama, index) => <li key={`${nama}-${index}`}>{nama}</li>)}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
          <form onSubmit={(e) => { e.preventDefault(); void pindahkan(); }}>
            <FilterField label="Tanggal masuk semester 2" htmlFor="input_tgl_masuk_pindah_riwayat">
              <Input
                id="input_tgl_masuk_pindah_riwayat"
                type="date"
                title="Tanggal masuk semester 2"
                aria-label="Tanggal masuk semester 2"
                value={tglMasuk}
                onChange={(e) => setTglMasuk(e.target.value)}
                required
              />
            </FilterField>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setPindahOpen(false)}>Batal</Button>
              <Button id="btn_konfirmasi_pindah_semester_riwayat" type="submit" disabled={!pindahAktif || !tglMasuk || pindahBusy || ringkasanPindahLoading || !ringkasanPindah || ringkasanPindah.aktif === 0}>
                {pindahBusy ? 'Memindahkan…' : 'Pindahkan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={batalOpen} onOpenChange={setBatalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Batalkan pemindahan semester</DialogTitle>
            <DialogDescription>Semua data Semester 2 aktif pada tahun ajaran aktif dan filter halaman akan dihapus, lalu data Semester 1 dipulihkan.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBatalOpen(false)}>Kembali</Button>
            <Button id="btn_konfirmasi_batal_semester_riwayat" variant="destructive" disabled={!batalAktif || batalBusy} onClick={() => void batalkan()}>
              {batalBusy ? 'Membatalkan…' : 'Batalkan Pemindahan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportBertahapDialog open={bertahapOpen} onOpenChange={setBertahapOpen} onSelesai={() => void muatUlang()} />
      {dialogProfil}
    </div>
  );
}
