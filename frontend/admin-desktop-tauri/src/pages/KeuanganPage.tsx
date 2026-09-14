import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api/client';
import {
  bayarTagihan,
  generateBulanan,
  tagihanSantri,
  voidPembayaran,
  type Tagihan,
} from '../api/keuangan';
import {
  listLembaga,
  listTahunAjaran,
  referensiList,
  type Lembaga,
  type ReferensiRow,
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
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ActionIcon } from '@/components/RowActions';
import { Wallet } from '@/icons';
import { toast } from 'sonner';

const KEUANGAN_FIELDS: ExcelField[] = [
  { key: 'no', label: 'No. tagihan', width: 200, kind: 'static' },
  { key: 'pos', label: 'Pos', width: 160, kind: 'static' },
  { key: 'periode', label: 'Periode', width: 100, kind: 'static' },
  { key: 'total', label: 'Total', width: 120, kind: 'static' },
  { key: 'terbayar', label: 'Terbayar', width: 120, kind: 'static' },
  { key: 'sisa', label: 'Sisa', width: 120, kind: 'static' },
  { key: 'status', label: 'Status', width: 110, kind: 'static' },
];

function tagihanGridValues(t: Tagihan): Record<string, string | null> {
  return {
    no: t.no_tagihan,
    pos: t.pos_keuangan?.nama_pos ?? String(t.pos_keuangan_id),
    periode: t.periode,
    total: String(t.nominal_total),
    terbayar: String(t.nominal_terbayar),
    sisa: String(t.sisa_tagihan),
    status: t.status,
  };
}

