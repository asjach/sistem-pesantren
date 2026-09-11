import { useEffect, useState } from 'react';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { ViewDialog } from '@/components/ViewDialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Pager from '@/components/Pager';
import { usePager } from '@/hooks/usePager';
import { DeleteAction, EditAction, ViewAction } from '@/components/RowActions';
import { toast } from 'sonner';

const TIPE: TipePos[] = ['bulanan', 'sekali_bayar', 'semesteran', 'tahunan'];

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
  const [kode, setKode] = useState('');
  const [nama, setNama] = useState('');
  const [tipe, setTipe] = useState<TipePos>('bulanan');
  const [tambahOpen, setTambahOpen] = useState(false);
  const [viewRow, setViewRow] = useState<PosKeuangan | null>(null);
  const [editRow, setEditRow] = useState<PosKeuangan | null>(null);
  const [editNama, setEditNama] = useState('');
  const [editTipe, setEditTipe] = useState<TipePos>('bulanan');

  const fields: ExcelField[] = [
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

  function openEdit(p: PosKeuangan) {
    setEditRow(p);
    setEditNama(p.nama_pos);
    setEditTipe(p.tipe);
  }

  async function load(p = pager.page, pp = pager.perPage) {
    setErr('');
    setLoading(true);
    try {
      const res = await listPos({ search: search || undefined, page: p, per_page: pp });
      const fix = pager.sync(res.current_page, res.last_page);
      if (fix != null && fix !== p) {
        await load(fix, pp);
        return;
      }
      setRows(res.data);
      setLastPage(res.last_page);
      setTotal(res.total);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (pager.ready) load(pager.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pager.ready]);

  async function onCreate(e: React.FormEvent) {
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
  }

  async function onUpdate() {
    if (!editRow) return;
    try {
      await updatePos(editRow.id, { nama_pos: editNama, tipe: editTipe });
      toast.success('Pos diubah.');
      setEditRow(null);
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  async function onDelete(id: number) {
    try {
      await deletePos(id);
      toast.success('Pos dihapus.');
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  return (
    <div className="flex h-[calc(100dvh_-_3.5rem)] flex-col max-md:h-auto max-md:min-h-[calc(100dvh_-_2rem)]">
      <div className="flex flex-wrap items-center gap-3">
        <h1 id="title_pos" className="text-2xl font-bold">Pos Keuangan</h1>
      </div>
      {err && (
        <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>
      )}
      <ExcelTable
        tableKey="pos"
        fields={fields}
        rows={rows}
        getValues={gridValues}
        loading={loading}
        emptyText="Belum ada pos keuangan."
        canEdit={canEdit}
        onCommit={commitDraft}
        onSaved={() => load()}
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={() => { pager.goFirst(); load(1); }}
        searchPlaceholder="Kode / nama pos"
        addButton={(
          <Button id="btn_buka_tambah_pos" onClick={() => setTambahOpen(true)}>
            + Pos
          </Button>
        )}
        renderActions={(p) => (
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
        )}
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
          </DialogHeader>
          <form id="form_tambah_pos" onSubmit={onCreate} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="input_kode_pos">Kode pos</Label>
            <Input id="input_kode_pos" value={kode} onChange={(e) => setKode(e.target.value)} required maxLength={20} placeholder="SPP" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="input_nama_pos">Nama pos</Label>
            <Input id="input_nama_pos" value={nama} onChange={(e) => setNama(e.target.value)} required maxLength={100} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="select_tipe_pos">Tipe</Label>
            <Select value={tipe} onValueChange={(v) => setTipe(v as TipePos)}>
              <SelectTrigger id="select_tipe_pos">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPE.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
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
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="input_ubah_nama_pos">Nama pos</Label>
              <Input id="input_ubah_nama_pos" value={editNama} onChange={(e) => setEditNama(e.target.value)} required maxLength={100} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="select_ubah_tipe_pos">Tipe</Label>
              <Select value={editTipe} onValueChange={(v) => setEditTipe(v as TipePos)}>
                <SelectTrigger id="select_ubah_tipe_pos">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPE.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Batal</Button>
            <Button id="btn_simpan_pos" onClick={onUpdate}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
