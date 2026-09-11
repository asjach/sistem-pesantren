import { useEffect, useState } from 'react';
import { errorMessage } from '../api/client';
import {
  importSantri,
  listSantri,
  uploadDokumenSantri,
  uploadFotoSantri,
  type Santri,
} from '../api/santri';
import { listLembaga, listTahunAjaran, referensiList, type Lembaga, type ReferensiRow, type TahunAjaran } from '../api/master';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Pager from '@/components/Pager';
import { usePager } from '@/hooks/usePager';
import { ActionIcon } from '@/components/RowActions';
import { FileUp, ImageUp, Upload } from 'lucide-react';
import { toast } from 'sonner';

// 101 Santri: daftar + import PPDB + upload foto/dokumen.
export default function SantriPage() {
  const [rows, setRows] = useState<Santri[]>([]);
  const [lembagas, setLembagas] = useState<Lembaga[]>([]);
  const [tas, setTas] = useState<TahunAjaran[]>([]);
  const [jenisDokumen, setJenisDokumen] = useState<ReferensiRow[]>([]);
  const pager = usePager('santri');
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [statusGlobal, setStatusGlobal] = useState('_semua');

  const [importOpen, setImportOpen] = useState(false);
  const [importLembaga, setImportLembaga] = useState('');
  const [importTa, setImportTa] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);

  const [fotoRow, setFotoRow] = useState<Santri | null>(null);
  const [fotoFile, setFotoFile] = useState<File | null>(null);

  const [dokRow, setDokRow] = useState<Santri | null>(null);
  const [dokJenis, setDokJenis] = useState('');
  const [dokFile, setDokFile] = useState<File | null>(null);
  const [dokCatatan, setDokCatatan] = useState('');
  const [busy, setBusy] = useState(false);

  const fields: ExcelField[] = [
    { key: 'nama', label: 'Nama', width: 220, kind: 'static' },
    { key: 'nik', label: 'NIK', width: 160, kind: 'static' },
    { key: 'nis', label: 'NIS', width: 100, kind: 'static' },
    { key: 'jk', label: 'JK', width: 60, kind: 'static' },
    { key: 'tgl_lahir', label: 'Tgl lahir', width: 110, kind: 'static' },
    { key: 'kelas', label: 'Kelas', width: 120, kind: 'static' },
    { key: 'lembaga', label: 'Lembaga', width: 180, kind: 'static' },
    { key: 'status', label: 'Status', width: 100, kind: 'static' },
  ];

  function gridValues(s: Santri): Record<string, string | null> {
    return {
      nama: s.nama_lengkap,
      nik: s.nik,
      nis: s.nis,
      jk: s.jk,
      tgl_lahir: s.tgl_lahir,
      kelas: s.kelas?.nama_kelas ?? null,
      lembaga: s.lembaga?.nama ?? String(s.lembaga_id),
      status: s.status_global ? 'aktif' : 'nonaktif',
    };
  }

  async function load(p = pager.page, pp = pager.perPage) {
    setErr('');
    setLoading(true);
    try {
      const res = await listSantri({
        status_global: statusGlobal === '_semua' ? undefined : statusGlobal === 'aktif',
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
  }, [pager.ready, statusGlobal]);

  useEffect(() => {
    listLembaga({ per_page: 100 }).then((p) => setLembagas(p.data)).catch((e) => setErr(errorMessage(e)));
    referensiList('jenis_dokumen_santri').then(setJenisDokumen).catch(() => {});
  }, []);

  useEffect(() => {
    if (!importLembaga) {
      setTas([]);
      return;
    }
    listTahunAjaran({ lembaga_id: Number(importLembaga), per_page: 100 })
      .then((p) => setTas(p.data))
      .catch((e) => setErr(errorMessage(e)));
  }, [importLembaga]);

  useEffect(() => {
    if (dokRow?.lembaga_id) {
      referensiList('jenis_dokumen_santri', dokRow.lembaga_id).then(setJenisDokumen).catch(() => {});
    }
  }, [dokRow]);

  async function onImport(e: React.FormEvent) {
    e.preventDefault();
    if (!importFile || !importTa) return;
    setBusy(true);
    setErr('');
    try {
      const res = await importSantri({
        tahun_ajaran_id: Number(importTa),
        lembaga_id: importLembaga ? Number(importLembaga) : undefined,
        file: importFile,
      });
      if (res.errors?.length) {
        setErr(res.errors.map((x) => `Baris ${x.row} (${x.attribute}): ${x.errors.join(', ')}`).join(' · '));
      } else {
        toast.success(res.pesan ?? 'Import selesai.');
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

  async function onUploadFoto(e: React.FormEvent) {
    e.preventDefault();
    if (!fotoRow || !fotoFile) return;
    setBusy(true);
    setErr('');
    try {
      await uploadFotoSantri(fotoRow.id, fotoFile);
      toast.success('Foto terupload.');
      setFotoRow(null);
      setFotoFile(null);
      await load();
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  async function onUploadDokumen(e: React.FormEvent) {
    e.preventDefault();
    if (!dokRow || !dokFile || !dokJenis) return;
    setBusy(true);
    setErr('');
    try {
      await uploadDokumenSantri(dokRow.id, {
        jenis_dokumen_santri: dokJenis,
        file: dokFile,
        catatan: dokCatatan || undefined,
      });
      toast.success('Dokumen terupload.');
      setDokRow(null);
      setDokFile(null);
      setDokJenis('');
      setDokCatatan('');
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={PAGE_SHELL}>
      <PageHeader titleId="title_santri" title="Data Santri" />
      <ErrorNotice>{err}</ErrorNotice>
      <ExcelTable
        tableKey="santri"
        fields={fields}
        rows={rows}
        getValues={gridValues}
        loading={loading}
        emptyText="Belum ada santri."
        canEdit={false}
        onCommit={async () => {}}
        onSaved={() => load()}
        filter={(
          <Select value={statusGlobal} onValueChange={(v) => { setStatusGlobal(v); pager.goFirst(); }}>
            <SelectTrigger id="select_status_santri" title="Filter status" aria-label="Filter status" className="h-8 w-36">
              <SelectValue placeholder="Semua" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_semua">Semua status</SelectItem>
              <SelectItem value="aktif">Aktif</SelectItem>
              <SelectItem value="nonaktif">Nonaktif</SelectItem>
            </SelectContent>
          </Select>
        )}
        addButton={(
          <Button id="btn_buka_import_santri" onClick={() => setImportOpen(true)}>
            <Upload size={16} /> Import
          </Button>
        )}
        renderActions={(s) => (
          <>
            <ActionIcon id={`btn_foto_santri_${s.id}`} title="Upload foto" onClick={() => setFotoRow(s)}>
              <ImageUp size={16} />
            </ActionIcon>
            <ActionIcon id={`btn_dokumen_santri_${s.id}`} title="Upload dokumen" onClick={() => setDokRow(s)}>
              <FileUp size={16} />
            </ActionIcon>
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

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import data santri (Excel/CSV)</DialogTitle>
          </DialogHeader>
          <form id="form_import_santri" onSubmit={onImport} className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="select_import_lembaga">Lembaga tujuan</Label>
              <Select value={importLembaga} onValueChange={(v) => { setImportLembaga(v); setImportTa(''); }}>
                <SelectTrigger id="select_import_lembaga" className="w-full">
                  <SelectValue placeholder="Pilih lembaga" />
                </SelectTrigger>
                <SelectContent>
                  {lembagas.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.nama}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="select_import_ta">Tahun ajaran</Label>
              <Select value={importTa} onValueChange={setImportTa}>
                <SelectTrigger id="select_import_ta" className="w-full">
                  <SelectValue placeholder="Pilih tahun ajaran" />
                </SelectTrigger>
                <SelectContent>
                  {tas.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.nama}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="input_file_santri">File (.xlsx/.xls/.csv, maks 5 MB)</Label>
              <Input
                id="input_file_santri"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>Batal</Button>
              <Button id="btn_import_santri" type="submit" disabled={busy || !importFile || !importTa}>Import</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={fotoRow !== null} onOpenChange={(o) => { if (!o) setFotoRow(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload foto: {fotoRow?.nama_lengkap}</DialogTitle>
          </DialogHeader>
          <form id="form_foto_santri" onSubmit={onUploadFoto} className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="input_file_foto">File (jpg/png, maks 2 MB)</Label>
              <Input
                id="input_file_foto"
                type="file"
                accept=".jpg,.jpeg,.png"
                onChange={(e) => setFotoFile(e.target.files?.[0] ?? null)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFotoRow(null)}>Batal</Button>
              <Button id="btn_upload_foto" type="submit" disabled={busy || !fotoFile}>Upload</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dokRow !== null} onOpenChange={(o) => { if (!o) setDokRow(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload dokumen: {dokRow?.nama_lengkap}</DialogTitle>
          </DialogHeader>
          <form id="form_dokumen_santri" onSubmit={onUploadDokumen} className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="select_jenis_dokumen">Jenis dokumen</Label>
              <Select value={dokJenis} onValueChange={setDokJenis}>
                <SelectTrigger id="select_jenis_dokumen" className="w-full">
                  <SelectValue placeholder="Pilih jenis" />
                </SelectTrigger>
                <SelectContent>
                  {jenisDokumen.map((r) => (
                    <SelectItem key={r.id} value={String(r.nama ?? r.kode)}>
                      {String(r.nama ?? r.label ?? r.kode)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="input_file_dokumen">File (jpg/png/pdf, maks 5 MB)</Label>
              <Input
                id="input_file_dokumen"
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={(e) => setDokFile(e.target.files?.[0] ?? null)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="input_catatan_dokumen">Catatan (opsional)</Label>
              <Input id="input_catatan_dokumen" value={dokCatatan} onChange={(e) => setDokCatatan(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDokRow(null)}>Batal</Button>
              <Button id="btn_upload_dokumen" type="submit" disabled={busy || !dokFile || !dokJenis}>Upload</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
