import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api/client';
import {
  hapusDokumenWajib,
  listDokumenWajib,
  simpanDokumenWajib,
  type DokumenWajib,
} from '../api/psb';
import { listLembaga, referensiList, type Lembaga, type ReferensiRow } from '../api/master';
import { Button } from '@/components/ui/button';
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
import { DeleteAction } from '@/components/RowActions';
import { toast } from 'sonner';

const FIELDS: ExcelField[] = [
  { key: 'jenis', label: 'Jenis dokumen', width: 260, kind: 'static' },
  { key: 'wajib', label: 'Wajib', width: 100, kind: 'static' },
];

function gridValues(d: DokumenWajib): Record<string, string | null> {
  return { jenis: d.jenis_dokumen_santri, wajib: d.is_wajib ? 'Ya' : 'Tidak' };
}

async function noopCommit() {}

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
  const reqRef = useRef(0);

  const load = useCallback(async () => {
    if (!lembagaId) return;
    const req = ++reqRef.current;
    setErr('');
    setLoading(true);
    try {
      const res = await listDokumenWajib(Number(lembagaId));
      if (req !== reqRef.current) return;
      setRows(res.data);
    } catch (e) {
      if (req === reqRef.current) setErr(errorMessage(e));
    } finally {
      if (req === reqRef.current) setLoading(false);
    }
  }, [lembagaId]);

  useEffect(() => {
    listLembaga({ per_page: 100 }).then((p) => setLembagas(p.data)).catch((e) => setErr(errorMessage(e)));
  }, []);

  useEffect(() => {
    if (!lembagaId) {
      reqRef.current += 1;
      setRows([]);
      setJenis([]);
      setLoading(false);
      return;
    }
    void load();
    let alive = true;
    referensiList('jenis_dokumen_santri', Number(lembagaId))
      .then((r) => { if (alive) setJenis(r); })
      .catch(() => {});
    return () => { alive = false; };
  }, [lembagaId, load]);

  const onTambah = useCallback(async (e: React.FormEvent) => {
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
  }, [lembagaId, jenisBaru, load]);

  const onHapus = useCallback(async (id: number) => {
    setErr('');
    try {
      await hapusDokumenWajib(id);
      toast.success('Ketentuan dihapus.');
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [load]);

  const renderActions = useCallback((d: DokumenWajib) => (
    <DeleteAction
      id={`btn_hapus_dokumen_wajib_${d.id}`}
      title="Hapus ketentuan?"
      description={`${d.jenis_dokumen_santri} tidak lagi menjadi syarat dokumen.`}
      onConfirm={() => onHapus(d.id)}
    />
  ), [onHapus]);

  return (
    <div className={PAGE_SHELL}>
      <PageHeader titleId="title_dokumen_wajib" title="Dokumen Wajib per Lembaga" />
      <ErrorNotice>{err}</ErrorNotice>
      <ExcelTable
        tableKey="dokumen_wajib"
        fields={FIELDS}
        rows={rows}
        getValues={gridValues}
        loading={loading}
        emptyText={lembagaId ? 'Belum ada ketentuan dokumen.' : 'Pilih lembaga dulu.'}
        canEdit={false}
        onCommit={noopCommit}
        onSaved={load}
        filter={(
          <Select value={lembagaId} onValueChange={setLembagaId}>
            <SelectTrigger id="select_lembaga_dokumen_wajib" title="Lembaga" aria-label="Lembaga" size="sm" className="w-44">
              <SelectValue placeholder="Pilih lembaga" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {lembagas.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.nama}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
        addButton={(
          <Button id="btn_buka_tambah_dokumen_wajib" onClick={() => { setJenisBaru(''); setTambahOpen(true); }} disabled={!lembagaId}>
            + Ketentuan
          </Button>
        )}
        renderActions={renderActions}
      />

      <Dialog open={tambahOpen} onOpenChange={setTambahOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah ketentuan dokumen</DialogTitle>
            <DialogDescription>Jenis dokumen diambil dari kamus aktif lembaga.</DialogDescription>
          </DialogHeader>
          <form id="form_tambah_dokumen_wajib" onSubmit={onTambah} className="flex flex-col gap-3">
            <FieldGroup className="gap-3">
              <Field>
                <FieldLabel htmlFor="select_jenis_dokumen_wajib">Jenis dokumen</FieldLabel>
                <Select value={jenisBaru} onValueChange={setJenisBaru}>
                  <SelectTrigger id="select_jenis_dokumen_wajib" className="w-full">
                    <SelectValue placeholder="Pilih jenis" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {jenis.map((r) => (
                        <SelectItem key={r.id} value={String(r.nama ?? r.kode)}>
                          {String(r.nama ?? r.label ?? r.kode)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
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
