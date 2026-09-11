import { useEffect, useState } from 'react';
import { errorMessage } from '../api/client';
import {
  accCalon,
  accPaket,
  downloadTemplatePsb,
  importPsb,
  listAntrean,
  listDokumenCalon,
  PSB_STATUS,
  promosiCalon,
  seleksiCalon,
  tolakCalon,
  tolakPaket,
  verifikasiCalon,
  verifikasiDokumen,
  verifikasiPaket,
  type PsbCalon,
} from '../api/psb';
import { listLembaga, type Lembaga } from '../api/master';
import type { DokumenSantri } from '../api/santri';
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
import { ActionIcon } from '@/components/RowActions';
import { toast } from 'sonner';
import {
  BadgeCheck,
  CheckCircle2,
  FolderOpen,
  Gavel,
  PackageCheck,
  PackageX,
  Upload,
  UserCheck,
  XCircle,
} from 'lucide-react';

// 100 PSB: antrean per status + verifikasi/seleksi/ACC/tolak/promosi + dokumen + import.
export default function PsbPage() {
  const [lembagas, setLembagas] = useState<Lembaga[]>([]);
  const [status, setStatus] = useState<string>('ajukan_daftar_ulang');
  const [lembagaId, setLembagaId] = useState('');
  const [rows, setRows] = useState<PsbCalon[]>([]);
  const pager = usePager('psb');
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const [seleksiRow, setSeleksiRow] = useState<PsbCalon | null>(null);
  const [seleksiLolos, setSeleksiLolos] = useState('lolos');
  const [seleksiCatatan, setSeleksiCatatan] = useState('');

  const [tolakRow, setTolakRow] = useState<PsbCalon | null>(null);
  const [tolakCatatan, setTolakCatatan] = useState('');

  const [dokRow, setDokRow] = useState<PsbCalon | null>(null);
  const [dokumen, setDokumen] = useState<DokumenSantri[]>([]);

  const [importOpen, setImportOpen] = useState(false);
  const [importGelombang, setImportGelombang] = useState('');
  const [importLembaga, setImportLembaga] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);

  const fields: ExcelField[] = [
    { key: 'no', label: 'No. pendaftaran', width: 190, kind: 'static' },
    { key: 'nama', label: 'Nama', width: 200, kind: 'static' },
    { key: 'nik', label: 'NIK', width: 160, kind: 'static' },
    { key: 'tipe', label: 'Tipe', width: 110, kind: 'static' },
    { key: 'lembaga', label: 'Lembaga', width: 180, kind: 'static' },
    { key: 'gelombang', label: 'Gelombang', width: 140, kind: 'static' },
    { key: 'paket', label: 'Paket', width: 120, kind: 'static' },
    { key: 'status', label: 'Status', width: 150, kind: 'static' },
    { key: 'daftar', label: 'Tgl daftar', width: 110, kind: 'static' },
  ];

  function gridValues(c: PsbCalon): Record<string, string | null> {
    return {
      no: c.no_pendaftaran,
      nama: c.nama_lengkap,
      nik: c.nik,
      tipe: c.tipe_santri,
      lembaga: c.lembaga_tujuan?.nama ?? String(c.lembaga_id),
      gelombang: c.gelombang?.nama ?? String(c.gelombang_id),
      paket: c.paket_grup_id ? c.paket_grup_id : null,
      status: c.status_pendaftaran,
      daftar: c.tanggal_daftar,
    };
  }

  async function load(p = pager.page, pp = pager.perPage) {
    setErr('');
    setLoading(true);
    try {
      const res = await listAntrean({
        status,
        lembaga_id: lembagaId ? Number(lembagaId) : undefined,
        page: p,
        per_page: pp,
      });
      const fix = pager.sync(res.data.current_page, res.data.last_page);
      if (fix != null && fix !== p) {
        await load(fix, pp);
        return;
      }
      setRows(res.data.data);
      setLastPage(res.data.last_page);
      setTotal(res.data.total);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (pager.ready) load(pager.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pager.ready, status, lembagaId]);

  useEffect(() => {
    listLembaga({ per_page: 100 }).then((p) => setLembagas(p.data)).catch((e) => setErr(errorMessage(e)));
  }, []);

  async function run(fn: () => Promise<{ pesan?: string }>, sukses: string) {
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
  }

  async function openDokumen(c: PsbCalon) {
    setDokRow(c);
    setDokumen([]);
    try {
      const res = await listDokumenCalon(c.id);
      setDokumen(res.data);
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  async function onSeleksi(e: React.FormEvent) {
    e.preventDefault();
    if (!seleksiRow) return;
    await run(
      () => seleksiCalon(seleksiRow.id, { lolos: seleksiLolos === 'lolos', catatan: seleksiCatatan || undefined }),
      'Hasil seleksi disimpan.',
    );
    setSeleksiRow(null);
    setSeleksiCatatan('');
  }

  async function onTolak(e: React.FormEvent) {
    e.preventDefault();
    if (!tolakRow) return;
    await run(() => tolakCalon(tolakRow.id, tolakCatatan || undefined), 'Calon ditolak.');
    setTolakRow(null);
    setTolakCatatan('');
  }

  async function onImport(e: React.FormEvent) {
    e.preventDefault();
    if (!importFile || !importGelombang || !importLembaga) return;
    setBusy(true);
    setErr('');
    try {
      const res = await importPsb({
        gelombang_id: Number(importGelombang),
        lembaga_id: Number(importLembaga),
        file: importFile,
      });
      if (res.errors?.length) {
        setErr(res.errors.map((x) => `Baris ${x.row} (${x.attribute}): ${x.errors.join(', ')}`).join(' · '));
      } else {
        toast.success(res.pesan ?? 'Import PSB selesai.');
        setImportOpen(false);
        setImportFile(null);
        await load(1);
      }
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  async function onTemplate() {
    setErr('');
    try {
      await downloadTemplatePsb();
      toast.success('Template diunduh.');
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  const bolehTolak = ['baru', 'terverifikasi', 'lolos', 'pemberkasan', 'ajukan_daftar_ulang', 'waiting_list'];

  return (
    <div className={PAGE_SHELL}>
      <PageHeader titleId="title_psb" title="PSB — Antrean Daftar Ulang" />
      <ErrorNotice>{err}</ErrorNotice>
      <ExcelTable
        tableKey="psb"
        fields={fields}
        rows={rows}
        getValues={gridValues}
        loading={loading}
        emptyText="Tidak ada calon pada status ini."
        canEdit={false}
        onCommit={async () => {}}
        onSaved={() => load()}
        filter={(
          <>
            <Select value={status} onValueChange={(v) => { setStatus(v); pager.goFirst(); }}>
              <SelectTrigger id="select_status_psb" title="Filter status" aria-label="Filter status" className="h-8 w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {PSB_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={lembagaId === '' ? '_semua' : lembagaId} onValueChange={(v) => { setLembagaId(v === '_semua' ? '' : v); pager.goFirst(); }}>
              <SelectTrigger id="select_lembaga_psb" title="Filter lembaga" aria-label="Filter lembaga" className="h-8 w-40">
                <SelectValue placeholder="Semua" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_semua">Semua lembaga</SelectItem>
                {lembagas.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.nama}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        )}
        addButton={(
          <Button id="btn_buka_import_psb" onClick={() => setImportOpen(true)}>
            <Upload size={16} /> Import
          </Button>
        )}
        renderActions={(c) => {
          const paket = !!c.paket_grup_id;
          return (
            <>
              {c.status_pendaftaran === 'baru' && (
                paket ? (
                  <ActionIcon id={`btn_verifikasi_paket_${c.id}`} title="Verifikasi paket (grup)" onClick={() => run(() => verifikasiPaket(c.paket_grup_id as string), 'Paket terverifikasi.')}>
                    <PackageCheck size={16} />
                  </ActionIcon>
                ) : (
                  <ActionIcon id={`btn_verifikasi_psb_${c.id}`} title="Verifikasi" onClick={() => run(() => verifikasiCalon(c.id), 'Calon terverifikasi.')}>
                    <CheckCircle2 size={16} />
                  </ActionIcon>
                )
              )}
              {c.status_pendaftaran === 'terverifikasi' && !paket && (
                <ActionIcon id={`btn_seleksi_psb_${c.id}`} title="Seleksi" onClick={() => { setSeleksiRow(c); setSeleksiLolos('lolos'); }}>
                  <Gavel size={16} />
                </ActionIcon>
              )}
              {c.status_pendaftaran === 'waiting_list' && (
                <ActionIcon id={`btn_promosi_psb_${c.id}`} title="Promosi dari waiting list" onClick={() => run(() => promosiCalon(c.id), 'Calon dipromosikan.')}>
                  <UserCheck size={16} />
                </ActionIcon>
              )}
              {c.status_pendaftaran === 'ajukan_daftar_ulang' && (
                paket ? (
                  <ActionIcon id={`btn_acc_paket_${c.id}`} title="ACC paket (grup)" onClick={() => run(() => accPaket(c.paket_grup_id as string), 'Paket disetujui.')}>
                    <PackageCheck size={16} />
                  </ActionIcon>
                ) : (
                  <ActionIcon id={`btn_acc_psb_${c.id}`} title="ACC daftar ulang" onClick={() => run(() => accCalon(c.id), 'Daftar ulang disetujui (santri dibuat).')}>
                    <BadgeCheck size={16} />
                  </ActionIcon>
                )
              )}
              {bolehTolak.includes(c.status_pendaftaran) && (
                paket ? (
                  <ActionIcon id={`btn_tolak_paket_${c.id}`} title="Tolak paket (grup)" onClick={() => run(() => tolakPaket(c.paket_grup_id as string), 'Paket ditolak.')}>
                    <PackageX size={16} />
                  </ActionIcon>
                ) : (
                  <ActionIcon id={`btn_tolak_psb_${c.id}`} title="Tolak" onClick={() => { setTolakRow(c); setTolakCatatan(''); }}>
                    <XCircle size={16} />
                  </ActionIcon>
                )
              )}
              <ActionIcon id={`btn_dokumen_psb_${c.id}`} title="Dokumen" onClick={() => openDokumen(c)}>
                <FolderOpen size={16} />
              </ActionIcon>
            </>
          );
        }}
      />
      <Pager
        page={pager.page}
        lastPage={lastPage}
        total={total}
        perPage={pager.perPage}
        onPage={(p) => { pager.setPage(p); load(p); }}
        onPerPage={(pp) => { pager.setPerPage(pp); load(1, pp); }}
      />

      <Dialog open={seleksiRow !== null} onOpenChange={(o) => { if (!o) setSeleksiRow(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Seleksi: {seleksiRow?.nama_lengkap}</DialogTitle>
            <DialogDescription>Gelombang jalur seleksi — hasil langsung lolos/tidak lolos.</DialogDescription>
          </DialogHeader>
          <form id="form_seleksi_psb" onSubmit={onSeleksi} className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="select_hasil_seleksi">Hasil</Label>
              <Select value={seleksiLolos} onValueChange={setSeleksiLolos}>
                <SelectTrigger id="select_hasil_seleksi" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lolos">Lolos</SelectItem>
                  <SelectItem value="tidak_lolos">Tidak lolos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="input_catatan_seleksi">Catatan (opsional)</Label>
              <Input id="input_catatan_seleksi" value={seleksiCatatan} onChange={(e) => setSeleksiCatatan(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSeleksiRow(null)}>Batal</Button>
              <Button id="btn_simpan_seleksi" type="submit" disabled={busy}>Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={tolakRow !== null} onOpenChange={(o) => { if (!o) setTolakRow(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak: {tolakRow?.nama_lengkap}</DialogTitle>
          </DialogHeader>
          <form id="form_tolak_psb" onSubmit={onTolak} className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="input_catatan_tolak">Catatan (opsional)</Label>
              <Input id="input_catatan_tolak" value={tolakCatatan} onChange={(e) => setTolakCatatan(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTolakRow(null)}>Batal</Button>
              <Button id="btn_simpan_tolak" type="submit" variant="destructive" disabled={busy}>Tolak</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dokRow !== null} onOpenChange={(o) => { if (!o) setDokRow(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dokumen: {dokRow?.nama_lengkap}</DialogTitle>
          </DialogHeader>
          {dokumen.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada dokumen diupload.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {dokumen.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-2 p-2 text-sm">
                  <span className="font-medium">{d.jenis_dokumen_santri}</span>
                  <span className="text-muted-foreground">{d.status_verifikasi}</span>
                  <div className="ml-auto flex gap-1.5">
                    <Button
                      id={`btn_dok_valid_${d.id}`}
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => run(() => verifikasiDokumen(d.id, { status: 'valid' }), 'Dokumen divalidasi.')}
                    >
                      Valid
                    </Button>
                    <Button
                      id={`btn_dok_tolak_${d.id}`}
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => run(() => verifikasiDokumen(d.id, { status: 'ditolak' }), 'Dokumen ditolak.')}
                    >
                      Tolak
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDokRow(null)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import data PSB (Excel/CSV)</DialogTitle>
            <DialogDescription>
              Gelombang menentukan tahun ajaran calon. Pakai template agar nama kolom sesuai.
            </DialogDescription>
          </DialogHeader>
          <form id="form_import_psb" onSubmit={onImport} className="space-y-3">
            <Button
              id="btn_template_psb"
              type="button"
              variant="outline"
              size="sm"
              onClick={onTemplate}
            >
              Unduh template Excel
            </Button>
            <div className="grid gap-1.5">
              <Label htmlFor="input_gelombang_psb">ID Gelombang</Label>
              <Input
                id="input_gelombang_psb"
                type="number"
                min={1}
                value={importGelombang}
                onChange={(e) => setImportGelombang(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="select_import_psb_lembaga">Lembaga tujuan</Label>
              <Select value={importLembaga} onValueChange={setImportLembaga}>
                <SelectTrigger id="select_import_psb_lembaga" className="w-full">
                  <SelectValue placeholder="Pilih lembaga" />
                </SelectTrigger>
                <SelectContent>
                  {lembagas.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.nama}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="input_file_psb">File (.xlsx/.xls/.csv, maks 5 MB)</Label>
              <Input
                id="input_file_psb"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>Batal</Button>
              <Button id="btn_import_psb" type="submit" disabled={busy || !importFile || !importGelombang || !importLembaga}>
                Import
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
