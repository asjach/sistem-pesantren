import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage } from '../api/client';
import {
  createTarif,
  deleteTarif,
  listLembaga,
  listPos,
  listTahunAjaran,
  listTarif,
  updateTarif,
  type Lembaga,
  type PosKeuangan,
  type TahunAjaran,
  type TarifBiaya,
  type TipeSantriTarif,
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
import { useLembagaAwalNumber } from '@/hooks/useLembagaAwal';
import { useTahunAjaranAwalNumber } from '@/hooks/useTahunAjaranAwal';
import FilterField from '@/components/FilterField';
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

const numRule = (label: string, required: boolean) => (v: string | null) => {
  if (!v) return required ? `${label} wajib diisi.` : null;
  const n = Number(v);
  return !Number.isFinite(n) || n < 0 ? `${label} angka ≥ 0.` : null;
};

const FIELDS: ExcelField[] = [
  { key: 'pos', label: 'Pos', width: 140, kind: 'static' },
  { key: 'lembaga', label: 'Lembaga', width: 180, kind: 'static' },
  { key: 'ta', label: 'TA', width: 140, kind: 'static' },
  {
    key: 'tipe', label: 'Tipe santri', width: 130, kind: 'static',
    inputKind: 'select',
    inputChoices: [
      { value: 'semua', label: 'semua' },
      { value: 'asrama', label: 'asrama' },
      { value: 'non_asrama', label: 'non_asrama' },
    ],
  },
  {
    key: 'nominal', label: 'Nominal', width: 160, kind: 'text', maxLength: 20,
    required: true,
    validate: numRule('Nominal', true),
  },
  {
    key: 'paket', label: 'Paket', width: 160, kind: 'text', maxLength: 20,
    validate: numRule('Nominal paket', false),
  },
];

function gridValues(t: TarifBiaya): Record<string, string | null> {
  return {
    pos: t.pos?.kode_pos ?? String(t.pos_keuangan_id),
    lembaga: t.lembaga?.kode ?? t.lembaga?.nama ?? String(t.lembaga_id),
    ta: t.tahunAjaran?.nama ?? t.tahun_ajaran?.nama ?? String(t.tahun_ajaran_id),
    tipe: t.tipe_santri,
    nominal: String(t.nominal),
    paket: t.nominal_paket === null || t.nominal_paket === undefined ? '' : String(t.nominal_paket),
  };
}

async function commitDraft(id: number, f: Record<string, string | null>) {
  await updateTarif(id, {
    ...(f.nominal !== undefined ? { nominal: Number(f.nominal) } : {}),
    ...(f.paket !== undefined ? { nominal_paket: f.paket ? Number(f.paket) : null } : {}),
  });
}

export default function TarifPage() {
  const [lembagas, setLembagas] = useState<Lembaga[]>([]);
  const [posList, setPosList] = useState<PosKeuangan[]>([]);
  const [tas, setTas] = useState<TahunAjaran[]>([]);
  const [lembagaId, setLembagaId] = useState<number | ''>('');
  useLembagaAwalNumber(setLembagaId);
  const [posId, setPosId] = useState<number | ''>('');
  const [taId, setTaId] = useState<number | ''>('');
  useTahunAjaranAwalNumber(setTaId);
  const [rows, setRows] = useState<TarifBiaya[]>([]);
  const pager = usePager('tarif');
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const reqRef = useRef(0);

  const [nominal, setNominal] = useState('');
  const [nominalPaket, setNominalPaket] = useState('');
  const [tipeSantri, setTipeSantri] = useState<TipeSantriTarif>('semua');
  const [tambahOpen, setTambahOpen] = useState(false);
  const [viewRow, setViewRow] = useState<TarifBiaya | null>(null);
  const [editRow, setEditRow] = useState<TarifBiaya | null>(null);
  const [editNominal, setEditNominal] = useState('');
  const [editPaket, setEditPaket] = useState('');

  const load = useCallback(
    async function loadPage(p = pager.page, pp = pager.perPage) {
      const req = ++reqRef.current;
      setErr('');
      setLoading(true);
      try {
        const res = await listTarif({
          lembaga_id: lembagaId === '' ? undefined : Number(lembagaId),
          pos_keuangan_id: posId === '' ? undefined : Number(posId),
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
    [lembagaId, posId, taId, pager.page, pager.perPage, pager.sync],
  );

  useEffect(() => {
    listLembaga().then((p) => setLembagas(p.data)).catch((e) => setErr(errorMessage(e)));
    listPos().then((p) => setPosList(p.data)).catch((e) => setErr(errorMessage(e)));
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

  useEffect(() => {
    if (pager.ready) load(pager.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pager.ready, lembagaId, posId, taId]);

  const openEdit = useCallback((t: TarifBiaya) => {
    setEditRow(t);
    setEditNominal(String(t.nominal));
    setEditPaket(t.nominal_paket === null || t.nominal_paket === undefined ? '' : String(t.nominal_paket));
  }, []);

  const onCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (lembagaId === '' || posId === '' || taId === '') {
      setErr('Pos + lembaga + tahun ajaran wajib (triple FK).');
      return;
    }
    try {
      await createTarif({
        pos_keuangan_id: Number(posId),
        lembaga_id: Number(lembagaId),
        tahun_ajaran_id: Number(taId),
        tipe_santri: tipeSantri,
        nominal: Number(nominal),
        nominal_paket: nominalPaket ? Number(nominalPaket) : null,
      });
      toast.success('Tarif dibuat.');
      setNominal(''); setNominalPaket('');
      setTambahOpen(false);
      pager.goFirst();
      await load(1);
    } catch (e2) {
      setErr(errorMessage(e2));
    }
  }, [lembagaId, posId, taId, tipeSantri, nominal, nominalPaket, load, pager.goFirst]);

  const onUpdate = useCallback(async () => {
    if (!editRow) return;
    try {
      await updateTarif(editRow.id, {
        nominal: Number(editNominal),
        nominal_paket: editPaket ? Number(editPaket) : null,
      });
      toast.success('Tarif diubah.');
      setEditRow(null);
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [editRow, editNominal, editPaket, load]);

  const onDelete = useCallback(async (id: number) => {
    try {
      await deleteTarif(id);
      toast.success('Tarif dihapus.');
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [load]);

  const onSearchSubmit = useCallback(() => {
    pager.goFirst();
  }, [pager.goFirst]);

  const onSaved = useCallback(() => load(), [load]);

  /** Mode Input: buat tarif baru dari baris input (butuh 3 filter terisi). */
  const createRow = useCallback(async (f: Record<string, string | null>) => {
    if (lembagaId === '' || posId === '' || taId === '') {
      throw new Error('Pilih filter pos, lembaga, & tahun ajaran dulu untuk mode Input.');
    }
    await createTarif({
      pos_keuangan_id: Number(posId),
      lembaga_id: Number(lembagaId),
      tahun_ajaran_id: Number(taId),
      tipe_santri: (f.tipe ?? 'semua') as TipeSantriTarif,
      nominal: Number(f.nominal),
      nominal_paket: f.paket ? Number(f.paket) : undefined,
    });
    toast.success('Tarif dibuat.');
    await load(1);
  }, [lembagaId, posId, taId, load]);

  const posTerpilih = useMemo(
    () => posList.find((p) => String(p.id) === String(posId))?.kode_pos ?? '',
    [posList, posId],
  );
  const lembagaTerpilih = useMemo(() => {
    const l = lembagas.find((x) => String(x.id) === String(lembagaId));
    return l?.kode ?? l?.nama ?? '';
  }, [lembagas, lembagaId]);
  const taTerpilih = useMemo(
    () => tas.find((t) => String(t.id) === String(taId))?.nama ?? '',
    [tas, taId],
  );

  const renderActions = useCallback((t: TarifBiaya) => (
    <>
      <ViewAction id={`btn_lihat_tarif_${t.id}`} onClick={() => setViewRow(t)} />
      <EditAction id={`btn_ubah_tarif_${t.id}`} onClick={() => openEdit(t)} />
      <DeleteAction
        id={`btn_hapus_tarif_${t.id}`}
        title="Hapus tarif?"
        description="Tarif akan dihapus permanen."
        onConfirm={() => onDelete(t.id)}
      />
    </>
  ), [openEdit, onDelete]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <ExcelTable
        tableKey="tarif"
        fields={FIELDS}
        rows={rows}
        getValues={gridValues}
        loading={loading}
        emptyText="Belum ada tarif."
        canEdit
        onCommit={commitDraft}
        onSaved={onSaved}
        onCreateRow={createRow}
        inputRowValues={{ pos: posTerpilih, lembaga: lembagaTerpilih, ta: taTerpilih }}
        onSearchSubmit={onSearchSubmit}
        searchIds={{ form: 'form_filter_tarif', button: 'btn_cari_tarif' }}
        addButton={(
          <Button id="btn_buka_tambah_tarif" onClick={() => setTambahOpen(true)}>
            + Tarif
          </Button>
        )}
        filter={(
          <>
            <FilterField label="Pos" htmlFor="select_pos_tarif">
            <Select
              value={posId === '' ? '_semua' : String(posId)}
              onValueChange={(v) => { setPosId(v === '_semua' ? '' : Number(v)); pager.goFirst(); }}
            >
              <SelectTrigger id="select_pos_tarif" title="Filter pos" aria-label="Filter pos" size="sm" className="w-36">
                <SelectValue placeholder="Semua" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="_semua">Semua</SelectItem>
                  {posList.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.kode_pos} — {p.nama_pos}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
            </FilterField>
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
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Tambah tarif</DialogTitle>
            <DialogDescription className="sr-only">Formulir penambahan tarif baru.</DialogDescription>
          </DialogHeader>
          <form id="form_tambah_tarif" onSubmit={onCreate} className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
            <FieldLabel htmlFor="select_tipe_santri_tarif">Tipe santri</FieldLabel>
            <Select value={tipeSantri} onValueChange={(v) => setTipeSantri(v as TipeSantriTarif)}>
              <SelectTrigger id="select_tipe_santri_tarif" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="semua">semua</SelectItem>
                  <SelectItem value="asrama">asrama</SelectItem>
                  <SelectItem value="non_asrama">non_asrama</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldLabel htmlFor="input_nominal_tarif">Nominal</FieldLabel>
            <Input id="input_nominal_tarif" type="number" min={0} value={nominal} onChange={(e) => setNominal(e.target.value)} required />
            <FieldLabel htmlFor="input_nominal_paket_tarif">Nominal paket (opsional, MI-MD)</FieldLabel>
            <Input id="input_nominal_paket_tarif" type="number" min={0} value={nominalPaket} onChange={(e) => setNominalPaket(e.target.value)} />
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setTambahOpen(false)}>Batal</Button>
              <Button id="btn_tambah_tarif" type="submit">Tambah</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ViewDialog
        open={viewRow !== null}
        onOpenChange={(o) => { if (!o) setViewRow(null); }}
        title="Tarif biaya"
        row={viewRow as unknown as Record<string, unknown> | null}
      />
      <Dialog open={editRow !== null} onOpenChange={(o) => { if (!o) setEditRow(null); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Ubah tarif</DialogTitle>
            <DialogDescription className="sr-only">Formulir perubahan tarif.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
            <FieldLabel htmlFor="input_ubah_nominal_tarif">Nominal</FieldLabel>
            <Input id="input_ubah_nominal_tarif" type="number" min={0} value={editNominal} onChange={(e) => setEditNominal(e.target.value)} required />
            <FieldLabel htmlFor="input_ubah_paket_tarif">Nominal paket (opsional, MI-MD)</FieldLabel>
            <Input id="input_ubah_paket_tarif" type="number" min={0} value={editPaket} onChange={(e) => setEditPaket(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditRow(null)}>Batal</Button>
            <Button id="btn_simpan_tarif" onClick={onUpdate}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
