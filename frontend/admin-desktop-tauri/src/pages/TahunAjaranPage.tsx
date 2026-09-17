import { useCallback, useState } from 'react';
import { errorMessage } from '../api/client';
import {
  createTahunAjaran,
  deleteTahunAjaran,
  listTahunAjaran,
  sembunyikanTahunAjaran,
  setAktifTahunAjaran,
  updateTahunAjaran,
  type TahunAjaran,
} from '../api/master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { useLembagaAwalNumber } from '@/hooks/useLembagaAwal';
import { useLembagaAktif } from '@/lembagaAktif';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
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

const FIELDS: ExcelField[] = [
  {
    key: 'nama', label: 'nama', width: 160, kind: 'text', maxLength: 50,
    required: true,
    validate: (v) => (!v || !v.trim() ? 'Nama tahun ajaran wajib diisi.' : null),
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
    tampil: t.lembaga_id === null ? 'global (semua)' : (t.is_active ? 'ditampilkan' : 'disembunyikan'),
  };
}

async function commitDraft(id: number, f: Record<string, string | null>) {
  await updateTahunAjaran(id, {
    ...(f.nama !== undefined ? { nama: f.nama ?? '' } : {}),
    ...(f.mulai !== undefined ? { tanggal_mulai: f.mulai || null } : {}),
    ...(f.selesai !== undefined ? { tanggal_selesai: f.selesai || null } : {}),
  });
}

/** Tahun Ajaran (global, gaya Referensi): super_admin mengelola daftar; admin
 *  lembaga hanya bisa menyembunyikan/menampilkan TA untuk lembaganya. */
export default function TahunAjaranPage() {
  const [lembagaId, setLembagaId] = useState<number | ''>('');
  useLembagaAwalNumber(setLembagaId);
  const {
    rows,
    loading,
    err,
    setErr,
    search,
    urut,
    arahUrut,
    terapkanUrut,
    load,
    lastPage,
    total,
    pager,
    onSearchChange,
    onSearchSubmit,
    onSaved,
  } = useDaftarTabel<TahunAjaran>({
    tableKey: 'tahun_ajaran',
    ambil: (a) => listTahunAjaran({
      search: a.search || undefined,
      lembaga_id: lembagaId === '' ? undefined : Number(lembagaId),
      // Baris tersembunyi ikut dimuat agar bisa ditampilkan kembali.
      termasuk_nonaktif: lembagaId !== '',
      sort: a.urut.length ? a.urut : undefined,
      arah: a.urut.length ? a.arah : undefined,
      page: a.page,
      per_page: a.perPage,
    }),
    deps: [lembagaId],
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
  // Saat berperan sebagai lembaga, izin kelola super_admin nonaktif (hanya sembunyikan).
  const bolehKelola = bisa(user, 'tahun_ajaran.ubah') && !bertindak;
  // Lembaga untuk aksi sembunyikan: lembaga aktif (perangkat) atau lembaga user.
  const lembagaAksi = lembagaId === '' ? (user?.lembagas?.[0]?.id ?? null) : Number(lembagaId);
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

  const onSetAktif = useCallback(async (id: number) => {
    try {
      await setAktifTahunAjaran(id);
      toast.success('Tahun ajaran diaktifkan.');
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [load]);

  const onUpdate = useCallback(async () => {
    if (!editRow) return;
    try {
      await updateTahunAjaran(editRow.id, {
        nama: editNama,
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

  const onDelete = useCallback(async (id: number) => {
    try {
      await deleteTahunAjaran(id);
      toast.success('Tahun ajaran dihapus.');
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [load]);

  const onSembunyikan = useCallback(async (id: number) => {
    if (lembagaAksi === null) return;
    try {
      await sembunyikanTahunAjaran(id, lembagaAksi);
      toast.success('Tahun ajaran disembunyikan untuk lembaga ini.');
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [lembagaAksi, load]);

  const onTampilkan = useCallback(async (id: number) => {
    try {
      await deleteTahunAjaran(id);
      toast.success('Tahun ajaran ditampilkan kembali.');
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [load]);

  /** Mode Input: buat TA global baru dari baris input (super_admin). */
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

  const renderActions = useCallback((t: TahunAjaran) => (
    <>
      <ViewAction id={`btn_lihat_ta_${t.id}`} onClick={() => setViewRow(t)} />
      {bolehKelola && (
        <>
          <EditAction id={`btn_ubah_ta_${t.id}`} onClick={() => openEdit(t)} />
          {!t.is_aktif && <SetAktifAction id={`btn_aktif_ta_${t.id}`} onClick={() => onSetAktif(t.id)} />}
          <DeleteAction
            id={`btn_hapus_ta_${t.id}`}
            title="Hapus tahun ajaran?"
            description={`${t.nama} akan dihapus permanen.`}
            onConfirm={() => onDelete(t.id)}
          />
        </>
      )}
      {bolehSembunyi && t.lembaga_id === null && t.is_active && !t.is_aktif && (
        <ActionIcon
          id={`btn_sembunyi_ta_${t.id}`}
          title="Sembunyikan dari lembaga ini"
          onClick={() => onSembunyikan(t.id)}
        >
          <Ban size={16} />
        </ActionIcon>
      )}
      {bolehSembunyi && t.lembaga_id !== null && !t.is_active && (
        <ActionIcon
          id={`btn_tampil_ta_${t.id}`}
          title="Tampilkan kembali"
          onClick={() => onTampilkan(t.id)}
        >
          <Undo2 size={16} />
        </ActionIcon>
      )}
    </>
  ), [bolehKelola, bolehSembunyi, openEdit, onSetAktif, onDelete, onSembunyikan, onTampilkan]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <ExcelTable
        tableKey="tahun_ajaran"
        sumberTabel="tahun_ajaran"
        fields={FIELDS}
        rows={rows}
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
        inputRowValues={{ aktif: 'nonaktif', tampil: 'global (semua)' }}
        searchValue={search}
        onSearchChange={onSearchChange}
        onSearchSubmit={onSearchSubmit}
        searchPlaceholder="Nama mis. 2026/2027"
        addButton={bolehKelola ? (
          <Button id="btn_buka_tambah_ta" onClick={() => setTambahOpen(true)}>
            + Tahun Ajaran
          </Button>
        ) : undefined}
        searchIds={{ form: 'form_filter_ta', input: 'input_cari_ta', button: 'btn_cari_ta' }}
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
