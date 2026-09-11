import { useEffect, useState } from 'react';
import { errorMessage } from '../api/client';
import {
  hapusDokumenWajib,
  listDokumenWajib,
  simpanDokumenWajib,
  type DokumenWajib,
} from '../api/psb';
import { listLembaga, referensiList, type Lembaga, type ReferensiRow } from '../api/master';
import { Button } from '@/components/ui/button';
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
import { DeleteAction } from '@/components/RowActions';
import { toast } from 'sonner';

// Ketentuan dokumen wajib per lembaga (dipakai verifikasi PSB/daftar ulang).
export default function DokumenWajibPage() {
  const [lembagas, setLembagas] = useState<Lembaga[]>([]);
  const [lembagaId, setLembagaId] = useState('');
  const [rows, setRows] = useState<DokumenWajib[]>([]);
  const [jenis, setJenis] = useState<ReferensiRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [tambahOpen, setTambahOpen] = useState(false);
  const [jenisBaru, setJenisBaru] = useState('');

  const fields: ExcelField[] = [
    { key: 'jenis', label: 'Jenis dokumen', width: 260, kind: 'static' },
    { key: 'wajib', label: 'Wajib', width: 100, kind: 'static' },
  ];

  function gridValues(d: DokumenWajib): Record<string, string | null> {
    return { jenis: d.jenis_dokumen_santri, wajib: d.is_wajib ? 'Ya' : 'Tidak' };
  }

  useEffect(() => {
    listLembaga({ per_page: 100 }).then((p) => setLembagas(p.data)).catch((e) => setErr(errorMessage(e)));
  }, []);

  useEffect(() => {
    if (!lembagaId) {
      setRows([]);
      return;
    }
    setErr('');
    setLoading(true);
    listDokumenWajib(Number(lembagaId))
      .then((res) => setRows(res.data))
      .catch((e) => setErr(errorMessage(e)))
      .finally(() => setLoading(false));
    referensiList('jenis_dokumen_santri', Number(lembagaId)).then(setJenis).catch(() => {});
  }, [lembagaId]);

  async function load() {
    if (!lembagaId) return;
    try {
      const res = await listDokumenWajib(Number(lembagaId));
      setRows(res.data);
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  async function onTambah(e: React.FormEvent) {
    e.preventDefault();
    if (!lembagaId || !jenisBaru) return;
    setBusy(true);
    setErr('');
    try {
      await simpanDokumenWajib({
        lembaga_id: Number(lembagaId),
        jenis_dokumen_santri: jenisBaru,
        is_wajib: true,
      });
      toast.success('Ketentuan disimpan.');
      setTambahOpen(false);
      setJenisBaru('');
      await load();
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  async function onHapus(id: number) {
    setErr('');
    try {
      await hapusDokumenWajib(id);
      toast.success('Ketentuan dihapus.');
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  return (
    <div className={PAGE_SHELL}>
      <PageHeader titleId="title_dokumen_wajib" title="Dokumen Wajib per Lembaga" />
      <ErrorNotice>{err}</ErrorNotice>
      <ExcelTable
        tableKey="dokumen_wajib"
        fields={fields}
        rows={rows}
        getValues={gridValues}
        loading={loading}
        emptyText={lembagaId ? 'Belum ada ketentuan dokumen.' : 'Pilih lembaga dulu.'}
        canEdit={false}
        onCommit={async () => {}}
        onSaved={load}
        filter={(
          <Select value={lembagaId} onValueChange={setLembagaId}>
            <SelectTrigger id="select_lembaga_dokumen_wajib" title="Lembaga" aria-label="Lembaga" className="h-8 w-44">
              <SelectValue placeholder="Pilih lembaga" />
            </SelectTrigger>
            <SelectContent>
              {lembagas.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.nama}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        addButton={(
          <Button id="btn_buka_tambah_dokumen_wajib" onClick={() => { setJenisBaru(''); setTambahOpen(true); }} disabled={!lembagaId}>
            + Ketentuan
          </Button>
        )}
        renderActions={(d) => (
          <DeleteAction
            id={`btn_hapus_dokumen_wajib_${d.id}`}
            title="Hapus ketentuan?"
            description={`${d.jenis_dokumen_santri} tidak lagi menjadi syarat dokumen.`}
            onConfirm={() => onHapus(d.id)}
          />
        )}
      />

      <Dialog open={tambahOpen} onOpenChange={setTambahOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah ketentuan dokumen</DialogTitle>
            <DialogDescription>Jenis dokumen diambil dari kamus aktif lembaga.</DialogDescription>
          </DialogHeader>
          <form id="form_tambah_dokumen_wajib" onSubmit={onTambah} className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="select_jenis_dokumen_wajib">Jenis dokumen</Label>
              <Select value={jenisBaru} onValueChange={setJenisBaru}>
                <SelectTrigger id="select_jenis_dokumen_wajib" className="w-full">
                  <SelectValue placeholder="Pilih jenis" />
                </SelectTrigger>
                <SelectContent>
                  {jenis.map((r) => (
                    <SelectItem key={r.id} value={String(r.nama ?? r.kode)}>
                      {String(r.nama ?? r.label ?? r.kode)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTambahOpen(false)}>Batal</Button>
              <Button id="btn_tambah_dokumen_wajib" type="submit" disabled={busy || !jenisBaru}>Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
