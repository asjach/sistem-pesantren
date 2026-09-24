import { useCallback, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { errorMessage } from '../api/client';
import { listPengajuan, setujuiPengajuan, tolakPengajuan, type PengajuanBiodata } from '../api/pengajuan';
import type { Paginate } from '../api/master';
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
import FilterField from '@/components/FilterField';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { TopBarSearch } from '@/components/TopBarSearch';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Pager from '@/components/Pager';
import { useDaftarTabel } from '@/hooks/useDaftarTabel';
import { ActionIcon, SetAktifAction } from '@/components/RowActions';
import { XCircle } from '@/icons';
import { toast } from 'sonner';

const STATUS = ['diajukan', 'disetujui', 'ditolak'];

const FIELDS: ExcelField[] = [
  { key: 'santri', label: 'santri.nama_lengkap', width: 200, kind: 'static', sumber: { tabel: 'santri', kolom: 'nama_lengkap' } },
  { key: 'nik', label: 'santri.nik', width: 160, kind: 'static', sumber: { tabel: 'santri', kolom: 'nik' } },
  { key: 'wali', label: 'users.name', width: 160, kind: 'static', sumber: { tabel: 'users', kolom: 'name' } },
  { key: 'perubahan', label: 'perubahan_json', width: 320, kind: 'static', sumber: null },
  { key: 'status', label: 'status', width: 110, kind: 'static', sumber: { tabel: 'pengajuan_biodata_santri', kolom: 'status' } },
  { key: 'tanggal', label: 'created_at', width: 110, kind: 'static', sumber: { tabel: 'pengajuan_biodata_santri', kolom: 'created_at' } },
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
  const { user } = useAuth();
  const canProses = bisa(user, 'pengajuan_biodata.ubah');
  const [status, setStatus] = useState('diajukan');
  /** Pencarian tunggal halaman (topBar). */
  const [cari, setCari] = useState('');
  const [badge, setBadge] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const {
    rows,
    loading,
    err,
    setErr,
    urut,
    arahUrut,
    terapkanUrut,
    load,
    lastPage,
    total,
    pager,
  } = useDaftarTabel<PengajuanBiodata, Paginate<PengajuanBiodata> & { badge?: Record<string, number> }>({
    tableKey: 'pengajuan_biodata',
    search: cari,
    ambil: (a) => listPengajuan({
      status,
      q: a.search || undefined,
      sort: a.urut.length ? a.urut : undefined,
      arah: a.urut.length ? a.arah : undefined,
      page: a.page,
      per_page: a.perPage,
      signal: a.signal,
    }).then((r) => ({ ...r.data, badge: r.badge })),
    onData: (res) => setBadge(res.badge ?? {}),
    deps: [status],
  });

  const [tolakRow, setTolakRow] = useState<PengajuanBiodata | null>(null);
  const [tolakCatatan, setTolakCatatan] = useState('');

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
    p.status === 'diajukan' && canProses ? (
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
  ), [run, canProses]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <TopBarSearch value={cari} onChange={setCari} placeholder="Cari santri…" />
      <PengaturanHalaman tampil={{}} tabel={[{ key: 'pengajuan_biodata', judul: 'Pengajuan biodata', fields: FIELDS }]} />
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
        urutAktif={urut}
        arahUrut={arahUrut}
        onUrut={terapkanUrut}
        filter={(
          <FilterField label="Status" htmlFor="select_status_pengajuan">
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
          </FilterField>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tolak pengajuan: {tolakRow?.santri?.nama_lengkap}</DialogTitle>
            <DialogDescription className="sr-only">Formulir penolakan pengajuan biodata.</DialogDescription>
          </DialogHeader>
          <form id="form_tolak_pengajuan" onSubmit={onTolak} className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
            <FieldLabel htmlFor="input_catatan_pengajuan">Catatan (opsional)</FieldLabel>
            <Input id="input_catatan_pengajuan" value={tolakCatatan} onChange={(e) => setTolakCatatan(e.target.value)} />
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setTolakRow(null)}>Batal</Button>
              <Button id="btn_simpan_tolak_pengajuan" type="submit" variant="destructive" disabled={busy}>Tolak</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
