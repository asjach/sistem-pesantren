import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api/client';
import {
  createTahunAjaran,
  deleteTahunAjaran,
  listLembaga,
  listTahunAjaran,
  setAktifTahunAjaran,
  updateTahunAjaran,
  type Lembaga,
  type TahunAjaran,
} from '../api/master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import PageHeader, { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
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
import { usePager } from '@/hooks/usePager';
import { DeleteAction, EditAction, SetAktifAction, ViewAction } from '@/components/RowActions';
import { toast } from 'sonner';

const dateRule = (label: string) => (v: string | null) =>
  v && !/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${label} format YYYY-MM-DD.` : null;

const FIELDS: ExcelField[] = [
  {
    key: 'nama', label: 'Nama', width: 160, minWidth: 120, kind: 'text', maxLength: 50,
    validate: (v) => (!v || !v.trim() ? 'Nama tahun ajaran wajib diisi.' : null),
  },
  { key: 'lembaga', label: 'Lembaga', width: 200, minWidth: 120, kind: 'static' },
  {
    key: 'mulai', label: 'Mulai', width: 130, minWidth: 110, kind: 'text', maxLength: 10,
    validate: dateRule('Tanggal mulai'),
  },
  {
    key: 'selesai', label: 'Selesai', width: 130, minWidth: 110, kind: 'text', maxLength: 10,
    validate: dateRule('Tanggal selesai'),
  },
  { key: 'aktif', label: 'Aktif', width: 120, minWidth: 90, kind: 'static' },
];

function gridValues(t: TahunAjaran): Record<string, string | null> {
  return {
    nama: t.nama,
    lembaga: t.lembaga?.nama ?? String(t.lembaga_id),
    mulai: t.tanggal_mulai,
    selesai: t.tanggal_selesai,
    aktif: t.is_aktif ? 'aktif' : 'nonaktif',
  };
}

async function commitDraft(id: number, f: Record<string, string | null>) {
  await updateTahunAjaran(id, {
    ...(f.nama !== undefined ? { nama: f.nama ?? '' } : {}),
    ...(f.mulai !== undefined ? { tanggal_mulai: f.mulai || null } : {}),
    ...(f.selesai !== undefined ? { tanggal_selesai: f.selesai || null } : {}),
  });
}

export default function TahunAjaranPage() {
  const [lembagas, setLembagas] = useState<Lembaga[]>([]);
  const [lembagaId, setLembagaId] = useState<number | ''>('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<TahunAjaran[]>([]);
  const pager = usePager('tahun_ajaran');
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const reqRef = useRef(0);

  const [nama, setNama] = useState('');
  const [mulai, setMulai] = useState('');
  const [selesai, setSelesai] = useState('');
  const [tambahOpen, setTambahOpen] = useState(false);
  const [viewRow, setViewRow] = useState<TahunAjaran | null>(null);
  const [editRow, setEditRow] = useState<TahunAjaran | null>(null);
  const [editNama, setEditNama] = useState('');
  const [editMulai, setEditMulai] = useState('');
  const [editSelesai, setEditSelesai] = useState('');

  const load = useCallback(
    async function loadPage(p = pager.page, pp = pager.perPage) {
      const req = ++reqRef.current;
      setErr('');
      setLoading(true);
      try {
        const res = await listTahunAjaran({
          search: search || undefined,
          lembaga_id: lembagaId === '' ? undefined : Number(lembagaId),
          page: p,
          per_page: pp,
        });
        if (req !== reqRef.current) return;
        const fix = pager.sync(res.current_page, res.last_page);
        if (fix != null && fix !== p) {
          await loadPage(fix, pp);
          return;
        }
        if (req !== reqRef.current) return;
        setRows(res.data);
        setLastPage(res.last_page);
        setTotal(res.total);
      } catch (e) {
        if (req === reqRef.current) setErr(errorMessage(e));
      } finally {
        if (req === reqRef.current) setLoading(false);
      }
    },
    [search, lembagaId, pager.page, pager.perPage, pager.sync],
  );

  useEffect(() => {
    listLembaga().then((p) => setLembagas(p.data)).catch((e) => setErr(errorMessage(e)));
  }, []);

  useEffect(() => {
    if (pager.ready) load(pager.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pager.ready, search, lembagaId]);

  const openEdit = useCallback((t: TahunAjaran) => {
    setEditRow(t);
    setEditNama(t.nama);
    setEditMulai(t.tanggal_mulai ?? '');
    setEditSelesai(t.tanggal_selesai ?? '');
  }, []);

  const onCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (lembagaId === '') {
      setErr('Pilih lembaga dulu (wajib, tenant per lembaga).');
      return;
    }
    try {
      await createTahunAjaran({
        lembaga_id: Number(lembagaId),
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
  }, [lembagaId, nama, mulai, selesai, load, pager.goFirst]);

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

  const onSearchChange = useCallback((v: string) => {
    setSearch(v);
    pager.goFirst();
  }, [pager.goFirst]);

  const onSearchSubmit = useCallback(() => {
    pager.goFirst();
  }, [pager.goFirst]);

  const onSaved = useCallback(() => load(), [load]);

  const renderActions = useCallback((t: TahunAjaran) => (
    <>
      <ViewAction id={`btn_lihat_ta_${t.id}`} onClick={() => setViewRow(t)} />
      <EditAction id={`btn_ubah_ta_${t.id}`} onClick={() => openEdit(t)} />
      {!t.is_aktif && <SetAktifAction id={`btn_aktif_ta_${t.id}`} onClick={() => onSetAktif(t.id)} />}
      <DeleteAction
        id={`btn_hapus_ta_${t.id}`}
        title="Hapus tahun ajaran?"
        description={`${t.nama} akan dihapus permanen.`}
        onConfirm={() => onDelete(t.id)}
      />
    </>
  ), [openEdit, onSetAktif, onDelete]);

  return (
    <div className={PAGE_SHELL}>
      <PageHeader titleId="title_tahun_ajaran" title="Tahun Ajaran" />
      <ErrorNotice>{err}</ErrorNotice>
      <ExcelTable
        tableKey="tahun_ajaran"
        fields={FIELDS}
        rows={rows}
        getValues={gridValues}
        loading={loading}
        emptyText="Belum ada tahun ajaran."
        canEdit
        onCommit={commitDraft}
        onSaved={onSaved}
        searchValue={search}
        onSearchChange={onSearchChange}
        onSearchSubmit={onSearchSubmit}
        searchPlaceholder="Nama mis. 2026/2027"
        addButton={(
          <Button id="btn_buka_tambah_ta" onClick={() => setTambahOpen(true)}>
            + Tahun Ajaran
          </Button>
        )}
        searchIds={{ form: 'form_filter_ta', input: 'input_cari_ta', button: 'btn_cari_ta' }}
        filter={(
          <Select
            value={lembagaId === '' ? '_semua' : String(lembagaId)}
            onValueChange={(v) => { setLembagaId(v === '_semua' ? '' : Number(v)); pager.goFirst(); }}
          >
            <SelectTrigger id="select_lembaga_ta" title="Filter lembaga" aria-label="Filter lembaga" size="sm" className="w-36">
              <SelectValue placeholder="Semua (akses saya)" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="_semua">Semua (akses saya)</SelectItem>
                {lembagas.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.nama} ({l.kode ?? '-'})</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Tambah tahun ajaran</DialogTitle>
            <DialogDescription className="sr-only">Formulir penambahan tahun ajaran baru.</DialogDescription>
          </DialogHeader>
          <form id="form_tambah_ta" onSubmit={onCreate} className="flex flex-col gap-3">
            <FieldGroup className="grid gap-3 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="input_nama_ta">Nama (unik per lembaga)</FieldLabel>
                <Input id="input_nama_ta" value={nama} onChange={(e) => setNama(e.target.value)} required maxLength={50} placeholder="2026/2027" />
              </Field>
              <Field>
                <FieldLabel htmlFor="input_mulai_ta">Tanggal mulai</FieldLabel>
                <Input id="input_mulai_ta" type="date" value={mulai} onChange={(e) => setMulai(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="input_selesai_ta">Tanggal selesai</FieldLabel>
                <Input id="input_selesai_ta" type="date" value={selesai} onChange={(e) => setSelesai(e.target.value)} />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTambahOpen(false)}>Batal</Button>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah tahun ajaran</DialogTitle>
            <DialogDescription className="sr-only">Formulir perubahan tahun ajaran.</DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-3">
            <Field>
              <FieldLabel htmlFor="input_ubah_nama_ta">Nama (unik per lembaga)</FieldLabel>
              <Input id="input_ubah_nama_ta" value={editNama} onChange={(e) => setEditNama(e.target.value)} required maxLength={50} />
            </Field>
            <Field>
              <FieldLabel htmlFor="input_ubah_mulai_ta">Tanggal mulai</FieldLabel>
              <Input id="input_ubah_mulai_ta" type="date" value={editMulai} onChange={(e) => setEditMulai(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="input_ubah_selesai_ta">Tanggal selesai</FieldLabel>
              <Input id="input_ubah_selesai_ta" type="date" value={editSelesai} onChange={(e) => setEditSelesai(e.target.value)} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Batal</Button>
            <Button id="btn_simpan_ta" onClick={onUpdate}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
