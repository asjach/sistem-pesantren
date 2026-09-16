import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { FieldLabel } from '@/components/ui/field';
import MultiSelect from '@/components/MultiSelect';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { useLembagaAwalNumber } from '@/hooks/useLembagaAwal';
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
import { useAuth } from '../auth/AuthContext';
import { DeleteAction, EditAction, SetAktifAction, ViewAction } from '@/components/RowActions';
import { toast } from 'sonner';

const dateRule = (label: string) => (v: string | null) =>
  v && !/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${label} format YYYY-MM-DD.` : null;

const FIELDS: ExcelField[] = [
  {
    key: 'nama', label: 'Nama', width: 160, kind: 'text', maxLength: 50,
    required: true,
    validate: (v) => (!v || !v.trim() ? 'Nama tahun ajaran wajib diisi.' : null),
  },
  { key: 'lembaga', label: 'Lembaga', width: 200, kind: 'static' },
  {
    key: 'mulai', label: 'Mulai', width: 130, kind: 'text', maxLength: 10,
    validate: dateRule('Tanggal mulai'),
  },
  {
    key: 'selesai', label: 'Selesai', width: 130, kind: 'text', maxLength: 10,
    validate: dateRule('Tanggal selesai'),
  },
  { key: 'aktif', label: 'Aktif', width: 120, kind: 'static' },
];

function gridValues(t: TahunAjaran): Record<string, string | null> {
  return {
    nama: t.nama,
    lembaga: t.lembaga?.kode ?? t.lembaga?.nama ?? String(t.lembaga_id),
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
  useLembagaAwalNumber(setLembagaId);
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
  const [tambahLembagas, setTambahLembagas] = useState<string[]>([]);
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
    // Muat SEMUA lembaga terdaftar (batas maks backend) agar chip selalu
    // mencakup lembaga baru di masa depan, bukan hanya halaman pertama.
    listLembaga({ per_page: 1000 }).then((p) => setLembagas(p.data)).catch((e) => setErr(errorMessage(e)));
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

  const { user } = useAuth();
  const isSuper = !!user?.roles.some((r) => r.name === 'super_admin');
  // Admin yang terhubung ke lembaga tidak memilih: pakai lembaganya sendiri.
  const linkedLembagaIds = !isSuper ? (user?.lembagas ?? []).map((l) => l.id) : [];
  const pilihLembagaSendiri = linkedLembagaIds.length === 0;
  // Opsi chip: hanya lembaga operasional (induk pesantren tidak punya tahun ajaran).
  const opsiLembaga = useMemo(
    () => lembagas.filter((l) => l.parent != null).map((l) => ({ value: String(l.id), label: l.kode ?? l.nama })),
    [lembagas],
  );

  const onCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    const ids = pilihLembagaSendiri ? tambahLembagas.map(Number) : linkedLembagaIds;
    if (ids.length === 0) {
      setErr(pilihLembagaSendiri ? 'Pilih minimal 1 lembaga (wajib).' : 'Akun Anda tidak terhubung ke lembaga mana pun.');
      return;
    }
    try {
      const res = await createTahunAjaran({
        ...(ids.length === 1 ? { lembaga_id: ids[0] } : { lembaga_ids: ids }),
        nama,
        tanggal_mulai: mulai || undefined,
        tanggal_selesai: selesai || undefined,
      });
      toast.success(Array.isArray((res as { data?: unknown }).data) ? `${(res as { data: unknown[] }).data.length} tahun ajaran dibuat.` : 'Tahun ajaran dibuat.');
      setNama(''); setMulai(''); setSelesai(''); setTambahLembagas([]);
      setTambahOpen(false);
      pager.goFirst();
      await load(1);
    } catch (e2) {
      setErr(errorMessage(e2));
    }
  }, [pilihLembagaSendiri, tambahLembagas, linkedLembagaIds, nama, mulai, selesai, load, pager.goFirst]);

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

  /** Mode Input: buat TA baru dari baris input (butuh filter lembaga). */
  const createRow = useCallback(async (f: Record<string, string | null>) => {
    if (lembagaId === '') {
      throw new Error('Pilih filter lembaga dulu untuk mode Input.');
    }
    await createTahunAjaran({
      lembaga_id: Number(lembagaId),
      nama: (f.nama ?? '').trim(),
      tanggal_mulai: f.mulai || undefined,
      tanggal_selesai: f.selesai || undefined,
    });
    toast.success('Tahun ajaran dibuat.');
    await load(1);
  }, [lembagaId, load]);

  const lembagaTerpilih = useMemo(() => {
    const l = lembagas.find((x) => String(x.id) === String(lembagaId));
    return l?.kode ?? l?.nama ?? '';
  }, [lembagas, lembagaId]);

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
        onCreateRow={createRow}
        inputRowValues={{ lembaga: lembagaTerpilih }}
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
            <FieldLabel htmlFor="input_nama_ta">Nama (unik per lembaga)</FieldLabel>
            <Input id="input_nama_ta" value={nama} onChange={(e) => setNama(e.target.value)} required maxLength={50} placeholder="2026/2027" />
            {pilihLembagaSendiri ? (
              <>
                <FieldLabel htmlFor="select_lembaga_ta_tambah">Lembaga (min. 1)</FieldLabel>
                <MultiSelect
                  id="select_lembaga_ta_tambah"
                  title="Pilih lembaga"
                  placeholder="Pilih lembaga…"
                  options={opsiLembaga}
                  values={tambahLembagas}
                  onChange={setTambahLembagas}
                />
              </>
            ) : (
              <p className="col-span-2 text-sm text-muted-foreground">
                Dibuat untuk: {linkedLembagaIds.map((id) => lembagas.find((l) => l.id === id)?.kode ?? `#${id}`).join(', ')}
              </p>
            )}
            <FieldLabel htmlFor="input_mulai_ta">Tanggal mulai</FieldLabel>
            <Input id="input_mulai_ta" type="date" value={mulai} onChange={(e) => setMulai(e.target.value)} />
            <FieldLabel htmlFor="input_selesai_ta">Tanggal selesai</FieldLabel>
            <Input id="input_selesai_ta" type="date" value={selesai} onChange={(e) => setSelesai(e.target.value)} />
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setTambahOpen(false)}>Batal</Button>
              <Button id="btn_tambah_ta" type="submit" disabled={pilihLembagaSendiri && tambahLembagas.length === 0}>Tambah</Button>
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
            <FieldLabel htmlFor="input_ubah_nama_ta">Nama (unik per lembaga)</FieldLabel>
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
