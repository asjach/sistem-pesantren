import { useCallback, useState } from 'react';
import { errorMessage } from '../api/client';
import {
  KOLOM_IMPORT_PEGAWAI,
  batalPotongPegawai,
  createPegawai,
  dataPegawaiExisting,
  deletePegawai,
  importPegawaiPotong,
  listPegawai,
  tautkanAkunPegawai,
  unduhGalatPegawai,
  unduhTemplatePegawai,
  updatePegawai,
  type Pegawai,
} from '../api/pegawai';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import FilterField from '@/components/FilterField';
import Pager from '@/components/Pager';
import { useDaftarTabel } from '@/hooks/useDaftarTabel';
import { useFilterGlobalAktif } from '@/hooks/useFilterGlobalAktif';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import { TopBarSearch } from '@/components/TopBarSearch';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import ImportBertahapUmumDialog from '@/components/ImportBertahapUmumDialog';
import { DeleteAction, EditAction } from '@/components/RowActions';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { FileUp } from '@/icons';
import { toast } from 'sonner';

/** Seluruh kolom identitas Buku Induk Guru (cermin tabel `pegawai`). */
const FIELDS: ExcelField[] = [
  { key: 'nama_lengkap', label: 'pegawai.nama_lengkap', width: 220, kind: 'text', maxLength: 255, required: true, sumber: { tabel: 'pegawai', kolom: 'nama_lengkap' } },
  { key: 'nip', label: 'pegawai.nip', width: 190, kind: 'text', maxLength: 50, sumber: { tabel: 'pegawai', kolom: 'nip' } },
  { key: 'nik', label: 'pegawai.nik', width: 190, kind: 'text', maxLength: 20, sumber: { tabel: 'pegawai', kolom: 'nik' } },
  { key: 'jenis_kelamin', label: 'pegawai.jenis_kelamin', width: 90, kind: 'text', maxLength: 1, sumber: { tabel: 'pegawai', kolom: 'jenis_kelamin' } },
  { key: 'gelar_depan', label: 'pegawai.gelar_depan', width: 110, kind: 'text', maxLength: 50, sumber: { tabel: 'pegawai', kolom: 'gelar_depan' } },
  { key: 'gelar_belakang', label: 'pegawai.gelar_belakang', width: 110, kind: 'text', maxLength: 50, sumber: { tabel: 'pegawai', kolom: 'gelar_belakang' } },
  { key: 'tempat_lahir', label: 'pegawai.tempat_lahir', width: 150, kind: 'text', maxLength: 100, sumber: { tabel: 'pegawai', kolom: 'tempat_lahir' } },
  { key: 'tanggal_lahir', label: 'pegawai.tanggal_lahir', width: 130, kind: 'text', maxLength: 10, sumber: { tabel: 'pegawai', kolom: 'tanggal_lahir' } },
  { key: 'no_hp', label: 'pegawai.no_hp', width: 150, kind: 'text', maxLength: 20, sumber: { tabel: 'pegawai', kolom: 'no_hp' } },
  { key: 'email_pribadi', label: 'pegawai.email_pribadi', width: 200, kind: 'text', maxLength: 255, sumber: { tabel: 'pegawai', kolom: 'email_pribadi' } },
  { key: 'email_gws', label: 'pegawai.email_gws', width: 200, kind: 'text', maxLength: 255, sumber: { tabel: 'pegawai', kolom: 'email_gws' } },
  { key: 'status_aktif', label: 'pegawai.status_aktif', width: 110, kind: 'text', maxLength: 10, sumber: { tabel: 'pegawai', kolom: 'status_aktif' } },
  { key: 'tgl_mulai_kerja', label: 'pegawai.tgl_mulai_kerja', width: 140, kind: 'text', maxLength: 10, sumber: { tabel: 'pegawai', kolom: 'tgl_mulai_kerja' } },
  { key: 'pendidikan_terakhir', label: 'pegawai.pendidikan_terakhir', width: 150, kind: 'text', maxLength: 100, sumber: { tabel: 'pegawai', kolom: 'pendidikan_terakhir' } },
  { key: 'jenis_ptk', label: 'pegawai.jenis_ptk', width: 150, kind: 'text', maxLength: 100, sumber: { tabel: 'pegawai', kolom: 'jenis_ptk' } },
  { key: 'akun', label: 'Akun', width: 160, kind: 'static', sumber: { tabel: 'pegawai', kolom: 'user_id' } },
];

function gridValues(p: Pegawai): Record<string, string | null> {
  return {
    nama_lengkap: p.nama_lengkap,
    nip: p.nip,
    nik: p.nik,
    jenis_kelamin: p.jenis_kelamin,
    gelar_depan: p.gelar_depan,
    gelar_belakang: p.gelar_belakang,
    tempat_lahir: p.tempat_lahir,
    tanggal_lahir: p.tanggal_lahir,
    no_hp: p.no_hp,
    email_pribadi: p.email_pribadi,
    email_gws: p.email_gws,
    status_aktif: p.status_aktif,
    tgl_mulai_kerja: p.tgl_mulai_kerja,
    pendidikan_terakhir: p.pendidikan_terakhir,
    jenis_ptk: p.jenis_ptk,
    akun: p.akun ? p.akun.name : '—',
  };
}

