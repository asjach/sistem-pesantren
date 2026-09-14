import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { FieldLabel } from '@/components/ui/field';
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

const FIELDS: ExcelField[] = [
  {
    key: 'nama', label: 'Nama', width: 160, minWidth: 120, kind: 'text', maxLength: 50,
    required: true,
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
  const reqRef = useRef(0);

  // Pilihan lembaga + TA khusus dialog Tambah (mandiri dari filter toolbar).
  const [tambahLembagaId, setTambahLembagaId] = useState<number | ''>('');
  const [tambahTaId, setTambahTaId] = useState<number | ''>('');
  const [tambahTas, setTambahTas] = useState<TahunAjaran[]>([]);
  const tambahTaReqRef = useRef(0);

  const [namaKelas, setNamaKelas] = useState('');
  const [tingkat, setTingkat] = useState('');
  const [kapasitas, setKapasitas] = useState('');
  const [tambahOpen, setTambahOpen] = useState(false);
  const [viewRow, setViewRow] = useState<Kelas | null>(null);
  const [editRow, setEditRow] = useState<Kelas | null>(null);
  const [editNama, setEditNama] = useState('');
  const [editTingkat, setEditTingkat] = useState('');
  const [editKapasitas, setEditKapasitas] = useState('');

  const load = useCallback(
    async function loadPage(p = pager.page, pp = pager.perPage) {
      const req = ++reqRef.current;
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
    [search, lembagaId, taId, pager.page, pager.perPage, pager.sync],
  );

  useEffect(() => {
    listLembaga().then((p) => setLembagas(p.data)).catch((e) => setErr(errorMessage(e)));
  }, []);

  useEffect(() => {
    if (lembagaId === '') {
      setTas([]);
      return;
    }
    let alive = true;
    listTahunAjaran({ lembaga_id: Number(lembagaId) })
      .then((p) => { if (alive) setTas(p.data); })
      .catch((e) => { if (alive) setErr(errorMessage(e)); });
    return () => { alive = false; };
  }, [lembagaId]);

  // Dialog Tambah: muat TA milik lembaga terpilih; pilih TA aktif otomatis
  // selama pilihan sebelumnya kosong/tidak lagi ada di daftar.
  useEffect(() => {
    const req = ++tambahTaReqRef.current;
    if (tambahLembagaId === '') {
      setTambahTas([]);
      return;
    }
    listTahunAjaran({ lembaga_id: Number(tambahLembagaId), per_page: 100 })
      .then((p) => {
        if (req !== tambahTaReqRef.current) return;
        setTambahTas(p.data);
        setTambahTaId((prev) => {
          if (prev !== '' && p.data.some((t) => String(t.id) === String(prev))) return prev;
          const aktif = p.data.find((t) => t.is_aktif);
          return aktif ? aktif.id : '';
        });
      })
      .catch((e) => {
        if (req !== tambahTaReqRef.current) return;
        setTambahTas([]);
        setErr(errorMessage(e));
      });
  }, [tambahLembagaId]);

  const bukaTambah = useCallback(() => {
    setTambahLembagaId(lembagaId);
    // Utamakan TA filter; bila kosong pakai TA aktif dari daftar yang sudah ada
    // (efek pemuat akan mengoreksi bila daftar itu milik lembaga lain).
    const aktif = tambahTas.find((t) => t.is_aktif);
    setTambahTaId(taId !== '' ? taId : (aktif ? aktif.id : ''));
    setTambahOpen(true);
  }, [lembagaId, taId, tambahTas]);

  useEffect(() => {
    if (pager.ready) load(pager.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pager.ready, search, lembagaId, taId]);

  const openEdit = useCallback((k: Kelas) => {
    setEditRow(k);
    setEditNama(k.nama_kelas);
    setEditTingkat(k.tingkat ?? '');
    setEditKapasitas(k.kapasitas === null || k.kapasitas === undefined ? '' : String(k.kapasitas));
  }, []);

  const onCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (tambahLembagaId === '' || tambahTaId === '') {
      setErr('Lembaga + tahun ajaran wajib (kelas se-lembaga dengan TA).');
      return;
    }
    try {
      await createKelas({
        lembaga_id: Number(tambahLembagaId),
        tahun_ajaran_id: Number(tambahTaId),
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
  }, [tambahLembagaId, tambahTaId, namaKelas, tingkat, kapasitas, load, pager.goFirst]);

  /** Mode Input: buat kelas baru dari baris input (butuh filter lembaga+TA). */
  const createRow = useCallback(async (f: Record<string, string | null>) => {
    if (lembagaId === '' || taId === '') {
      throw new Error('Pilih filter lembaga & tahun ajaran dulu untuk mode Input.');
    }
    await createKelas({
      lembaga_id: Number(lembagaId),
      tahun_ajaran_id: Number(taId),
      nama_kelas: (f.nama ?? '').trim(),
      tingkat: f.tingkat || undefined,
      kapasitas: f.kapasitas ? Number(f.kapasitas) : undefined,
    });
    toast.success('Kelas dibuat.');
    await load(1);
  }, [lembagaId, taId, load]);

  const taTerpilih = useMemo(
    () => tas.find((t) => String(t.id) === String(taId))?.nama ?? '',
    [tas, taId],
  );

  const onUpdate = useCallback(async () => {
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
  }, [editRow, editNama, editTingkat, editKapasitas, load]);

  const onDelete = useCallback(async (id: number) => {
    try {
      await deleteKelas(id);
      toast.success('Kelas dihapus.');
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

  const renderActions = useCallback((k: Kelas) => (
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
  ), [openEdit, onDelete]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <ExcelTable
        tableKey="kelas"
        fields={FIELDS}
        rows={rows}
        getValues={gridValues}
        loading={loading}
        emptyText="Belum ada kelas."
        canEdit
        onCommit={commitDraft}
        onSaved={onSaved}
        onCreateRow={createRow}
        inputRowValues={{ ta: taTerpilih }}
        searchValue={search}
        onSearchChange={onSearchChange}
        onSearchSubmit={onSearchSubmit}
        searchPlaceholder="Nama kelas"
        addButton={(
          <Button id="btn_buka_tambah_kelas" onClick={bukaTambah}>
            + Kelas
          </Button>
        )}
        searchIds={{ form: 'form_filter_kelas', input: 'input_cari_kelas', button: 'btn_cari_kelas' }}
        filter={(
          <>
            <Select
              value={lembagaId === '' ? '_semua' : String(lembagaId)}
              onValueChange={(v) => { setLembagaId(v === '_semua' ? '' : Number(v)); setTaId(''); pager.goFirst(); }}
            >
              <SelectTrigger id="select_lembaga_kelas" title="Filter lembaga" aria-label="Filter lembaga" size="sm" className="w-36">
                <SelectValue placeholder="Semua" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="_semua">Semua</SelectItem>
                  {lembagas.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.kode ?? l.nama}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Select
              value={taId === '' ? '_semua' : String(taId)}
              onValueChange={(v) => { setTaId(v === '_semua' ? '' : Number(v)); pager.goFirst(); }}
            >
              <SelectTrigger id="select_ta_kelas" title="Filter tahun ajaran" aria-label="Filter tahun ajaran" size="sm" className="w-36">
                <SelectValue placeholder="Semua" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="_semua">Semua</SelectItem>
                  {tas.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.nama}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
          </>
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
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tambah kelas</DialogTitle>
            <DialogDescription className="sr-only">Formulir penambahan kelas baru.</DialogDescription>
          </DialogHeader>
          <form id="form_tambah_kelas" onSubmit={onCreate} className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
            <FieldLabel htmlFor="select_tambah_lembaga_kelas">Lembaga</FieldLabel>
            <Select
              value={tambahLembagaId === '' ? '' : String(tambahLembagaId)}
              onValueChange={(v) => { setTambahLembagaId(Number(v)); setTambahTaId(''); }}
            >
              <SelectTrigger id="select_tambah_lembaga_kelas" className="w-full">
                <SelectValue placeholder="Pilih lembaga" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {lembagas.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.kode ?? l.nama}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldLabel htmlFor="select_tambah_ta_kelas" className="self-start pt-1.5">Tahun ajaran</FieldLabel>
            <div className="flex flex-col gap-1.5">
              <Select
                value={tambahTaId === '' ? '' : String(tambahTaId)}
                onValueChange={(v) => setTambahTaId(Number(v))}
                disabled={tambahLembagaId === ''}
              >
                <SelectTrigger id="select_tambah_ta_kelas" className="w-full">
                  <SelectValue placeholder={tambahLembagaId === '' ? 'Pilih lembaga dulu' : 'Pilih tahun ajaran'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {tambahTas.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.nama}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {tambahLembagaId !== '' && tambahTas.length === 0 ? (
                <p className="text-xs text-muted-foreground">Belum ada tahun ajaran di lembaga ini.</p>
              ) : null}
            </div>
            <FieldLabel htmlFor="input_nama_kelas">Nama kelas</FieldLabel>
            <Input id="input_nama_kelas" value={namaKelas} onChange={(e) => setNamaKelas(e.target.value)} required maxLength={50} placeholder="VII-A" />
            <FieldLabel htmlFor="input_tingkat_kelas">Tingkat (kamus, opsional)</FieldLabel>
            <Input id="input_tingkat_kelas" value={tingkat} onChange={(e) => setTingkat(e.target.value)} placeholder="7 / 8 / 9" />
            <FieldLabel htmlFor="input_kapasitas_kelas">Kapasitas</FieldLabel>
            <Input id="input_kapasitas_kelas" type="number" min={1} value={kapasitas} onChange={(e) => setKapasitas(e.target.value)} />
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setTambahOpen(false)}>Batal</Button>
              <Button
                id="btn_tambah_kelas"
                type="submit"
                disabled={tambahLembagaId === '' || tambahTaId === '' || !namaKelas.trim()}
              >
                Tambah
              </Button>
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
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Ubah kelas</DialogTitle>
            <DialogDescription className="sr-only">Formulir perubahan data kelas.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
            <FieldLabel htmlFor="input_ubah_nama_kelas">Nama kelas</FieldLabel>
            <Input id="input_ubah_nama_kelas" value={editNama} onChange={(e) => setEditNama(e.target.value)} required maxLength={50} />
            <FieldLabel htmlFor="input_ubah_tingkat_kelas">Tingkat (kamus, opsional)</FieldLabel>
            <Input id="input_ubah_tingkat_kelas" value={editTingkat} onChange={(e) => setEditTingkat(e.target.value)} />
            <FieldLabel htmlFor="input_ubah_kapasitas_kelas">Kapasitas</FieldLabel>
            <Input id="input_ubah_kapasitas_kelas" type="number" min={1} value={editKapasitas} onChange={(e) => setEditKapasitas(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditRow(null)}>Batal</Button>
            <Button id="btn_simpan_kelas" onClick={onUpdate}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
