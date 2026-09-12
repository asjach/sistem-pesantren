import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  createLembaga,
  deleteLembaga,
  listLembaga,
  updateLembaga,
  type Lembaga,
} from '../api/master';
import { errorMessage } from '../api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { ViewDialog } from '@/components/ViewDialog';
import PageHeader, { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
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
import { DeleteAction, EditAction, ViewAction } from '@/components/RowActions';
import { toast } from 'sonner';

const FIELDS: ExcelField[] = [
  {
    key: 'kode', label: 'Kode', width: 130, minWidth: 100, kind: 'text', maxLength: 20,
    validate: (v) => (v && v.length > 20 ? 'Kode maksimal 20 karakter.' : null),
  },
  {
    key: 'nama', label: 'Nama', width: 260, minWidth: 120, kind: 'text', maxLength: 100,
    validate: (v) => (!v || !v.trim() ? 'Nama lembaga wajib diisi.' : null),
  },
  { key: 'induk', label: 'Induk', width: 220, minWidth: 120, kind: 'static' },
];

function gridValues(l: Lembaga): Record<string, string | null> {
  return { kode: l.kode, nama: l.nama, induk: l.parent?.nama ?? '' };
}

async function commitDraft(id: number, f: Record<string, string | null>) {
  await updateLembaga(id, {
    ...(f.nama !== undefined ? { nama: f.nama ?? '' } : {}),
    ...(f.kode !== undefined ? { kode: f.kode || undefined } : {}),
  });
}

export default function LembagaPage() {
  const { user: me } = useAuth();
  const isSuper = me?.roles.some((r) => r.name === 'super_admin') ?? false;
  const [rows, setRows] = useState<Lembaga[]>([]);
  const [all, setAll] = useState<Lembaga[]>([]);
  const [search, setSearch] = useState('');
  const pager = usePager('lembaga');
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const reqRef = useRef(0);

  const [nama, setNama] = useState('');
  const [kode, setKode] = useState('');
  const [parentId, setParentId] = useState('');
  const [tambahOpen, setTambahOpen] = useState(false);
  const [viewRow, setViewRow] = useState<Lembaga | null>(null);
  const [editRow, setEditRow] = useState<Lembaga | null>(null);
  const [editNama, setEditNama] = useState('');
  const [editKode, setEditKode] = useState('');

  const load = useCallback(
    async function loadPage(p = pager.page, pp = pager.perPage) {
      const req = ++reqRef.current;
      setErr('');
      setLoading(true);
      try {
        const res = await listLembaga({ search: search || undefined, page: p, per_page: pp });
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
    [search, pager.page, pager.perPage, pager.sync],
  );

  useEffect(() => {
    if (pager.ready) load(pager.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pager.ready, search]);

  useEffect(() => {
    listLembaga({ per_page: 100 }).then((p) => setAll(p.data)).catch(() => {});
  }, []);

  const openEdit = useCallback((l: Lembaga) => {
    setEditRow(l);
    setEditNama(l.nama);
    setEditKode(l.kode ?? '');
  }, []);

  const onCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    try {
      await createLembaga({
        nama,
        kode: kode || undefined,
        parent_id: parentId ? Number(parentId) : undefined,
      });
      toast.success('Lembaga dibuat.');
      setNama(''); setKode(''); setParentId('');
      setTambahOpen(false);
      pager.goFirst();
      await load(1);
      const p = await listLembaga({ per_page: 100 });
      setAll(p.data);
    } catch (e2) {
      setErr(errorMessage(e2));
    }
  }, [nama, kode, parentId, load, pager.goFirst]);

  const onUpdate = useCallback(async () => {
    if (!editRow) return;
    try {
      await updateLembaga(editRow.id, { nama: editNama, kode: editKode || undefined });
      toast.success('Lembaga diubah.');
      setEditRow(null);
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [editRow, editNama, editKode, load]);

  const onDelete = useCallback(async (id: number) => {
    try {
      await deleteLembaga(id);
      toast.success('Lembaga dihapus.');
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

  const renderActions = useCallback((l: Lembaga) => (
    <>
      <ViewAction id={`btn_lihat_lembaga_${l.id}`} onClick={() => setViewRow(l)} />
      {isSuper && (
        <>
          <EditAction id={`btn_ubah_lembaga_${l.id}`} onClick={() => openEdit(l)} />
          <DeleteAction
            id={`btn_hapus_lembaga_${l.id}`}
            title="Hapus lembaga?"
            description={`${l.nama} akan dihapus permanen.`}
            onConfirm={() => onDelete(l.id)}
          />
        </>
      )}
    </>
  ), [isSuper, openEdit, onDelete]);

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        titleId="title_lembaga"
        title="Lembaga"
        description={!isSuper ? 'Tambah/ubah/hapus lembaga hanya super_admin.' : undefined}
      />
      <ErrorNotice>{err}</ErrorNotice>
      <ExcelTable
        tableKey="lembaga"
        fields={FIELDS}
        rows={rows}
        getValues={gridValues}
        loading={loading}
        emptyText="Belum ada lembaga."
        canEdit={isSuper}
        onCommit={commitDraft}
        onSaved={onSaved}
        searchValue={search}
        onSearchChange={onSearchChange}
        onSearchSubmit={onSearchSubmit}
        searchPlaceholder="Nama / kode"
        addButton={isSuper ? (
          <Button id="btn_buka_tambah_lembaga" onClick={() => setTambahOpen(true)}>
            + Lembaga
          </Button>
        ) : undefined}
        searchIds={{ form: 'form_cari_lembaga', input: 'input_cari_lembaga', button: 'btn_cari_lembaga' }}
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
      {isSuper && (
        <Dialog open={tambahOpen} onOpenChange={setTambahOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Tambah lembaga</DialogTitle>
              <DialogDescription className="sr-only">Formulir penambahan lembaga baru.</DialogDescription>
            </DialogHeader>
            <form id="form_tambah_lembaga" onSubmit={onCreate} autoComplete="off" className="flex flex-col gap-3">
              <FieldGroup className="grid gap-3 sm:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="input_nama_lembaga">Nama</FieldLabel>
                  <Input id="input_nama_lembaga" value={nama} onChange={(e) => setNama(e.target.value)} required maxLength={100} autoComplete="off" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="input_kode_lembaga">Kode (unik global, opsional)</FieldLabel>
                  <Input id="input_kode_lembaga" value={kode} onChange={(e) => setKode(e.target.value)} maxLength={20} placeholder="MI" autoComplete="off" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="select_induk_lembaga">Induk (opsional)</FieldLabel>
                  <Select value={parentId || '_root'} onValueChange={(v) => setParentId(v === '_root' ? '' : v)}>
                    <SelectTrigger id="select_induk_lembaga">
                      <SelectValue placeholder="Tanpa induk (root)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Induk lembaga</SelectLabel>
                        <SelectItem value="_root">Tanpa induk (root)</SelectItem>
                        {all.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.nama} ({l.kode ?? '-'})</SelectItem>)}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTambahOpen(false)}>Batal</Button>
                <Button id="btn_tambah_lembaga" type="submit">Tambah</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
      <ViewDialog
        open={viewRow !== null}
        onOpenChange={(o) => { if (!o) setViewRow(null); }}
        title={viewRow ? `Lembaga: ${viewRow.nama}` : 'Lembaga'}
        row={viewRow as unknown as Record<string, unknown> | null}
      />
      <Dialog open={editRow !== null} onOpenChange={(o) => { if (!o) setEditRow(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah lembaga</DialogTitle>
            <DialogDescription className="sr-only">Formulir perubahan data lembaga.</DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-3">
            <Field>
              <FieldLabel htmlFor="input_ubah_nama_lembaga">Nama</FieldLabel>
              <Input id="input_ubah_nama_lembaga" value={editNama} onChange={(e) => setEditNama(e.target.value)} required maxLength={100} />
            </Field>
            <Field>
              <FieldLabel htmlFor="input_ubah_kode_lembaga">Kode (unik global, opsional)</FieldLabel>
              <Input id="input_ubah_kode_lembaga" value={editKode} onChange={(e) => setEditKode(e.target.value)} maxLength={20} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Batal</Button>
            <Button id="btn_simpan_lembaga" onClick={onUpdate}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
