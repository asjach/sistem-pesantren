import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { errorMessage } from '../api/client';
import {
  batalLulus,
  batalPotongAlumni,
  batalTidakLulus,
  importAlumniPotong,
  listAlumni,
  listRiwayatBelajar,
  lulusSantri,
  tidakLulusSantri,
  unduhGalatAlumni,
  updateAlumni,
  dataAlumniExisting,
  unduhTemplateAlumni,
  type Alumni,
  type RiwayatRow,
} from '../api/siklus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { ActionIcon } from '@/components/RowActions';
import { ResizableAutoHidePanel, ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { targetTunggal, useFilterGlobalAktif } from '@/hooks/useFilterGlobalAktif';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { TopBarSearch } from '@/components/TopBarSearch';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import { Download, FileUp, X } from '@/icons';
import { namaTahunAjaran } from '@/lib/nilaiTampil';
import { tokenUrut, type PetaArahKolom } from '@/lib/urut';
import ImportBertahapUmumDialog from '@/components/ImportBertahapUmumDialog';
import { toast } from 'sonner';
import { useAksiProfilSantri } from '@/components/santri/useAksiProfilSantri';

/** Kelulusan: kiri santri tingkat akhir → kanan alumni & santri tidak lulus. */

/** Tingkat akhir per jenjang (cermin ReferensiSeeder: MI/MD 1–6, MTS 7–9, MLN 10–12). */
const TINGKAT_AKHIR: Record<string, string> = {
  MI: '6',
  MD: '6',
  MTS: '9',
  MLN: '12',
};

/** TA acuan + 1 (cermin SiklusSantriService::taBerikutnya pada halaman Kenaikan). */
function taBerikutnya(ta: string | null | undefined): string | null {
  const m = /^(\d{4})\/(\d{4})$/.exec(ta ?? '');
  return m ? `${Number(m[1]) + 1}/${Number(m[2]) + 1}` : null;
}

/** Baris tabel tidak lulus: pengulang aktif tahun berikutnya di kelas akhir. */
interface TidakLulus {
  id: number;
  santri_id: number;
  nama: string;
  kelas: string | null;
  tingkat: string | null;
  tahun_ajaran: string | null;
  status_awal: string | null;
}

/** Kolom template yang dikirim (kunci lain dari file diabaikan). */
const KOLOM_IMPORT_ALUMNI = [
  'nis_lokal', 'jenjang', 'tahun_ajaran_lulus', 'tanggal_lulus', 'kelas_lulus', 'nomor_ijazah',
  'no_peserta', 'skhun', 'no_surat_ijazah', 'kegiatan_setelah_lulus', 'penyerahan_ijazah', 'melanjutkan', 'catatan',
];

/** Kolom santri tingkat akhir. */
const FIELDS_SANTRI: ExcelField[] = [
  { key: 'nama', label: 'santri.nama_lengkap', kind: 'static', sumber: { tabel: 'santri', kolom: 'nama_lengkap' } },
  { key: 'kelas', label: 'kelas.nama_kelas', kind: 'static', sumber: { tabel: 'kelas', kolom: 'nama_kelas' } },
  { key: 'tingkat', label: 'tingkat', kind: 'static', sumber: { tabel: 'riwayat_belajar', kolom: 'tingkat' } },
  { key: 'tahun_ajaran', label: 'tahun_ajaran', kind: 'static', sumber: { tabel: 'riwayat_belajar', kolom: 'tahun_ajaran' } },
];

/** Kolom santri tidak lulus (pengulang tahun berikutnya). */
const FIELDS_TIDAK_LULUS: ExcelField[] = [
  { key: 'nama', label: 'santri.nama_lengkap', kind: 'static', sumber: { tabel: 'santri', kolom: 'nama_lengkap' } },
  { key: 'kelas', label: 'kelas.nama_kelas', kind: 'static', sumber: { tabel: 'kelas', kolom: 'nama_kelas' } },
  { key: 'tingkat', label: 'tingkat', kind: 'static', sumber: { tabel: 'riwayat_belajar', kolom: 'tingkat' } },
  { key: 'tahun_ajaran', label: 'tahun_ajaran', kind: 'static', sumber: { tabel: 'riwayat_belajar', kolom: 'tahun_ajaran' } },
  { key: 'status_awal', label: 'status_awal', kind: 'static', sumber: { tabel: 'riwayat_belajar', kolom: 'status_awal' } },
];

/** Kolom arsip alumni: seluruh field tabel alumni (kunci santri/lembaga/tahun/kelas baca-saja). */
const PILIHAN_SERAH_IJAZAH = [
  { value: 'sudah', label: 'Sudah' },
  { value: 'belum', label: 'Belum' },
];
const PILIHAN_MELANJUTKAN = [
  { value: 'ya', label: 'Ya' },
  { value: 'tidak', label: 'Tidak' },
];
const FIELDS_ALUMNI: ExcelField[] = [
  { key: 'nama', label: 'santri.nama_lengkap', kind: 'static', sumber: { tabel: 'santri', kolom: 'nama_lengkap' } },
  { key: 'lembaga', label: 'lembaga.nama', kind: 'static', sumber: { tabel: 'lembaga', kolom: 'nama' } },
  { key: 'tahun_ajaran_lulus', label: 'tahun_ajaran_lulus', kind: 'static', sumber: { tabel: 'alumni', kolom: 'tahun_ajaran_lulus' } },
  {
    key: 'tanggal_lulus',
    label: 'tanggal_lulus',
    kind: 'text',
    sumber: { tabel: 'alumni', kolom: 'tanggal_lulus' },
    validate: (v) => (!v || /^\d{4}-\d{2}-\d{2}$/.test(v) ? null : 'Format tanggal: YYYY-MM-DD.'),
  },
  { key: 'kelas_lulus', label: 'kelas.nama_kelas', kind: 'static', sumber: { tabel: 'kelas', kolom: 'nama_kelas' } },
  { key: 'nomor_ijazah', label: 'nomor_ijazah', kind: 'text', sumber: { tabel: 'alumni', kolom: 'nomor_ijazah' } },
  { key: 'no_peserta', label: 'no_peserta', kind: 'text', sumber: { tabel: 'alumni', kolom: 'no_peserta' } },
  { key: 'skhun', label: 'skhun', kind: 'text', sumber: { tabel: 'alumni', kolom: 'skhun' } },
  { key: 'no_surat_ijazah', label: 'no_surat_ijazah', kind: 'text', sumber: { tabel: 'alumni', kolom: 'no_surat_ijazah' } },
  { key: 'kegiatan_setelah_lulus', label: 'kegiatan_setelah_lulus', kind: 'text', sumber: { tabel: 'alumni', kolom: 'kegiatan_setelah_lulus' } },
  { key: 'penyerahan_ijazah', label: 'penyerahan_ijazah', kind: 'select', choices: PILIHAN_SERAH_IJAZAH, sumber: { tabel: 'alumni', kolom: 'penyerahan_ijazah' } },
  { key: 'melanjutkan', label: 'melanjutkan', kind: 'select', choices: PILIHAN_MELANJUTKAN, sumber: { tabel: 'alumni', kolom: 'melanjutkan' } },
  { key: 'catatan', label: 'catatan', kind: 'text', sumber: { tabel: 'alumni', kolom: 'catatan' } },
];
export default function KelulusanPage() {
  const { user } = useAuth();
  const canUbah = bisa(user, 'kelulusan.ubah');
  const {
    jenjangs,
    tahunAjaranNames,
    loading: filterLoading,
  } = useFilterGlobalAktif();
  const targetJenjang = targetTunggal(jenjangs);
  /** Tahun ajaran acuan (wajib satu): kandidat dibaca dari sini, tidak lulus dari TA berikutnya. */
  const taDasar = targetTunggal(tahunAjaranNames);
  const taDepan = taBerikutnya(taDasar);
  const siap = !filterLoading && taDasar !== null && taDepan !== null;
  /** Tingkat akhir untuk setiap lembaga terpilih (hasil query disaring per lembaga). */
  const tingkatAkhir = useMemo(() => {
    const daftar = jenjangs
      .map((jenjang) => TINGKAT_AKHIR[jenjang])
      .filter((tingkat): tingkat is string => tingkat !== undefined);
    return [...new Set(daftar)];
  }, [jenjangs]);
  const [kiri, setKiri] = useState<RiwayatRow[]>([]);
  const [pilih, setPilih] = useState<Set<number>>(new Set());
  const [tidakLulus, setTidakLulus] = useState<TidakLulus[]>([]);
  const [alumni, setAlumni] = useState<Alumni[]>([]);
  /** Baris tercentang pada tabel alumni (untuk tombol Batalkan di header). */
  const [tercentangAlumni, setTercentangAlumni] = useState<Alumni[]>([]);
  /** Baris tercentang pada tabel tidak lulus (untuk tombol Batalkan di header). */
  const [tercentangTidakLulus, setTercentangTidakLulus] = useState<TidakLulus[]>([]);
  /** Urut header tabel alumni: daftar nilai allowlist + arah global (maks 3 kunci). */
  const [urutAlumni, setUrutAlumni] = useState<string[]>([]);
  /** Arah per kode dari preset urut (opsional) — menimpa arah global. */
  const [arahKolom, setArahKolom] = useState<PetaArahKolom | undefined>(undefined);
  const [arahAlumni, setArahAlumni] = useState<'naik' | 'turun'>('naik');
  const [err, setErr] = useState('');
  const { aksiProfil, dialogProfil } = useAksiProfilSantri();
  /** Urutan tiap tabel asal untuk navigasi tetangga pada dialog profil. */
  const daftarTingkatAkhir = useMemo(() => kiri.map((r) => r.santri_id), [kiri]);
  const daftarAlumni = useMemo(() => alumni.map((a) => a.santri_id), [alumni]);
  const daftarTidakLulus = useMemo(() => tidakLulus.map((b) => b.santri_id), [tidakLulus]);
  /** Pencarian tunggal halaman (topBar). */
  const [cari, setCari] = useState('');
  const [busy, setBusy] = useState(false);

  const [importOpen, setImportOpen] = useState(false);

  const [lulusOpen, setLulusOpen] = useState(false);
  const [tanggalLulus, setTanggalLulus] = useState('');
  const [noIjazah, setNoIjazah] = useState('');
  const [noPeserta, setNoPeserta] = useState('');
  const [skhun, setSkhun] = useState('');
  const [noSurat, setNoSurat] = useState('');

  /** Kandidat tingkat akhir: semester genap kelas akhir berstatus akhir aktif. */
  const loadKiri = useCallback(async () => {
    if (!siap || jenjangs.length === 0 || tingkatAkhir.length === 0) { setKiri([]); return; }
    setErr('');
    try {
      const res = await listRiwayatBelajar({
        jenjang: jenjangs,
        tahun_ajaran: taDasar,
        semester: '2',
        tingkat: tingkatAkhir,
        status_akhir: 'aktif',
        is_active_riwayat: true,
        q: cari || undefined,
        page: 1,
        per_page: 0,
      });
      // `tingkat` dikirim sebagai gabungan semua lembaga; pastikan tiap baris
      // tepat pada tingkat akhir lembaganya masing-masing.
      setKiri(res.data.filter((r) => r.tingkat !== null && r.tingkat === TINGKAT_AKHIR[r.jenjang]));
    } catch (e) { setErr(errorMessage(e)); }
  }, [siap, jenjangs, taDasar, tingkatAkhir, cari]);

  /** Petakan baris pengulang tahun berikutnya ke tabel tidak lulus. */
  const barisTidakLulus = useCallback((r: RiwayatRow): TidakLulus => ({
    id: r.id,
    santri_id: r.santri_id,
    nama: r.santri?.nama_lengkap ?? String(r.santri_id),
    kelas: r.kelas?.nama_kelas ?? null,
    tingkat: r.tingkat ?? null,
    tahun_ajaran: r.tahun_ajaran ?? null,
    status_awal: r.status_awal ?? null,
  }), []);

  /** Santri tidak lulus: pengulang aktif tahun berikutnya di kelas akhir. */
  const loadTidak = useCallback(async () => {
    if (!siap || jenjangs.length === 0 || tingkatAkhir.length === 0) { setTidakLulus([]); return; }
    setErr('');
    try {
      const res = await listRiwayatBelajar({
        jenjang: jenjangs,
        tahun_ajaran: taDepan,
        tingkat: tingkatAkhir,
        status_awal: 'mengulang',
        is_active_riwayat: true,
        q: cari || undefined,
        page: 1,
        per_page: 0,
      });
      setTidakLulus(res.data
        .filter((r) => r.tingkat !== null && r.tingkat === TINGKAT_AKHIR[r.jenjang])
        .map(barisTidakLulus));
    } catch (e) { setErr(errorMessage(e)); }
  }, [siap, jenjangs, taDepan, tingkatAkhir, cari, barisTidakLulus]);

  const loadArsip = useCallback(async (
    f?: { urut?: string[]; arah?: 'naik' | 'turun'; arahKolom?: PetaArahKolom },
  ) => {
    if (!siap || jenjangs.length === 0) { setAlumni([]); return; }
    setErr('');
    try {
      const u = f?.urut ?? urutAlumni;
      const a = f?.arah ?? arahAlumni;
      const ak = f?.arahKolom ?? arahKolom;
      const res = await listAlumni({
        jenjang: jenjangs,
        tahun_ajaran_lulus: taDasar,
        q: cari || undefined,
        sort: u.length ? tokenUrut(u, ak) : undefined,
        arah: u.length ? a : undefined,
        page: 1,
        per_page: 0,
      });
      setAlumni(res.data);
    } catch (e) { setErr(errorMessage(e)); }
  }, [siap, jenjangs, taDasar, cari, urutAlumni, arahAlumni, arahKolom]);

  useEffect(() => { void loadKiri(); }, [loadKiri]);
  useEffect(() => { void loadTidak(); }, [loadTidak]);
  useEffect(() => { void loadArsip(); }, [loadArsip]);

  /** Klik combobox Urutkan: simpan urut baru lalu muat ulang arsip alumni. */
  function terapkanUrutAlumni(nilai: string[], arah: 'naik' | 'turun', arahKolomBaru?: PetaArahKolom) {
    const peta = nilai.length > 0 ? arahKolomBaru : undefined;
    setUrutAlumni(nilai);
    setArahAlumni(arah);
    setArahKolom(peta);
    void loadArsip({ urut: nilai, arah, arahKolom: peta });
  }

  const namaTerpilih = kiri.filter((r) => pilih.has(r.santri_id));

  /** Muat ulang ketiga tabel + bersihkan semua centangan (setelah proses/batal). */
  const muatUlang = useCallback(async () => {
    setPilih(new Set());
    setTercentangAlumni([]);
    setTercentangTidakLulus([]);
    await Promise.all([loadKiri(), loadTidak(), loadArsip()]);
  }, [loadKiri, loadTidak, loadArsip]);

  const prosesLulus = async () => {
    if (!targetJenjang || !taDasar || !tanggalLulus || namaTerpilih.length === 0) return;
    setBusy(true);
    try {
      for (const r of namaTerpilih) {
        await lulusSantri(r.santri_id, {
          jenjang: targetJenjang,
          tahun_ajaran_lulus: taDasar,
          tanggal_lulus: tanggalLulus,
          nomor_ijazah: noIjazah.trim() || undefined,
          no_peserta: noPeserta.trim() || undefined,
          skhun: skhun.trim() || undefined,
          no_surat_ijazah: noSurat.trim() || undefined,

        });
      }
      toast.success(`${namaTerpilih.length} santri dinyatakan lulus.`);
      setLulusOpen(false);
      setNoIjazah(''); setNoPeserta(''); setSkhun(''); setNoSurat(''); setTanggalLulus('');
      await muatUlang();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  /** Tandai kandidat terpilih sebagai tidak lulus (membuka baris mengulang tahun berikutnya). */
  const prosesTidakLulusTerpilih = useCallback(async () => {
    if (!targetJenjang || namaTerpilih.length === 0 || busy) return;
    setBusy(true);
    try {
      const gagal: string[] = [];
      for (const r of namaTerpilih) {
        try {
          await tidakLulusSantri(r.santri_id, targetJenjang);
        } catch (e) { gagal.push(`#${r.santri_id}: ${errorMessage(e)}`); }
      }
      if (gagal.length) toast.error(gagal.join(' · '));
      else toast.success(`${namaTerpilih.length} santri ditandai tidak lulus (mengulang).`);
      await muatUlang();
    } finally { setBusy(false); }
  }, [targetJenjang, namaTerpilih, busy, muatUlang]);

  /** Batalkan kelulusan: arsip alumni dihapus, santri kembali ke tingkat akhir. */
  const batalkanLulus = useCallback(async (daftar: Alumni[], clearSelection?: () => void) => {
    if (!targetJenjang || daftar.length === 0 || busy) return;
    setBusy(true);
    try {
      const gagal: string[] = [];
      for (const a of daftar) {
        try {
          await batalLulus(a.santri_id, targetJenjang);
        } catch (e) { gagal.push(`#${a.santri_id}: ${errorMessage(e)}`); }
      }
      if (gagal.length) toast.error(gagal.join(' · '));
      else toast.success(`Kelulusan dibatalkan: ${daftar.length} santri.`);
      clearSelection?.();
      await muatUlang();
    } finally { setBusy(false); }
  }, [targetJenjang, busy, muatUlang]);

  /** Simpan satu baris alumni (auto-save per sel, mode Edit): hanya field arsip yang berubah. */
  const commitAlumni = useCallback(async (id: string | number, f: Record<string, string | null>) => {
    const bersih = (v: string | null | undefined) => (v?.trim() ? v.trim() : null);
    await updateAlumni(Number(id), {
      ...(f.tanggal_lulus !== undefined ? { tanggal_lulus: bersih(f.tanggal_lulus) } : {}),
      ...(f.nomor_ijazah !== undefined ? { nomor_ijazah: bersih(f.nomor_ijazah) } : {}),
      ...(f.no_peserta !== undefined ? { no_peserta: bersih(f.no_peserta) } : {}),
      ...(f.skhun !== undefined ? { skhun: bersih(f.skhun) } : {}),
      ...(f.no_surat_ijazah !== undefined ? { no_surat_ijazah: bersih(f.no_surat_ijazah) } : {}),
      ...(f.kegiatan_setelah_lulus !== undefined ? { kegiatan_setelah_lulus: bersih(f.kegiatan_setelah_lulus) } : {}),
      ...(f.penyerahan_ijazah !== undefined
        ? { penyerahan_ijazah: bersih(f.penyerahan_ijazah) as 'sudah' | 'belum' | null }
        : {}),
      ...(f.melanjutkan !== undefined
        ? { melanjutkan: bersih(f.melanjutkan) as 'ya' | 'tidak' | null }
        : {}),
      ...(f.catatan !== undefined ? { catatan: bersih(f.catatan) } : {}),
    });
  }, []);
  /** Batalkan tidak lulus: baris mengulang dihapus, santri kembali ke baris asal. */
  const batalkanTidakLulus = useCallback(async (daftar: TidakLulus[], clearSelection?: () => void) => {
    if (!targetJenjang || daftar.length === 0 || busy) return;
    setBusy(true);
    try {
      const gagal: string[] = [];
      for (const b of daftar) {
        try {
          await batalTidakLulus(b.santri_id, targetJenjang);
        } catch (e) { gagal.push(`#${b.santri_id}: ${errorMessage(e)}`); }
      }
      if (gagal.length) toast.error(gagal.join(' · '));
      else toast.success(`Tidak lulus dibatalkan: ${daftar.length} santri.`);
      clearSelection?.();
      await muatUlang();
    } finally { setBusy(false); }
  }, [targetJenjang, busy, muatUlang]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <TopBarSearch value={cari} onChange={setCari} placeholder="Cari santri…" />
      <PengaturanHalaman tampil={{ tahun_ajaran: true }} tabel={[{ key: 'kelulusan_santri_akhir', judul: 'Santri tingkat akhir', fields: FIELDS_SANTRI }, { key: 'kelulusan_alumni', judul: 'Alumni', fields: FIELDS_ALUMNI }, { key: 'kelulusan_tidak_lulus', judul: 'Santri tidak lulus', fields: FIELDS_TIDAK_LULUS }]} />

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1" id="grup_kelulusan_kolom">
        <ResizableAutoHidePanel id="panel_kelulusan_santri_akhir" defaultSize="33%" minSize="20%">
         <section className="flex h-full min-h-0 min-w-0 flex-col rounded-md">
           <div className="flex min-h-0 flex-1 flex-col pb-0">
            <ExcelTable
               tableKey="kelulusan_santri_akhir"
                header={<span>Santri tingkat akhir — {taDasar ?? '—'}</span>}
                 addButton={canUbah ? (
                   <>
                     <Button id="btn_buka_luluskan" disabled={namaTerpilih.length === 0 || !targetJenjang || !taDasar || busy} onClick={() => { setTanggalLulus(''); setNoIjazah(''); setNoPeserta(''); setSkhun(''); setNoSurat(''); setLulusOpen(true); }}>
                       Luluskan ({namaTerpilih.length})
                     </Button>
                     <Button id="btn_tidak_lulus" variant="outline" disabled={namaTerpilih.length === 0 || !targetJenjang || busy} onClick={() => void prosesTidakLulusTerpilih()}>
                       Tidak Lulus ({namaTerpilih.length})
                     </Button>
                   </>
                 ) : undefined}
               fields={FIELDS_SANTRI}
              rows={kiri}
              getValues={(r) => ({
                nama: r.santri?.nama_lengkap ?? null,
                kelas: r.kelas?.nama_kelas ?? null,
                tingkat: r.tingkat ?? null,
                tahun_ajaran: r.tahun_ajaran ?? null,
              })}
              canEdit={false}
              onCommit={async () => {}}
              onSaved={() => {}}
              renderActions={(r) => aksiProfil(r.santri_id, { prefix: 'tingkat_akhir', daftar: daftarTingkatAkhir })}
               onCheckedChange={(rows) => setPilih(new Set(rows.map((r) => r.santri_id)))}
               hidePreset
               emptyText="Tidak ada santri tingkat akhir aktif pada tahun ajaran ini."
            />
          </div>
        </section>
        </ResizableAutoHidePanel>
        <ResizableHandle withHandle orientation="horizontal" id="gagang_kelulusan_kolom" />
        <ResizablePanel defaultSize="67%" minSize="25%">
        <div className="flex h-full min-h-0 flex-col">
        <ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1" id="grup_kelulusan_baris">
          <ResizableAutoHidePanel id="panel_kelulusan_alumni" defaultSize="50%" minSize="15%">
           <section className="flex h-full min-h-0 min-w-0 flex-col rounded-md">
             <div className="flex min-h-0 flex-1 flex-col pb-0">
              <ExcelTable
                 tableKey="kelulusan_alumni"
                  header={<span>Alumni — {taDasar ?? '—'}</span>}
                  addButton={canUbah ? (
                    <>
                      <Button id="btn_batalkan_alumni_terpilih" size="sm" variant="ghost" disabled={busy || targetJenjang === null || tercentangAlumni.length === 0} onClick={() => void batalkanLulus(tercentangAlumni, () => setTercentangAlumni([]))}>
                        Batalkan ({tercentangAlumni.length})
                      </Button>
                      <Button id="btn_buka_import_alumni" variant="outline" onClick={() => setImportOpen(true)}>
                        <FileUp data-icon="inline-start" size={16} /> Import
                      </Button>
                    </>
                  ) : undefined}
                  fields={FIELDS_ALUMNI}
                rows={alumni}
                getValues={(a) => ({
                  nama: a.santri?.nama_lengkap ?? '',
                  lembaga: a.lembaga_lulus?.nama ?? a.lembaga_lulus?.jenjang ?? '',
                  tahun_ajaran_lulus: namaTahunAjaran(a.tahun_ajaran_lulus) ?? '',
                  tanggal_lulus: a.tanggal_lulus?.slice(0, 10) ?? '',
                  kelas_lulus: a.kelas_lulus?.nama_kelas ?? '',
                  nomor_ijazah: a.nomor_ijazah ?? '',
                  no_peserta: a.no_peserta ?? '',
                  skhun: a.skhun ?? '',
                  no_surat_ijazah: a.no_surat_ijazah ?? '',
                  kegiatan_setelah_lulus: a.kegiatan_setelah_lulus ?? '',
                  penyerahan_ijazah: a.penyerahan_ijazah ?? '',
                  melanjutkan: a.melanjutkan ?? '',
                  catatan: a.catatan ?? '',
                })}
                 canEdit={canUbah}
                onCommit={commitAlumni}
                onSaved={() => void loadArsip()}
                renderActions={(a) => (
                  <>
                    {aksiProfil(a.santri_id, { prefix: 'alumni', daftar: daftarAlumni })}
                    {canUbah && (
                      <ActionIcon
                        id={`btn_batal_lulus_alumni_${a.id}`}
                        title="Batalkan kelulusan (hapus arsip alumni)"
                        disabled={busy || targetJenjang === null}
                        onClick={() => void batalkanLulus([a])}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X size={16} />
                      </ActionIcon>
                    )}
                  </>
                )}
                onCheckedChange={setTercentangAlumni}
                urutAktif={urutAlumni}
                arahUrut={arahAlumni}
                onUrut={terapkanUrutAlumni}
                emptyText="Belum ada alumni."
              />
            </div>
          </section>
          </ResizableAutoHidePanel>
          <ResizableHandle withHandle orientation="vertical" id="gagang_kelulusan_baris" />
          <ResizableAutoHidePanel id="panel_kelulusan_tidak_lulus" defaultSize="50%" minSize="15%" sembunyiOtomatis={tidakLulus.length === 0}>
           <section className="flex h-full min-h-0 min-w-0 flex-col rounded-md">
             <div className="flex min-h-0 flex-1 flex-col pb-0">
              <ExcelTable
                 tableKey="kelulusan_tidak_lulus"
                  header={<span>Santri tidak lulus — {taDepan ?? '—'}</span>}
                  addButton={canUbah ? (
                    <Button id="btn_batalkan_tidak_lulus_terpilih" size="sm" variant="ghost" disabled={busy || targetJenjang === null || tercentangTidakLulus.length === 0} onClick={() => void batalkanTidakLulus(tercentangTidakLulus, () => setTercentangTidakLulus([]))}>
                      Batalkan ({tercentangTidakLulus.length})
                    </Button>
                  ) : undefined}
                 fields={FIELDS_TIDAK_LULUS}
                rows={tidakLulus}
                getValues={(b) => ({
                  nama: b.nama,
                  kelas: b.kelas,
                  tingkat: b.tingkat,
                  tahun_ajaran: b.tahun_ajaran,
                  status_awal: b.status_awal,
                })}
                canEdit={false}
                onCommit={async () => {}}
                onSaved={() => {}}
                renderActions={(b) => (
                  <>
                    {aksiProfil(b.santri_id, { prefix: 'tidak_lulus', daftar: daftarTidakLulus })}
                    {canUbah && (
                      <ActionIcon
                        id={`btn_batal_tidak_lulus_${b.santri_id}`}
                        title="Batalkan tidak lulus (hapus baris mengulang)"
                        disabled={busy || targetJenjang === null}
                        onClick={() => void batalkanTidakLulus([b])}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X size={16} />
                      </ActionIcon>
                    )}
                  </>
                )}
                onCheckedChange={setTercentangTidakLulus}
                 hidePreset
                 emptyText="Belum ada."
              />
            </div>
          </section>
          </ResizableAutoHidePanel>
        </ResizablePanelGroup>
        </div>
        </ResizablePanel>
      </ResizablePanelGroup>

       <ImportBertahapUmumDialog
         open={importOpen}
         onOpenChange={setImportOpen}
         config={{
           idPrefix: 'alumni',
           judul: 'Import arsip alumni bertahap',
           deskripsi: 'Kolom wajib: tahun_ajaran_lulus.',
           kolom: KOLOM_IMPORT_ALUMNI,
           wajib: ['nis_lokal', 'jenjang', 'tahun_ajaran_lulus'],
           idTombol: {
             template: 'btn_unduh_template_alumni',
             periksa: 'btn_periksa_import_alumni',
             mulai: 'btn_import_alumni',
           },
           labelTemplate: 'Unduh template Excel alumni',
           unduhTemplate: unduhTemplateAlumni,
          unduhData: {
            label: 'Unduh data alumni existing',
            ambil: dataAlumniExisting,
            namaBerkas: 'data-alumni-existing.xlsx',
            judulSheet: 'Data Alumni',
          },
           kirim: ({ sesi_id, mode, total, baris, terakhir }) =>
             importAlumniPotong({
               ...(sesi_id === undefined ? {} : { sesi_id }),
               mode, ...(sesi_id === undefined ? { total } : {}), baris,
               ...(terakhir ? { terakhir } : {}),
             }),
           batal: batalPotongAlumni,
           unduhGalat: unduhGalatAlumni,
           onSelesai: () => {
             setImportOpen(false);
             void muatUlang();
           },
         }}
       />

       <Dialog open={lulusOpen} onOpenChange={setLulusOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Luluskan santri</DialogTitle>
            <DialogDescription>{namaTerpilih.length} santri diproses (lulus).</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-3">
            <FieldLabel htmlFor="input_tanggal_lulus">Tanggal lulus</FieldLabel>
            <Input id="input_tanggal_lulus" type="date" value={tanggalLulus} onChange={(e) => setTanggalLulus(e.target.value)} />
            <FieldLabel htmlFor="input_no_ijazah_kelulusan">No. ijazah</FieldLabel>
            <Input id="input_no_ijazah_kelulusan" value={noIjazah} onChange={(e) => setNoIjazah(e.target.value)} />
            <FieldLabel htmlFor="input_no_peserta_kelulusan">No. peserta</FieldLabel>
            <Input id="input_no_peserta_kelulusan" value={noPeserta} onChange={(e) => setNoPeserta(e.target.value)} />
            <FieldLabel htmlFor="input_skhun_kelulusan">SKHUN</FieldLabel>
            <Input id="input_skhun_kelulusan" value={skhun} onChange={(e) => setSkhun(e.target.value)} />
            <FieldLabel htmlFor="input_no_surat_kelulusan">No. surat</FieldLabel>
            <Input id="input_no_surat_kelulusan" value={noSurat} onChange={(e) => setNoSurat(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLulusOpen(false)}>Batal</Button>
            <Button id="btn_simpan_lulus" disabled={busy || !tanggalLulus || !targetJenjang || !taDasar} onClick={() => void prosesLulus()}>Proses</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {dialogProfil}
    </div>
  );
}
