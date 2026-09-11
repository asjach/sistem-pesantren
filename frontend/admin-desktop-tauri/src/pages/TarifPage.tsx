import { useEffect, useState } from 'react';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Pager from '@/components/Pager';
import { usePager } from '@/hooks/usePager';
import { DeleteAction, EditAction, ViewAction } from '@/components/RowActions';
import { toast } from 'sonner';

export default function TarifPage() {
  const [lembagas, setLembagas] = useState<Lembaga[]>([]);
  const [posList, setPosList] = useState<PosKeuangan[]>([]);
  const [tas, setTas] = useState<TahunAjaran[]>([]);
  const [lembagaId, setLembagaId] = useState<number | ''>('');
  const [posId, setPosId] = useState<number | ''>('');
  const [taId, setTaId] = useState<number | ''>('');
  const [rows, setRows] = useState<TarifBiaya[]>([]);
  const pager = usePager('tarif');
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [nominal, setNominal] = useState('');
  const [nominalPaket, setNominalPaket] = useState('');
  const [tipeSantri, setTipeSantri] = useState<TipeSantriTarif>('semua');
  const [tambahOpen, setTambahOpen] = useState(false);
  const [viewRow, setViewRow] = useState<TarifBiaya | null>(null);
  const [editRow, setEditRow] = useState<TarifBiaya | null>(null);
  const [editNominal, setEditNominal] = useState('');
  const [editPaket, setEditPaket] = useState('');

  const numRule = (label: string, required: boolean) => (v: string | null) => {
    if (!v) return required ? `${label} wajib diisi.` : null;
    const n = Number(v);
    return !Number.isFinite(n) || n < 0 ? `${label} angka ≥ 0.` : null;
  };

  const fields: ExcelField[] = [
    { key: 'pos', label: 'Pos', width: 140, minWidth: 110, kind: 'static' },
    { key: 'lembaga', label: 'Lembaga', width: 180, minWidth: 120, kind: 'static' },
    { key: 'ta', label: 'TA', width: 140, minWidth: 110, kind: 'static' },
    { key: 'tipe', label: 'Tipe santri', width: 130, minWidth: 100, kind: 'static' },
    {
      key: 'nominal', label: 'Nominal', width: 160, minWidth: 110, kind: 'text', maxLength: 20,
      validate: numRule('Nominal', true),
    },
    {
      key: 'paket', label: 'Paket', width: 160, minWidth: 110, kind: 'text', maxLength: 20,
      validate: numRule('Nominal paket', false),
    },
  ];

  function gridValues(t: TarifBiaya): Record<string, string | null> {
    return {
      pos: t.pos?.kode_pos ?? String(t.pos_keuangan_id),
      lembaga: t.lembaga?.nama ?? String(t.lembaga_id),
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

  function openEdit(t: TarifBiaya) {
    setEditRow(t);
    setEditNominal(String(t.nominal));
    setEditPaket(t.nominal_paket === null || t.nominal_paket === undefined ? '' : String(t.nominal_paket));
  }

  useEffect(() => {
    listLembaga().then((p) => setLembagas(p.data)).catch((e) => setErr(errorMessage(e)));
    listPos().then((p) => setPosList(p.data)).catch((e) => setErr(errorMessage(e)));
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
      const res = await listTarif({
        lembaga_id: lembagaId === '' ? undefined : Number(lembagaId),
        pos_keuangan_id: posId === '' ? undefined : Number(posId),
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
  }

  async function onUpdate() {
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
  }

  async function onDelete(id: number) {
    try {
      await deleteTarif(id);
      toast.success('Tarif dihapus.');
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  return (
    <div className={PAGE_SHELL}>
      <PageHeader titleId="title_tarif" title="Tarif Biaya" />
      <ErrorNotice>{err}</ErrorNotice>
      <ExcelTable
        tableKey="tarif"
        fields={fields}
        rows={rows}
        getValues={gridValues}
        loading={loading}
        emptyText="Belum ada tarif."
        canEdit
        onCommit={commitDraft}
        onSaved={() => load()}
        onSearchSubmit={() => { pager.goFirst(); load(1); }}
        searchIds={{ form: 'form_filter_tarif', button: 'btn_cari_tarif' }}
        addButton={(
          <Button id="btn_buka_tambah_tarif" onClick={() => setTambahOpen(true)}>
            + Tarif
          </Button>
        )}
        filter={(
          <>
            <Select value={lembagaId === '' ? '_semua' : String(lembagaId)} onValueChange={(v) => { setLembagaId(v === '_semua' ? '' : Number(v)); setTaId(''); }}>
              <SelectTrigger id="select_lembaga_tarif" title="Filter lembaga" aria-label="Filter lembaga" className="h-8 w-36">
                <SelectValue placeholder="Semua" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_semua">Semua</SelectItem>
                {lembagas.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.nama}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={posId === '' ? '_semua' : String(posId)} onValueChange={(v) => setPosId(v === '_semua' ? '' : Number(v))}>
              <SelectTrigger id="select_pos_tarif" title="Filter pos" aria-label="Filter pos" className="h-8 w-36">
                <SelectValue placeholder="Semua" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_semua">Semua</SelectItem>
                {posList.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.kode_pos} — {p.nama_pos}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={taId === '' ? '_semua' : String(taId)} onValueChange={(v) => setTaId(v === '_semua' ? '' : Number(v))}>
              <SelectTrigger id="select_ta_tarif" title="Filter tahun ajaran" aria-label="Filter tahun ajaran" className="h-8 w-36">
                <SelectValue placeholder="Semua" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_semua">Semua</SelectItem>
                {tas.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.nama}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        )}
        renderActions={(t) => (
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
            <DialogTitle>Tambah tarif</DialogTitle>
          </DialogHeader>
          <form id="form_tambah_tarif" onSubmit={onCreate} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="select_tipe_santri_tarif">Tipe santri</Label>
            <Select value={tipeSantri} onValueChange={(v) => setTipeSantri(v as TipeSantriTarif)}>
              <SelectTrigger id="select_tipe_santri_tarif">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">semua</SelectItem>
                <SelectItem value="asrama">asrama</SelectItem>
                <SelectItem value="non_asrama">non_asrama</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="input_nominal_tarif">Nominal</Label>
            <Input id="input_nominal_tarif" type="number" min={0} value={nominal} onChange={(e) => setNominal(e.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="input_nominal_paket_tarif">Nominal paket (opsional, MI-MD)</Label>
            <Input id="input_nominal_paket_tarif" type="number" min={0} value={nominalPaket} onChange={(e) => setNominalPaket(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setTambahOpen(false)}>Batal</Button>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah tarif</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="input_ubah_nominal_tarif">Nominal</Label>
              <Input id="input_ubah_nominal_tarif" type="number" min={0} value={editNominal} onChange={(e) => setEditNominal(e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="input_ubah_paket_tarif">Nominal paket (opsional, MI-MD)</Label>
              <Input id="input_ubah_paket_tarif" type="number" min={0} value={editPaket} onChange={(e) => setEditPaket(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Batal</Button>
            <Button id="btn_simpan_tarif" onClick={onUpdate}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
