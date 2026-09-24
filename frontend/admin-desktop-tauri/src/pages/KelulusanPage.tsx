import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { errorMessage } from '../api/client';
import { daftarKelas, listAlumni, lulusSantri, tidakLulusSantri, type Alumni, type RiwayatRow } from '../api/siklus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ExcelTable from '@/components/ExcelTable';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useLembagaAwalString } from '@/hooks/useLembagaAwal';
import { useTahunAjaranAwalString } from '@/hooks/useTahunAjaranAwal';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { TopBarSearch } from '@/components/TopBarSearch';
import { toast } from 'sonner';

/** Kelulusan: kiri santri tingkat akhir → kanan alumni & santri tidak lulus. */
export default function KelulusanPage() {
  const { user } = useAuth();
  const canUbah = bisa(user, 'kelulusan.ubah');
  const [jenjang, setLembagaId] = useState('');
  useLembagaAwalString(setLembagaId);
  const [tingkat, setTingkat] = useState('');
  const [taLulus, setTaLulus] = useState('');
  useTahunAjaranAwalString(setTaLulus);
  const [kiri, setKiri] = useState<RiwayatRow[]>([]);
  const [pilih, setPilih] = useState<Set<number>>(new Set());
  const [tidakLulus, setTidakLulus] = useState<{ santri_id: number; nama: string; kelas: string | null }[]>([]);
  /** Panel santri tidak lulus bisa disembunyikan/ditampilkan. */
  const [tampilTidakLulus, setTampilTidakLulus] = useState(true);
  const [alumni, setAlumni] = useState<Alumni[]>([]);
  /** Urut header alumni: daftar nilai allowlist + arah global (maks 3 kunci). */
  const [urut, setUrut] = useState<string[]>([]);
  const [arahUrut, setArahUrut] = useState<'naik' | 'turun'>('naik');
  const [err, setErr] = useState('');
  /** Pencarian tunggal halaman (topBar). */
  const [cari, setCari] = useState('');
  const [busy, setBusy] = useState(false);

  const [lulusOpen, setLulusOpen] = useState(false);
  const [tanggalLulus, setTanggalLulus] = useState('');
  const [noIjazah, setNoIjazah] = useState('');
  const [noSurat, setNoSurat] = useState('');

  const loadKiri = useCallback(async () => {
    if (!jenjang) { setKiri([]); return; }
    setErr('');
    const q = cari.trim().toLowerCase();
    try {
      const res = await daftarKelas({ jenjang: jenjang });
      setKiri(res.data.filter((r) => (!tingkat || r.tingkat === tingkat)
        && (q === ''
          || (r.santri?.nama_lengkap ?? '').toLowerCase().includes(q)
          || (r.nis_lokal ?? '').toLowerCase().includes(q))));
    } catch (e) { setErr(errorMessage(e)); }
  }, [jenjang, tingkat, cari]);

  const loadArsip = useCallback(async (f?: { urut?: string[]; arah?: 'naik' | 'turun' }) => {
    if (!jenjang) { setAlumni([]); return; }
    try {
      const u = f?.urut ?? urut;
      const a = f?.arah ?? arahUrut;
      const res = await listAlumni({
        jenjang: jenjang,
        q: cari || undefined,
        sort: u.length ? u : undefined,
        arah: u.length ? a : undefined,
        per_page: 100,
      });
      setAlumni(res.data);
    } catch (e) { setErr(errorMessage(e)); }
  }, [jenjang, urut, arahUrut, cari]);

  /** Klik header: simpan urut baru lalu muat ulang arsip alumni. */
  function terapkanUrut(nilai: string[], arah: 'naik' | 'turun') {
    setUrut(nilai);
    setArahUrut(arah);
    void loadArsip({ urut: nilai, arah });
  }

  useEffect(() => { void loadKiri(); }, [loadKiri]);
  useEffect(() => { void loadArsip(); }, [loadArsip]);

  const namaTerpilih = kiri.filter((r) => pilih.has(r.santri_id));
  const totalTerpilih = namaTerpilih.length + tidakLulus.length;

  const prosesLulus = async () => {
    if (!jenjang || !taLulus || !tanggalLulus || namaTerpilih.length === 0) return;
    setBusy(true);
    try {
      for (const r of namaTerpilih) {
        await lulusSantri(r.santri_id, {
          jenjang: jenjang,
          tahun_ajaran_lulus: taLulus,
          tanggal_lulus: tanggalLulus,
          nomor_ijazah: noIjazah.trim() || undefined,
          no_surat_ijazah: noSurat.trim() || undefined,
        });
      }
      toast.success(`${namaTerpilih.length} santri dinyatakan lulus.`);
      setLulusOpen(false);
      setNoIjazah(''); setNoSurat(''); setTanggalLulus('');
      await Promise.all([loadKiri(), loadArsip()]);
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  const prosesTidakLulus = async () => {
    if (!jenjang || tidakLulus.length === 0) return;
    setBusy(true);
    try {
      for (const b of tidakLulus) await tidakLulusSantri(b.santri_id, jenjang);
      toast.success(`${tidakLulus.length} santri ditandai tidak lulus (mengulang).`);
      setTidakLulus([]);
      await Promise.all([loadKiri(), loadArsip()]);
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <TopBarSearch value={cari} onChange={setCari} placeholder="Cari santri…" />
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <FieldLabel htmlFor="input_tingkat_kelulusan">Tingkat akhir</FieldLabel>
          <Input id="input_tingkat_akhir_kelulusan" value={tingkat} onChange={(e) => setTingkat(e.target.value)} placeholder="mis. 6" className="w-28" />
        </div>
        {canUbah && (
        <Button id="btn_buka_luluskan" disabled={namaTerpilih.length === 0} onClick={() => { setTanggalLulus(''); setNoIjazah(''); setNoSurat(''); setLulusOpen(true); }}>
          Luluskan ({namaTerpilih.length})
        </Button>
        )}
        {canUbah && (
        <Button id="btn_proses_tidak_lulus" variant="outline" disabled={busy || tidakLulus.length === 0} onClick={() => void prosesTidakLulus()}>
          Tandai tidak lulus ({tidakLulus.length})
        </Button>
        )}
      </div>

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1" id="grup_kelulusan_kolom">
        <ResizablePanel defaultSize={50} minSize={25}>
        <section className="flex h-full min-h-0 min-w-0 flex-col rounded-md border">
          <header className="flex shrink-0 items-center justify-between border-b bg-muted/40 px-3 py-2 text-sm font-medium">
            <span>Santri tingkat akhir ({kiri.length})</span>
            <div className="flex gap-2">
              <Button id="btn_ke_tidak_lulus" size="sm" variant="outline" disabled={pilih.size === 0} onClick={() => {
                const baris = kiri.filter((r) => pilih.has(r.santri_id)).map((r) => ({ santri_id: r.santri_id, nama: r.santri?.nama_lengkap ?? String(r.santri_id), kelas: r.kelas?.nama_kelas ?? null }));
                setTidakLulus((prev) => [...prev, ...baris]);
                setKiri((prev) => prev.filter((r) => !pilih.has(r.santri_id)));
                setPilih(new Set());
              }}>→ Tidak lulus</Button>
            </div>
          </header>
          <div className="flex min-h-0 flex-1 flex-col px-2 pb-2">
            <ExcelTable
              tableKey="kelulusan_santri_akhir"
              fields={[
                { key: 'nama', label: 'santri.nama_lengkap', kind: 'static', sumber: { tabel: 'santri', kolom: 'nama_lengkap' } },
                { key: 'kelas', label: 'kelas.nama_kelas', kind: 'static', sumber: { tabel: 'kelas', kolom: 'nama_kelas' } },
              ]}
              rows={kiri}
              getValues={(r) => ({ nama: r.santri?.nama_lengkap ?? null, kelas: r.kelas?.nama_kelas ?? null })}
              canEdit={false}
              onCommit={async () => {}}
              onSaved={() => {}}
              renderActions={() => null}
              onCheckedChange={(rows) => setPilih(new Set(rows.map((r) => r.santri_id)))}
              emptyText="Tidak ada santri aktif."
            />
          </div>
        </section>
        </ResizablePanel>
        <ResizableHandle withHandle orientation="horizontal" id="gagang_kelulusan_kolom" />
        <ResizablePanel defaultSize={50} minSize={25}>
        <div className="flex h-full min-h-0 flex-col">
        <ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1" id="grup_kelulusan_baris">
          <ResizablePanel defaultSize={50} minSize={15}>
          <section className="flex h-full min-h-0 min-w-0 flex-col rounded-md border">
            <header className="shrink-0 border-b bg-muted/40 px-3 py-2 text-sm font-medium">{`Alumni (${alumni.length})`}</header>
            <div className="flex min-h-0 flex-1 flex-col px-2 pb-2">
              <ExcelTable
                tableKey="kelulusan_alumni"
                fields={[
                  { key: 'santri', label: 'santri.nama_lengkap', kind: 'static', sumber: { tabel: 'santri', kolom: 'nama_lengkap' } },
                  { key: 'kelas', label: 'kelas.nama_kelas', kind: 'static', sumber: { tabel: 'kelas', kolom: 'nama_kelas' } },
                  { key: 'ta', label: 'tahun_ajaran.nama', kind: 'static', sumber: { tabel: 'tahun_ajaran', kolom: 'nama' } },
                  { key: 'ijazah', label: 'nomor_ijazah', kind: 'static', sumber: { tabel: 'alumni', kolom: 'nomor_ijazah' } },
                ]}
                rows={alumni}
                getValues={(a) => ({
                  santri: a.santri?.nama_lengkap ?? '—',
                  kelas: a.kelas_lulus?.nama_kelas ?? '—',
                  ta: a.tahunAjaranLulus?.nama ?? '—',
                  ijazah: a.nomor_ijazah ?? '—',
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
                emptyText="Belum ada alumni."
              />
            </div>
          </section>
          </ResizablePanel>
          {tampilTidakLulus && (
          <>
          <ResizableHandle withHandle orientation="vertical" id="gagang_kelulusan_baris" />
          <ResizablePanel defaultSize={50} minSize={15}>
          <section className="flex h-full min-h-0 min-w-0 flex-col rounded-md border">
            <header className="flex shrink-0 items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2 text-sm font-medium">
              <span>Santri tidak lulus ({tidakLulus.length})</span>
              <Button id="btn_sembunyi_tidak_lulus" size="sm" variant="ghost" onClick={() => setTampilTidakLulus(false)}>
                Sembunyikan
              </Button>
            </header>
            <div className="flex min-h-0 flex-1 flex-col px-2 pb-2">
              <ExcelTable
                tableKey="kelulusan_tidak_lulus"
                fields={[
                  { key: 'nama', label: 'santri.nama_lengkap', kind: 'static', sumber: { tabel: 'santri', kolom: 'nama_lengkap' } },
                  { key: 'kelas', label: 'kelas.nama_kelas', kind: 'static', sumber: { tabel: 'kelas', kolom: 'nama_kelas' } },
                ]}
                rows={tidakLulus.map((b) => ({ ...b, id: b.santri_id }))}
                getValues={(b) => ({ nama: b.nama, kelas: b.kelas })}
                canEdit={false}
                onCommit={async () => {}}
                onSaved={() => {}}
                renderActions={(b) => (
                  <Button id={`btn_kembalikan_tidak_lulus_${b.santri_id}`} size="sm" variant="ghost" onClick={() => setTidakLulus((prev) => prev.filter((x) => x.santri_id !== b.santri_id))}>Kembalikan</Button>
                )}
                hideCheckbox
                emptyText="Belum ada."
              />
            </div>
          </section>
          </ResizablePanel>
          </>
          )}
        </ResizablePanelGroup>
        {!tampilTidakLulus && (
          <div className="flex shrink-0 justify-end pt-2">
            <Button id="btn_tampil_tidak_lulus" size="sm" variant="outline" onClick={() => setTampilTidakLulus(true)}>
              Tampilkan santri tidak lulus ({tidakLulus.length})
            </Button>
          </div>
        )}
        </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <Dialog open={lulusOpen} onOpenChange={setLulusOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Luluskan santri</DialogTitle>
            <DialogDescription>{totalTerpilih} santri diproses (lulus).</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-3">
            <FieldLabel htmlFor="input_tanggal_lulus">Tanggal lulus</FieldLabel>
            <Input id="input_tanggal_lulus" type="date" value={tanggalLulus} onChange={(e) => setTanggalLulus(e.target.value)} />
            <FieldLabel htmlFor="input_no_ijazah_kelulusan">No. ijazah</FieldLabel>
            <Input id="input_no_ijazah_kelulusan" value={noIjazah} onChange={(e) => setNoIjazah(e.target.value)} />
            <FieldLabel htmlFor="input_no_surat_kelulusan">No. surat</FieldLabel>
            <Input id="input_no_surat_kelulusan" value={noSurat} onChange={(e) => setNoSurat(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLulusOpen(false)}>Batal</Button>
            <Button id="btn_simpan_lulus" disabled={busy || !tanggalLulus || !taLulus} onClick={() => void prosesLulus()}>Proses</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
