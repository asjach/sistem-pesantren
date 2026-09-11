import { useEffect, useState } from 'react';
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
import { DeleteAction, EditAction, SetAktifAction, ViewAction } from '@/components/RowActions';
import { toast } from 'sonner';

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
  const [nama, setNama] = useState('');
  const [mulai, setMulai] = useState('');
  const [selesai, setSelesai] = useState('');
  const [tambahOpen, setTambahOpen] = useState(false);
  const [viewRow, setViewRow] = useState<TahunAjaran | null>(null);
  const [editRow, setEditRow] = useState<TahunAjaran | null>(null);
  const [editNama, setEditNama] = useState('');
  const [editMulai, setEditMulai] = useState('');
  const [editSelesai, setEditSelesai] = useState('');

  const dateRule = (label: string) => (v: string | null) =>
    v && !/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${label} format YYYY-MM-DD.` : null;

  const fields: ExcelField[] = [
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

  function openEdit(t: TahunAjaran) {
    setEditRow(t);
    setEditNama(t.nama);
    setEditMulai(t.tanggal_mulai ?? '');
    setEditSelesai(t.tanggal_selesai ?? '');
  }

  useEffect(() => {
    listLembaga().then((p) => setLembagas(p.data)).catch((e) => setErr(errorMessage(e)));
  }, []);

  async function load(p = pager.page, pp = pager.perPage) {
    setErr('');
    setLoading(true);
    try {
      const res = await listTahunAjaran({
        search: search || undefined,
        lembaga_id: lembagaId === '' ? undefined : Number(lembagaId),
        page: p,
        per_page: pp,
      });
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
  }

  async function onSetAktif(id: number) {
    try {
      await setAktifTahunAjaran(id);
      toast.success('Tahun ajaran diaktifkan.');
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  async function onUpdate() {
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
  }

  async function onDelete(id: number) {
    try {
      await deleteTahunAjaran(id);
      toast.success('Tahun ajaran dihapus.');
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  return (
    <div className="flex h-[calc(100dvh_-_3.5rem)] flex-col max-md:h-auto max-md:min-h-[calc(100dvh_-_2rem)]">
      <div className="flex flex-wrap items-center gap-3">
        <h1 id="title_tahun_ajaran" className="text-2xl font-bold">Tahun Ajaran</h1>
      </div>
      {err && (
        <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>
      )}
      <ExcelTable
        tableKey="tahun_ajaran"
        fields={fields}
        rows={rows}
        getValues={gridValues}
        loading={loading}
        emptyText="Belum ada tahun ajaran."
        canEdit
        onCommit={commitDraft}
        onSaved={() => load()}
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={() => { pager.goFirst(); load(1); }}
        searchPlaceholder="Nama mis. 2026/2027"
        addButton={(
          <Button id="btn_buka_tambah_ta" onClick={() => setTambahOpen(true)}>
            + Tahun Ajaran
          </Button>
        )}
        searchIds={{ form: 'form_filter_ta', input: 'input_cari_ta', button: 'btn_cari_ta' }}
        filter={(
          <Select value={lembagaId === '' ? '_semua' : String(lembagaId)} onValueChange={(v) => setLembagaId(v === '_semua' ? '' : Number(v))}>
            <SelectTrigger id="select_lembaga_ta" title="Filter lembaga" aria-label="Filter lembaga" className="h-6 w-36">
              <SelectValue placeholder="Semua (akses saya)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_semua">Semua (akses saya)</SelectItem>
              {lembagas.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.nama} ({l.kode ?? '-'})</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        renderActions={(t) => (
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
            <DialogTitle>Tambah tahun ajaran</DialogTitle>
          </DialogHeader>
          <form id="form_tambah_ta" onSubmit={onCreate} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="input_nama_ta">Nama (unik per lembaga)</Label>
            <Input id="input_nama_ta" value={nama} onChange={(e) => setNama(e.target.value)} required maxLength={50} placeholder="2026/2027" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="input_mulai_ta">Tanggal mulai</Label>
            <Input id="input_mulai_ta" type="date" value={mulai} onChange={(e) => setMulai(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="input_selesai_ta">Tanggal selesai</Label>
            <Input id="input_selesai_ta" type="date" value={selesai} onChange={(e) => setSelesai(e.target.value)} />
          </div>
        </div>
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
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="input_ubah_nama_ta">Nama (unik per lembaga)</Label>
              <Input id="input_ubah_nama_ta" value={editNama} onChange={(e) => setEditNama(e.target.value)} required maxLength={50} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="input_ubah_mulai_ta">Tanggal mulai</Label>
              <Input id="input_ubah_mulai_ta" type="date" value={editMulai} onChange={(e) => setEditMulai(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="input_ubah_selesai_ta">Tanggal selesai</Label>
              <Input id="input_ubah_selesai_ta" type="date" value={editSelesai} onChange={(e) => setEditSelesai(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Batal</Button>
            <Button id="btn_simpan_ta" onClick={onUpdate}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
