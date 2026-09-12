import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api/client';
import { listPengajuan, setujuiPengajuan, tolakPengajuan, type PengajuanBiodata } from '../api/pengajuan';
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
import { ActionIcon, SetAktifAction } from '@/components/RowActions';
import { XCircle } from 'lucide-react';
import { toast } from 'sonner';

const STATUS = ['diajukan', 'disetujui', 'ditolak'];

const FIELDS: ExcelField[] = [
  { key: 'santri', label: 'Santri', width: 200, kind: 'static' },
  { key: 'nik', label: 'NIK', width: 160, kind: 'static' },
  { key: 'wali', label: 'Wali', width: 160, kind: 'static' },
  { key: 'perubahan', label: 'Perubahan', width: 320, kind: 'static' },
  { key: 'status', label: 'Status', width: 110, kind: 'static' },
  { key: 'tanggal', label: 'Diajukan', width: 110, kind: 'static' },
];

function gridValues(p: PengajuanBiodata): Record<string, string | null> {
  const keys = Object.keys(p.perubahan_json ?? {});
  const ringkas = keys
    .slice(0, 4)
    .map((k) => `${k} → ${String((p.perubahan_json as Record<string, unknown>)[k] ?? '')}`)
    .join('; ');
  return {
    santri: p.santri?.nama_lengkap ?? String(p.santri_id),
    nik: p.santri?.nik ?? null,
    wali: p.wali?.name ?? String(p.wali_user_id),
    perubahan: keys.length > 4 ? `${ringkas}; +${keys.length - 4} lainnya` : ringkas,
    status: p.status,
    tanggal: p.created_at,
  };
}

async function noopCommit() {}

// Verifikasi pengajuan biodata dari portal wali.
export default function PengajuanBiodataPage() {
  const [status, setStatus] = useState('diajukan');
  const [rows, setRows] = useState<PengajuanBiodata[]>([]);
  const [badge, setBadge] = useState<Record<string, number>>({});
  const pager = usePager('pengajuan_biodata');
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const reqRef = useRef(0);

  const [tolakRow, setTolakRow] = useState<PengajuanBiodata | null>(null);
  const [tolakCatatan, setTolakCatatan] = useState('');

  const load = useCallback(
    async function loadPage(p = pager.page, pp = pager.perPage) {
      const req = ++reqRef.current;
      setErr('');
      setLoading(true);
      try {
        const res = await listPengajuan({ status, page: p, per_page: pp });
        if (req !== reqRef.current) return;
        const fix = pager.sync(res.data.current_page, res.data.last_page);
        if (fix != null && fix !== p) {
          await loadPage(fix, pp);
          return;
        }
        if (req !== reqRef.current) return;
        setRows(res.data.data);
        setBadge(res.badge ?? {});
        setLastPage(res.data.last_page);
        setTotal(res.data.total);
      } catch (e) {
        if (req === reqRef.current) setErr(errorMessage(e));
      } finally {
        if (req === reqRef.current) setLoading(false);
      }
    },
    [status, pager.page, pager.perPage, pager.sync],
  );

  useEffect(() => {
    if (pager.ready) load(pager.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pager.ready, status]);

  const run = useCallback(async (fn: () => Promise<{ pesan?: string }>, sukses: string) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
      toast.success(sukses);
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [load]);

  const onTolak = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tolakRow) return;
    await run(() => tolakPengajuan(tolakRow.id, tolakCatatan || undefined), 'Pengajuan ditolak.');
    setTolakRow(null);
    setTolakCatatan('');
  }, [tolakRow, tolakCatatan, run]);

  const onSaved = useCallback(() => load(), [load]);

  const renderActions = useCallback((p: PengajuanBiodata) => (
    p.status === 'diajukan' ? (
      <>
        <SetAktifAction
          id={`btn_setujui_pengajuan_${p.id}`}
          onClick={() => run(() => setujuiPengajuan(p.id), 'Pengajuan disetujui.')}
        />
        <ActionIcon
          id={`btn_tolak_pengajuan_${p.id}`}
          title="Tolak"
          className="text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
          onClick={() => { setTolakRow(p); setTolakCatatan(''); }}
        >
          <XCircle size={16} />
        </ActionIcon>
      </>
    ) : null
  ), [run]);

  return (
    <div className={PAGE_SHELL}>
      <PageHeader titleId="title_pengajuan_biodata" title="Pengajuan Biodata" />
      <ErrorNotice>{err}</ErrorNotice>
      <ExcelTable
        tableKey="pengajuan_biodata"
        fields={FIELDS}
        rows={rows}
        getValues={gridValues}
        loading={loading}
        emptyText="Tidak ada pengajuan."
        canEdit={false}
        onCommit={noopCommit}
        onSaved={onSaved}
        filter={(
          <Select value={status} onValueChange={(v) => { setStatus(v); pager.goFirst(); }}>
            <SelectTrigger id="select_status_pengajuan" title="Filter status" aria-label="Filter status" size="sm" className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {STATUS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s} ({badge[s] ?? 0})
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
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

      <Dialog open={tolakRow !== null} onOpenChange={(o) => { if (!o) setTolakRow(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak pengajuan: {tolakRow?.santri?.nama_lengkap}</DialogTitle>
            <DialogDescription className="sr-only">Formulir penolakan pengajuan biodata.</DialogDescription>
          </DialogHeader>
          <form id="form_tolak_pengajuan" onSubmit={onTolak} className="flex flex-col gap-3">
            <FieldGroup className="gap-3">
              <Field>
                <FieldLabel htmlFor="input_catatan_pengajuan">Catatan (opsional)</FieldLabel>
                <Input id="input_catatan_pengajuan" value={tolakCatatan} onChange={(e) => setTolakCatatan(e.target.value)} />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTolakRow(null)}>Batal</Button>
              <Button id="btn_simpan_tolak_pengajuan" type="submit" variant="destructive" disabled={busy}>Tolak</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
