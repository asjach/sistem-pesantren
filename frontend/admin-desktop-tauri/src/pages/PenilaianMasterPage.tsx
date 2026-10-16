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
  buatEkskul, buatKomponen, daftarEkskul, daftarKkm, daftarKomponen, daftarPredikat,
  daftarPrestasi, hapusEkskul, hapusKomponen, hapusPrestasi, muatBawaan,
  simpanKkm, simpanPredikat, ubahEkskul, ubahKomponen,
  type Ekstrakurikuler, type KkmBaris, type KomponenNilai, type PredikatBaris, type PrestasiSantri,
} from '@/api/penilaian';

const TAB = ['komponen', 'kkm', 'predikat', 'ekskul', 'prestasi'] as const;

/** Halaman Master Penilaian: komponen & bobot, KKM, predikat, ekskul, prestasi. */
export default function PenilaianMasterPage() {
  const { jenjangs, tahunAjaranNames, loading: filterLoading } = useFilterGlobalAktif();
  const { user } = useAuth();
  const canTambah = bisa(user, 'penilaian.tambah');
  const canUbah = bisa(user, 'penilaian.ubah');
  const canHapus = bisa(user, 'penilaian.hapus');

  const jenjang = targetTunggal(jenjangs);
  const ta = targetTunggal(tahunAjaranNames);
  const siap = jenjang !== null && ta !== null;

  const [tab, setTab] = useState<string>('komponen');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [komponen, setKomponen] = useState<KomponenNilai[]>([]);
  const [totalBobot, setTotalBobot] = useState(0);
  const [kkm, setKkm] = useState<KkmBaris[]>([]);
  const [predikat, setPredikat] = useState<PredikatBaris[]>([]);
  const [ekskul, setEkskul] = useState<Ekstrakurikuler[]>([]);
  const [prestasi, setPrestasi] = useState<PrestasiSantri[]>([]);

  const muat = useCallback(async () => {
    if (jenjang === null || ta === null) return;
    setErr(''); setLoading(true);
    try {
      const [k, km, pr, ex, ps] = await Promise.all([
        daftarKomponen({ jenjang, tahun_ajaran: ta }),
        daftarKkm({ jenjang, tahun_ajaran: ta }),
        daftarPredikat({ jenjang, tahun_ajaran: ta }),
        daftarEkskul({ jenjang, tahun_ajaran: ta }),
        daftarPrestasi({ tahun_ajaran: ta }),
      ]);
      setKomponen(k.komponen); setTotalBobot(k.total_bobot);
      setKkm(km.baris);
      setPredikat(pr.baris);
      setEkskul(ex);
      setPrestasi(ps);
    } catch (e) {
      setErr(errorMessage(e));
    } finally { setLoading(false); }
  }, [jenjang, ta]);

  useEffect(() => { if (!filterLoading) void muat(); }, [filterLoading, muat]);

  const jalankan = useCallback(async (kerja: () => Promise<unknown>, sukses: string) => {
    try { await kerja(); toast.success(sukses); await muat(); }
    catch (e) { toast.error(errorMessage(e)); }
  }, [muat]);

  if (!siap) {
    return (
      <div className={PAGE_SHELL}>
        <p className="p-4 text-xs text-muted-foreground">Pilih satu jenjang (lembaga) dan satu tahun ajaran pada filter di atas.</p>
      </div>
    );
  }

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col gap-0">
        <TabsList className={KELAS_LIST_TAB} indikator="primer">
          <TabsTrigger value="komponen" id="pen_tab_komponen" className={KELAS_TRIGGER}>Komponen &amp; Bobot</TabsTrigger>
          <TabsTrigger value="kkm" id="pen_tab_kkm" className={KELAS_TRIGGER}>KKM</TabsTrigger>
          <TabsTrigger value="predikat" id="pen_tab_predikat" className={KELAS_TRIGGER}>Predikat</TabsTrigger>
          <TabsTrigger value="ekskul" id="pen_tab_ekskul" className={KELAS_TRIGGER}>Ekstrakurikuler</TabsTrigger>
          <TabsTrigger value="prestasi" id="pen_tab_prestasi" className={KELAS_TRIGGER}>Prestasi</TabsTrigger>
        </TabsList>

        {/* ---- Komponen & Bobot ---- */}
        <TabsContent value="komponen" className={`min-h-0 flex-1 overflow-auto p-3 ${KELAS_PANEL_TAB}`}>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Lingkup <strong>{jenjang}</strong> · TA <strong>{ta}</strong> · total bobot <strong>{totalBobot}</strong>
              {totalBobot !== 100 && <span className="ml-1 text-destructive">(idealnya 100)</span>}
            </span>
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="outline" size="sm" id="btn_muat_bawaan" disabled={!canTambah || loading}
                onClick={() => void jalankan(() => muatBawaan(jenjang, ta), 'Bawaan dimuat.')}>
                Muat bawaan
              </Button>
              <Button type="button" size="sm" id="btn_tambah_komponen" disabled={!canTambah}
                onClick={() => void jalankan(
                  () => buatKomponen({ jenjang, tahun_ajaran: ta, nama: 'Komponen Baru', bobot: 0 }),
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
                <th className="border border-border px-2 py-1 w-20">Urutan</th>
                <th className="border border-border px-2 py-1 w-24">Bobot</th>
                <th className="border border-border px-2 py-1 w-20">Aktif</th>
                <th className="border border-border px-2 py-1 w-24">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {komponen.map((k) => (
                <BarisKomponen key={k.id} k={k} ta={ta} canUbah={canUbah} canHapus={canHapus} onSimpan={jalankan} />
              ))}
              {komponen.length === 0 && (
                <tr><td colSpan={6} className="border border-border px-2 py-4 text-center text-muted-foreground">
                  Belum ada komponen. Klik “Muat bawaan” (UH 20 + Tugas 20 + PTS 20 + ASAS 40) atau tambah manual.
                </td></tr>
              )}
            </tbody>
          </table>
        </TabsContent>

        {/* ---- KKM ---- */}
        <TabsContent value="kkm" className={`min-h-0 flex-1 overflow-auto p-3 ${KELAS_PANEL_TAB}`}>
          <p className="mb-2 text-xs text-muted-foreground">
            KKM per peristiwa. Baris <strong>AKHIR</strong> jadi jangkar predikat rapor.
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
          <Button type="button" size="sm" className="mt-2" id="btn_simpan_kkm" disabled={!canUbah}
            onClick={() => void jalankan(() => simpanKkm(jenjang, ta, kkm), 'KKM disimpan.')}>
            <Save data-icon="inline-start" size={16} /> Simpan KKM
          </Button>
        </TabsContent>

        {/* ---- Predikat ---- */}
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
          <Button type="button" size="sm" className="mt-2" id="btn_simpan_predikat" disabled={!canUbah}
            onClick={() => void jalankan(() => simpanPredikat(jenjang, ta, predikat), 'Predikat disimpan.')}>
            <Save data-icon="inline-start" size={16} /> Simpan Predikat
          </Button>
        </TabsContent>

        {/* ---- Ekstrakurikuler ---- */}
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

        {/* ---- Prestasi ---- */}
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

/** Baris komponen dengan penyuntingan inline (nama/kode/urutan/bobot/aktif). */
function BarisKomponen({ k, ta, canUbah, canHapus, onSimpan }: {
  k: KomponenNilai; ta: string; canUbah: boolean; canHapus: boolean;
  onSimpan: (kerja: () => Promise<unknown>, sukses: string) => Promise<void>;
}) {
  const [nama, setNama] = useState(k.nama);
  const [kode, setKode] = useState(k.kode ?? '');
  const [urutan, setUrutan] = useState(String(k.urutan));
  const [bobot, setBobot] = useState(String(k.bobot));
  const [aktif, setAktif] = useState(k.is_active);

  useEffect(() => {
    setNama(k.nama); setKode(k.kode ?? ''); setUrutan(String(k.urutan));
    setBobot(String(k.bobot)); setAktif(k.is_active);
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
        <Input type="number" min={0} className="h-7 text-xs" aria-label="Urutan" disabled={!canUbah} value={urutan} onChange={(e) => setUrutan(e.target.value)} />
      </td>
      <td className="border border-border px-1 py-0.5">
        <Input type="number" min={0} max={100} className="h-7 text-xs" aria-label="Bobot" disabled={!canUbah} value={bobot} onChange={(e) => setBobot(e.target.value)} />
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
                  tahun_ajaran: ta, nama, kode: kode || null,
                  urutan: Number(urutan) || 0, bobot: Number(bobot) || 0, is_active: aktif,
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
