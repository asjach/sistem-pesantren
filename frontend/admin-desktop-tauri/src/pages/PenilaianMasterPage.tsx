import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KELAS_LIST_TAB, KELAS_PANEL_TAB, KELAS_TRIGGER } from '@/components/HalamanTabs';
import { useFilterGlobalAktif, targetTunggal } from '@/hooks/useFilterGlobalAktif';
import { useAuth } from '@/auth/AuthContext';
import { bisa } from '@/api/auth';
import { errorMessage } from '@/api/client';
import { Plus, Save, Trash2 } from '@/icons';
import {
  buatEkskul, buatKomponen, buatKegiatanEvaluatif, daftarEkskul, daftarKkm, daftarKomponen,
  daftarKegiatanEvaluatif, daftarPredikat, daftarPrestasi, hapusEkskul, hapusKomponen, hapusKegiatanEvaluatif,
  hapusPrestasi, muatBawaan, simpanKkm, simpanPredikat, ubahEkskul, ubahKomponen, ubahKegiatanEvaluatif,
  type CakupanKegiatanEvaluatif, type Ekstrakurikuler, type JenisRapor, type KkmBaris,
  type KomponenNilai, type KurikulumKegiatanEvaluatif, type KegiatanEvaluatif,
  type PredikatBaris, type PrestasiSantri,
} from '@/api/penilaian';

/** Label cakupan peserta kegiatanEvaluatif. */
const CAKUPAN: { nilai: CakupanKegiatanEvaluatif; label: string }[] = [
  { nilai: 'semua', label: 'Semua tingkat' },
  { nilai: 'kecuali_akhir', label: 'Semua kecuali tingkat akhir' },
  { nilai: 'tingkat_akhir', label: 'Hanya tingkat akhir' },
];

const KURIKULUM: KurikulumKegiatanEvaluatif[] = ['keduanya', 'kemenag', 'pesantren'];

/** Kegiatan evaluatif mana yang menghasilkan rapor (ASAS/ASAT = akhir; UJIAN/UAP tidak). */
const JENIS_RAPOR: { nilai: JenisRapor; label: string }[] = [
  { nilai: 'akhir', label: 'Rapor akhir' },
  { nilai: 'sementara', label: 'Rapor sementara' },
  { nilai: 'tidak_ada', label: 'Tanpa rapor (nilai ujian)' },
];