async function commitDraft(id: number, f: Record<string, string | null>) {
  const bersih: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(f)) {
    if (k === 'akun') continue;
    bersih[k] = v === '' ? null : v;
  }
  if (Object.keys(bersih).length > 0) await updatePegawai(id, bersih);
}

/** Halaman Buku Induk Guru: seluruh field `pegawai` + Urutkan/Kolom + Import + Unduh existing. */
export default function PegawaiPage() {
  const { user } = useAuth();
  const canTambah = bisa(user, 'pegawai.tambah');
  const canUbah = bisa(user, 'pegawai.ubah');
  const canHapus = bisa(user, 'pegawai.hapus');
  const { jenjangs, tahunAjaranNames } = useFilterGlobalAktif();
  const [cari, setCari] = useState('');
  const [status, setStatus] = useState('');

  const { rows, loading, err, setErr, urut, arahUrut, terapkanUrut, load, lastPage, total, pager, onSaved } =
    useDaftarTabel<Pegawai>({
      tableKey: 'pegawai',
      search: cari,
      ambil: (a) => listPegawai({
        q: a.search || undefined,
        jenjang: jenjangs,
        tahun_ajaran: tahunAjaranNames,
        status_aktif: status || undefined,
        sort: a.urut.length ? a.urut : undefined,
        arah: a.urut.length ? a.arah : undefined,
        page: a.page,
        per_page: a.perPage,
        signal: a.signal,
      }),
      deps: [jenjangs, tahunAjaranNames, status],
    });

  const [tambahOpen, setTambahOpen] = useState(false);
  const [fNama, setFNama] = useState('');
  const [fJk, setFJk] = useState('L');
  const [fNip, setFNip] = useState('');
  const [fNik, setFNik] = useState('');
  const [busy, setBusy] = useState(false);

  const [akunRow, setAkunRow] = useState<Pegawai | null>(null);
  const [akunId, setAkunId] = useState('');
  const [fileOpen, setFileOpen] = useState(false);

  const onTambah = useCallback(async () => {
    if (!fNama.trim()) return;
    setBusy(true);
    try {
      await createPegawai({
        nama_lengkap: fNama.trim(),
        jenis_kelamin: fJk,
        nip: fNip.trim() || null,
        nik: fNik.trim() || null,
      });
      toast.success('Pegawai ditambahkan.');
      setTambahOpen(false);
      setFNama('');
      setFNip('');
      setFNik('');
      pager.goFirst();
      await load(1);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [fNama, fJk, fNip, fNik, pager, load]);

  const onHapus = useCallback(async (id: number) => {
    try {
      await deletePegawai(id);
      toast.success('Pegawai dihapus.');
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [load]);

  const onTautkan = useCallback(async () => {
    if (!akunRow) return;
    setBusy(true);
    try {
      await tautkanAkunPegawai(akunRow.id, akunId.trim() === '' ? null : Number(akunId));
      toast.success('Akun ditautkan.');
      setAkunRow(null);
      setAkunId('');
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [akunRow, akunId, load]);

  const renderActions = useCallback((p: Pegawai) => (
    <>
      {canUbah && <EditAction id={`btn_akun_pegawai_${p.id}`} onClick={() => { setAkunRow(p); setAkunId(p.user_id ? String(p.user_id) : ''); }} />}
      {canHapus && (
        <DeleteAction
          id={`btn_hapus_pegawai_${p.id}`}
          title="Hapus pegawai?"
          description={`${p.nama_lengkap} akan dihapus permanen beserta penempatannya.`}
          onConfirm={() => onHapus(p.id)}
        />
      )}
    </>
  ), [canUbah, canHapus, onHapus]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <PengaturanHalaman tampil={{ semester: false, tingkat: false }} tabel={[{ key: 'pegawai', judul: 'Pegawai', fields: FIELDS }]} />
      <TopBarSearch value={cari} onChange={setCari} placeholder="Cari nama / NIP / NIK…" />
      <ExcelTable
        tableKey="pegawai"
        sumberTabel="pegawai"
        fields={FIELDS}
        rows={rows}
        getValues={gridValues}
        loading={loading}
        emptyText="Belum ada pegawai."
        canEdit={canUbah}
        onCommit={commitDraft}
        onSaved={onSaved}
        urutAktif={urut}
        arahUrut={arahUrut}
        onUrut={terapkanUrut}
        filter={(
          <FilterField label="Status" htmlFor="select_status_pegawai">
            <Select value={status === '' ? 'semua' : status} onValueChange={(v) => { setStatus(v === 'semua' ? '' : v); pager.goFirst(); }}>
              <SelectTrigger id="select_status_pegawai" title="Filter status" aria-label="Filter status" size="sm" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent><SelectGroup>
                <SelectItem value="semua">Semua</SelectItem>
                <SelectItem value="aktif">Aktif</SelectItem>
                <SelectItem value="cuti">Cuti</SelectItem>
                <SelectItem value="keluar">Keluar</SelectItem>
              </SelectGroup></SelectContent>
            </Select>
          </FilterField>
        )}
        addButton={canTambah ? (
          <>
            <Button id="btn_buka_import_pegawai" variant="outline" onClick={() => setFileOpen(true)}>
              <FileUp data-icon="inline-start" size={16} /> Import
            </Button>
            <Button id="btn_buka_tambah_pegawai" onClick={() => setTambahOpen(true)}>
              + Pegawai
            </Button>
          </>
        ) : undefined}
        renderActions={renderActions}
      />
      <Pager
        page={pager.page}
        lastPage={lastPage}
        total={total}
        perPage={pager.perPage}
        onPage={(p) => { pager.setPage(p); load(p); }}
        onPerPage={(pp) => { pager.setPerPage(pp); load(1, pp); }}
      />
      <Dialog open={tambahOpen} onOpenChange={setTambahOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah pegawai</DialogTitle>
            <DialogDescription className="sr-only">Formulir pegawai baru.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
            <FieldLabel htmlFor="input_nama_pegawai">Nama lengkap</FieldLabel>
            <Input id="input_nama_pegawai" value={fNama} onChange={(e) => setFNama(e.target.value)} maxLength={255} />
            <FieldLabel htmlFor="select_jk_pegawai">Jenis kelamin</FieldLabel>
            <Select value={fJk} onValueChange={setFJk}>
              <SelectTrigger id="select_jk_pegawai"><SelectValue /></SelectTrigger>
              <SelectContent><SelectGroup>
                <SelectItem value="L">Laki-laki</SelectItem>
                <SelectItem value="P">Perempuan</SelectItem>
              </SelectGroup></SelectContent>
            </Select>
            <FieldLabel htmlFor="input_nip_pegawai">NIP</FieldLabel>
            <Input id="input_nip_pegawai" value={fNip} onChange={(e) => setFNip(e.target.value)} maxLength={50} />
            <FieldLabel htmlFor="input_nik_pegawai">NIK</FieldLabel>
            <Input id="input_nik_pegawai" value={fNik} onChange={(e) => setFNik(e.target.value)} maxLength={20} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTambahOpen(false)}>Batal</Button>
            <Button id="btn_tambah_pegawai" disabled={!fNama.trim() || busy} onClick={() => void onTambah()}>Tambah</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={akunRow !== null} onOpenChange={(o) => { if (!o) setAkunRow(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tautkan akun: {akunRow?.nama_lengkap}</DialogTitle>
            <DialogDescription>Isi ID pengguna (lihat halaman Pengguna). Kosongkan untuk melepas.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
            <FieldLabel htmlFor="input_akun_pegawai">ID pengguna</FieldLabel>
            <Input id="input_akun_pegawai" inputMode="numeric" value={akunId} onChange={(e) => setAkunId(e.target.value)} placeholder="mis. 12" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAkunRow(null)}>Batal</Button>
            <Button id="btn_tautkan_akun_pegawai" disabled={busy} onClick={() => void onTautkan()}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ImportBertahapUmumDialog
        open={fileOpen}
        onOpenChange={setFileOpen}
        config={{
          idPrefix: 'pegawai',
          judul: 'Import pegawai bertahap',
          deskripsi: 'Import Buku Induk Guru (identitas saja). Penempatan ke lembaga dilakukan di halaman Lembaga Pegawai.',
          kolom: KOLOM_IMPORT_PEGAWAI,
          wajib: ['nama_lengkap', 'jenis_kelamin'],
          idTombol: {
            template: 'btn_unduh_template_pegawai',
            periksa: 'btn_periksa_import_pegawai',
            mulai: 'btn_import_pegawai',
          },
          labelTemplate: 'Unduh template Excel pegawai',
          unduhTemplate: unduhTemplatePegawai,
          unduhData: {
            label: 'Unduh data pegawai existing',
            ambil: dataPegawaiExisting,
            namaBerkas: 'data-pegawai-existing.xlsx',
            judulSheet: 'Data Pegawai',
          },
          kirim: ({ sesi_id, mode, total, baris, terakhir }) =>
            importPegawaiPotong({
              ...(sesi_id === undefined ? {} : { sesi_id }),
              mode, ...(sesi_id === undefined ? { total } : {}), baris,
              ...(terakhir ? { terakhir } : {}),
            }),
          batal: batalPotongPegawai,
          unduhGalat: unduhGalatPegawai,
          onSelesai: () => {
            setFileOpen(false);
            pager.goFirst();
            void load(1);
          },
        }}
      />
    </div>
  );
}
