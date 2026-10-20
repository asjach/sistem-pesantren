import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useFilterGlobalAktif, targetTunggal } from '@/hooks/useFilterGlobalAktif';
import { useAuth } from '@/auth/AuthContext';
import { bisa } from '@/api/auth';
import { errorMessage } from '@/api/client';
import { listKelas, type Kelas } from '@/api/master';
import {
  daftarPeristiwa, daftarPesertaPeristiwa, generateNomorPeserta,
  simpanPengaturanNomorPeserta, ubahNomorPeserta,
  type BarisPesertaPeristiwa, type ModeUrutanNomorPeserta,
  type PeristiwaNilai, type PesertaPeristiwaResp,
} from '@/api/penilaian';
import { RefreshCw, RotateCcw, Save } from '@/icons';
import { formatContohNomorPeserta } from '@/lib/nomorPeserta';

export default function PenilaianKartuPesertaPage() {
  const { jenjangs, tahunAjaranNames, semesters, tingkat, kelas: kelasAktif, loading: filterLoading } = useFilterGlobalAktif();
  const { user } = useAuth();
  const canUbah = bisa(user, 'penilaian.ubah');

  const jenjang = targetTunggal(jenjangs);
  const tahunAjaran = targetTunggal(tahunAjaranNames);
  const semester = targetTunggal(semesters);
  const siap = jenjang !== null && tahunAjaran !== null && semester !== null;

  const [peristiwa, setPeristiwa] = useState<PeristiwaNilai[]>([]);
  const [peristiwaId, setPeristiwaId] = useState<number | ''>('');
  const [kelasOpsi, setKelasOpsi] = useState<Kelas[]>([]);
  const [data, setData] = useState<PesertaPeristiwaResp | null>(null);
  const [template, setTemplate] = useState('');
  const [modeUrutan, setModeUrutan] = useState<ModeUrutanNomorPeserta>('per_tingkat');
  const [cari, setCari] = useState('');
  const [cariTertunda, setCariTertunda] = useState('');
  const [loading, setLoading] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const [konfirmasiUlang, setKonfirmasiUlang] = useState(false);
  const [err, setErr] = useState('');
  const pengaturanKey = useRef('');

  useEffect(() => {
    if (filterLoading || jenjang === null || tahunAjaran === null) {
      setKelasOpsi([]);
      return;
    }
    let hidup = true;
    listKelas({ jenjang, tahun_ajaran: tahunAjaran, per_page: 1000 })
      .then((hasil) => { if (hidup) setKelasOpsi(hasil.data); })
      .catch(() => { if (hidup) setKelasOpsi([]); });
    return () => { hidup = false; };
  }, [filterLoading, jenjang, tahunAjaran]);

  useEffect(() => {
    if (filterLoading || jenjang === null || tahunAjaran === null) {
      setPeristiwa([]);
      setPeristiwaId('');
      return;
    }
    let hidup = true;
    daftarPeristiwa({ jenjang, tahun_ajaran: tahunAjaran })
      .then((hasil) => {
        if (!hidup) return;
        const aktif = hasil.peristiwa.filter((item) => item.is_active);
        setPeristiwa(aktif);
        setPeristiwaId((saatIni) => aktif.some((item) => item.id === saatIni) ? saatIni : (aktif[0]?.id ?? ''));
      })
      .catch((e) => { if (hidup) setErr(errorMessage(e)); });
    return () => { hidup = false; };
  }, [filterLoading, jenjang, tahunAjaran]);

  const kelasIds = useMemo(
    () => kelasOpsi.filter((item) => kelasAktif.includes(item.nama_kelas)).map((item) => item.id),
    [kelasOpsi, kelasAktif],
  );

  useEffect(() => {
    const bersih = cari.trim();
    const jeda = setTimeout(() => setCariTertunda(bersih), bersih === '' ? 0 : 350);
    return () => clearTimeout(jeda);
  }, [cari]);

  const permintaanTerakhir = useRef(0);
  const muat = useCallback(async () => {
    if (peristiwaId === '' || semester === null) {
      setData(null);
      return;
    }
    const permintaan = ++permintaanTerakhir.current;
    setLoading(true);
    setErr('');
    try {
      const hasil = await daftarPesertaPeristiwa({
        peristiwa_id: Number(peristiwaId),
        semester,
        tingkat: tingkat.length > 0 ? tingkat : undefined,
        kelas_id: kelasIds.length > 0 ? kelasIds : undefined,
        q: cariTertunda || undefined,
      });
      if (permintaan !== permintaanTerakhir.current) return;
      setData(hasil);
      const key = `${peristiwaId}:${semester}`;
      if (pengaturanKey.current !== key) {
        pengaturanKey.current = key;
        setTemplate(hasil.pengaturan.template);
        setModeUrutan(hasil.pengaturan.mode_urutan);
      }
    } catch (e) {
      if (permintaan !== permintaanTerakhir.current) return;
      setErr(errorMessage(e));
      setData(null);
    } finally {
      if (permintaan === permintaanTerakhir.current) setLoading(false);
    }
  }, [peristiwaId, semester, tingkat, kelasIds, cariTertunda]);

  useEffect(() => {
    if (filterLoading) return;
    void muat();
  }, [filterLoading, muat]);

  const contoh = useMemo(() => {
    const pilihan = peristiwa.find((item) => item.id === peristiwaId);
    if (!pilihan || semester === null || template === '') return '—';
    return formatContohNomorPeserta(template, {
      tahunAjaran: pilihan.tahun_ajaran,
      kodePeristiwa: pilihan.kode,
      semester,
      tingkat: tingkat[0] ?? data?.peserta[0]?.tingkat ?? '1',
      urutan: 1,
    });
  }, [peristiwa, peristiwaId, semester, template, tingkat, data]);

  const payload = useCallback(() => {
    if (peristiwaId === '' || semester === null) return null;
    return {
      peristiwa_id: Number(peristiwaId),
      semester,
      template,
      mode_urutan: modeUrutan,
    };
  }, [peristiwaId, semester, template, modeUrutan]);

  const simpanPola = useCallback(async () => {
    const isi = payload();
    if (isi === null) return;
    setMenyimpan(true);
    try {
      const hasil = await simpanPengaturanNomorPeserta(isi);
      toast.success(hasil.pesan);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setMenyimpan(false);
    }
  }, [payload]);

  const buatNomor = useCallback(async (buatUlangOtomatis: boolean) => {
    const isi = payload();
    if (isi === null) return;
    setMenyimpan(true);
    try {
      const hasil = await generateNomorPeserta({ ...isi, buat_ulang_otomatis: buatUlangOtomatis });
      toast.success(hasil.pesan);
      await muat();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setMenyimpan(false);
      setKonfirmasiUlang(false);
    }
  }, [payload, muat]);

  const tambahToken = useCallback((token: string) => setTemplate((nilai) => `${nilai}${token}`), []);
  const aksiNonaktif = !canUbah || !siap || peristiwaId === '' || template.trim() === '' || menyimpan;

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <label className="text-xs text-muted-foreground" htmlFor="select_peristiwa_kartu">Peristiwa</label>
        <select
          id="select_peristiwa_kartu"
          className="h-8 border border-input bg-transparent px-2 text-xs"
          value={peristiwaId === '' ? '' : String(peristiwaId)}
          onChange={(e) => {
            pengaturanKey.current = '';
            setPeristiwaId(e.target.value === '' ? '' : Number(e.target.value));
          }}
        >
          <option value="">— pilih peristiwa —</option>
          {peristiwa.map((item) => <option key={item.id} value={item.id}>{item.kode} — {item.nama}</option>)}
        </select>
        <Input
          id="input_cari_peserta_kartu"
          aria-label="Cari nama, NIS, atau nomor peserta"
          placeholder="Cari nama, NIS, atau nomor…"
          className="h-8 w-64 text-xs"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
        />
        <span className="text-xs text-muted-foreground">
          {!siap ? 'Pilih satu lembaga, tahun ajaran, dan semester.'
            : peristiwa.length === 0 ? 'Belum ada peristiwa aktif.'
              : `${data?.ringkasan.total ?? 0} peserta · ${data?.ringkasan.belum_bernomor ?? 0} belum bernomor`}
        </span>
      </div>

      <section className="shrink-0 border-b border-border bg-muted/20 px-3 py-3" aria-labelledby="judul_penyusun_pola">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_240px_260px]">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <h2 id="judul_penyusun_pola" className="text-xs font-semibold">Penyusun pola nomor</h2>
              <span className="text-[11px] text-muted-foreground">Bagian pola (token)</span>
            </div>
            <Input
              id="input_template_nomor_peserta"
              aria-label="Pola nomor peserta"
              className="h-9 font-mono text-xs"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              placeholder="{ta_awal_2}.{ta_akhir_2}.{kode_peristiwa}.{tingkat_2}.{nomor_4}"
            />
            <div className="mt-2 flex flex-wrap gap-1">
              {(data?.token ?? []).map((item) => (
                <Button
                  key={item.token}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 font-mono text-[11px]"
                  title={`${item.label}; contoh ${item.contoh}`}
                  onClick={() => tambahToken(item.token)}
                  disabled={!canUbah}
                >
                  {item.token}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold" htmlFor="select_mode_urutan_peserta">Urutan nomor</label>
            <select
              id="select_mode_urutan_peserta"
              className="h-9 w-full border border-input bg-background px-2 text-xs"
              value={modeUrutan}
              onChange={(e) => setModeUrutan(e.target.value as ModeUrutanNomorPeserta)}
              disabled={!canUbah}
            >
              <option value="per_tingkat">Mulai kembali per tingkat</option>
              <option value="semua_tingkat">Bersambung semua tingkat</option>
            </select>
            <div className="mt-3 border-l-4 border-primary bg-background px-3 py-2">
              <span className="block text-[11px] text-muted-foreground">Contoh langsung (pratinjau)</span>
              <strong className="block truncate font-mono text-sm" title={contoh}>{contoh}</strong>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px border border-border bg-border">
            <Ringkasan label="Total" nilai={data?.ringkasan.total ?? 0} />
            <Ringkasan label="Belum bernomor" nilai={data?.ringkasan.belum_bernomor ?? 0} />
            <Ringkasan label="Manual" nilai={data?.ringkasan.manual ?? 0} />
            <Ringkasan label="Otomatis" nilai={data?.ringkasan.otomatis ?? 0} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" size="sm" id="btn_simpan_pola_nomor" disabled={aksiNonaktif} onClick={() => void simpanPola()}>
            <Save data-icon="inline-start" size={16} /> Simpan pola
          </Button>
          <Button type="button" size="sm" id="btn_isi_nomor_kosong" disabled={aksiNonaktif} onClick={() => void buatNomor(false)}>
            <RefreshCw data-icon="inline-start" size={16} /> Isi yang kosong
          </Button>
          <Button type="button" variant="outline" size="sm" id="btn_buat_ulang_nomor" disabled={aksiNonaktif} onClick={() => setKonfirmasiUlang(true)}>
            <RotateCcw data-icon="inline-start" size={16} /> Buat ulang otomatis
          </Button>
        </div>
      </section>

      <div className="min-h-0 flex-1 overflow-auto">
        {loading && <p className="p-3 text-xs text-muted-foreground">Memuat peserta…</p>}
        {!loading && data !== null && (
          <table className="w-full min-w-[820px] border-collapse text-xs" id="tabel_nomor_peserta">
            <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur">
              <tr>
                <th className="border border-border px-2 py-1 text-left">No.</th>
                <th className="border border-border px-2 py-1 text-left">NIS</th>
                <th className="border border-border px-2 py-1 text-left">Nama</th>
                <th className="border border-border px-2 py-1 text-left">Kelas</th>
                <th className="border border-border px-2 py-1 text-left">Tingkat</th>
                <th className="w-[330px] border border-border px-2 py-1 text-left">Nomor peserta</th>
              </tr>
            </thead>
            <tbody>
              {data.peserta.map((baris, index) => (
                <tr key={baris.santri_id} className="hover:bg-muted/40">
                  <td className="border border-border px-2 py-1 text-muted-foreground">{index + 1}</td>
                  <td className="border border-border px-2 py-1 font-mono">{baris.nis_lokal ?? '—'}</td>
                  <td className="border border-border px-2 py-1 font-medium">{baris.nama}</td>
                  <td className="border border-border px-2 py-1">{baris.kelas ?? '—'}</td>
                  <td className="border border-border px-2 py-1">{baris.tingkat ?? '—'}</td>
                  <td className="border border-border p-1">
                    <InputNomor
                      baris={baris}
                      peristiwaId={Number(peristiwaId)}
                      semester={semester ?? '1'}
                      canUbah={canUbah}
                      onSaved={muat}
                    />
                  </td>
                </tr>
              ))}
              {data.peserta.length === 0 && (
                <tr><td colSpan={6} className="border border-border px-3 py-8 text-center text-muted-foreground">Tidak ada peserta pada lingkup ini.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <AlertDialog open={konfirmasiUlang} onOpenChange={setKonfirmasiUlang}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Buat ulang seluruh nomor otomatis?</AlertDialogTitle>
            <AlertDialogDescription>
              Nomor otomatis akan mengikuti pola dan urutan terbaru. Nomor yang diisi manual tetap dipertahankan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction id="btn_konfirmasi_buat_ulang_nomor" onClick={() => void buatNomor(true)}>Buat ulang</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Ringkasan({ label, nilai }: { label: string; nilai: number }) {
  return (
    <div className="bg-background px-3 py-2">
      <span className="block text-[11px] text-muted-foreground">{label}</span>
      <strong className="text-lg tabular-nums">{nilai}</strong>
    </div>
  );
}

function InputNomor({ baris, peristiwaId, semester, canUbah, onSaved }: {
  baris: BarisPesertaPeristiwa;
  peristiwaId: number;
  semester: string;
  canUbah: boolean;
  onSaved: () => Promise<void>;
}) {
  const [nilai, setNilai] = useState(baris.nomor_peserta ?? '');
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => setNilai(baris.nomor_peserta ?? ''), [baris.nomor_peserta]);
  const berubah = nilai.trim() !== (baris.nomor_peserta ?? '');

  const simpan = async () => {
    setMenyimpan(true);
    try {
      const hasil = await ubahNomorPeserta(baris.santri_id, {
        peristiwa_id: peristiwaId,
        semester,
        nomor_peserta: nilai.trim() || null,
      });
      toast.success(hasil.pesan);
      await onSaved();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Input
        id={`input_nomor_peserta_${baris.santri_id}`}
        aria-label={`Nomor peserta ${baris.nama}`}
        className="h-8 flex-1 font-mono text-xs"
        value={nilai}
        onChange={(e) => setNilai(e.target.value)}
        disabled={!canUbah || menyimpan}
        placeholder="Kosong"
      />
      <span className="w-14 text-center text-[10px] uppercase text-muted-foreground">
        {baris.sumber_nomor ?? 'kosong'}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        id={`btn_simpan_nomor_peserta_${baris.santri_id}`}
        aria-label={`Simpan nomor peserta ${baris.nama}`}
        title="Simpan sebagai nomor manual"
        disabled={!canUbah || !berubah || menyimpan}
        onClick={() => void simpan()}
      >
        <Save size={15} />
      </Button>
    </div>
  );
}