// 103 Keuangan: generate bulanan + tagihan santri + bayar + void.
export default function KeuanganPage() {
  const [lembagas, setLembagas] = useState<Lembaga[]>([]);
  const [tas, setTas] = useState<TahunAjaran[]>([]);
  const [metode, setMetode] = useState<ReferensiRow[]>([]);

  const [genLembaga, setGenLembaga] = useState('');
  const [genTa, setGenTa] = useState('');
  const [genPeriode, setGenPeriode] = useState('');
  const [genHasil, setGenHasil] = useState('');

  const [santriId, setSantriId] = useState('');
  const [tagihan, setTagihan] = useState<Tagihan[]>([]);
  const [loadingTagihan, setLoadingTagihan] = useState(false);

  const [bayarRow, setBayarRow] = useState<Tagihan | null>(null);
  const [bayarKas, setBayarKas] = useState('');
  const [bayarMetode, setBayarMetode] = useState('tunai');
  const [bayarNominal, setBayarNominal] = useState('');
  const [bayarTanggal, setBayarTanggal] = useState('');
  const [bayarCatatan, setBayarCatatan] = useState('');

  const [voidId, setVoidId] = useState('');
  const [voidAlasan, setVoidAlasan] = useState('');

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const lembagaReqRef = useRef(0);
  const metodeReqRef = useRef(0);
  const taReqRef = useRef(0);
  const tagihanReqRef = useRef(0);

  const getValues = useCallback(tagihanGridValues, []);

  useEffect(() => {
    const lembagaReq = ++lembagaReqRef.current;
    listLembaga({ per_page: 100 })
      .then((p) => {
        if (lembagaReq !== lembagaReqRef.current) return;
        setLembagas(p.data);
      })
      .catch((e) => {
        if (lembagaReq !== lembagaReqRef.current) return;
        setErr(errorMessage(e));
      });
    const metodeReq = ++metodeReqRef.current;
    referensiList('metode_pembayaran')
      .then((r) => {
        if (metodeReq !== metodeReqRef.current) return;
        setMetode(r);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const req = ++taReqRef.current;
    if (!genLembaga) {
      setTas([]);
      return;
    }
    listTahunAjaran({ lembaga_id: Number(genLembaga), per_page: 100 })
      .then((p) => {
        if (req !== taReqRef.current) return;
        setTas(p.data);
      })
      .catch((e) => {
        if (req === taReqRef.current) setErr(errorMessage(e));
      });
  }, [genLembaga]);

  async function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!genLembaga || !genTa || !genPeriode) return;
    setBusy(true);
    setErr('');
    setGenHasil('');
    try {
      const res = await generateBulanan({
        lembaga_id: Number(genLembaga),
        tahun_ajaran_id: Number(genTa),
        periode: genPeriode,
      });
      const gagal = res.data.gagal?.length ?? 0;
      setGenHasil(
        `${res.data.berhasil} tagihan dibuat · dilewati (paket MD): ${res.data.dilewati_paket} · gagal: ${gagal}`,
      );
      toast.success(res.pesan ?? 'Generate selesai.');
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  async function onMuatTagihan(e?: React.FormEvent) {
    e?.preventDefault();
    if (!santriId) return;
    const req = ++tagihanReqRef.current;
    setErr('');
    setLoadingTagihan(true);
    try {
      const res = await tagihanSantri(Number(santriId));
      if (req !== tagihanReqRef.current) return;
      setTagihan(res.data);
      if (res.data.length === 0) toast.info('Tidak ada tagihan terbuka.');
    } catch (e2) {
      if (req !== tagihanReqRef.current) return;
      setTagihan([]);
      setErr(errorMessage(e2));
    } finally {
      if (req === tagihanReqRef.current) setLoadingTagihan(false);
    }
  }

  const openBayar = useCallback((t: Tagihan) => {
    setBayarRow(t);
    setBayarNominal(String(t.sisa_tagihan));
    setBayarTanggal('');
    setBayarCatatan('');
  }, []);

  const onSaved = useCallback(async () => {}, []);
  const onCommit = useCallback(async () => {}, []);
  const renderActions = useCallback((t: Tagihan) => (
    <ActionIcon id={`btn_bayar_tagihan_${t.id}`} title="Bayar" onClick={() => openBayar(t)}>
      <Wallet size={16} />
    </ActionIcon>
  ), [openBayar]);

  async function onBayar(e: React.FormEvent) {
    e.preventDefault();
    if (!bayarRow) return;
    setBusy(true);
    setErr('');
    try {
      await bayarTagihan({
        akun_kas_id: Number(bayarKas),
        total_bayar: Number(bayarNominal),
        metode_pembayaran: bayarMetode,
        items: [{ tagihan_id: bayarRow.id, nominal_dibayar: Number(bayarNominal) }],
        tgl_pembayaran: bayarTanggal || undefined,
        catatan: bayarCatatan || undefined,
        santri_id: bayarRow.santri_id ?? undefined,
        client_op_id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `op-${Date.now()}`,
      });
      toast.success('Pembayaran diproses.');
      setBayarRow(null);
      await onMuatTagihan();
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  async function onVoid(e: React.FormEvent) {
    e.preventDefault();
    if (!voidId) return;
    setBusy(true);
    setErr('');
    try {
      await voidPembayaran(Number(voidId), voidAlasan);
      toast.success('Pembayaran di-void.');
      setVoidId('');
      setVoidAlasan('');
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Generate tagihan bulanan</h2>
          <form id="form_generate_bulanan" onSubmit={onGenerate} className="grid gap-3">
            <FieldGroup className="gap-3">
              <Field>
                <FieldLabel htmlFor="select_gen_lembaga">Lembaga</FieldLabel>
                <Select value={genLembaga} onValueChange={(v) => { setGenLembaga(v); setGenTa(''); }}>
                  <SelectTrigger id="select_gen_lembaga" className="w-full">
                    <SelectValue placeholder="Pilih lembaga" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {lembagas.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.kode ?? l.nama}</SelectItem>)}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="select_gen_ta">Tahun ajaran</FieldLabel>
                <Select value={genTa} onValueChange={setGenTa}>
                  <SelectTrigger id="select_gen_ta" className="w-full">
                    <SelectValue placeholder="Pilih tahun ajaran" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {tas.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.nama}</SelectItem>)}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="input_gen_periode">Periode (YYYY-MM)</FieldLabel>
                <Input id="input_gen_periode" type="month" value={genPeriode} onChange={(e) => setGenPeriode(e.target.value)} required />
              </Field>
            </FieldGroup>
            <Button id="btn_generate_bulanan" type="submit" disabled={busy || !genLembaga || !genTa || !genPeriode}>
              Generate
            </Button>
          </form>
          {genHasil && <p className="mt-3 rounded-md border bg-muted/40 p-2 text-xs">{genHasil}</p>}
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Void pembayaran (admin)</h2>
          <form id="form_void_pembayaran" onSubmit={onVoid} className="grid gap-3">
            <FieldGroup className="gap-3">
              <Field>
                <FieldLabel htmlFor="input_void_id">ID pembayaran</FieldLabel>
                <Input id="input_void_id" type="number" min={1} value={voidId} onChange={(e) => setVoidId(e.target.value)} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="input_void_alasan">Alasan</FieldLabel>
                <Input id="input_void_alasan" value={voidAlasan} onChange={(e) => setVoidAlasan(e.target.value)} required />
              </Field>
            </FieldGroup>
            <Button id="btn_void_pembayaran" type="submit" variant="destructive" disabled={busy || !voidId || !voidAlasan}>
              Void
            </Button>
          </form>
        </div>
      </div>

      <form id="form_tagihan_santri" onSubmit={onMuatTagihan} className="mt-4 flex flex-wrap items-end gap-2">
        <Field className="w-36">
          <FieldLabel htmlFor="input_santri_tagihan">ID santri</FieldLabel>
          <Input
            id="input_santri_tagihan"
            type="number"
            min={1}
            value={santriId}
            onChange={(e) => setSantriId(e.target.value)}
            className="h-8 w-32"
            required
          />
        </Field>
        <Button id="btn_muat_tagihan" type="submit" variant="outline" disabled={loadingTagihan || !santriId}>
          Muat tagihan
        </Button>
      </form>

      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        <ExcelTable
          tableKey="keuangan_tagihan"
          fields={KEUANGAN_FIELDS}
          rows={tagihan}
          getValues={getValues}
          loading={loadingTagihan}
          emptyText="Belum ada tagihan dimuat."
          canEdit={false}
          onCommit={onCommit}
          onSaved={onSaved}
          renderActions={renderActions}
        />
      </div>

      <Dialog open={bayarRow !== null} onOpenChange={(o) => { if (!o) setBayarRow(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Bayar: {bayarRow?.no_tagihan}</DialogTitle>
            <DialogDescription className="sr-only">
              Catat pembayaran untuk tagihan ini.
            </DialogDescription>
          </DialogHeader>
          <form id="form_bayar_tagihan" onSubmit={onBayar} className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
            <FieldLabel htmlFor="input_bayar_kas">ID akun kas</FieldLabel>
            <Input id="input_bayar_kas" type="number" min={1} value={bayarKas} onChange={(e) => setBayarKas(e.target.value)} required />
            <FieldLabel htmlFor="select_bayar_metode">Metode pembayaran</FieldLabel>
            <Select value={bayarMetode} onValueChange={setBayarMetode}>
              <SelectTrigger id="select_bayar_metode" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {(metode.length > 0 ? metode.map((m) => String(m.nama ?? m.kode)) : ['tunai', 'transfer']).map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldLabel htmlFor="input_bayar_nominal">Nominal dibayar</FieldLabel>
            <Input
              id="input_bayar_nominal"
              type="number"
              min={1}
              value={bayarNominal}
              onChange={(e) => setBayarNominal(e.target.value)}
              required
            />
            <FieldLabel htmlFor="input_bayar_tanggal">Tanggal (opsional)</FieldLabel>
            <Input id="input_bayar_tanggal" type="date" value={bayarTanggal} onChange={(e) => setBayarTanggal(e.target.value)} />
            <FieldLabel htmlFor="input_bayar_catatan">Catatan (opsional)</FieldLabel>
            <Input id="input_bayar_catatan" value={bayarCatatan} onChange={(e) => setBayarCatatan(e.target.value)} />
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setBayarRow(null)}>Batal</Button>
              <Button id="btn_simpan_bayar" type="submit" disabled={busy || !bayarKas || !bayarNominal}>Bayar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
