import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage } from '../api/client';
import {
  hapusDokumenWajib,
  listDokumenWajib,
  listPsbKegiatan,
  simpanDokumenWajib,
  type DokumenWajib,
  type PsbKegiatan,
} from '../api/psb';
import { listLembaga, referensiList, type Lembaga, type ReferensiRow } from '../api/master';
import { Button } from '@/components/ui/button';
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
import { useLembagaAwalString } from '@/hooks/useLembagaAwal';
import { useLembagaAktif } from '@/lembagaAktif';
import FilterField from '@/components/FilterField';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
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

/** Kolom grid dokumen wajib; pilihan jenis mengikuti kamus aktif lembaga
 *  (dipakai pada mode Input). */
function dokumenFields(jenisOptions: { value: string; label: string }[]): ExcelField[] {
  return [
    {
      key: 'jenis', label: 'Jenis dokumen', width: 260, kind: 'static',
      inputKind: 'select', required: true, inputChoices: jenisOptions,
    },
    {
      key: 'wajib', label: 'Sifat', width: 120, kind: 'select',
      choices: [
        { value: 'Ya', label: 'Wajib' },
        { value: 'Tidak', label: 'Opsional' },
      ],
    },
  ];
}

function gridValues(d: DokumenWajib): Record<string, string | null> {
  return { jenis: d.jenis_dokumen_santri, wajib: d.is_wajib ? 'Ya' : 'Tidak' };
}

