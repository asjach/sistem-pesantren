import { useCallback, useState } from 'react';
import { errorMessage } from '../api/client';
import {
  aktifkanMassalKeaktifan,
  batalPotongKeaktifan,
  dataKeaktifanExisting,
  hapusKeaktifanPegawai,
  importKeaktifanPotong,
  KOLOM_IMPORT_KEAKTIFAN,
  listKeaktifanPegawai,
  nonaktifkanKeaktifan,
  simpanKeaktifanPegawai,
  unduhGalatKeaktifan,
  unduhTemplateKeaktifan,
  type KeaktifanPegawai,
} from '../api/pegawai';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import Pager from '@/components/Pager';
import { useDaftarTabel } from '@/hooks/useDaftarTabel';
import { targetTunggal, useFilterGlobalAktif } from '@/hooks/useFilterGlobalAktif';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import { TopBarSearch } from '@/components/TopBarSearch';
import FilterField from '@/components/FilterField';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import CatatanProsesTahunAjaran from '@/components/CatatanProsesTahunAjaran';
import ImportBertahapUmumDialog from '@/components/ImportBertahapUmumDialog';
import { ActionIcon, DeleteAction } from '@/components/RowActions';
import { FileUp, Trash2, X } from '@/icons';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { toast } from 'sonner';

const FIELDS: ExcelField[] = [
  { key: 'nama', label: 'pegawai.nama_lengkap', width: 220, kind: 'static', sumber: { tabel: 'pegawai', kolom: 'nama_lengkap' } },
  { key: 'lembaga', label: 'lembaga.jenjang', width: 100, kind: 'static', sumber: { tabel: 'lembaga', kolom: 'jenjang' } },
  { key: 'ta', label: 'tahun_ajaran.nama', width: 130, kind: 'static', sumber: { tabel: 'tahun_ajaran', kolom: 'nama' } },
  { key: 'tugas', label: 'Tugas', width: 180, kind: 'static', sumber: { tabel: 'keaktifan_pegawai', kolom: 'tugas_utama' } },
  // Toggle langsung (tanpa Mode Edit): gerbang izin mengikuti `canEdit` tabel.
  { key: 'status', label: 'Status', width: 110, kind: 'toggle', sumber: { tabel: 'keaktifan_pegawai', kolom: 'status_keaktifan' } },
  { key: 'no_sk', label: 'No. SK', width: 180, kind: 'text', maxLength: 100, sumber: { tabel: 'keaktifan_pegawai', kolom: 'no_sk' } },
  { key: 'tgl_sk', label: 'Tgl SK', width: 130, kind: 'text', maxLength: 10, sumber: { tabel: 'keaktifan_pegawai', kolom: 'tgl_sk' } },
];

function nilaiBaris(r: KeaktifanPegawai): Record<string, string | null> {
  return {
    nama: r.pegawai?.nama_lengkap ?? '—',
    lembaga: r.lembaga?.jenjang ?? r.jenjang,
    ta: r.tahun_ajaran,
    tugas: r.tugas_utama,
    status: r.status_keaktifan === 'Ya' ? 'ya' : 'tidak',
    no_sk: r.no_sk,
    tgl_sk: r.tgl_sk,
  };
}

