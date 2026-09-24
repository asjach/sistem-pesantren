import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { errorMessage } from '../api/client';
import { daftarKelas, importMutasiFile, listMutasiKeluar, mutasiSantri, periksaImportMutasi, unduhTemplateMutasi, type ImportMutasiHasil, type MutasiKeluar, type RiwayatRow } from '../api/siklus';
import { referensiList } from '../api/master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ExcelTable from '@/components/ExcelTable';
import { FilterTingkatKelas, useFilterTingkatKelas } from '@/components/FilterTingkatKelas';
import { useLembagaAwalString } from '@/hooks/useLembagaAwal';
import { FileUp, Download, ArrowRight } from '@/icons';
import { ActionIcon } from '@/components/RowActions';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import Pager from '@/components/Pager';
import { usePager } from '@/hooks/usePager';
import { toast } from 'sonner';

/** Mutasi Keluar: kiri santri aktif (nama + kelas) → kanan arsip mutasi. */
export default function MutasiKeluarPage() {
  const { user } = useAuth();
  const [jenjang, setLembagaId] = useState('');
  useLembagaAwalString(setLembagaId);
  const [kiri, setKiri] = useState<RiwayatRow[]>([]);
  const [arsip, setArsip] = useState<MutasiKeluar[]>([]);
  const [alasanOpsi, setAlasanOpsi] = useState<{ value: string; label: string }[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const pager = usePager('mutasi_keluar');
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  /** Urut header arsip: daftar nilai allowlist + arah global (maks 3 kunci). */
  const [urut, setUrut] = useState<string[]>([]);
  const [arahUrut, setArahUrut] = useState<'naik' | 'turun'>('naik');

  const [baris, setBaris] = useState<RiwayatRow | null>(null);
  const [tanggal, setTanggal] = useState('');
  const [alasan, setAlasan] = useState('');
  const [noSurat, setNoSurat] = useState('');
  const [tujuan, setTujuan] = useState('');
  const [npsn, setNpsn] = useState('');
  const [nsm, setNsm] = useState('');
  const [keterangan, setKeterangan] = useState('');

  // Import arsip mutasi (Periksa → Import).
  const canImportMutasi = bisa(user, 'mutasi_keluar.ubah');
  const [fileOpen, setFileOpen] = useState(false);
  const [fileMutasi, setFileMutasi] = useState<File | null>(null);
  const [hasilFile, setHasilFile] = useState<ImportMutasiHasil | null>(null);
  const [fileBusy, setFileBusy] = useState(false);

  const loadKiri = useCallback(async () => {
    if (!jenjang) { setKiri([]); return; }
    setErr('');
    try {
      const res = await daftarKelas({ jenjang: jenjang });
      setKiri(res.data);
    } catch (e) { setErr(errorMessage(e)); }
  }, [jenjang]);

  const loadArsip = useCallback(async (
    p = pager.page, pp = pager.perPage,
    f?: { urut?: string[]; arah?: 'naik' | 'turun' },
  ) => {
    if (!jenjang) { setArsip([]); return; }
    try {
      const u = f?.urut ?? urut;
      const a = f?.arah ?? arahUrut;
      const res = await listMutasiKeluar({
        jenjang: jenjang,
        sort: u.length ? u : undefined,
        arah: u.length ? a : undefined,
        page: p, per_page: pp,
      });
      setArsip(res.data);
      setLastPage(res.last_page);
      setTotal(res.total);
    } catch (e) { setErr(errorMessage(e)); }
  }, [jenjang, pager.page, pager.perPage, urut, arahUrut]);

  /** Klik header: simpan urut baru lalu muat ulang arsip dari halaman 1. */
  function terapkanUrut(nilai: string[], arah: 'naik' | 'turun') {
    setUrut(nilai);
    setArahUrut(arah);
    pager.goFirst();
    void loadArsip(1, pager.perPage, { urut: nilai, arah });
  }

  useEffect(() => { void loadKiri(); }, [loadKiri]);
  useEffect(() => { void loadArsip(); }, [loadArsip]);

  useEffect(() => {
    referensiList('alasan_mutasi', jenjang ? jenjang : undefined)
      .then((r) => setAlasanOpsi(r.map((x) => ({ value: x.kode ?? x.nama ?? '', label: x.nama ?? x.kode ?? '' }))))
      .catch(() => setAlasanOpsi([]));
  }, [jenjang]);

  /** Filter tingkat & kelas (multi-pilih) di topBar untuk daftar santri aktif. */
  const filter = useFilterTingkatKelas(kiri, (r) => r.tingkat, (r) => r.kelas?.nama_kelas);

  const simpan = async () => {
    if (!baris || !jenjang || !tanggal || !alasan) return;
    setBusy(true);
    try {
      await mutasiSantri(baris.santri_id, {
        jenjang: jenjang,
        tanggal_mutasi: tanggal,
        alasan_mutasi: alasan,
        kelas_terakhir_id: baris.kelas_id ?? undefined,
        no_surat: noSurat.trim() || undefined,
        nama_sekolah_tujuan: tujuan.trim() || undefined,
        npsn_sekolah_tujuan: npsn.trim() || undefined,
        nsm_sekolah_tujuan: nsm.trim() || undefined,
        keterangan: keterangan.trim() || undefined,
      });
      toast.success('Santri dimutasi keluar.');
      setBaris(null);
      setTanggal(''); setAlasan(''); setNoSurat(''); setTujuan(''); setNpsn(''); setNsm(''); setKeterangan('');
      await Promise.all([loadKiri(), loadArsip(1)]);
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <FilterTingkatKelas filter={filter} />
      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1" id="grup_mutasi_kolom">
        <ResizablePanel defaultSize="33" minSize="20">
        <section className="flex h-full min-h-0 min-w-0 flex-col rounded-md">
          <header className="shrink-0 border-b bg-muted/40 px-3 py-2 text-sm font-medium">Santri aktif ({filter.tersaring.length})</header>
          <div className="flex min-h-0 flex-1 flex-col px-2 pb-2">
            <ExcelTable
              tableKey="mutasi_santri_aktif"
              fields={[
                { key: 'nama', label: 'santri.nama_lengkap', kind: 'static', sumber: { tabel: 'santri', kolom: 'nama_lengkap' } },
                { key: 'kelas', label: 'kelas.nama_kelas', kind: 'static', sumber: { tabel: 'kelas', kolom: 'nama_kelas' } },
              ]}
              rows={filter.tersaring}
              getValues={(r) => ({ nama: r.santri?.nama_lengkap ?? null, kelas: r.kelas?.nama_kelas ?? null })}
              canEdit={false}
              onCommit={async () => {}}
              onSaved={() => {}}
              renderActions={(r) => (
                bisa(user, 'mutasi_keluar.ubah') ? (
                  <ActionIcon
                    id={`btn_mutasi_${r.id}`}
                    title="Mutasi keluar"
                    onClick={() => { setBaris(r); setTanggal(''); setAlasan(''); setNoSurat(''); setTujuan(''); setNpsn(''); setNsm(''); setKeterangan(''); }}
                  >
                    <ArrowRight size={16} />
                  </ActionIcon>
                ) : null
              )}
              hideCheckbox
              emptyText="Pilih lembaga dulu."
            />
          </div>
        </section>
        </ResizablePanel>

        <ResizableHandle orientation="horizontal" withHandle id="gagang_mutasi_kolom" />

        <ResizablePanel defaultSize="67" minSize="20">
        <section className="flex h-full min-h-0 min-w-0 flex-col rounded-md">
          <header className="flex shrink-0 items-center justify-between border-b bg-muted/40 px-3 py-2 text-sm font-medium">
            <span>Arsip mutasi keluar</span>
            {canImportMutasi && (
              <Button id="btn_buka_import_mutasi" size="sm" variant="outline" disabled={!jenjang}
                onClick={() => { setFileMutasi(null); setHasilFile(null); setFileOpen(true); }}>
                <FileUp data-icon="inline-start" size={16} /> Import
              </Button>
            )}
          </header>
          <div className="flex min-h-0 flex-1 flex-col px-2 pb-2">
            <ExcelTable
              tableKey="mutasi_arsip"
              fields={[
                { key: 'santri', label: 'santri.nama_lengkap', kind: 'static', sumber: { tabel: 'santri', kolom: 'nama_lengkap' } },
                { key: 'tanggal', label: 'tanggal_mutasi', kind: 'static', sumber: { tabel: 'mutasi_keluar', kolom: 'tanggal_mutasi' } },
                { key: 'alasan', label: 'alasan_mutasi', kind: 'static', sumber: { tabel: 'mutasi_keluar', kolom: 'alasan_mutasi' } },
                { key: 'tujuan', label: 'nama_sekolah_tujuan', kind: 'static', sumber: { tabel: 'mutasi_keluar', kolom: 'nama_sekolah_tujuan' } },
              ]}
              rows={arsip}
              getValues={(m) => ({
                santri: m.santri?.nama_lengkap ?? '—',
                tanggal: m.tanggal_mutasi?.slice(0, 10) ?? '—',
                alasan: m.alasan_mutasi ?? '—',
                tujuan: m.nama_sekolah_tujuan ?? '—',
              })}
              urutAktif={urut}
              arahUrut={arahUrut}
              onUrut={terapkanUrut}
              canEdit={false}
              onCommit={async () => {}}
              onSaved={() => {}}
              renderActions={() => null}
              hideCheckbox
              hideActions
              hidePreset
              emptyText="Belum ada arsip mutasi."
            />
          </div>
          <Pager page={pager.page} lastPage={lastPage} total={total} perPage={pager.perPage} onPage={(p) => { pager.setPage(p); void loadArsip(p); }} onPerPage={(pp) => { pager.setPerPage(pp); void loadArsip(1, pp); }} />
        </section>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Import arsip mutasi (Periksa → Import) */}
      <Dialog open={fileOpen} onOpenChange={setFileOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import arsip mutasi keluar</DialogTitle>
            <DialogDescription>
              Satu file boleh berisi banyak lembaga. Kunci santri: NIS lokal + lembaga.
              Kolom: nis_lokal (wajib), jenjang (wajib), tanggal_mutasi (wajib), alasan_mutasi (wajib),
              kelas_terakhir (nama rombel; kosong = beku dari riwayat terakhir), tahun_ajaran
              (opsional, wajib bila nama kelas ada di beberapa tahun ajaran), no_surat,
              nama_sekolah_tujuan, npsn, nsm, dan alamat tujuan, keterangan. Baris yang sama
              (santri+lembaga+tanggal) dilewati; santri yang masih aktif ikut ditutup seperti
              tombol Mutasi.
            </DialogDescription>
          </DialogHeader>
          <form className="grid grid-cols-2 gap-3" onSubmit={async (e) => {
            e.preventDefault();
            if (!fileMutasi || !hasilFile?.siap_import) return;
            setFileBusy(true);
            try {
              const res = await importMutasiFile(fileMutasi);
              if (res.errors?.length) toast.error(res.errors.map((x) => `Baris ${x.row} (${x.attribute}): ${x.errors.join(', ')}`).join(' · '));
              else {
                toast.success(res.pesan ?? 'Import selesai.');
                setFileOpen(false);
                pager.goFirst();
                await Promise.all([loadKiri(), loadArsip(1)]);
              }
            } catch (e2) { toast.error(errorMessage(e2)); } finally { setFileBusy(false); }
          }}>
            <Button id="btn_unduh_template_mutasi" type="button" variant="link" className="col-span-2 h-auto justify-start px-0"
              onClick={() => void unduhTemplateMutasi().catch((e) => toast.error(errorMessage(e)))}>
              <Download data-icon="inline-start" size={16} /> Unduh template Excel mutasi keluar
            </Button>
            <Input id="input_file_import_mutasi" className="col-span-2" type="file" accept=".xlsx,.xls,.csv"
              onChange={(e) => { setFileMutasi(e.target.files?.[0] ?? null); setHasilFile(null); }} required />
            {hasilFile ? (
              <div className="col-span-2 rounded-md border p-3 text-sm" id="hasil_periksa_import_mutasi">
                <p className="font-medium">
                  {hasilFile.ringkasan.baris_diproses} baris diperiksa · {hasilFile.ringkasan.dibuat} dibuat ·{' '}
                  {hasilFile.ringkasan.dilewati} dilewati · {hasilFile.ringkasan.baris_gagal} bermasalah
                </p>
                {hasilFile.errors.length > 0 ? (
                  <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-destructive">
                    {hasilFile.errors.slice(0, 50).map((x, i) => <li key={`${x.row}-${x.attribute}-${i}`}>Baris {x.row} ({x.attribute}): {x.errors.join(', ')}</li>)}
                  </ul>
                ) : <p className="mt-1 text-xs text-emerald-600">Tidak ada masalah — siap diimport.</p>}
              </div>
            ) : null}
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setFileOpen(false)}>Batal</Button>
              <Button id="btn_periksa_import_mutasi" type="button" variant="outline" disabled={!fileMutasi || fileBusy}
                onClick={async () => {
                  if (!fileMutasi) return;
                  setFileBusy(true);
                  try {
                    const res = await periksaImportMutasi(fileMutasi);
                    setHasilFile(res);
                    if (res.siap_import) toast.success(res.pesan); else toast.error(res.pesan);
                  } catch (e2) { setHasilFile(null); toast.error(errorMessage(e2)); } finally { setFileBusy(false); }
                }}>Periksa</Button>
              <Button id="btn_import_mutasi" type="submit" disabled={fileBusy || !hasilFile?.siap_import}>Import</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={baris !== null} onOpenChange={(o) => { if (!o) setBaris(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Mutasi keluar</DialogTitle>
            <DialogDescription>{baris?.santri?.nama_lengkap} — {baris?.kelas?.nama_kelas ?? 'tanpa kelas'}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-3">
            <FieldLabel htmlFor="input_tanggal_mutasi">Tanggal</FieldLabel>
            <Input id="input_tanggal_mutasi" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
            <FieldLabel htmlFor="select_alasan_mutasi">Alasan</FieldLabel>
            <Select value={alasan || '_kosong'} onValueChange={(v) => setAlasan(v === '_kosong' ? '' : v)}>
              <SelectTrigger id="select_alasan_mutasi"><SelectValue placeholder="Pilih alasan" /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="_kosong">Pilih alasan</SelectItem>
                  {alasanOpsi.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldLabel htmlFor="input_no_surat_mutasi">No. surat</FieldLabel>
            <Input id="input_no_surat_mutasi" value={noSurat} onChange={(e) => setNoSurat(e.target.value)} />
            <FieldLabel htmlFor="input_tujuan_mutasi">Sekolah tujuan</FieldLabel>
            <Input id="input_tujuan_mutasi" value={tujuan} onChange={(e) => setTujuan(e.target.value)} />
            <FieldLabel htmlFor="input_npsn_mutasi">NPSN tujuan</FieldLabel>
            <Input id="input_npsn_mutasi" value={npsn} onChange={(e) => setNpsn(e.target.value)} />
            <FieldLabel htmlFor="input_nsm_mutasi">NSM tujuan</FieldLabel>
            <Input id="input_nsm_mutasi" value={nsm} onChange={(e) => setNsm(e.target.value)} />
            <FieldLabel htmlFor="input_keterangan_mutasi">Keterangan</FieldLabel>
            <Input id="input_keterangan_mutasi" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBaris(null)}>Batal</Button>
            <Button id="btn_simpan_mutasi" disabled={busy || !tanggal || !alasan} onClick={() => void simpan()}>Proses mutasi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