// Ketentuan dokumen wajib per lembaga (dipakai verifikasi PSB/daftar ulang).
export default function DokumenWajibPage() {
  const [kegiatans, setKegiatans] = useState<PsbKegiatan[]>([]);
  const [kegiatanId, setKegiatanId] = useState('');
  const [lembagas, setLembagas] = useState<Lembaga[]>([]);
  const [lembagaId, setLembagaId] = useState('');
  useLembagaAwalString(setLembagaId);
  const { terkunci } = useLembagaAktif();
  const [rows, setRows] = useState<DokumenWajib[]>([]);
  const [jenis, setJenis] = useState<ReferensiRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [tambahOpen, setTambahOpen] = useState(false);
  const [jenisBaru, setJenisBaru] = useState('');
  const [sifatBaru, setSifatBaru] = useState<'wajib' | 'opsional'>('wajib');
  const reqRef = useRef(0);

  const load = useCallback(async () => {
    if (!kegiatanId || !lembagaId) return;
    const req = ++reqRef.current;
    setErr('');
    setLoading(true);
    try {
      const res = await listDokumenWajib(Number(kegiatanId), Number(lembagaId));
      if (req !== reqRef.current) return;
      setRows(res.data);
    } catch (e) {
      if (req === reqRef.current) setErr(errorMessage(e));
    } finally {
      if (req === reqRef.current) setLoading(false);
    }
  }, [kegiatanId, lembagaId]);

  useEffect(() => {
    listLembaga({ per_page: 100 }).then((p) => setLembagas(p.data)).catch((e) => setErr(errorMessage(e)));
    listPsbKegiatan()
      .then((r) => {
        setKegiatans(r.data);
        setKegiatanId((cur) => cur || (r.data[0] ? String(r.data[0].id) : ''));
      })
      .catch((e) => setErr(errorMessage(e)));
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
    if (!kegiatanId || !lembagaId || !jenisBaru) return;
    setBusy(true);
    setErr('');
    try {
      await simpanDokumenWajib({
        psb_kegiatan_id: Number(kegiatanId),
        lembaga_id: Number(lembagaId),
        jenis_dokumen_santri: jenisBaru,
        is_wajib: sifatBaru === 'wajib',
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
  }, [kegiatanId, lembagaId, jenisBaru, sifatBaru, load]);

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

  const commitWajib = useCallback(async (id: string | number, f: Record<string, string | null>) => {
    if (f.wajib === undefined || !kegiatanId || !lembagaId) return;
    const row = rows.find((r) => String(r.id) === String(id));
    if (!row) return;
    await simpanDokumenWajib({
      psb_kegiatan_id: row.psb_kegiatan_id,
      lembaga_id: Number(lembagaId),
      jenis_dokumen_santri: row.jenis_dokumen_santri,
      is_wajib: f.wajib === 'Ya',
    });
  }, [rows, kegiatanId, lembagaId]);

  /** Kolom grid dengan pilihan jenis dinamis + mode Input. */
  const fields = useMemo(
    () => dokumenFields(jenis.map((r) => ({
      value: String(r.nama ?? r.kode),
      label: String(r.nama ?? r.kode),
    }))),
    [jenis],
  );

  /** Mode Input: simpan ketentuan dokumen baru dari baris input. */
  const createRow = useCallback(async (f: Record<string, string | null>) => {
    if (!kegiatanId || !lembagaId) {
      throw new Error('Pilih kegiatan & lembaga dulu untuk mode Input.');
    }
    await simpanDokumenWajib({
      psb_kegiatan_id: Number(kegiatanId),
      lembaga_id: Number(lembagaId),
      jenis_dokumen_santri: (f.jenis ?? '').trim(),
      is_wajib: f.wajib !== 'Tidak',
    });
    toast.success('Ketentuan disimpan.');
    await load();
  }, [kegiatanId, lembagaId, load]);

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
      <ErrorNotice>{err}</ErrorNotice>
      <ExcelTable
        tableKey="dokumen_wajib"
        fields={fields}
        rows={rows}
        getValues={gridValues}
        loading={loading}
        emptyText={kegiatanId && lembagaId ? 'Belum ada ketentuan dokumen.' : 'Pilih kegiatan & lembaga dulu.'}
        canEdit
        onCommit={commitWajib}
        onSaved={load}
        onCreateRow={kegiatanId && lembagaId ? createRow : undefined}
        inputRowValues={{ wajib: 'Ya' }}
        filter={(
          <>
            <FilterField label="Kegiatan" htmlFor="select_kegiatan_dokumen_wajib">
            <Select value={kegiatanId} onValueChange={setKegiatanId}>
              <SelectTrigger id="select_kegiatan_dokumen_wajib" title="Kegiatan PSB" aria-label="Kegiatan PSB" className="w-52">
                <SelectValue placeholder="Pilih kegiatan" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {kegiatans.map((k) => <SelectItem key={k.id} value={String(k.id)}>{k.nama}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
            </FilterField>
            <FilterField label="Lembaga" htmlFor="select_lembaga_dokumen_wajib">
            <Select value={lembagaId} onValueChange={setLembagaId} disabled={terkunci}>
              <SelectTrigger id="select_lembaga_dokumen_wajib" title="Lembaga" aria-label="Lembaga" className="w-44">
                <SelectValue placeholder="Pilih lembaga" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {lembagas.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.kode ?? l.nama}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
            </FilterField>
          </>
        )}
        addButton={(
          <Button id="btn_buka_tambah_dokumen_wajib" onClick={() => { setJenisBaru(''); setSifatBaru('wajib'); setTambahOpen(true); }} disabled={!kegiatanId || !lembagaId}>
            + Ketentuan
          </Button>
        )}
        renderActions={renderActions}
      />

      <Dialog open={tambahOpen} onOpenChange={setTambahOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah ketentuan dokumen</DialogTitle>
            <DialogDescription>Jenis dokumen diambil dari kamus aktif lembaga.</DialogDescription>
          </DialogHeader>
          <form id="form_tambah_dokumen_wajib" onSubmit={onTambah} className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
            <FieldLabel htmlFor="select_jenis_dokumen_wajib">Jenis dokumen</FieldLabel>
            <Select value={jenisBaru} onValueChange={setJenisBaru}>
              <SelectTrigger id="select_jenis_dokumen_wajib" className="w-full">
                <SelectValue placeholder="Pilih jenis" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {jenis.map((r) => (
                    <SelectItem key={r.id} value={String(r.nama ?? r.kode)}>
                      {String(r.nama ?? r.kode)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldLabel htmlFor="select_sifat_dokumen_wajib">Sifat dokumen</FieldLabel>
            <Select value={sifatBaru} onValueChange={(v) => setSifatBaru(v as 'wajib' | 'opsional')}>
              <SelectTrigger id="select_sifat_dokumen_wajib" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="wajib">Wajib</SelectItem>
                  <SelectItem value="opsional">Opsional</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setTambahOpen(false)}>Batal</Button>
              <Button id="btn_tambah_dokumen_wajib" type="submit" disabled={busy || !jenisBaru}>Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