/** Halaman Keaktifan Pegawai: daftar guru aktif per lembaga + tahun ajaran. */
export default function KeaktifanPegawaiPage() {
  const { user } = useAuth();
  const canUbah = bisa(user, 'pegawai.ubah');
  const canHapus = bisa(user, 'pegawai.hapus');
  const { jenjangs, tahunAjaranNames } = useFilterGlobalAktif();
  const [cari, setCari] = useState('');
  const [status, setStatus] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const taTunggal = targetTunggal(tahunAjaranNames);
  const jenjangTunggal = targetTunggal(jenjangs);

  const { rows, loading, err, urut, arahUrut, terapkanUrut, load, lastPage, total, pager, onSaved } =
    useDaftarTabel<KeaktifanPegawai>({
      tableKey: 'pegawai_keaktifan',
      search: cari,
      ambil: (a) => {
        if (!taTunggal) {
          return Promise.resolve({ data: [], current_page: 1, last_page: 1, per_page: a.perPage, total: 0 });
        }
        return listKeaktifanPegawai({
          jenjang: jenjangs,
          tahun_ajaran: tahunAjaranNames,
          status_keaktifan: status || undefined,
          q: a.search || undefined,
          sort: a.urut.length ? a.urut : undefined,
          arah: a.urut.length ? a.arah : undefined,
          page: a.page,
          per_page: a.perPage,
          signal: a.signal,
        });
      },
      deps: [jenjangs, tahunAjaranNames, status],
    });

  const onAktifkanMassal = useCallback(async () => {
    if (!jenjangTunggal || !taTunggal) {
      toast.error('Pilih satu lembaga dan satu tahun ajaran di filter.');
      return;
    }
    try {
      const res = await aktifkanMassalKeaktifan({ jenjang: jenjangTunggal, tahun_ajaran: taTunggal });
      toast.success(res.pesan);
      pager.goFirst();
      await load(1);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [jenjangTunggal, taTunggal, pager, load]);

  const onNonaktif = useCallback(async (r: KeaktifanPegawai) => {
    try {
      await nonaktifkanKeaktifan(r.id);
      toast.success('Keaktifan dinonaktifkan.');
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [load]);

  /** Toggle Aktif: nyala → simpan status aktif; padam → nonaktifkan baris. */
  const onToggleStatus = useCallback(async (r: KeaktifanPegawai, aktif: boolean) => {
    if (aktif) {
      await simpanKeaktifanPegawai({
        pegawai_id: r.pegawai_id,
        jenjang: r.jenjang,
        tahun_ajaran: r.tahun_ajaran,
        status_keaktifan: 'Ya',
      });
    } else {
      await nonaktifkanKeaktifan(r.id);
    }
  }, []);

  const onHapus = useCallback(async (r: KeaktifanPegawai) => {
    try {
      await hapusKeaktifanPegawai(r.id);
      toast.success('Keaktifan dihapus.');
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [load]);

  async function commitBaris(id: number, f: Record<string, string | null>) {
    const baris = rows.find((r) => r.id === id);
    if (!baris) return;
    const ubahSk = f.no_sk !== undefined || f.tgl_sk !== undefined;
    if (ubahSk) {
      await simpanKeaktifanPegawai({
        pegawai_id: baris.pegawai_id,
        jenjang: baris.jenjang,
        tahun_ajaran: baris.tahun_ajaran,
        ...(f.no_sk !== undefined ? { no_sk: f.no_sk || null } : {}),
        ...(f.tgl_sk !== undefined ? { tgl_sk: f.tgl_sk || null } : {}),
        // Bila status ikut berubah dalam batch yang sama, kirim eksplisit —
        // endpoint store berstatus bawaan `aktif` sehingga tanpa ini toggle
        // padam akan tertimpa jadi aktif.
        ...(f.status !== undefined ? { status_keaktifan: f.status === 'ya' ? 'Ya' : 'Tidak' } : {}),
      });
      return;
    }
    if (f.status !== undefined) await onToggleStatus(baris, f.status === 'ya');
  }

  const renderActions = useCallback((r: KeaktifanPegawai) => (
    <>
      {canUbah && r.status_keaktifan === 'Ya' && (
        <ActionIcon
          id={`btn_nonaktif_keaktifan_${r.id}`}
          title="Nonaktifkan"
          aria-label={`Nonaktifkan ${r.pegawai?.nama_lengkap}`}
          onClick={() => void onNonaktif(r)}
        >
          <X size={16} />
        </ActionIcon>
      )}
      {canHapus && (
        <DeleteAction
          id={`btn_hapus_keaktifan_${r.id}`}
          title="Hapus riwayat keaktifan?"
          description={`${r.pegawai?.nama_lengkap ?? 'Pegawai'} — ${r.tahun_ajaran} akan dihapus permanen dari riwayat.`}
          onConfirm={() => onHapus(r)}
        />
      )}
    </>
  ), [canUbah, canHapus, onNonaktif, onHapus]);

  // Bulk hapus: baris tercentang dilaporkan via onCheckedChange, tombolnya
  // hidup di hamburger aksi tabel (addButton, setelah combobox Kolom).
  const [tercentang, setTercentang] = useState<KeaktifanPegawai[]>([]);
  const [bulkHapusOpen, setBulkHapusOpen] = useState(false);
  const [bulkHapusProses, setBulkHapusProses] = useState(false);

  const tombolBulkHapus = canHapus ? (
    <Button
      id="btn_bulk_hapus_keaktifan"
      size="sm"
      variant="destructive"
      disabled={tercentang.length === 0 || bulkHapusProses}
      // Buka dialog async setelah menu hamburger tertutup: membuka AlertDialog
      // sinkron dari onSelect dropdown membuat konflik fokus portal Radix
      // (crash halaman blank).
      onClick={() => { setTimeout(() => setBulkHapusOpen(true), 0); }}
    >
      <Trash2 size={14} />
      Hapus ({tercentang.length})
    </Button>
  ) : null;

  const jalankanBulkHapus = useCallback(async () => {
    setBulkHapusProses(true);
    let sukses = 0;
    const gagal: string[] = [];
    for (const r of tercentang) {
      try {
        await hapusKeaktifanPegawai(r.id);
        sukses++;
      } catch {
        gagal.push(r.pegawai?.nama_lengkap ?? `#${r.id}`);
      }
    }
    setBulkHapusOpen(false);
    setTercentang([]);
    if (gagal.length === 0) {
      toast.success(`${sukses} keaktifan dihapus.`);
    } else {
      toast.error(`${gagal.length} gagal: ${gagal.join(', ')}`);
    }
    pager.goFirst();
    await load(1);
    setBulkHapusProses(false);
  }, [tercentang, load, pager]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <PengaturanHalaman tampil={{ semester: false, tingkat: false }} tabel={[{ key: 'pegawai_keaktifan', judul: 'Keaktifan', fields: FIELDS }]} />
      <TopBarSearch value={cari} onChange={setCari} placeholder="Cari nama / NIP / NIPP / No. SK…" />
      {!taTunggal && <CatatanProsesTahunAjaran />}
      <ExcelTable
        tableKey="pegawai_keaktifan"
        sumberTabel="keaktifan_pegawai"
        fields={FIELDS}
        rows={rows}
        getValues={nilaiBaris}
        loading={loading}
        emptyText={taTunggal ? 'Belum ada guru aktif di TA ini.' : 'Pilih satu tahun ajaran di filter.'}
        canEdit={canUbah}
        onCommit={commitBaris}
        onSaved={onSaved}
        urutAktif={urut}
        arahUrut={arahUrut}
        onUrut={terapkanUrut}
        onCheckedChange={setTercentang}
        filter={
          <FilterField label="Status" htmlFor="select_status_keaktifan">
            <Select
              value={status === '' ? 'semua' : status}
              onValueChange={(v) => {
                setStatus(v === 'semua' ? '' : v);
                pager.goFirst();
              }}
            >
              <SelectTrigger id="select_status_keaktifan" title="Status keaktifan" aria-label="Status keaktifan" size="sm" className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="semua">Semua status</SelectItem>
                  <SelectItem value="Ya">Aktif</SelectItem>
                  <SelectItem value="Tidak">Inaktif</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </FilterField>
        }
        addButton={
          <>
            {canUbah && (
              <>
                <Button id="btn_aktifkan_massal_keaktifan" variant="outline" disabled={!jenjangTunggal || !taTunggal} onClick={() => void onAktifkanMassal()}>
                  Aktifkan penempatan untuk TA ini
                </Button>
                <Button id="btn_buka_import_keaktifan" variant="outline" title="Untuk file besar (puluhan hingga ratusan ribu baris)" onClick={() => setImportOpen(true)}>
                  <FileUp data-icon="inline-start" size={16} /> Import
                </Button>
              </>
            )}
            {tombolBulkHapus}
          </>
        }
        renderActions={renderActions}
      />
      <ImportBertahapUmumDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        config={{
          idPrefix: 'keaktifan',
          judul: 'Import keaktifan pegawai',
          deskripsi: 'Kolom wajib: jenjang + tahun_ajaran, plus identitas pegawai (pegawai_id / NIPP / nama unik). Baris hanya sah bila pegawai sudah ditempatkan di lembaga baris; tugas kosong mewarisi penempatan. Baris cocok diperbarui, hanya kolom terisi.',
          kolom: KOLOM_IMPORT_KEAKTIFAN,
          wajib: ['jenjang', 'tahun_ajaran'],
          idTombol: {
            template: 'btn_unduh_template_keaktifan',
            periksa: 'btn_periksa_import_keaktifan',
            mulai: 'btn_import_keaktifan',
          },
          labelTemplate: 'Unduh template Excel keaktifan',
          unduhTemplate: unduhTemplateKeaktifan,
          unduhData: {
            label: 'Unduh data keaktifan existing',
            ambil: dataKeaktifanExisting,
            namaBerkas: 'data-keaktifan-existing.xlsx',
            judulSheet: 'Data Keaktifan Pegawai',
          },
          kirim: ({ sesi_id, mode, total, baris, terakhir }) =>
            importKeaktifanPotong({
              ...(sesi_id === undefined ? {} : { sesi_id }),
              mode, ...(sesi_id === undefined ? { total } : {}), baris,
              ...(terakhir ? { terakhir } : {}),
            }),
          batal: batalPotongKeaktifan,
          unduhGalat: unduhGalatKeaktifan,
          onSelesai: () => {
            setImportOpen(false);
            pager.goFirst();
            void load(1);
          },
        }}
      />
      <AlertDialog open={bulkHapusOpen} onOpenChange={setBulkHapusOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus {tercentang.length} riwayat keaktifan?</AlertDialogTitle>
            <AlertDialogDescription>
              Riwayat keaktifan yang dihapus tidak dapat dikembalikan. Penempatan pegawai tidak ikut terhapus.
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
      <Pager
        page={pager.page}
        lastPage={lastPage}
        total={total}
        perPage={pager.perPage}
        onPage={(p) => { pager.setPage(p); load(p); }}
        onPerPage={(pp) => { pager.setPerPage(pp); load(1, pp); }}
      />
    </div>
  );
}
