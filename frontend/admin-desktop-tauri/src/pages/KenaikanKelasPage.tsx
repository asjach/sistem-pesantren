import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { errorMessage } from '../api/client';
import { batalKenaikan, listRiwayatBelajar, naikKelasOtomatis, type RiwayatRow } from '../api/siklus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import ExcelTable from '@/components/ExcelTable';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useLembagaAwalString } from '@/hooks/useLembagaAwal';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { toast } from 'sonner';

interface Baris { santri_id: number; nama: string; kelas: string | null; tingkat: string | null; }

/** Kenaikan: kiri santri semester genap (tingkat 1–5). Aksi per baris
 *  "Tidak naik" langsung memproses ke tabel kanan bawah; tombol Naik
 *  memproses sisa tabel kiri sekaligus ke tabel kanan atas. Batal
 *  mengurungkan hasil (baris kembali ke kiri). TA + kelas tujuan
 *  dibuatkan otomatis; tingkat akhir lewat halaman Kelulusan. */
export default function KenaikanKelasPage() {
  const { user } = useAuth();
  const canUbah = bisa(user, 'kenaikan.ubah');
  const [jenjang, setLembagaId] = useState('');
  useLembagaAwalString(setLembagaId);
  /** Tanggal masuk kelas baru; bawaan hari ini (lokal). */
  const [tglMasuk, setTglMasuk] = useState(() => {
    const now = new Date();
    const lokal = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return lokal.toISOString().slice(0, 10);
  });
  /** Urut header: daftar nilai allowlist + arah global (maks 3 kunci). */
  const [urut, setUrut] = useState<string[]>([]);
  const [arahUrut, setArahUrut] = useState<'naik' | 'turun'>('naik');
  const [kiri, setKiri] = useState<RiwayatRow[]>([]);
  /** Hasil sesi ini (kanan atas = naik, kanan bawah = tidak naik). */
  const [hasilNaik, setHasilNaik] = useState<Baris[]>([]);
  const [hasilTidak, setHasilTidak] = useState<Baris[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async (f?: { urut?: string[]; arah?: 'naik' | 'turun' }) => {
    if (!jenjang) { setKiri([]); return; }
    setErr('');
    const urutPakai = f?.urut ?? urut;
    const arahPakai = f?.arah ?? arahUrut;
    try {
      const res = await listRiwayatBelajar({
        jenjang: jenjang,
        semester: '2',
        is_active_riwayat: true,
        sort: urutPakai.length ? urutPakai : undefined,
        arah: urutPakai.length ? arahPakai : undefined,
        per_page: 500,
      });
      // Hanya tingkat 1–5; tingkat akhir lewat halaman Kelulusan.
      setKiri(res.data.filter((r) => /^[1-5]$/.test(String(r.tingkat ?? ''))));
    } catch (e) { setErr(errorMessage(e)); }
  }, [jenjang, urut, arahUrut]);

  /** Klik header: simpan urut baru lalu muat ulang. */
  function terapkanUrut(nilai: string[], arah: 'naik' | 'turun') {
    setUrut(nilai);
    setArahUrut(arah);
    void load({ urut: nilai, arah });
  }

  /** Petakan baris riwayat aktif (kelas/tingkat tujuan) ke tabel hasil. */
  const barisHasil = (r: RiwayatRow): Baris => ({
    santri_id: r.santri_id,
    nama: r.santri?.nama_lengkap ?? String(r.santri_id),
    kelas: r.kelas?.nama_kelas ?? null,
    tingkat: r.tingkat ?? null,
  });

  /** Hasil dimuat dari backend (persisten): status_awal kenaikan/mengulang
   *  yang masih aktif — bukan state sesi, jadi aman di-reload. */
  const muatHasil = useCallback(async () => {
    if (!jenjang) { setHasilNaik([]); setHasilTidak([]); return; }
    try {
      const [naik, tidak] = await Promise.all([
        listRiwayatBelajar({ jenjang: jenjang, status_awal: 'kenaikan', is_active_riwayat: true, per_page: 500 }),
        listRiwayatBelajar({ jenjang: jenjang, status_awal: 'mengulang', is_active_riwayat: true, per_page: 500 }),
      ]);
      setHasilNaik(naik.data.map(barisHasil));
      setHasilTidak(tidak.data.map(barisHasil));
    } catch (e) { setErr(errorMessage(e)); }
  }, [jenjang]);

  useEffect(() => { void load(); void muatHasil(); }, [load, muatHasil]);

  /** Naik: sisa tabel kiri dianggap naik semua. */
  const prosesNaik = async () => {
    if (!jenjang || kiri.length === 0 || !tglMasuk || busy) return;
    setBusy(true);
    try {
      const res = await naikKelasOtomatis({
        jenjang: jenjang,
        siswa: kiri.map((r) => ({ santri_id: r.santri_id, status: 'naik' as const, tgl_masuk: tglMasuk })),
      });
      toast.success(`Kenaikan selesai: ${res.berhasil} berhasil, ${res.gagal.length} gagal.`);
      if (res.gagal.length) toast.error(res.gagal.map((g) => `#${g.santri_id}: ${g.pesan}`).join(' · '));
      await load();
      await muatHasil();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  /** Tidak naik per santri: langsung proses → tabel kanan bawah. */
  const prosesTidakNaik = async (r: RiwayatRow) => {
    if (!jenjang || !tglMasuk || busyId !== null) return;
    setBusyId(r.santri_id);
    try {
      const res = await naikKelasOtomatis({
        jenjang: jenjang,
        siswa: [{ santri_id: r.santri_id, status: 'tidak_naik' as const, tgl_masuk: tglMasuk }],
      });
      if (res.berhasil === 1) {
        toast.success('Santri ditandai tidak naik.');
        await load();
        await muatHasil();
      } else {
        toast.error(res.gagal.map((g) => `#${g.santri_id}: ${g.pesan}`).join(' · '));
      }
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusyId(null); }
  };

  /** Batalkan hasil (per baris / bulk): urungkan di server, baris kembali kiri. */
  const batalkan = async (daftar: Baris[]) => {
    if (!jenjang || daftar.length === 0 || busy) return;
    setBusy(true);
    const gagal: string[] = [];
    for (const b of daftar) {
      try {
        await batalKenaikan(b.santri_id, jenjang);
      } catch (e) { gagal.push(`#${b.santri_id}: ${errorMessage(e)}`); }
    }
    if (gagal.length) toast.error(gagal.join(' · '));
    else toast.success('Kenaikan dibatalkan.');
    await load();
    await muatHasil();
    setBusy(false);
  };

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <div className="flex flex-wrap items-end gap-3">
        {canUbah && (
        <>
          <Button id="btn_naik_kenaikan" disabled={busy || busyId !== null || kiri.length === 0 || !tglMasuk} onClick={() => void prosesNaik()}>
            Naik ({kiri.length})
          </Button>
          <div>
            <FieldLabel htmlFor="input_tgl_kenaikan">Tanggal masuk kelas baru</FieldLabel>
            <Input id="input_tgl_kenaikan" type="date" value={tglMasuk} onChange={(e) => setTglMasuk(e.target.value)} className="w-40" />
          </div>
        </>
        )}
      </div>

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1" id="grup_kenaikan_kolom">
        <ResizablePanel defaultSize={50} minSize={25}>
        <section className="flex h-full min-h-0 min-w-0 flex-col">
          <header className="flex shrink-0 items-center justify-between border-b bg-muted/40 px-3 py-2 text-sm font-medium">
            <span>Santri semester genap, tingkat 1–5 ({kiri.length})</span>
          </header>
          <div className="flex min-h-0 flex-1 flex-col px-2 pb-2">
            <ExcelTable
              tableKey="kenaikan_santri_genap"
              fields={[
                { key: 'nama', label: 'santri.nama_lengkap', kind: 'static', sumber: { tabel: 'santri', kolom: 'nama_lengkap' } },
                { key: 'kelas', label: 'kelas.nama_kelas', kind: 'static', sumber: { tabel: 'kelas', kolom: 'nama_kelas' } },
                { key: 'tingkat', label: 'tingkat', kind: 'static', sumber: { tabel: 'riwayat_belajar', kolom: 'tingkat' } },
              ]}
              rows={kiri}
              getValues={(r) => ({
                nama: r.santri?.nama_lengkap ?? null,
                kelas: r.kelas?.nama_kelas ?? null,
                tingkat: r.tingkat ?? null,
              })}
              urutAktif={urut}
              arahUrut={arahUrut}
              onUrut={terapkanUrut}
              canEdit={false}
              onCommit={async () => {}}
              onSaved={() => {}}
              renderActions={(r) => (
                canUbah ? (
                  <Button id={`btn_tidak_naik_${r.santri_id}`} size="sm" variant="outline" disabled={busyId === r.santri_id || !tglMasuk} onClick={() => void prosesTidakNaik(r)}>
                    Tidak naik
                  </Button>
                ) : null
              )}
              hideCheckbox
              emptyText="Tidak ada santri semester genap pada filter ini."
            />
          </div>
        </section>
        </ResizablePanel>
        <ResizableHandle withHandle orientation="horizontal" id="gagang_kenaikan_kolom" />
        <ResizablePanel defaultSize={50} minSize={25}>
        <div className="flex h-full min-h-0 flex-col">
        <ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1" id="grup_kenaikan_baris">
          <ResizablePanel defaultSize={65} minSize={15}>
          <PanelDaftar
            idPrefix="naik_kelas"
            judul={`Santri naik kelas (${hasilNaik.length})`}
            baris={hasilNaik}
            onBatalkan={(b) => void batalkan([b])}
            aksiHeader={hasilNaik.length > 0 ? (
              <Button id="btn_batal_semua_naik" size="sm" variant="ghost" disabled={busy} onClick={() => void batalkan(hasilNaik)}>
                Batalkan semua
              </Button>
            ) : undefined}
          />
          </ResizablePanel>
          <ResizableHandle withHandle orientation="vertical" id="gagang_kenaikan_baris" />
          <ResizablePanel defaultSize={35} minSize={15}>
          <PanelDaftar
            idPrefix="tidak_naik_kelas"
            judul={`Santri tidak naik (${hasilTidak.length})`}
            baris={hasilTidak}
            onBatalkan={(b) => void batalkan([b])}
            aksiHeader={hasilTidak.length > 0 ? (
              <Button id="btn_batal_semua_tidak_naik" size="sm" variant="ghost" disabled={busy} onClick={() => void batalkan(hasilTidak)}>
                Batalkan semua
              </Button>
            ) : undefined}
          />
          </ResizablePanel>
        </ResizablePanelGroup>
        </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function PanelDaftar({ idPrefix, judul, baris, onBatalkan, aksiHeader }: { idPrefix: string; judul: string; baris: Baris[]; onBatalkan: (b: Baris) => void; aksiHeader?: ReactNode }) {
  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2 text-sm font-medium">
        <span>{judul}</span>
        {aksiHeader}
      </header>
      <div className="flex min-h-0 flex-1 flex-col px-2 pb-2">
        <ExcelTable
          tableKey={`kenaikan_${idPrefix}`}
          fields={[
            { key: 'nama', label: 'santri.nama_lengkap', kind: 'static', sumber: { tabel: 'santri', kolom: 'nama_lengkap' } },
            { key: 'kelas', label: 'kelas.nama_kelas', kind: 'static', sumber: { tabel: 'kelas', kolom: 'nama_kelas' } },
            { key: 'tingkat', label: 'tingkat', kind: 'static', sumber: { tabel: 'riwayat_belajar', kolom: 'tingkat' } },
          ]}
          rows={baris.map((b) => ({ ...b, id: b.santri_id }))}
          getValues={(b) => ({ nama: b.nama, kelas: b.kelas, tingkat: b.tingkat })}
          canEdit={false}
          onCommit={async () => {}}
          onSaved={() => {}}
          renderActions={(b) => (
            <Button id={`btn_batal_${idPrefix}_${b.santri_id}`} size="sm" variant="ghost" onClick={() => onBatalkan(b)}>Batalkan</Button>
          )}
          hideCheckbox
          emptyText="Belum ada."
        />
      </div>
    </section>
  );
}
