import { useCallback, useEffect, useMemo, useState } from 'react';
import { errorMessage } from '../api/client';
import { referensiList } from '../api/master';
import {
  aktifkanPenempatan,
  hapusPenempatanPegawai,
  listPegawai,
  listPenempatanPegawai,
  nonaktifkanPenempatan,
  tempatkanPegawai,
  updatePenempatanPegawai,
  type LembagaPegawai,
  type Pegawai,
} from '../api/pegawai';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { useDaftarTabel } from '@/hooks/useDaftarTabel';
import { useFilterGlobalAktif } from '@/hooks/useFilterGlobalAktif';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import { TopBarSearch } from '@/components/TopBarSearch';
import { ResizableAutoHidePanel, ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { ActionIcon, DeleteAction } from '@/components/RowActions';
import { ArrowRight, Trash2 } from '@/icons';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { toast } from 'sonner';

const FIELDS_KIRI: ExcelField[] = [
  { key: 'nama_lengkap', label: 'pegawai.nama_lengkap', width: 220, kind: 'static', sumber: { tabel: 'pegawai', kolom: 'nama_lengkap' } },
  { key: 'nip', label: 'pegawai.nip', width: 180, kind: 'static', sumber: { tabel: 'pegawai', kolom: 'nip' } },
];

function nilaiKiri(p: Pegawai): Record<string, string | null> {
  return { nama_lengkap: p.nama_lengkap, nip: p.nip };
}

function nilaiKanan(r: LembagaPegawai): Record<string, string | null> {
  return {
    nama: r.pegawai?.nama_lengkap ?? '—',
    nipp: r.pegawai?.nipp ?? null,
    lembaga: r.lembaga?.jenjang ?? r.jenjang,
    tugas: r.tugas_utama,
    aktif: r.is_active_lembaga === 'Ya' ? 'ya' : 'tidak',
    tgl_masuk: r.tgl_masuk,
    no_sk_awal_ptk: r.no_sk_awal_ptk,
    tgl_sk_awal_ptk: r.tgl_sk_awal_ptk,
  };
}

/** Halaman Lembaga Pegawai: kiri = Buku Induk (aksi → tempatkan), kanan = penempatan di lembaga filter. */
export default function LembagaPegawaiPage() {
  const { user } = useAuth();
  const canUbah = bisa(user, 'pegawai.ubah');
  const canHapus = bisa(user, 'pegawai.hapus');
  const { jenjangs } = useFilterGlobalAktif();
  const [cari, setCari] = useState('');

  // Pilihan Tugas dari kamus referensi per lembaga (mengikuti filter global).
  const [tugasOpsi, setTugasOpsi] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    let hidup = true;
    referensiList('tugas_utama', jenjangs)
      .then((r) => {
        if (!hidup) return;
        const opsi = [...new Map(r.map((x) => [x.nama, x.nama])).keys()]
          .filter((n): n is string => !!n)
          .map((n) => ({ value: n, label: n }));
        setTugasOpsi(opsi);
      })
      .catch(() => { if (hidup) setTugasOpsi([]); });
    return () => { hidup = false; };
  }, [jenjangs]);

  // Halaman ini tanpa pagination: kedua tabel memuat seluruh baris sekaligus
  // (per_page=0) dan mengisi seluruh ruang vertikal panel masing-masing.
  const kiri = useDaftarTabel<Pegawai>({
    tableKey: 'pegawai',
    search: cari,
    ambil: (a) => listPegawai({
      q: a.search || undefined,
      sort: a.urut.length ? a.urut : undefined,
      arah: a.urut.length ? a.arah : undefined,
      page: 1,
      per_page: 0,
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
      page: 1,
      per_page: 0,
      signal: a.signal,
    }),
    deps: [jenjangs],
  });

  // Panel kiri = antrean penempatan: sembunyikan pegawai yang sudah masuk ke
  // lembaga pada filter global. Tanpa filter lembaga, tampil semua (lembaga
  // tujuan = toggle lembaga topbar) agar penempatan rangkap tetap bisa dilakukan.
  const idSudahMasuk = useMemo(
    () => new Set(kanan.rows.map((r) => r.pegawai_id)),
    [kanan.rows],
  );
  const kiriTampil = useMemo(
    () => (jenjangs.length > 0 ? kiri.rows.filter((p) => !idSudahMasuk.has(p.id)) : kiri.rows),
    [kiri.rows, idSudahMasuk, jenjangs],
  );
  const kiriKosongSemuaMasuk = jenjangs.length > 0 && kiri.rows.length > 0 && kiriTampil.length === 0;

  const [busy, setBusy] = useState(false);

  // Lempatkan langsung tanpa dialog: lembaga diambil dari toggle topbar.
  const onTempatkan = useCallback(async (p: Pegawai) => {    if (jenjangs.length !== 1) {
      toast.error('Pilih satu lembaga di topbar untuk menempatkan pegawai.');
      return;
    }
    setBusy(true);
    try {
      await tempatkanPegawai(p.id, { jenjang: jenjangs[0] });
      toast.success(`${p.nama_lengkap} ditempatkan ke ${jenjangs[0]}.`);
      await kanan.load(1);
      await kiri.load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [jenjangs, kanan, kiri]);

  const onHapus = useCallback(async (r: LembagaPegawai) => {
    try {
      await hapusPenempatanPegawai(r.id);
      toast.success('Penempatan dihapus.');
      await kanan.load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [kanan]);

  async function commitKanan(id: number, f: Record<string, string | null>) {
    // Toggle Aktif memakai endpoint khusus agar server yang menata tgl_selesai,
    // keaktifan TA berjalan, dan akses akun tertaut (nonaktifkan/aktifkan).
    if (f.aktif !== undefined) {
      if (f.aktif === 'ya') await aktifkanPenempatan(id);
      else await nonaktifkanPenempatan(id);
      return;
    }
    await updatePenempatanPegawai(id, {
      ...(f.tugas !== undefined ? { tugas_utama: f.tugas || null } : {}),
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
          title={`Tempatkan ke ${jenjangs.length === 1 ? jenjangs[0] : 'lembaga (pilih di topbar)'} (→)`}
          aria-label={`Tempatkan ${p.nama_lengkap} ke lembaga`}
          onClick={() => void onTempatkan(p)}
        >
          <ArrowRight size={16} />
        </ActionIcon>
      )}
    </>
  ), [canUbah, onTempatkan, jenjangs]);

  // Input bulk: tempatkan semua pegawai tercentang sekaligus ke lembaga topbar.
  const renderBulkKiri = useCallback((tercentang: Pegawai[], clear: () => void) => {
    if (!canUbah || jenjangs.length !== 1) return null;
    return (
      <Button
        id="btn_bulk_tempatkan_pegawai_penempatan"
        size="sm"
        variant="default"
        disabled={tercentang.length === 0 || busy}
        onClick={async () => {
          setBusy(true);
          let sukses = 0;
          const gagal: string[] = [];
          for (const p of tercentang) {
            try {
              await tempatkanPegawai(p.id, { jenjang: jenjangs[0] });
              sukses++;
            } catch (e) {
              gagal.push(p.nama_lengkap);
            }
          }
          clear();
          if (gagal.length === 0) {
            toast.success(`${sukses} pegawai ditempatkan ke ${jenjangs[0]}.`);
          } else {
            toast.error(`${gagal.length} gagal: ${gagal.join(', ')}`);
          }
          await kanan.load(1);
          await kiri.load();
          setBusy(false);
        }}
      >
        <ArrowRight size={14} />
        Tempatkan ({tercentang.length})
      </Button>
    );
  }, [canUbah, jenjangs, busy, kanan, kiri]);

  const fieldsKanan = useMemo<ExcelField[]>(() => [
    { key: 'nama', label: 'pegawai.nama_lengkap', width: 220, kind: 'static', sumber: { tabel: 'pegawai', kolom: 'nama_lengkap' } },
    { key: 'nipp', label: 'pegawai.nipp', width: 130, kind: 'static', sumber: { tabel: 'pegawai', kolom: 'nipp' } },
    { key: 'lembaga', label: 'lembaga.jenjang', width: 100, kind: 'static', sumber: { tabel: 'lembaga', kolom: 'jenjang' } },
    { key: 'tugas', label: 'Tugas', width: 160, kind: 'select', selectTanpaEdit: true, choices: tugasOpsi, sumber: { tabel: 'lembaga_pegawai', kolom: 'tugas_utama' } },
    { key: 'aktif', label: 'Aktif', width: 90, kind: 'toggle', sumber: { tabel: 'lembaga_pegawai', kolom: 'is_active_lembaga' } },
    { key: 'tgl_masuk', label: 'Tgl Masuk', width: 130, kind: 'text', maxLength: 10, sumber: { tabel: 'lembaga_pegawai', kolom: 'tgl_masuk' } },
    { key: 'no_sk_awal_ptk', label: 'No. SK Awal PTK', width: 180, kind: 'text', maxLength: 100, sumber: { tabel: 'lembaga_pegawai', kolom: 'no_sk_awal_ptk' } },
    { key: 'tgl_sk_awal_ptk', label: 'Tgl SK Awal PTK', width: 140, kind: 'text', maxLength: 10, sumber: { tabel: 'lembaga_pegawai', kolom: 'tgl_sk_awal_ptk' } },
  ], [tugasOpsi]);

  const renderKanan = useCallback((r: LembagaPegawai) => (
    <>
      {canHapus && (
        <DeleteAction
          id={`btn_hapus_tempat_${r.id}`}
          title="Hapus penempatan?"
          description={`${r.pegawai?.nama_lengkap ?? 'Pegawai'} di ${r.lembaga?.jenjang ?? r.jenjang} akan dihapus permanen beserta riwayat keaktifannya.`}
          onConfirm={() => onHapus(r)}
        />
      )}
    </>
  ), [canHapus, onHapus]);

  // Bulk delete penempatan: baris tercentang dilaporkan via onCheckedChange,
  // tombolnya hidup di hamburger aksi tabel kanan (setelah combobox Kolom).
  const [tercentangKanan, setTercentangKanan] = useState<LembagaPegawai[]>([]);
  const [bulkHapusOpen, setBulkHapusOpen] = useState(false);
  const [bulkHapusProses, setBulkHapusProses] = useState(false);

  const renderBulkHapusKanan = useCallback(() => {
    if (!canHapus) return null;
    return (
      <Button
        id="btn_bulk_hapus_tempat"
        size="sm"
        variant="destructive"
        disabled={tercentangKanan.length === 0 || bulkHapusProses}
        // Buka dialog async setelah menu hamburger tertutup: membuka AlertDialog
        // sinkron dari onSelect dropdown membuat konflik fokus portal Radix
        // (crash halaman blank).
        onClick={() => { setTimeout(() => setBulkHapusOpen(true), 0); }}
      >
        <Trash2 size={14} />
        Hapus ({tercentangKanan.length})
      </Button>
    );
  }, [canHapus, tercentangKanan.length, bulkHapusProses]);

  const jalankanBulkHapus = useCallback(async () => {
    setBulkHapusProses(true);
    let sukses = 0;
    const gagal: string[] = [];
    for (const r of tercentangKanan) {
      try {
        await hapusPenempatanPegawai(r.id);
        sukses++;
      } catch {
        gagal.push(r.pegawai?.nama_lengkap ?? `#${r.id}`);
      }
    }
    setBulkHapusOpen(false);
    setTercentangKanan([]);
    if (gagal.length === 0) {
      toast.success(`${sukses} penempatan dihapus.`);
    } else {
      toast.error(`${gagal.length} gagal: ${gagal.join(', ')}`);
    }
    await kanan.load(1);
    setBulkHapusProses(false);
  }, [tercentangKanan, kanan]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{kiri.err || kanan.err}</ErrorNotice>
      <PengaturanHalaman tampil={{ semester: false, tingkat: false }} tabel={[
        { key: 'pegawai', judul: 'Pegawai (sumber)', fields: FIELDS_KIRI },
        { key: 'pegawai_lembaga', judul: 'Penempatan', fields: fieldsKanan },
      ]} />
      <TopBarSearch value={cari} onChange={setCari} placeholder="Cari nama / NIP / NIPP…" />
      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1" id="grup_pegawai_kolom">
        <ResizableAutoHidePanel id="panel_pegawai_sumber" defaultSize="40%" minSize="20%" className="flex min-h-0 flex-col">
          <div className="flex h-full min-h-0 flex-col">
          <ExcelTable
            tableKey="pegawai"
            sumberTabel="pegawai"
            fields={FIELDS_KIRI}
            rows={kiriTampil}
            getValues={nilaiKiri}
            loading={kiri.loading}
            emptyText={kiriKosongSemuaMasuk ? 'Semua pegawai sudah masuk ke lembaga ini.' : 'Belum ada pegawai.'}
            canEdit={false}
            aksiLangsung
            onCommit={async () => {}}
            onSaved={kiri.onSaved}
            urutAktif={kiri.urut}
            arahUrut={kiri.arahUrut}
            onUrut={kiri.terapkanUrut}
            renderBulkActions={renderBulkKiri}
            renderActions={renderKiri}
          />
          </div>
        </ResizableAutoHidePanel>
        <ResizableHandle orientation="horizontal" withHandle id="gagang_pegawai_kolom" />
        <ResizablePanel defaultSize="60%" minSize="20%" className="flex min-h-0 flex-col">
          <div className="flex h-full min-h-0 flex-col">
          <ExcelTable
            tableKey="pegawai_lembaga"
            sumberTabel="lembaga_pegawai"
            fields={fieldsKanan}
            rows={kanan.rows}
            getValues={nilaiKanan}
            loading={kanan.loading}
            emptyText="Belum ada penempatan di lembaga ini."
            canEdit={canUbah}
            aksiLangsung
            onCommit={commitKanan}
            onSaved={kanan.onSaved}
            urutAktif={kanan.urut}
            arahUrut={kanan.arahUrut}
            onUrut={kanan.terapkanUrut}
            onCheckedChange={setTercentangKanan}
            addButton={renderBulkHapusKanan()}
            renderActions={renderKanan}
          />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
      <AlertDialog open={bulkHapusOpen} onOpenChange={setBulkHapusOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus {tercentangKanan.length} penempatan?</AlertDialogTitle>
            <AlertDialogDescription>
              Penempatan yang dihapus beserta riwayat keaktifannya tidak dapat dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkHapusProses}>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={bulkHapusProses}
              onClick={() => void jalankanBulkHapus()}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
