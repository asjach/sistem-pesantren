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
import { useLembagaAwalString } from '@/hooks/useLembagaAwal';
import { useTahunAjaranAwalString } from '@/hooks/useTahunAjaranAwal';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { toast } from 'sonner';

/** Kelulusan: kiri santri tingkat akhir → kanan alumni & santri tidak lulus. */
export default function KelulusanPage() {
  const { user } = useAuth();
  const canUbah = bisa(user, 'kelulusan.ubah');
  const [lembagaId, setLembagaId] = useState('');
  useLembagaAwalString(setLembagaId);
  const [tingkat, setTingkat] = useState('');
  const [taLulus, setTaLulus] = useState('');
  useTahunAjaranAwalString(setTaLulus);
  const [kiri, setKiri] = useState<RiwayatRow[]>([]);
  const [pilih, setPilih] = useState<Set<number>>(new Set());
  const [tidakLulus, setTidakLulus] = useState<{ santri_id: number; nama: string; kelas: string | null }[]>([]);
  const [alumni, setAlumni] = useState<Alumni[]>([]);
  /** Urut header alumni: daftar nilai allowlist + arah global (maks 3 kunci). */
  const [urut, setUrut] = useState<string[]>([]);
  const [arahUrut, setArahUrut] = useState<'naik' | 'turun'>('naik');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const [lulusOpen, setLulusOpen] = useState(false);
  const [tanggalLulus, setTanggalLulus] = useState('');
  const [noIjazah, setNoIjazah] = useState('');
  const [noSurat, setNoSurat] = useState('');

  const loadKiri = useCallback(async () => {
    if (!lembagaId) { setKiri([]); return; }
    setErr('');
    try {
      const res = await daftarKelas({ lembaga_id: Number(lembagaId) });
      setKiri(res.data.filter((r) => !tingkat || r.tingkat === tingkat));
    } catch (e) { setErr(errorMessage(e)); }
  }, [lembagaId, tingkat]);

  const loadArsip = useCallback(async (f?: { urut?: string[]; arah?: 'naik' | 'turun' }) => {
    if (!lembagaId) { setAlumni([]); return; }
    try {
      const u = f?.urut ?? urut;
      const a = f?.arah ?? arahUrut;
      const res = await listAlumni({
        lembaga_id: Number(lembagaId),
        sort: u.length ? u : undefined,
        arah: u.length ? a : undefined,
        per_page: 100,
      });
      setAlumni(res.data);
    } catch (e) { setErr(errorMessage(e)); }
  }, [lembagaId, urut, arahUrut]);

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
    if (!lembagaId || !taLulus || !tanggalLulus || namaTerpilih.length === 0) return;
    setBusy(true);
    try {
      for (const r of namaTerpilih) {
        await lulusSantri(r.santri_id, {
          lembaga_id: Number(lembagaId),
          tahun_ajaran_lulus_id: Number(taLulus),
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
    if (!lembagaId || tidakLulus.length === 0) return;
    setBusy(true);
    try {
      for (const b of tidakLulus) await tidakLulusSantri(b.santri_id, Number(lembagaId));
      toast.success(`${tidakLulus.length} santri ditandai tidak lulus (mengulang).`);
      setTidakLulus([]);
      await Promise.all([loadKiri(), loadArsip()]);
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
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

      <div className="grid grid-cols-2 gap-4">
        <section className="rounded-md border">
          <header className="flex items-center justify-between border-b bg-muted/40 px-3 py-2 text-sm font-medium">
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
          <div className="px-2 pb-1">
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
              maxRows={12}
              emptyText="Tidak ada santri aktif."
            />
          </div>
        </section>

        <div className="grid grid-rows-2 gap-4">
          <section className="rounded-md border">
            <header className="border-b bg-muted/40 px-3 py-2 text-sm font-medium">{`Alumni (${alumni.length})`}</header>
            <div className="px-2 pb-1">
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
                  ta: a.tahun_ajaran_lulus?.nama ?? '—',
                  ijazah: a.nomor_ijazah ?? '—',
                })}
                opsiUrut={[
                  { kunci: 'santri', nilai: 'santri' },
                  { kunci: 'ta', nilai: 'ta' },
                  { kunci: 'kelas', nilai: 'kelas' },
                ]}
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
                maxRows={6}
                emptyText="Belum ada alumni."
              />
            </div>
          </section>
          <section className="rounded-md border">
            <header className="border-b bg-muted/40 px-3 py-2 text-sm font-medium">Santri tidak lulus ({tidakLulus.length})</header>
            <div className="px-2 pb-1">
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
                maxRows={6}
                emptyText="Belum ada."
              />
            </div>
          </section>
        </div>
      </div>

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