/** Halaman Master Penilaian: kegiatanEvaluatif, komponen & bobot, KKM, predikat, ekskul, prestasi. */
export default function PenilaianMasterPage() {
  const { jenjangs, tahunAjaranNames, loading: filterLoading } = useFilterGlobalAktif();
  const { user } = useAuth();
  const canTambah = bisa(user, 'penilaian.tambah');
  const canUbah = bisa(user, 'penilaian.ubah');
  const canHapus = bisa(user, 'penilaian.hapus');

  const jenjang = targetTunggal(jenjangs);
  const ta = targetTunggal(tahunAjaranNames);
  const siap = jenjang !== null && ta !== null;

  const [tab, setTab] = useState<string>('kegiatan_evaluatif');
  const [err, setErr] = useState('');
  const [kegiatanEvaluatif, setKegiatanEvaluatif] = useState<KegiatanEvaluatif[]>([]);
  const [tingkatAkhir, setTingkatAkhir] = useState<string | null>(null);
  const [kegiatanEvaluatifId, setKegiatanEvaluatifId] = useState<number | ''>('');
  const [komponen, setKomponen] = useState<KomponenNilai[]>([]);
  const [totalBobot, setTotalBobot] = useState(0);
  const [kkm, setKkm] = useState<KkmBaris[]>([]);
  const [predikat, setPredikat] = useState<PredikatBaris[]>([]);
  const [ekskul, setEkskul] = useState<Ekstrakurikuler[]>([]);
  const [prestasi, setPrestasi] = useState<PrestasiSantri[]>([]);

  /** Tab yang isinya milik satu kegiatanEvaluatif (butuh pemilih kegiatanEvaluatif). */
  const butuhKegiatanEvaluatif = tab === 'komponen' || tab === 'kkm' || tab === 'predikat';

  const muatKegiatanEvaluatif = useCallback(async () => {
    if (jenjang === null || ta === null) return;
    try {
      const r = await daftarKegiatanEvaluatif({ jenjang, tahun_ajaran: ta });
      setKegiatanEvaluatif(r.kegiatan_evaluatif);
      setTingkatAkhir(r.tingkat_akhir);
      setKegiatanEvaluatifId((v) => (r.kegiatan_evaluatif.some((p) => p.id === v) ? v : (r.kegiatan_evaluatif[0]?.id ?? '')));
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [jenjang, ta]);

  const muatKegiatanEvaluatifTerkait = useCallback(async () => {
    if (kegiatanEvaluatifId === '') { setKomponen([]); setKkm([]); setPredikat([]); return; }
    try {
      const [k, km, pr] = await Promise.all([
        daftarKomponen(kegiatanEvaluatifId), daftarKkm(kegiatanEvaluatifId), daftarPredikat(kegiatanEvaluatifId),
      ]);
      setKomponen(k.komponen); setTotalBobot(k.total_bobot);
      setKkm(km.baris); setPredikat(pr.baris);
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [kegiatanEvaluatifId]);

  const muatUmum = useCallback(async () => {
    if (jenjang === null || ta === null) return;
    try {
      const [ex, ps] = await Promise.all([daftarEkskul({ jenjang, tahun_ajaran: ta }), daftarPrestasi({ tahun_ajaran: ta })]);
      setEkskul(ex); setPrestasi(ps);
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [jenjang, ta]);

  useEffect(() => {
    if (filterLoading) return;
    setErr('');
    void muatKegiatanEvaluatif();
    void muatUmum();
  }, [filterLoading, muatKegiatanEvaluatif, muatUmum]);

  useEffect(() => { void muatKegiatanEvaluatifTerkait(); }, [muatKegiatanEvaluatifTerkait]);

  const segarkan = useCallback(async () => {
    await muatKegiatanEvaluatif();
    await muatKegiatanEvaluatifTerkait();
    await muatUmum();
  }, [muatKegiatanEvaluatif, muatKegiatanEvaluatifTerkait, muatUmum]);

  const jalankan = useCallback(async (kerja: () => Promise<unknown>, sukses: string) => {
    try { await kerja(); toast.success(sukses); await segarkan(); }
    catch (e) { toast.error(errorMessage(e)); }
  }, [segarkan]);

  if (!siap) {
    return (
      <div className={PAGE_SHELL}>
        <p className="p-4 text-xs text-muted-foreground">Pilih satu jenjang (lembaga) dan satu tahun ajaran pada filter di atas.</p>
      </div>
    );
  }

  const kegiatanEvaluatifAktif = kegiatanEvaluatif.find((p) => p.id === kegiatanEvaluatifId) ?? null;

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col gap-0">
        <TabsList className={KELAS_LIST_TAB} indikator="primer">
          <TabsTrigger value="kegiatan_evaluatif" id="pen_tab_kegiatan_evaluatif" className={KELAS_TRIGGER}>Kegiatan Evaluatif</TabsTrigger>
          <TabsTrigger value="komponen" id="pen_tab_komponen" className={KELAS_TRIGGER}>Komponen &amp; Bobot</TabsTrigger>
          <TabsTrigger value="kkm" id="pen_tab_kkm" className={KELAS_TRIGGER}>KKM</TabsTrigger>
          <TabsTrigger value="predikat" id="pen_tab_predikat" className={KELAS_TRIGGER}>Predikat</TabsTrigger>
          <TabsTrigger value="ekskul" id="pen_tab_ekskul" className={KELAS_TRIGGER}>Ekstrakurikuler</TabsTrigger>
          <TabsTrigger value="prestasi" id="pen_tab_prestasi" className={KELAS_TRIGGER}>Prestasi</TabsTrigger>
        </TabsList>

        {butuhKegiatanEvaluatif && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
            <label className="text-xs text-muted-foreground" htmlFor="select_kegiatan_evaluatif_master">Kegiatan Evaluatif</label>
            <select
              id="select_kegiatan_evaluatif_master"
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
              value={kegiatanEvaluatifId === '' ? '' : String(kegiatanEvaluatifId)}
              onChange={(e) => setKegiatanEvaluatifId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">— pilih kegiatan evaluatif —</option>
              {kegiatanEvaluatif.map((p) => <option key={p.id} value={p.id}>{p.kode} — {p.nama}</option>)}
            </select>
            {kegiatanEvaluatifAktif && (
              <span className="text-xs text-muted-foreground">
                {CAKUPAN.find((c) => c.nilai === kegiatanEvaluatifAktif.cakupan)?.label}
                {kegiatanEvaluatifAktif.kurikulum !== 'keduanya' && ` · kurikulum ${kegiatanEvaluatifAktif.kurikulum}`}
              </span>
            )}
            {kegiatanEvaluatif.length === 0 && (
              <span className="text-xs text-destructive">Belum ada kegiatan evaluatif — buka tab Kegiatan Evaluatif dan klik “Muat bawaan”.</span>
            )}
          </div>
        )}

        <TabsContent value="kegiatan_evaluatif" className={`min-h-0 flex-1 overflow-auto p-3 ${KELAS_PANEL_TAB}`}>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Lingkup <strong>{jenjang}</strong> · TA <strong>{ta}</strong>
              {tingkatAkhir !== null && <> · tingkat akhir <strong>{tingkatAkhir}</strong></>}
            </span>
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="outline" size="sm" id="btn_muat_bawaan" disabled={!canTambah}
                onClick={() => void jalankan(() => muatBawaan(jenjang, ta), 'Bawaan dimuat.')}>
                Muat bawaan
              </Button>
              <Button type="button" size="sm" id="btn_tambah_kegiatan_evaluatif" disabled={!canTambah}
                onClick={() => void jalankan(
                  () => buatKegiatanEvaluatif({ jenjang, tahun_ajaran: ta, kode: 'BARU', nama: 'Kegiatan Evaluatif Baru', cakupan: 'semua', jenis_rapor: 'tidak_ada' }),
                  'Kegiatan Evaluatif ditambah.',
                )}>
                <Plus data-icon="inline-start" size={16} /> Tambah
              </Button>
            </div>
          </div>
          <table className="w-full border-collapse text-xs" id="tabel_kegiatan_evaluatif_nilai">
            <thead className="bg-muted/60">
              <tr>
                <th className="border border-border px-2 py-1 w-24 text-left">Kode</th>
                <th className="border border-border px-2 py-1 text-left">Nama</th>
                <th className="border border-border px-2 py-1 w-56 text-left">Peserta</th>
                <th className="border border-border px-2 py-1 w-32 text-left">Kurikulum</th>
                <th className="border border-border px-2 py-1 w-44 text-left">Rapor</th>
                <th className="border border-border px-2 py-1 w-20">Urutan</th>
                <th className="border border-border px-2 py-1 w-20">Aktif</th>
                <th className="border border-border px-2 py-1 w-24">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {kegiatanEvaluatif.map((p) => (
                <BarisKegiatanEvaluatif key={p.id} p={p} canUbah={canUbah} canHapus={canHapus} onSimpan={jalankan} />
              ))}
              {kegiatanEvaluatif.length === 0 && (
                <tr><td colSpan={8} className="border border-border px-2 py-4 text-center text-muted-foreground">
                  Belum ada kegiatan evaluatif. Klik “Muat bawaan” untuk ASAS + ASAT + UJIAN + UAP.
                </td></tr>
              )}
            </tbody>
          </table>
        </TabsContent>

        <TabsContent value="komponen" className={`min-h-0 flex-1 overflow-auto p-3 ${KELAS_PANEL_TAB}`}>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Total bobot <strong>{totalBobot}</strong>
              {totalBobot !== 100 && <span className="ml-1 text-destructive">(idealnya 100)</span>}
            </span>
            <div className="ml-auto">
              <Button type="button" size="sm" id="btn_tambah_komponen" disabled={!canTambah || kegiatanEvaluatifId === ''}
                onClick={() => void jalankan(
                  () => buatKomponen({ kegiatan_evaluatif_id: Number(kegiatanEvaluatifId), nama: 'Komponen Baru', bobot: 0 }),
                  'Komponen ditambah.',
                )}>
                <Plus data-icon="inline-start" size={16} /> Tambah
              </Button>
            </div>
          </div>
          <table className="w-full border-collapse text-xs" id="tabel_komponen_nilai">
            <thead className="bg-muted/60">
              <tr>
                <th className="border border-border px-2 py-1 text-left">Nama</th>
                <th className="border border-border px-2 py-1 text-left">Kode</th>
                <th className="border border-border px-2 py-1 w-24">Bobot</th>
                <th className="border border-border px-2 py-1 w-48 text-left">Sumber nilai</th>
                <th className="border border-border px-2 py-1 w-56 text-left">Rincian sumber</th>
                <th className="border border-border px-2 py-1 w-20">Aktif</th>
                <th className="border border-border px-2 py-1 w-24">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {komponen.map((k) => (
                <BarisKomponen
                  key={k.id}
                  k={k}
                  kegiatanEvaluatifLain={kegiatanEvaluatif.filter((p) => p.id !== kegiatanEvaluatifId)}
                  canUbah={canUbah}
                  canHapus={canHapus}
                  onSimpan={jalankan}
                />
              ))}
              {komponen.length === 0 && (
                <tr><td colSpan={7} className="border border-border px-2 py-4 text-center text-muted-foreground">
                  {kegiatanEvaluatifId === '' ? 'Pilih kegiatan evaluatif dulu.' : 'Belum ada komponen pada kegiatan evaluatif ini.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </TabsContent>

        <TabsContent value="kkm" className={`min-h-0 flex-1 overflow-auto p-3 ${KELAS_PANEL_TAB}`}>
          <p className="mb-2 text-xs text-muted-foreground">
            KKM per komponen; baris <strong>AKHIR</strong> jadi jangkar predikat rapor kegiatan evaluatif ini.
          </p>
          <table className="w-full max-w-lg border-collapse text-xs" id="tabel_kkm">
            <thead className="bg-muted/60">
              <tr><th className="border border-border px-2 py-1 text-left">Kegiatan</th><th className="border border-border px-2 py-1 w-24">KKM</th></tr>
            </thead>
            <tbody>
              {kkm.map((b, i) => (
                <tr key={b.kegiatan}>
                  <td className="border border-border px-2 py-1">{b.kegiatan}</td>
                  <td className="border border-border px-1 py-0.5">
                    <Input
                      type="number" min={0} max={100} className="h-7 text-xs"
                      aria-label={`KKM ${b.kegiatan}`}
                      disabled={!canUbah}
                      value={String(b.kkm)}
                      onChange={(e) => setKkm((prev) => prev.map((x, j) => j === i ? { ...x, kkm: Number(e.target.value) } : x))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button type="button" size="sm" className="mt-2" id="btn_simpan_kkm" disabled={!canUbah || kegiatanEvaluatifId === ''}
            onClick={() => void jalankan(() => simpanKkm(Number(kegiatanEvaluatifId), kkm), 'KKM disimpan.')}>
            <Save data-icon="inline-start" size={16} /> Simpan KKM
          </Button>
        </TabsContent>

        <TabsContent value="predikat" className={`min-h-0 flex-1 overflow-auto p-3 ${KELAS_PANEL_TAB}`}>
          <p className="mb-2 text-xs text-muted-foreground">
            Predikat berjangkar ke KKM AKHIR: berlaku bila nilai ≥ KKM + offset. Offset kosong = tanpa batas bawah (predikat terakhir).
          </p>
          <table className="w-full max-w-lg border-collapse text-xs" id="tabel_predikat">
            <thead className="bg-muted/60">
              <tr>
                <th className="border border-border px-2 py-1 w-20">Predikat</th>
                <th className="border border-border px-2 py-1 w-28">Offset dari KKM</th>
                <th className="border border-border px-2 py-1 text-left">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {predikat.map((b, i) => (
                <tr key={b.predikat}>
                  <td className="border border-border px-2 py-1 text-center font-semibold">{b.predikat}</td>
                  <td className="border border-border px-1 py-0.5">
                    <Input
                      type="number" className="h-7 text-xs"
                      aria-label={`Offset ${b.predikat}`}
                      disabled={!canUbah}
                      value={b.offset_bawah === null ? '' : String(b.offset_bawah)}
                      onChange={(e) => setPredikat((prev) => prev.map((x, j) => j === i
                        ? { ...x, offset_bawah: e.target.value === '' ? null : Number(e.target.value) }
                        : x))}
                    />
                  </td>
                  <td className="border border-border px-1 py-0.5">
                    <Input
                      className="h-7 text-xs" aria-label={`Keterangan ${b.predikat}`}
                      disabled={!canUbah}
                      value={b.keterangan ?? ''}
                      onChange={(e) => setPredikat((prev) => prev.map((x, j) => j === i ? { ...x, keterangan: e.target.value } : x))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button type="button" size="sm" className="mt-2" id="btn_simpan_predikat" disabled={!canUbah || kegiatanEvaluatifId === ''}
            onClick={() => void jalankan(() => simpanPredikat(Number(kegiatanEvaluatifId), predikat), 'Predikat disimpan.')}>
            <Save data-icon="inline-start" size={16} /> Simpan Predikat
          </Button>
        </TabsContent>

        <TabsContent value="ekskul" className={`min-h-0 flex-1 overflow-auto p-3 ${KELAS_PANEL_TAB}`}>
          <div className="mb-2 flex justify-end">
            <Button type="button" size="sm" id="btn_tambah_ekskul" disabled={!canTambah}
              onClick={() => void jalankan(() => buatEkskul({ jenjang, tahun_ajaran: ta, nama: 'Ekskul Baru' }), 'Ekskul ditambah.')}>
              <Plus data-icon="inline-start" size={16} /> Tambah
            </Button>
          </div>
          <table className="w-full max-w-2xl border-collapse text-xs" id="tabel_ekskul">
            <thead className="bg-muted/60">
              <tr>
                <th className="border border-border px-2 py-1 text-left">Nama</th>
                <th className="border border-border px-2 py-1 text-left">Pembimbing</th>
                <th className="border border-border px-2 py-1 w-20">Aktif</th>
                <th className="border border-border px-2 py-1 w-24">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {ekskul.map((e) => (
                <BarisEkskul key={e.id} e={e} canUbah={canUbah} canHapus={canHapus} onSimpan={jalankan} />
              ))}
              {ekskul.length === 0 && (
                <tr><td colSpan={4} className="border border-border px-2 py-4 text-center text-muted-foreground">Belum ada ekstrakurikuler.</td></tr>
              )}
            </tbody>
          </table>
        </TabsContent>

        <TabsContent value="prestasi" className={`min-h-0 flex-1 overflow-auto p-3 ${KELAS_PANEL_TAB}`}>
          <p className="mb-2 text-xs text-muted-foreground">
            Prestasi TA <strong>{ta}</strong>. Penambahan massal lewat halaman <strong>Impor Nilai</strong> (template Prestasi).
          </p>
          <table className="w-full border-collapse text-xs" id="tabel_prestasi">
            <thead className="bg-muted/60">
              <tr>
                <th className="border border-border px-2 py-1 text-left">Santri</th>
                <th className="border border-border px-2 py-1 text-left">Prestasi</th>
                <th className="border border-border px-2 py-1 text-left">Level</th>
                <th className="border border-border px-2 py-1 text-left">Keterangan</th>
                <th className="border border-border px-2 py-1 w-24">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {prestasi.map((p) => (
                <tr key={p.id}>
                  <td className="border border-border px-2 py-1">{p.santri?.nama_lengkap ?? `#${p.santri_id}`}</td>
                  <td className="border border-border px-2 py-1">{p.prestasi}</td>
                  <td className="border border-border px-2 py-1">{p.level ?? '—'}</td>
                  <td className="border border-border px-2 py-1">{p.keterangan ?? '—'}</td>
                  <td className="border border-border px-1 py-0.5 text-center">
                    {canHapus && (
                      <Button type="button" variant="ghost" size="icon-sm" aria-label="Hapus prestasi"
                        onClick={() => void jalankan(() => hapusPrestasi(p.id), 'Prestasi dihapus.')}>
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {prestasi.length === 0 && (
                <tr><td colSpan={5} className="border border-border px-2 py-4 text-center text-muted-foreground">Belum ada prestasi.</td></tr>
              )}
            </tbody>
          </table>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Baris kegiatanEvaluatif dengan penyuntingan inline. */
function BarisKegiatanEvaluatif({ p, canUbah, canHapus, onSimpan }: {
  p: KegiatanEvaluatif; canUbah: boolean; canHapus: boolean;
  onSimpan: (kerja: () => Promise<unknown>, sukses: string) => Promise<void>;
}) {
  const [nama, setNama] = useState(p.nama);
  const [cakupan, setCakupan] = useState<CakupanKegiatanEvaluatif>(p.cakupan);
  const [kurikulum, setKurikulum] = useState<KurikulumKegiatanEvaluatif>(p.kurikulum);
  const [jenisRapor, setJenisRapor] = useState<JenisRapor>(p.jenis_rapor);
  const [urutan, setUrutan] = useState(String(p.urutan));
  const [aktif, setAktif] = useState(p.is_active);

  useEffect(() => {
    setNama(p.nama); setCakupan(p.cakupan); setKurikulum(p.kurikulum);
    setJenisRapor(p.jenis_rapor); setUrutan(String(p.urutan)); setAktif(p.is_active);
  }, [p]);

  return (
    <tr>
      <td className="border border-border px-2 py-1 font-mono font-semibold">{p.kode}</td>
      <td className="border border-border px-1 py-0.5">
        <Input className="h-7 text-xs" aria-label="Nama kegiatan evaluatif" disabled={!canUbah} value={nama} onChange={(e) => setNama(e.target.value)} />
      </td>
      <td className="border border-border px-1 py-0.5">
        <select className="h-7 w-full rounded-md border border-input bg-transparent px-1 text-xs" aria-label="Peserta"
          disabled={!canUbah} value={cakupan} onChange={(e) => setCakupan(e.target.value as CakupanKegiatanEvaluatif)}>
          {CAKUPAN.map((c) => <option key={c.nilai} value={c.nilai}>{c.label}</option>)}
        </select>
      </td>
      <td className="border border-border px-1 py-0.5">
        <select className="h-7 w-full rounded-md border border-input bg-transparent px-1 text-xs" aria-label="Kurikulum"
          disabled={!canUbah} value={kurikulum} onChange={(e) => setKurikulum(e.target.value as KurikulumKegiatanEvaluatif)}>
          {KURIKULUM.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </td>
      <td className="border border-border px-1 py-0.5">
        <select className="h-7 w-full rounded-md border border-input bg-transparent px-1 text-xs" aria-label="Jenis rapor"
          disabled={!canUbah} value={jenisRapor} onChange={(e) => setJenisRapor(e.target.value as JenisRapor)}>
          {JENIS_RAPOR.map((j) => <option key={j.nilai} value={j.nilai}>{j.label}</option>)}
        </select>
      </td>
      <td className="border border-border px-1 py-0.5">
        <Input type="number" min={0} className="h-7 text-xs" aria-label="Urutan" disabled={!canUbah} value={urutan} onChange={(e) => setUrutan(e.target.value)} />
      </td>
      <td className="border border-border px-1 py-0.5 text-center">
        <input type="checkbox" aria-label="Aktif" disabled={!canUbah} checked={aktif} onChange={(e) => setAktif(e.target.checked)} />
      </td>
      <td className="border border-border px-1 py-0.5">
        <div className="flex justify-center gap-1">
          {canUbah && (
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Simpan kegiatan evaluatif"
              onClick={() => void onSimpan(
                () => ubahKegiatanEvaluatif(p.id, { nama, cakupan, kurikulum, jenis_rapor: jenisRapor, urutan: Number(urutan) || 0, is_active: aktif }),
                'Kegiatan Evaluatif disimpan.',
              )}>
              <Save size={14} />
            </Button>
          )}
          {canHapus && (
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Hapus kegiatan evaluatif"
              onClick={() => void onSimpan(() => hapusKegiatanEvaluatif(p.id), 'Kegiatan Evaluatif dihapus.')}>
              <Trash2 size={14} />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

/** Baris komponen (per kegiatanEvaluatif) dengan penyuntingan inline. */
function BarisKomponen({ k, kegiatanEvaluatifLain, canUbah, canHapus, onSimpan }: {
  k: KomponenNilai; kegiatanEvaluatifLain: KegiatanEvaluatif[]; canUbah: boolean; canHapus: boolean;
  onSimpan: (kerja: () => Promise<unknown>, sukses: string) => Promise<void>;
}) {
  const [nama, setNama] = useState(k.nama);
  const [kode, setKode] = useState(k.kode ?? '');
  const [bobot, setBobot] = useState(String(k.bobot));
  const [sumber, setSumber] = useState(k.sumber);
  const [nTingkat, setNTingkat] = useState(k.jumlah_tingkat_rapor === null ? '' : String(k.jumlah_tingkat_rapor));
  const [kegiatanEvaluatifSumberId, setKegiatanEvaluatifSumberId] = useState(
    k.kegiatan_evaluatif_sumber_id === null ? '' : String(k.kegiatan_evaluatif_sumber_id),
  );
  const [aktif, setAktif] = useState(k.is_active);

  useEffect(() => {
    setNama(k.nama); setKode(k.kode ?? ''); setBobot(String(k.bobot));
    setSumber(k.sumber); setNTingkat(k.jumlah_tingkat_rapor === null ? '' : String(k.jumlah_tingkat_rapor));
    setKegiatanEvaluatifSumberId(k.kegiatan_evaluatif_sumber_id === null ? '' : String(k.kegiatan_evaluatif_sumber_id));
    setAktif(k.is_active);
  }, [k]);

  return (
    <tr>
      <td className="border border-border px-1 py-0.5">
        <Input className="h-7 text-xs" aria-label="Nama komponen" disabled={!canUbah} value={nama} onChange={(e) => setNama(e.target.value)} />
      </td>
      <td className="border border-border px-1 py-0.5">
        <Input className="h-7 text-xs" aria-label="Kode komponen" disabled={!canUbah} value={kode} onChange={(e) => setKode(e.target.value)} />
      </td>
      <td className="border border-border px-1 py-0.5">
        <Input type="number" min={0} max={100} className="h-7 text-xs" aria-label="Bobot" disabled={!canUbah} value={bobot} onChange={(e) => setBobot(e.target.value)} />
      </td>
      <td className="border border-border px-1 py-0.5">
        <select className="h-7 w-full rounded-md border border-input bg-transparent px-1 text-xs" aria-label="Sumber nilai"
          disabled={!canUbah} value={sumber} onChange={(e) => setSumber(e.target.value as KomponenNilai['sumber'])}>
          <option value="manual">Manual (diisi/diimpor)</option>
          <option value="rapor_otomatis">Otomatis dari rapor</option>
          <option value="kegiatan_evaluatif">Dari kegiatan evaluatif lain</option>
        </select>
      </td>
      <td className="border border-border px-1 py-0.5">
        {sumber === 'rapor_otomatis' && (
          <Input
            type="number" min={1} max={6} className="h-7 text-xs" aria-label="Jumlah tingkat rapor"
            title="Jumlah tingkat sebelumnya yang dirata-rata"
            disabled={!canUbah}
            value={nTingkat} placeholder="N tingkat"
            onChange={(e) => setNTingkat(e.target.value)}
          />
        )}
        {sumber === 'kegiatan_evaluatif' && (
          <select
            className="h-7 w-full rounded-md border border-input bg-transparent px-1 text-xs"
            aria-label="Kegiatan Evaluatif sumber"
            disabled={!canUbah}
            value={kegiatanEvaluatifSumberId}
            onChange={(e) => setKegiatanEvaluatifSumberId(e.target.value)}
          >
            <option value="">— pilih kegiatan evaluatif —</option>
            {kegiatanEvaluatifLain.map((p) => <option key={p.id} value={p.id}>{p.kode} — {p.nama}</option>)}
          </select>
        )}
        {sumber === 'manual' && <span className="block text-center text-[10px] text-muted-foreground">diisi guru</span>}
      </td>
      <td className="border border-border px-1 py-0.5 text-center">
        <input type="checkbox" aria-label="Aktif" disabled={!canUbah} checked={aktif} onChange={(e) => setAktif(e.target.checked)} />
      </td>
      <td className="border border-border px-1 py-0.5">
        <div className="flex justify-center gap-1">
          {canUbah && (
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Simpan komponen"
              onClick={() => void onSimpan(
                () => ubahKomponen(k.id, {
                  nama, kode: kode || null, bobot: Number(bobot) || 0,
                  sumber,
                  jumlah_tingkat_rapor: sumber === 'rapor_otomatis' && nTingkat !== '' ? Number(nTingkat) : null,
                  kegiatan_evaluatif_sumber_id: sumber === 'kegiatan_evaluatif' && kegiatanEvaluatifSumberId !== '' ? Number(kegiatanEvaluatifSumberId) : null,
                  is_active: aktif,
                }),
                'Komponen disimpan.',
              )}>
              <Save size={14} />
            </Button>
          )}
          {canHapus && (
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Hapus komponen"
              onClick={() => void onSimpan(() => hapusKomponen(k.id), 'Komponen dihapus.')}>
              <Trash2 size={14} />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

/** Baris ekstrakurikuler dengan penyuntingan inline. */
function BarisEkskul({ e, canUbah, canHapus, onSimpan }: {
  e: Ekstrakurikuler; canUbah: boolean; canHapus: boolean;
  onSimpan: (kerja: () => Promise<unknown>, sukses: string) => Promise<void>;
}) {
  const [nama, setNama] = useState(e.nama);
  const [pembimbing, setPembimbing] = useState(e.pembimbing ?? '');
  const [aktif, setAktif] = useState(e.is_active);

  useEffect(() => { setNama(e.nama); setPembimbing(e.pembimbing ?? ''); setAktif(e.is_active); }, [e]);

  return (
    <tr>
      <td className="border border-border px-1 py-0.5">
        <Input className="h-7 text-xs" aria-label="Nama ekskul" disabled={!canUbah} value={nama} onChange={(ev) => setNama(ev.target.value)} />
      </td>
      <td className="border border-border px-1 py-0.5">
        <Input className="h-7 text-xs" aria-label="Pembimbing" disabled={!canUbah} value={pembimbing} onChange={(ev) => setPembimbing(ev.target.value)} />
      </td>
      <td className="border border-border px-1 py-0.5 text-center">
        <input type="checkbox" aria-label="Aktif" disabled={!canUbah} checked={aktif} onChange={(ev) => setAktif(ev.target.checked)} />
      </td>
      <td className="border border-border px-1 py-0.5">
        <div className="flex justify-center gap-1">
          {canUbah && (
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Simpan ekskul"
              onClick={() => void onSimpan(
                () => ubahEkskul(e.id, { nama, pembimbing: pembimbing || null, is_active: aktif }),
                'Ekskul disimpan.',
              )}>
              <Save size={14} />
            </Button>
          )}
          {canHapus && (
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Hapus ekskul"
              onClick={() => void onSimpan(() => hapusEkskul(e.id), 'Ekskul dihapus.')}>
              <Trash2 size={14} />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
