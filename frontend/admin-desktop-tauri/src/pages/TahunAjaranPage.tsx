import { useCallback, useMemo, useState } from 'react';
import { errorMessage } from '../api/client';
import {
  createTahunAjaran,
  deleteTahunAjaran,
  listTahunAjaran,
  sembunyikanTahunAjaran,
  setAktifTahunAjaran,
  tampilkanTahunAjaran,
  updateTahunAjaran,
  type TahunAjaran,
} from '../api/master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { useLembagaAwalString } from '@/hooks/useLembagaAwal';
import { useLembagaAktif } from '@/lembagaAktif';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { TopBarSearch } from '@/components/TopBarSearch';
import { ViewDialog } from '@/components/ViewDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Pager from '@/components/Pager';
import { useDaftarTabel } from '@/hooks/useDaftarTabel';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { ActionIcon, DeleteAction, EditAction, SetAktifAction, ViewAction } from '@/components/RowActions';
import { Ban, Undo2 } from '@/icons';
import { toast } from 'sonner';

const dateRule = (label: string) => (v: string | null) =>
  v && !/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${label} format YYYY-MM-DD.` : null;

const namaRule = (v: string | null) =>
  !v || !v.trim() ? 'Nama tahun ajaran wajib diisi.' : (/^\d{4}\/\d{4}$/.test(v.trim()) ? null : 'Format YYYY/YYYY, mis. 2026/2027.');

const FIELDS: ExcelField[] = [
  {
    key: 'nama', label: 'nama', width: 160, kind: 'text', maxLength: 50,
    required: true,
    validate: namaRule,
  },
  {
    key: 'mulai', label: 'tanggal_mulai', width: 130, kind: 'text', maxLength: 10,
    sumber: { tabel: 'tahun_ajaran', kolom: 'tanggal_mulai' },
    validate: dateRule('Tanggal mulai'),
  },
  {
    key: 'selesai', label: 'tanggal_selesai', width: 130, kind: 'text', maxLength: 10,
    sumber: { tabel: 'tahun_ajaran', kolom: 'tanggal_selesai' },
    validate: dateRule('Tanggal selesai'),
  },
  { key: 'aktif', label: 'is_aktif', width: 100, kind: 'static', sumber: { tabel: 'tahun_ajaran', kolom: 'is_aktif' } },
  { key: 'tampil', label: 'Tampil lembaga', width: 150, kind: 'static', sumber: null },
];

function gridValues(t: TahunAjaran): Record<string, string | null> {
  return {
    nama: t.nama,
    mulai: t.tanggal_mulai,
    selesai: t.tanggal_selesai,
    aktif: t.is_aktif ? 'aktif' : 'nonaktif',
    tampil: t.tampil === undefined ? '—' : (t.tampil ? 'ditampilkan' : 'disembunyikan'),
  };
}

/** Nama TA memuat '/', jadi id elemen disanitasi (mis. 2026/2027 → 20262027). */
const slug = (nama: string) => nama.replace(/[^0-9]/g, '');

async function commitDraft(id: string | number, f: Record<string, string | null>) {
  await updateTahunAjaran(String(id), {
    ...(f.nama !== undefined ? { nama_baru: (f.nama ?? '').trim() } : {}),
    ...(f.mulai !== undefined ? { tanggal_mulai: f.mulai || null } : {}),
    ...(f.selesai !== undefined ? { tanggal_selesai: f.selesai || null } : {}),
  });
}

/** Tahun Ajaran (global, kunci `nama`): super_admin mengelola daftar; admin
 *  lembaga hanya bisa menyembunyikan/menampilkan TA untuk lembaganya. */
export default function TahunAjaranPage() {
  const [jenjang, setLembagaId] = useState<string>('');
  useLembagaAwalString(setLembagaId);
  /** Pencarian tunggal halaman (topBar). */
  const [cari, setCari] = useState('');
  const {
    rows,
    loading,
    err,
    setErr,
    urut,
    arahUrut,
    terapkanUrut,
    load,
    lastPage,
    total,
    pager,
    onSaved,
  } = useDaftarTabel<TahunAjaran>({
    tableKey: 'tahun_ajaran',
    search: cari,
    ambil: (a) => listTahunAjaran({
      search: a.search || undefined,
      jenjang: jenjang === '' ? undefined : jenjang,
      // TA tersembunyi ikut dimuat agar bisa ditampilkan kembali.
      termasuk_nonaktif: jenjang !== '',
      sort: a.urut.length ? a.urut : undefined,
      arah: a.urut.length ? a.arah : undefined,
      page: a.page,
      per_page: a.perPage,
      signal: a.signal,
    }),
    deps: [jenjang],
  });

  const [nama, setNama] = useState('');
  const [mulai, setMulai] = useState('');
  const [selesai, setSelesai] = useState('');
  const [tambahOpen, setTambahOpen] = useState(false);
  const [viewRow, setViewRow] = useState<TahunAjaran | null>(null);
  const [editRow, setEditRow] = useState<TahunAjaran | null>(null);
  const [editNama, setEditNama] = useState('');
  const [editMulai, setEditMulai] = useState('');
  const [editSelesai, setEditSelesai] = useState('');

  const { user } = useAuth();
  const { bertindak } = useLembagaAktif();
  // ExcelTable butuh `id`; TA memakai `nama` sebagai kunci → turunkan id dari nama.
  const rowsTampil = useMemo(() => rows.map((t) => ({ ...t, id: t.nama })), [rows]);
  // Saat berperan sebagai lembaga, izin kelola super_admin nonaktif (hanya sembunyikan).
  const bolehKelola = bisa(user, 'tahun_ajaran.ubah') && !bertindak;
  // Lembaga untuk aksi sembunyikan: lembaga aktif (perangkat) atau lembaga user.
  const lembagaAksi = jenjang === '' ? (user?.lembagas?.[0]?.jenjang ?? null) : jenjang;
  const bolehSembunyi = !bolehKelola && lembagaAksi !== null;

  const openEdit = useCallback((t: TahunAjaran) => {
    setEditRow(t);
    setEditNama(t.nama);
    setEditMulai(t.tanggal_mulai ?? '');
    setEditSelesai(t.tanggal_selesai ?? '');
  }, []);

  const onCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    try {
      await createTahunAjaran({
        nama,
        tanggal_mulai: mulai || undefined,
        tanggal_selesai: selesai || undefined,
      });
      toast.success('Tahun ajaran dibuat.');
      setNama(''); setMulai(''); setSelesai('');
      setTambahOpen(false);
      pager.goFirst();
      await load(1);
    } catch (e2) {
      setErr(errorMessage(e2));
    }
  }, [nama, mulai, selesai, load, pager.goFirst]);

  const onSetAktif = useCallback(async (nama: string) => {
    try {
      await setAktifTahunAjaran(nama);
      toast.success('Tahun ajaran diaktifkan.');
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [load]);

  const onUpdate = useCallback(async () => {
    if (!editRow) return;
    try {
      await updateTahunAjaran(editRow.nama, {
        nama_baru: editNama.trim(),
        tanggal_mulai: editMulai || null,
        tanggal_selesai: editSelesai || null,
      });
      toast.success('Tahun ajaran diubah.');
      setEditRow(null);
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [editRow, editNama, editMulai, editSelesai, load]);

  const onDelete = useCallback(async (nama: string) => {
    try {
      await deleteTahunAjaran(nama);
      toast.success('Tahun ajaran dihapus.');
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [load]);

  const onSembunyikan = useCallback(async (nama: string) => {
    if (lembagaAksi === null) return;
    try {
      await sembunyikanTahunAjaran(nama, lembagaAksi);
      toast.success('Tahun ajaran disembunyikan untuk lembaga ini.');
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [lembagaAksi, load]);

  const onTampilkan = useCallback(async (nama: string) => {
    if (lembagaAksi === null) return;
    try {
      await tampilkanTahunAjaran(nama, lembagaAksi);
      toast.success('Tahun ajaran ditampilkan kembali.');
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [lembagaAksi, load]);

  /** Mode Input: buat TA baru dari baris input (super_admin). */
  const createRow = useCallback(async (f: Record<string, string | null>) => {
    const namaRapi = (f.nama ?? '').trim();
    if (namaRapi === '') {
      throw new Error('Nama tahun ajaran wajib diisi.');
    }
    await createTahunAjaran({
      nama: namaRapi,
      tanggal_mulai: f.mulai || undefined,
      tanggal_selesai: f.selesai || undefined,
    });
    toast.success('Tahun ajaran dibuat.');
    await load(1);
  }, [load]);

  const renderActions = useCallback((t: TahunAjaran) => {
    const id = slug(t.nama);
    return (
      <>
        <ViewAction id={`btn_lihat_ta_${id}`} onClick={() => setViewRow(t)} />
        {bolehKelola && (
          <>
            <EditAction id={`btn_ubah_ta_${id}`} onClick={() => openEdit(t)} />
            {!t.is_aktif && <SetAktifAction id={`btn_aktif_ta_${id}`} onClick={() => onSetAktif(t.nama)} />}
            <DeleteAction
              id={`btn_hapus_ta_${id}`}
              title="Hapus tahun ajaran?"
              description={`${t.nama} akan dihapus permanen.`}
              onConfirm={() => onDelete(t.nama)}
            />
          </>
        )}
        {bolehSembunyi && t.tampil !== false && !t.is_aktif && (
          <ActionIcon
            id={`btn_sembunyi_ta_${id}`}
            title="Sembunyikan dari lembaga ini"
            onClick={() => onSembunyikan(t.nama)}
          >
            <Ban size={16} />
          </ActionIcon>
        )}
        {bolehSembunyi && t.tampil === false && (
          <ActionIcon
            id={`btn_tampil_ta_${id}`}
            title="Tampilkan kembali"
            onClick={() => onTampilkan(t.nama)}
          >
            <Undo2 size={16} />
          </ActionIcon>
        )}
      </>
    );
  }, [bolehKelola, bolehSembunyi, openEdit, onSetAktif, onDelete, onSembunyikan, onTampilkan]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <TopBarSearch value={cari} onChange={setCari} placeholder="Cari tahun ajaran…" />
      <ExcelTable
        tableKey="tahun_ajaran"
        sumberTabel="tahun_ajaran"
        fields={FIELDS}
        rows={rowsTampil}
        getValues={gridValues}
        loading={loading}
        emptyText={bolehKelola ? 'Belum ada tahun ajaran.' : 'Lembaga ini belum memakai tahun ajaran mana pun.'}
        canEdit={bolehKelola}
        onCommit={commitDraft}
        onSaved={onSaved}
        urutAktif={urut}
        arahUrut={arahUrut}
        onUrut={terapkanUrut}
        onCreateRow={bolehKelola ? createRow : undefined}
        inputRowValues={{ aktif: 'nonaktif', tampil: '—' }}
        addButton={bolehKelola ? (
          <Button id="btn_buka_tambah_ta" onClick={() => setTambahOpen(true)}>
            + Tahun Ajaran
          </Button>
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
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Tambah tahun ajaran</DialogTitle>
            <DialogDescription className="sr-only">Formulir penambahan tahun ajaran baru.</DialogDescription>
          </DialogHeader>
          <form id="form_tambah_ta" onSubmit={onCreate} className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
            <FieldLabel htmlFor="input_nama_ta">Nama (berlaku semua lembaga)</FieldLabel>
            <Input id="input_nama_ta" value={nama} onChange={(e) => setNama(e.target.value)} required maxLength={50} placeholder="2026/2027" />
            <FieldLabel htmlFor="input_mulai_ta">Tanggal mulai</FieldLabel>
            <Input id="input_mulai_ta" type="date" value={mulai} onChange={(e) => setMulai(e.target.value)} />
            <FieldLabel htmlFor="input_selesai_ta">Tanggal selesai</FieldLabel>
            <Input id="input_selesai_ta" type="date" value={selesai} onChange={(e) => setSelesai(e.target.value)} />
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setTambahOpen(false)}>Batal</Button>
              <Button id="btn_tambah_ta" type="submit">Tambah</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ViewDialog
        open={viewRow !== null}
        onOpenChange={(o) => { if (!o) setViewRow(null); }}
        title={viewRow ? `Tahun ajaran: ${viewRow.nama}` : 'Tahun ajaran'}
        row={viewRow as unknown as Record<string, unknown> | null}
      />
      <Dialog open={editRow !== null} onOpenChange={(o) => { if (!o) setEditRow(null); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Ubah tahun ajaran</DialogTitle>
            <DialogDescription className="sr-only">Formulir perubahan tahun ajaran.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
            <FieldLabel htmlFor="input_ubah_nama_ta">Nama (berlaku semua lembaga)</FieldLabel>
            <Input id="input_ubah_nama_ta" value={editNama} onChange={(e) => setEditNama(e.target.value)} required maxLength={50} />
            <FieldLabel htmlFor="input_ubah_mulai_ta">Tanggal mulai</FieldLabel>
            <Input id="input_ubah_mulai_ta" type="date" value={editMulai} onChange={(e) => setEditMulai(e.target.value)} />
            <FieldLabel htmlFor="input_ubah_selesai_ta">Tanggal selesai</FieldLabel>
            <Input id="input_ubah_selesai_ta" type="date" value={editSelesai} onChange={(e) => setEditSelesai(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditRow(null)}>Batal</Button>
            <Button id="btn_simpan_ta" onClick={onUpdate}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
