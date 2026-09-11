import { useEffect, useState } from 'react';
import { errorMessage } from '../api/client';
import {
  createKelas,
  deleteKelas,
  listKelas,
  listLembaga,
  listTahunAjaran,
  updateKelas,
  type Kelas,
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
import { DeleteAction, EditAction, ViewAction } from '@/components/RowActions';
import { toast } from 'sonner';

export default function KelasPage() {
  const [lembagas, setLembagas] = useState<Lembaga[]>([]);
  const [tas, setTas] = useState<TahunAjaran[]>([]);
  const [lembagaId, setLembagaId] = useState<number | ''>('');
  const [taId, setTaId] = useState<number | ''>('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<Kelas[]>([]);
  const pager = usePager('kelas');
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [namaKelas, setNamaKelas] = useState('');
  const [tingkat, setTingkat] = useState('');
  const [kapasitas, setKapasitas] = useState('');
  const [tambahOpen, setTambahOpen] = useState(false);
  const [viewRow, setViewRow] = useState<Kelas | null>(null);
  const [editRow, setEditRow] = useState<Kelas | null>(null);
  const [editNama, setEditNama] = useState('');
  const [editTingkat, setEditTingkat] = useState('');
  const [editKapasitas, setEditKapasitas] = useState('');

  const fields: ExcelField[] = [
    {
      key: 'nama', label: 'Nama', width: 160, minWidth: 120, kind: 'text', maxLength: 50,
      validate: (v) => (!v || !v.trim() ? 'Nama kelas wajib diisi.' : null),
    },
    {
      key: 'tingkat', label: 'Tingkat', width: 120, minWidth: 90, kind: 'text', maxLength: 20,
    },
    { key: 'ta', label: 'TA', width: 160, minWidth: 120, kind: 'static' },
    {
      key: 'kapasitas', label: 'Kapasitas', width: 120, minWidth: 90, kind: 'text', maxLength: 10,
      validate: (v) => {
        if (!v) return null;
        const n = Number(v);
        return !Number.isInteger(n) || n < 1 ? 'Kapasitas bilangan bulat ≥ 1.' : null;
      },
    },
  ];

  function gridValues(k: Kelas): Record<string, string | null> {
    return {
      nama: k.nama_kelas,
      tingkat: k.tingkat,
      ta: k.tahunAjaran?.nama ?? k.tahun_ajaran?.nama ?? String(k.tahun_ajaran_id),
      kapasitas: k.kapasitas === null || k.kapasitas === undefined ? '' : String(k.kapasitas),
    };
  }

  async function commitDraft(id: number, f: Record<string, string | null>) {
    await updateKelas(id, {
      ...(f.nama !== undefined ? { nama_kelas: f.nama ?? '' } : {}),
      ...(f.tingkat !== undefined ? { tingkat: f.tingkat || null } : {}),
      ...(f.kapasitas !== undefined
        ? { kapasitas: f.kapasitas ? Number(f.kapasitas) : null }
        : {}),
    });
  }

  function openEdit(k: Kelas) {
    setEditRow(k);
    setEditNama(k.nama_kelas);
    setEditTingkat(k.tingkat ?? '');
    setEditKapasitas(k.kapasitas === null || k.kapasitas === undefined ? '' : String(k.kapasitas));
  }

  useEffect(() => {
    listLembaga().then((p) => setLembagas(p.data)).catch((e) => setErr(errorMessage(e)));
  }, []);

  useEffect(() => {
    if (lembagaId === '') {
      setTas([]);
      return;
    }
    listTahunAjaran({ lembaga_id: Number(lembagaId) })
      .then((p) => setTas(p.data))
      .catch((e) => setErr(errorMessage(e)));
  }, [lembagaId]);

  async function load(p = pager.page, pp = pager.perPage) {
    setErr('');
    setLoading(true);
    try {
      const res = await listKelas({
        search: search || undefined,
        lembaga_id: lembagaId === '' ? undefined : Number(lembagaId),
        tahun_ajaran_id: taId === '' ? undefined : Number(taId),
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
    if (lembagaId === '' || taId === '') {
      setErr('Lembaga + tahun ajaran wajib (kelas se-lembaga dengan TA).');
      return;
    }
    try {
      await createKelas({
        lembaga_id: Number(lembagaId),
        tahun_ajaran_id: Number(taId),
        nama_kelas: namaKelas,
        tingkat: tingkat || undefined,
        kapasitas: kapasitas ? Number(kapasitas) : undefined,
      });
      toast.success('Kelas dibuat.');
      setNamaKelas(''); setTingkat(''); setKapasitas('');
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
      await updateKelas(editRow.id, {
        nama_kelas: editNama,
        tingkat: editTingkat || null,
        kapasitas: editKapasitas ? Number(editKapasitas) : null,
      });
      toast.success('Kelas diubah.');
      setEditRow(null);
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  async function onDelete(id: number) {
    try {
      await deleteKelas(id);
      toast.success('Kelas dihapus.');
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  return (
    <div className="flex h-[calc(100dvh_-_3.5rem)] flex-col max-md:h-auto max-md:min-h-[calc(100dvh_-_2rem)]">
      <div className="flex flex-wrap items-center gap-3">
        <h1 id="title_kelas" className="text-2xl font-bold">Kelas</h1>
      </div>
      {err && (
        <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>
      )}
      <ExcelTable
        tableKey="kelas"
        fields={fields}
        rows={rows}
        getValues={gridValues}
        loading={loading}
        emptyText="Belum ada kelas."
        canEdit
        onCommit={commitDraft}
        onSaved={() => load()}
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={() => { pager.goFirst(); load(1); }}
        searchPlaceholder="Nama kelas"
        addButton={(
          <Button id="btn_buka_tambah_kelas" onClick={() => setTambahOpen(true)}>
            + Kelas
          </Button>
        )}
        searchIds={{ form: 'form_filter_kelas', input: 'input_cari_kelas', button: 'btn_cari_kelas' }}
        filter={(
          <>
            <Select value={lembagaId === '' ? '_semua' : String(lembagaId)} onValueChange={(v) => { setLembagaId(v === '_semua' ? '' : Number(v)); setTaId(''); }}>
              <SelectTrigger id="select_lembaga_kelas" title="Filter lembaga" aria-label="Filter lembaga" className="h-6 w-36">
                <SelectValue placeholder="Semua" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_semua">Semua</SelectItem>
                {lembagas.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.nama}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={taId === '' ? '_semua' : String(taId)} onValueChange={(v) => setTaId(v === '_semua' ? '' : Number(v))}>
              <SelectTrigger id="select_ta_kelas" title="Filter tahun ajaran" aria-label="Filter tahun ajaran" className="h-6 w-36">
                <SelectValue placeholder="Semua" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_semua">Semua</SelectItem>
                {tas.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.nama}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        )}
        renderActions={(k) => (
          <>
            <ViewAction id={`btn_lihat_kelas_${k.id}`} onClick={() => setViewRow(k)} />
            <EditAction id={`btn_ubah_kelas_${k.id}`} onClick={() => openEdit(k)} />
            <DeleteAction
              id={`btn_hapus_kelas_${k.id}`}
              title="Hapus kelas?"
              description={`${k.nama_kelas} akan dihapus permanen.`}
              onConfirm={() => onDelete(k.id)}
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
            <DialogTitle>Tambah kelas</DialogTitle>
          </DialogHeader>
          <form id="form_tambah_kelas" onSubmit={onCreate} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="input_nama_kelas">Nama kelas</Label>
            <Input id="input_nama_kelas" value={namaKelas} onChange={(e) => setNamaKelas(e.target.value)} required maxLength={50} placeholder="VII-A" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="input_tingkat_kelas">Tingkat (kamus, opsional)</Label>
            <Input id="input_tingkat_kelas" value={tingkat} onChange={(e) => setTingkat(e.target.value)} placeholder="7 / 8 / 9" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="input_kapasitas_kelas">Kapasitas</Label>
            <Input id="input_kapasitas_kelas" type="number" min={1} value={kapasitas} onChange={(e) => setKapasitas(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setTambahOpen(false)}>Batal</Button>
          <Button id="btn_tambah_kelas" type="submit">Tambah</Button>
        </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
      <ViewDialog
        open={viewRow !== null}
        onOpenChange={(o) => { if (!o) setViewRow(null); }}
        title={viewRow ? `Kelas: ${viewRow.nama_kelas}` : 'Kelas'}
        row={viewRow as unknown as Record<string, unknown> | null}
      />
      <Dialog open={editRow !== null} onOpenChange={(o) => { if (!o) setEditRow(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah kelas</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="input_ubah_nama_kelas">Nama kelas</Label>
              <Input id="input_ubah_nama_kelas" value={editNama} onChange={(e) => setEditNama(e.target.value)} required maxLength={50} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="input_ubah_tingkat_kelas">Tingkat (kamus, opsional)</Label>
              <Input id="input_ubah_tingkat_kelas" value={editTingkat} onChange={(e) => setEditTingkat(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="input_ubah_kapasitas_kelas">Kapasitas</Label>
              <Input id="input_ubah_kapasitas_kelas" type="number" min={1} value={editKapasitas} onChange={(e) => setEditKapasitas(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Batal</Button>
            <Button id="btn_simpan_kelas" onClick={onUpdate}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
