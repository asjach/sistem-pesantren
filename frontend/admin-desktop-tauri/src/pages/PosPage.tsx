import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import {
  createPos,
  deletePos,
  listPos,
  updatePos,
  type PosKeuangan,
  type TipePos,
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
import { usePager } from '@/hooks/usePager';
import { DeleteAction, EditAction, ViewAction } from '@/components/RowActions';
import { toast } from 'sonner';

const TIPE: TipePos[] = ['bulanan', 'sekali_bayar', 'semesteran', 'tahunan'];

const FIELDS: ExcelField[] = [
  { key: 'kode', label: 'Kode (global unik)', width: 170, minWidth: 120, kind: 'static' },
  {
    key: 'nama', label: 'Nama', width: 260, minWidth: 120, kind: 'text', maxLength: 100,
    validate: (v) => (!v || !v.trim() ? 'Nama pos wajib diisi.' : null),
  },
  {
    key: 'tipe', label: 'Tipe', width: 150, minWidth: 110, kind: 'select',
    choices: TIPE.map((t) => ({ value: t, label: t })),
    validate: (v) => ((TIPE as string[]).includes(v ?? '') ? null : 'Tipe tidak valid.'),
  },
];

function gridValues(p: PosKeuangan): Record<string, string | null> {
  return { kode: p.kode_pos, nama: p.nama_pos, tipe: p.tipe };
}

async function commitDraft(id: number, f: Record<string, string | null>) {
  await updatePos(id, {
    ...(f.nama !== undefined ? { nama_pos: f.nama ?? '' } : {}),
    ...(f.tipe !== undefined ? { tipe: (f.tipe ?? 'bulanan') as TipePos } : {}),
  });
}

export default function PosPage() {
  const { user: me } = useAuth();
  const canEdit = !!me?.roles.some((r) => r.name === 'super_admin' || r.name === 'admin');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<PosKeuangan[]>([]);
  const pager = usePager('pos');
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const reqRef = useRef(0);

  const [kode, setKode] = useState('');
  const [nama, setNama] = useState('');
  const [tipe, setTipe] = useState<TipePos>('bulanan');
  const [tambahOpen, setTambahOpen] = useState(false);
  const [viewRow, setViewRow] = useState<PosKeuangan | null>(null);
  const [editRow, setEditRow] = useState<PosKeuangan | null>(null);
  const [editNama, setEditNama] = useState('');
  const [editTipe, setEditTipe] = useState<TipePos>('bulanan');

  const load = useCallback(
    async function loadPage(p = pager.page, pp = pager.perPage) {
      const req = ++reqRef.current;
      setErr('');
      setLoading(true);
      try {
        const res = await listPos({ search: search || undefined, page: p, per_page: pp });
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

  const openEdit = useCallback((p: PosKeuangan) => {
    setEditRow(p);
    setEditNama(p.nama_pos);
    setEditTipe(p.tipe);
  }, []);

  const onCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    try {
      await createPos({ kode_pos: kode, nama_pos: nama, tipe });
      toast.success('Pos dibuat (kode unik global).');
      setKode(''); setNama(''); setTipe('bulanan');
      setTambahOpen(false);
      pager.goFirst();
      await load(1);
    } catch (e2) {
      setErr(errorMessage(e2));
    }
  }, [kode, nama, tipe, load, pager.goFirst]);

  const onUpdate = useCallback(async () => {
    if (!editRow) return;
    try {
      await updatePos(editRow.id, { nama_pos: editNama, tipe: editTipe });
      toast.success('Pos diubah.');
      setEditRow(null);
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [editRow, editNama, editTipe, load]);

  const onDelete = useCallback(async (id: number) => {
    try {
      await deletePos(id);
      toast.success('Pos dihapus.');
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

  const renderActions = useCallback((p: PosKeuangan) => (
    <>
      <ViewAction id={`btn_lihat_pos_${p.id}`} onClick={() => setViewRow(p)} />
      <EditAction id={`btn_ubah_pos_${p.id}`} onClick={() => openEdit(p)} />
      <DeleteAction
        id={`btn_hapus_pos_${p.id}`}
        title="Hapus pos?"
        description={`${p.nama_pos} akan dihapus permanen.`}
        onConfirm={() => onDelete(p.id)}
      />
    </>
  ), [openEdit, onDelete]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <ExcelTable
        tableKey="pos"
        fields={FIELDS}
        rows={rows}
        getValues={gridValues}
        loading={loading}
        emptyText="Belum ada pos keuangan."
        canEdit={canEdit}
        onCommit={commitDraft}
        onSaved={onSaved}
        searchValue={search}
        onSearchChange={onSearchChange}
        onSearchSubmit={onSearchSubmit}
        searchPlaceholder="Kode / nama pos"
        addButton={(
          <Button id="btn_buka_tambah_pos" onClick={() => setTambahOpen(true)}>
            + Pos
          </Button>
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
            <DialogTitle>Tambah pos keuangan</DialogTitle>
            <DialogDescription className="sr-only">Formulir penambahan pos keuangan baru.</DialogDescription>
          </DialogHeader>
          <form id="form_tambah_pos" onSubmit={onCreate} className="flex flex-col gap-3">
            <FieldGroup className="grid gap-3 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="input_kode_pos">Kode pos</FieldLabel>
                <Input id="input_kode_pos" value={kode} onChange={(e) => setKode(e.target.value)} required maxLength={20} placeholder="SPP" />
              </Field>
              <Field>
                <FieldLabel htmlFor="input_nama_pos">Nama pos</FieldLabel>
                <Input id="input_nama_pos" value={nama} onChange={(e) => setNama(e.target.value)} required maxLength={100} />
              </Field>
              <Field>
                <FieldLabel htmlFor="select_tipe_pos">Tipe</FieldLabel>
                <Select value={tipe} onValueChange={(v) => setTipe(v as TipePos)}>
                  <SelectTrigger id="select_tipe_pos">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {TIPE.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTambahOpen(false)}>Batal</Button>
              <Button id="btn_tambah_pos" type="submit">Tambah</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ViewDialog
        open={viewRow !== null}
        onOpenChange={(o) => { if (!o) setViewRow(null); }}
        title={viewRow ? `Pos: ${viewRow.nama_pos}` : 'Pos keuangan'}
        row={viewRow as unknown as Record<string, unknown> | null}
      />
      <Dialog open={editRow !== null} onOpenChange={(o) => { if (!o) setEditRow(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah pos keuangan</DialogTitle>
            <DialogDescription className="sr-only">Formulir perubahan pos keuangan.</DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-3">
            <Field>
              <FieldLabel htmlFor="input_ubah_nama_pos">Nama pos</FieldLabel>
              <Input id="input_ubah_nama_pos" value={editNama} onChange={(e) => setEditNama(e.target.value)} required maxLength={100} />
            </Field>
            <Field>
              <FieldLabel htmlFor="select_ubah_tipe_pos">Tipe</FieldLabel>
              <Select value={editTipe} onValueChange={(v) => setEditTipe(v as TipePos)}>
                <SelectTrigger id="select_ubah_tipe_pos">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {TIPE.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Batal</Button>
            <Button id="btn_simpan_pos" onClick={onUpdate}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
