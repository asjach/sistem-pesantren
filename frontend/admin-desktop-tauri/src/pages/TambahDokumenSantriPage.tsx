import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage, isTauri, prefGet, prefSet } from '../api/client';
import { listSantri, type Santri, type SantriPenuh } from '../api/santri';
import { listDokumen } from '../api/dokumen';
import { listKelas, referensiList, type Kelas, type ReferensiRow } from '../api/master';
import { listRiwayatBelajar } from '../api/siklus';
import { simpanDokumen } from '../api/dokumen';
import TombolIkon from '@/components/TombolIkon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Check, FolderOpen, Save, X } from '@/icons';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import { Checkbox } from '@/components/ui/checkbox';
import { useFilterGlobalAktif } from '@/hooks/useFilterGlobalAktif';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import { Separator } from '@/components/ui/separator';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { TopBarSearch } from '@/components/TopBarSearch';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { ProfilSantriDialog } from '@/components/ProfilSantriDialog';
import { useProfilSantri } from '@/components/santri/IsiProfilSantri';
import { cn } from '@/lib/utils';
import { jenjangTampilSantri, urutSantriFilter, type InfoUrutSantri } from '@/lib/urut';
import {
  BATAS_BERKAS,
  EKSTENSI_BOLEH,
  PREF_FOLDER_ARSIP,
  PREF_FOLDER_ARSIP_TEST,
  PREF_MODE_DOKUMEN,
  ROOT_ARSIP_DOKUMEN,
  ROOT_ARSIP_TEST,
  akarArsip,
  ekstensiDariNama,
  formatUkuran,
  mimeDariEkstensi,
  namaArsip,
  pilihBerkasDokumen,
  pindahKeSudah,
  tulisArsip,
} from '@/lib/arsipDokumen';
import PenampilBerkas, { type SumberBerkas } from '@/components/dokumen/PenampilBerkas';
import type { HasilGambar } from '@/lib/olahGambar';
import { gantiEkstensi } from '@/lib/olahGambar';
import { toast } from 'sonner';

/** Halaman Tambah Dokumen Santri — dua kolom: form (400px) + viewer berkas.
 *  Alur: klik nama santri di tabel → pilih jenis dokumen → pilih berkas
 *  (catatan opsional) → Simpan. Di aplikasi desktop, berkas disalin ke arsip
 *  lokal dan (opsional via checkbox) file asli dipindah ke folder `sudah`. */
export default function TambahDokumenSantriPage() {
  const navigate = useNavigate();
  const desktop = isTauri();
  const {
    jenjangs,
    tahunAjaranNames,
    semesters,
    tingkat: tingkatAktif,
    kelas: kelasAktif,
    loading: filterLoading,
  } = useFilterGlobalAktif();

  // ----- Daftar santri (kolom 1, atas) -----
  const [cari, setCari] = useState('');
  const [cariTunda, setCariTunda] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setCariTunda(cari), 350);
    return () => clearTimeout(t);
  }, [cari]);

  /** Sumber daftar: filter akademik topBar vs buku induk (scope admin). */
  const [sumber, setSumber] = useState<'filter' | 'buku'>('filter');
  /** Opsi kelas untuk memetakan nama filter global → id param server. */
  const [kelasOpsi, setKelasOpsi] = useState<Kelas[]>([]);
  useEffect(() => {
    if (sumber !== 'filter' || filterLoading || jenjangs.length === 0) { setKelasOpsi([]); return; }
    let hidup = true;
    listKelas({ jenjang: jenjangs, tahun_ajaran: tahunAjaranNames, per_page: 1000 })
      .then((p) => { if (hidup) setKelasOpsi(p.data); })
      .catch(() => { if (hidup) setKelasOpsi([]); });
    return () => { hidup = false; };
  }, [sumber, filterLoading, jenjangs, tahunAjaranNames]);
  const kelasFilterIds = useMemo(
    () => kelasOpsi.filter((k) => kelasAktif.includes(k.nama_kelas)).map((k) => k.id),
    [kelasOpsi, kelasAktif],
  );

  const [santris, setSantris] = useState<Santri[]>([]);
  const [loadingSantri, setLoadingSantri] = useState(false);
  const [err, setErr] = useState('');

  /** Daftar santri dimuat utuh tanpa pagination (per_page=0 = semua baris). */
  const muatSantri = useCallback(async (signal?: AbortSignal) => {
    if (filterLoading || jenjangs.length === 0) { setSantris([]); return; }
    setLoadingSantri(true);
    setErr('');
    try {
      const res = await listSantri({
        jenjang: jenjangs,
        ...(sumber === 'filter'
          ? {
              tahun_ajaran: tahunAjaranNames.length ? tahunAjaranNames : undefined,
              semester: semesters.length ? semesters : undefined,
              tingkat: tingkatAktif.length ? tingkatAktif : undefined,
              kelas_id: kelasFilterIds.length ? kelasFilterIds : undefined,
            }
          : {}),
        q: cariTunda || undefined,
        per_page: 0,
        signal,
      });
      setSantris(res.data);
    } catch (e) {
      // Request yang dibatalkan (ganti filter/cari, StrictMode) tiba sebagai
      // ApiError(0) — abaikan seperti pola useDaftarTabel.
      if (signal?.aborted) return;
      setErr(errorMessage(e));
    } finally {
      setLoadingSantri(false);
    }
  }, [sumber, filterLoading, jenjangs, tahunAjaranNames, semesters, tingkatAktif, kelasFilterIds, cariTunda]);

  useEffect(() => {
    const c = new AbortController();
    void muatSantri(c.signal);
    return () => c.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sumber, filterLoading, jenjangs, tahunAjaranNames, semesters, tingkatAktif, kelasFilterIds, cariTunda]);

  const [santriId, setSantriId] = useState<number | null>(null);
  /** Profil yang dibuka via klik kanan baris (verifikasi identitas). */
  const [profilId, setProfilId] = useState<number | null>(null);
  const santriTerpilih = useMemo(
    () => santris.find((s) => s.id === santriId) ?? null,
    [santris, santriId],
  );
  /** Info santri terpilih (sumber sama dengan dialog profil). */
  const profilTerpilih = useProfilSantri(santriId);
  const detailTerpilih = profilTerpilih?.santri as SantriPenuh | undefined;

  // ----- Jenis dokumen (ref) -----
  const [jenisRows, setJenisRows] = useState<ReferensiRow[]>([]);
  useEffect(() => {
    if (jenjangs.length === 0) { setJenisRows([]); return; }
    let hidup = true;
    referensiList('jenis_dokumen_santri', jenjangs)
      .then((r) => { if (hidup) setJenisRows(r); })
      .catch(() => { if (hidup) setJenisRows([]); });
    return () => { hidup = false; };
  }, [jenjangs]);
  const opsiJenis = useMemo(
    () => jenisRows.map((r) => ({ value: String(r.nama ?? r.kode), label: String(r.nama ?? r.kode) })),
    [jenisRows],
  );
  const [jenis, setJenis] = useState('');
  const [catatan, setCatatan] = useState('');

  /** Kelas per santri (kunci: santri_id) dari riwayat belajar sesuai filter. */
  const [kelasSantri, setKelasSantri] = useState<Record<number, string>>({});
  /** Tingkat per santri (kunci: santri_id) — segmen urut mode filter. */
  const [tingkatSantri, setTingkatSantri] = useState<Record<number, string>>({});
  const muatKelasSantri = useCallback(async (): Promise<{ kelas: Record<number, string>; tingkat: Record<number, string> }> => {
    try {
      if (filterLoading || jenjangs.length === 0) return { kelas: {}, tingkat: {} };
      const p = await listRiwayatBelajar({
        jenjang: jenjangs,
        ...(sumber === 'filter'
          ? {
              tahun_ajaran: tahunAjaranNames.length ? tahunAjaranNames : undefined,
              semester: semesters.length ? semesters : undefined,
              tingkat: tingkatAktif.length ? tingkatAktif : undefined,
              kelas_id: kelasFilterIds.length ? kelasFilterIds : undefined,
            }
          : {}),
        // Bawaan backend hanya baris aktif (kosong untuk filter historis) —
        // minta semua, lalu utamakan yang aktif per santri di bawah.
        is_active_riwayat: 'semua',
        per_page: 0,
      });
      const peta: Record<number, { nama: string; tingkat: string; aktif: boolean }> = {};
      for (const r of p.data) {
        const nama = r.kelas?.nama_kelas?.trim();
        if (!nama) continue;
        const aktif = r.is_active_riwayat === 'Ya';
        if (!peta[r.santri_id] || (aktif && !peta[r.santri_id].aktif)) {
          peta[r.santri_id] = { nama, tingkat: r.tingkat?.trim() ?? '', aktif };
        }
      }
      return {
        kelas: Object.fromEntries(Object.entries(peta).map(([k, v]) => [Number(k), v.nama])),
        tingkat: Object.fromEntries(Object.entries(peta).map(([k, v]) => [Number(k), v.tingkat])),
      };
    } catch {
      return { kelas: {}, tingkat: {} };
    }
  }, [sumber, filterLoading, jenjangs, tahunAjaranNames, semesters, tingkatAktif, kelasFilterIds]);
  useEffect(() => {
    let hidup = true;
    void muatKelasSantri().then((m) => { if (hidup) { setKelasSantri(m.kelas); setTingkatSantri(m.tingkat); } });
    return () => { hidup = false; };
  }, [muatKelasSantri]);

  /** Jumlah dokumen per santri (kunci: santri_id) — satu fetch per jenjang. */
  const [jumlahSantri, setJumlahSantri] = useState<Record<number, number>>({});
  const muatJumlahSantri = useCallback(async (): Promise<Record<number, number>> => {
    try {
      if (jenjangs.length === 0) return {};
      const p = await listDokumen('santri', { jenjang: jenjangs, per_page: 0 });
      const hitung: Record<number, number> = {};
      for (const d of p.data) {
        const sid = d.santri_id;
        if (sid != null) hitung[sid] = (hitung[sid] ?? 0) + 1;
      }
      return hitung;
    } catch {
      return {};
    }
  }, [jenjangs]);
  useEffect(() => {
    let hidup = true;
    void muatJumlahSantri().then((h) => { if (hidup) setJumlahSantri(h); });
    return () => { hidup = false; };
  }, [muatJumlahSantri]);

  /** Jumlah dokumen per jenis milik santri terpilih (kunci: lowercase). */
  const [jumlahJenis, setJumlahJenis] = useState<Record<string, number>>({});
  const muatJumlahJenis = useCallback(async (sid: number): Promise<Record<string, number>> => {
    try {
      const p = await listDokumen('santri', { santri_id: sid, per_page: 1000 });
      const hitung: Record<string, number> = {};
      for (const d of p.data) {
        const kunci = (d.jenis_dokumen ?? '').trim().toLowerCase();
        if (kunci) hitung[kunci] = (hitung[kunci] ?? 0) + 1;
      }
      return hitung;
    } catch {
      return {};
    }
  }, []);
  useEffect(() => {
    if (santriId == null) { setJumlahJenis({}); return; }
    let hidup = true;
    void muatJumlahJenis(santriId).then((h) => { if (hidup) setJumlahJenis(h); });
    return () => { hidup = false; };
  }, [santriId, muatJumlahJenis]);

  // ----- Berkas: sumber byte + path asli (desktop, untuk sudah) -----
  const [sumberBerkas, setSumberBerkas] = useState<SumberBerkas | null>(null);
  const [berkasPath, setBerkasPath] = useState<string | null>(null);
  const [keluaran, setKeluaran] = useState<HasilGambar | null>(null);
  /** Pipeline viewer sibuk: Simpan dikunci agar tak menyimpan byte basi. */
  const [prosesViewer, setProsesViewer] = useState(false);
  const inputWebRef = useRef<HTMLInputElement>(null);
  const btnBrowseRef = useRef<HTMLButtonElement>(null);

  function resetBerkas() {
    setSumberBerkas(null);
    setBerkasPath(null);
    if (inputWebRef.current) inputWebRef.current.value = '';
  }

  async function terapkanPilihan(nama: string, bytes: Uint8Array, mime: string) {
    resetBerkas();
    setSumberBerkas({ bytes, mime, nama });
  }

  async function onBrowse() {
    if (desktop) {
      try {
        const b = await pilihBerkasDokumen();
        if (!b) return;
        const { readFile } = await import('@tauri-apps/plugin-fs');
        const bytes = await readFile(b.path);
        resetBerkas();
        setBerkasPath(b.path);
        setSumberBerkas({ bytes: new Uint8Array(bytes), mime: b.mime, nama: b.nama });
      } catch (e) {
        toast.error(errorMessage(e));
      }
      return;
    }
    inputWebRef.current?.click();
  }

  async function onFileWeb(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;
    const ext = ekstensiDariNama(f.name);
    if (!EKSTENSI_BOLEH.includes(ext)) {
      toast.error(`Berkas harus ${EKSTENSI_BOLEH.join('/').toUpperCase()}.`);
      e.target.value = '';
      return;
    }
    if (f.size > BATAS_BERKAS) {
      toast.error('Berkas melebihi 10 MB.');
      e.target.value = '';
      return;
    }
    try {
      const buf = await f.arrayBuffer();
      await terapkanPilihan(f.name, new Uint8Array(buf), f.type || mimeDariEkstensi(ext));
    } catch (err) {
      toast.error(errorMessage(err));
      e.target.value = '';
    }
  }

  // ----- Opsi pasca-simpan -----
  const [inputLainnya, setInputLainnya] = useState(false);
  const [pindahSudah, setPindahSudah] = useState(true);
  const [busy, setBusy] = useState(false);
  // Mode penyimpanan perangkat (diatur di Pengaturan → Server; hanya dibaca).
  const [modeDokumen, setModeDokumen] = useState<'server' | 'lokal' | 'test'>('server');
  const [folderArsip, setFolderArsip] = useState('');
  const [folderArsipTest, setFolderArsipTest] = useState('');

  const modeEfektif = desktop && modeDokumen !== 'server' ? 'lokal' : 'server';
  /** Mode test = perilaku lokal ke folder uji; folder `sudah/` tidak disentuh saat test. */
  const modeTest = desktop && modeDokumen === 'test';

  // Persistensi pilihan radio/checkbox per perangkat (pola pager/sidebar).
  const [prefSiap, setPrefSiap] = useState(false);
  useEffect(() => {
    let hidup = true;
    (async () => {
      try {
        const [s, l, u, m, f, ft] = await Promise.all([
          prefGet('simpes_tambah_dok_sumber'),
          prefGet('simpes_tambah_dok_lainnya'),
          prefGet('simpes_tambah_dok_sudah'),
          prefGet(PREF_MODE_DOKUMEN),
          prefGet(PREF_FOLDER_ARSIP),
          prefGet(PREF_FOLDER_ARSIP_TEST),
        ]);
        if (!hidup) return;
        if (s === 'filter' || s === 'buku') setSumber(s);
        if (l === '1' || l === '0') setInputLainnya(l === '1');
        if (u === '1' || u === '0') setPindahSudah(u === '1');
        // Nilai cari dari search global (TopBarSearch mengadopsi otomatis).
        if (m === 'server' || m === 'lokal' || m === 'test') setModeDokumen(m);
        if (typeof f === 'string') setFolderArsip(f);
        if (typeof ft === 'string') setFolderArsipTest(ft);
      } catch {
        /* penyimpanan terkunci: pakai bawaan */
      }
      if (hidup) setPrefSiap(true);
    })();
    return () => { hidup = false; };
  }, []);
  useEffect(() => {
    if (!prefSiap) return;
    prefSet('simpes_tambah_dok_sumber', sumber).catch(() => {});
  }, [prefSiap, sumber]);
  useEffect(() => {
    if (!prefSiap) return;
    prefSet('simpes_tambah_dok_lainnya', inputLainnya ? '1' : '0').catch(() => {});
  }, [prefSiap, inputLainnya]);
  useEffect(() => {
    if (!prefSiap) return;
    prefSet('simpes_tambah_dok_sudah', pindahSudah ? '1' : '0').catch(() => {});
  }, [prefSiap, pindahSudah]);
  /** Berkas wajib di halaman ini (baris + file-nya sekaligus). */
  const bisaSimpan = santriId != null && jenis.trim() !== '' && sumberBerkas !== null && keluaran !== null && !prosesViewer && !busy;

  async function bukaPilihLagi() {
    await onBrowse();
    if (!desktop) btnBrowseRef.current?.focus();
  }

  async function onSimpan() {
    if (!bisaSimpan || santriId == null || !sumberBerkas || !keluaran) return;
    setBusy(true);
    try {
      if (modeEfektif === 'lokal') {
        // Mode lokal/test: metadata + cadangan nama ke server, byte hanya di drive.
        const tersimpan = await simpanDokumen('santri', {
          santri_id: santriId,
          jenis_dokumen: jenis.trim(),
          ...(catatan.trim() ? { catatan: catatan.trim() } : {}),
          tujuan: modeTest ? 'test' : 'lokal',
          ekstensi: keluaran.ext,
        });
        const namaArsipBaru = tersimpan.data?.nama_file
          || namaArsip(santriTerpilih?.nama_lengkap ?? `santri-${santriId}`, jenis.trim(), catatan.trim(), keluaran.ext);
        if (desktop && berkasPath) {
          try {
            const akar = await akarArsip(
              modeTest ? folderArsipTest : folderArsip,
              modeTest ? ROOT_ARSIP_TEST : ROOT_ARSIP_DOKUMEN,
            );
            await tulisArsip(keluaran.bytes, namaArsipBaru, jenis.trim(), akar);
            let pesan = modeTest ? 'Dokumen disimpan (test).' : 'Dokumen disimpan (lokal).';
            if (pindahSudah && !modeTest) {
              await pindahKeSudah(berkasPath);
              pesan += ' File asli dipindah ke folder sudah.';
            }
            toast.success(pesan);
          } catch (e) {
            toast.success('Metadata disimpan; arsip lokal gagal.');
            toast.warning(`Arsip lokal gagal: ${errorMessage(e)}`);
          }
        } else {
          toast.success('Dokumen disimpan (lokal).');
        }
      } else {
        // Mode server: byte (hasil edisi bila ada) ke server.
        const fileUp = new File(
          [keluaran.bytes.buffer as ArrayBuffer],
          gantiEkstensi(sumberBerkas.nama, keluaran.ext),
          { type: keluaran.mime },
        );
        await simpanDokumen('santri', {
          santri_id: santriId,
          jenis_dokumen: jenis.trim(),
          ...(catatan.trim() ? { catatan: catatan.trim() } : {}),
        }, fileUp);
        if (desktop && berkasPath && pindahSudah) {
          try {
            await pindahKeSudah(berkasPath);
            toast.success('Dokumen disimpan. File asli dipindah ke folder sudah.');
          } catch (e) {
            toast.success('Dokumen disimpan.');
            toast.warning(`Pemindahan ke folder sudah gagal: ${errorMessage(e)}`);
          }
        } else {
          toast.success('Dokumen disimpan.');
        }
      }
      // Angka jenis dokumen langsung terupdate tanpa ganti santri.
      void muatJumlahJenis(santriId).then(setJumlahJenis);
      void muatJumlahSantri().then(setJumlahSantri);
      // Reset form (pilihan santri + checkbox dipertahankan).
      setJenis('');
      setCatatan('');
      resetBerkas();
      if (inputLainnya) await bukaPilihLagi();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const daftarIds = useMemo(() => santris.map((s) => s.id), [santris]);

  /** Mode filter: urut jenjang → tingkat → kelas → nama → jk. */
  const infoUrutSantri = useMemo(() => {
    const m: Record<number, InfoUrutSantri> = {};
    for (const s of santris) {
      m[s.id] = {
        jenjang: jenjangTampilSantri(s),
        tingkat: tingkatSantri[s.id] ?? '',
        kelas: kelasSantri[s.id] ?? '',
      };
    }
    return m;
  }, [santris, tingkatSantri, kelasSantri]);
  const santriTampil = useMemo(
    () => (sumber === 'filter' ? urutSantriFilter(santris, infoUrutSantri) : santris),
    [sumber, santris, infoUrutSantri],
  );

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <TopBarSearch value={cari} onChange={setCari} placeholder="Cari santri…" />
      <PengaturanHalaman tampil={sumber === 'filter' ? { tahun_ajaran: true, semester: true, tingkat: true, kelas: true } : {}} />
      <ResizablePanelGroup orientation="horizontal" id="grup_tambah_dokumen" className="min-h-0 flex-1 overflow-hidden">
        {/* Kolom 1: form (400px, bisa digeser). */}
        <ResizablePanel defaultSize={400} minSize={300} maxSize="70%" id="panel_tambah_dokumen_form" className="min-h-0">
          <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto rounded-xl border bg-card p-4">
          <div className="flex min-h-0 flex-1 flex-col gap-1.5">
            <FieldLabel id="label_sumber_santri">Daftar santri</FieldLabel>
            <div id="radio_sumber_santri" role="radiogroup" aria-labelledby="label_sumber_santri" className="flex flex-wrap gap-2">
              {([
                ['filter', 'Filter Santri'],
                ['buku', 'Buku Induk'],
              ] as const).map(([nilai, label]) => (
                <label
                  key={nilai}
                  htmlFor={`radio_sumber_${nilai}`}
                  className="inline-flex h-6 cursor-pointer items-center gap-2 rounded-full border bg-card px-3 py-0 text-xs has-checked:border-primary has-checked:bg-accent has-checked:font-semibold"
                >
                  <input
                    type="radio"
                    id={`radio_sumber_${nilai}`}
                    name="sumber_santri"
                    value={nilai}
                    checked={sumber === nilai}
                    onChange={() => { setSumber(nilai); setSantriId(null); }}
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="min-h-[120px] flex-1 overflow-y-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr className="text-left">
                    <th className="px-2 py-1 font-medium">Nama</th>
                    <th className="px-2 py-1 font-medium">Kelas</th>
                    <th className="px-2 py-1 font-medium">Dok</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingSantri ? (
                    <tr><td colSpan={3} className="px-2 py-1 text-center text-muted-foreground">Memuat…</td></tr>
                  ) : santriTampil.length === 0 ? (
                    <tr><td colSpan={3} className="px-2 py-1 text-center text-muted-foreground">{sumber === 'filter' ? 'Tidak ada santri pada filter ini.' : 'Tidak ada santri.'}</td></tr>
                  ) : santriTampil.map((s) => {
                    const aktif = s.id === santriId;
                    const n = jumlahSantri[s.id] ?? 0;
                    return (
                      <tr
                        key={s.id}
                        onClick={() => setSantriId(s.id)}
                        onContextMenu={(e) => { e.preventDefault(); setProfilId(s.id); }}
                        title="Klik untuk memilih, klik kanan untuk profil"
                        aria-selected={aktif}
                        className={cn(
                          'cursor-pointer border-t',
                          aktif ? 'bg-accent font-medium' : 'hover:bg-muted/60',
                        )}
                      >
                        <td className="px-2 py-1">
                          {s.nama_lengkap}
                          {s.is_active_pst !== 'Ya' && <Badge variant="destructive" className="ml-1 py-0 align-middle text-[9px] leading-3">Nonaktif</Badge>}
                        </td>
                        <td className="px-2 py-1 text-muted-foreground">{kelasSantri[s.id] ?? '—'}</td>
                        <td className="px-2 py-1"><Badge variant={n > 0 ? 'secondary' : 'outline'} className="py-0 leading-4">{n}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div id="info_santri_terpilih" className="min-h-[86px] rounded-md border bg-muted/40 px-2.5 py-2 text-xs">
              {santriTerpilih ? (
                <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                  <dt className="text-muted-foreground">ID</dt>
                  <dd>{santriTerpilih.id}</dd>
                  <dt className="text-muted-foreground">Nama</dt>
                  <dd className="font-medium">{santriTerpilih.nama_lengkap}</dd>
                  <dt className="text-muted-foreground">Ayah</dt>
                  <dd>{detailTerpilih ? (detailTerpilih.ayah_nama || '—') : '…'}</dd>
                  <dt className="text-muted-foreground">Ibu</dt>
                  <dd>{detailTerpilih ? (detailTerpilih.ibu_nama || '—') : '…'}</dd>
                </dl>
              ) : (
                <p className="text-muted-foreground">Pilih santri di tabel untuk melihat info.</p>
              )}
            </div>
          </div>
          <Separator />
          <div className="grid gap-1.5">
            <FieldLabel id="label_jenis_tambah_dokumen">Jenis Dokumen</FieldLabel>
            {opsiJenis.length === 0 ? (
              <p className="text-xs text-muted-foreground">Belum ada jenis dokumen di referensi.</p>
            ) : (
              <div id="list_jenis_tambah_dokumen" role="listbox" aria-labelledby="label_jenis_tambah_dokumen" className="rounded-md border">
                {opsiJenis.map((o) => {
                  const jumlah = jumlahJenis[o.value.trim().toLowerCase()] ?? 0;
                  const aktif = jenis === o.value;
                  return (
                    <Tooltip key={o.value}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          role="option"
                          aria-selected={aktif}
                          onClick={() => setJenis(o.value)}
                          className={cn(
                            'flex w-full cursor-pointer items-center gap-2 px-2.5 py-1 text-left text-xs',
                            aktif ? 'bg-accent font-medium' : 'hover:bg-muted/60',
                          )}
                        >
                          <Check size={12} className={cn('shrink-0', aktif ? 'opacity-100' : 'opacity-0')} />
                          <span className="min-w-0 flex-1 truncate">{o.label}</span>
                          <Badge variant={jumlah > 0 ? 'secondary' : 'outline'} className="py-0 text-[10px] leading-3">{jumlah}</Badge>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{santriTerpilih ? `${jumlah} dokumen ${o.label} milik ${santriTerpilih.nama_lengkap}` : o.label}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <FieldLabel htmlFor="input_catatan_tambah_dokumen" className="shrink-0">Catatan</FieldLabel>
            <Input
              id="input_catatan_tambah_dokumen"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="opsional"
              className="min-w-0 flex-1"
            />
          </div>
          <div id="box_browse_tambah_dokumen" className="grid gap-1.5 rounded-md border border-dashed bg-muted/40 p-2.5">
            <div className="flex items-center gap-2">
              <TombolIkon tip="Pilih berkas" ref={btnBrowseRef} variant="outline" size="icon" onClick={() => void onBrowse()}>
                <FolderOpen size={14} />
              </TombolIkon>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={sumberBerkas?.nama}>
                {sumberBerkas ? `${sumberBerkas.nama} (${formatUkuran(sumberBerkas.bytes.length)})` : 'Belum ada berkas dipilih.'}
              </span>
              {sumberBerkas && (
                <TombolIkon tip="Hapus pilihan berkas" variant="ghost" size="icon" onClick={resetBerkas}>
                  <X size={14} />
                </TombolIkon>
              )}
            </div>
            <input
              ref={inputWebRef}
              id="input_berkas_web_tambah_dokumen"
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              className="hidden"
              onChange={onFileWeb}
            />
          </div>
          <div className="flex justify-end gap-2">
            <span className="mr-auto self-center text-xs text-muted-foreground">
              Mode: {modeTest ? 'Test (folder uji)' : (modeEfektif === 'lokal' ? 'Lokal (berkas di drive perangkat ini)' : 'Server')}
            </span>
            <TombolIkon tip="Batal" variant="outline" size="icon" onClick={() => navigate('/dokumen-santri')}>
              <X size={14} />
            </TombolIkon>
            <TombolIkon tip="Simpan" id="btn_simpan_tambah_dokumen" size="icon" disabled={!bisaSimpan} onClick={() => void onSimpan()}>
              <Save size={14} />
            </TombolIkon>
          </div>
          <Separator />
          <div className="flex flex-row flex-wrap items-center gap-x-4 gap-y-2">
            <label htmlFor="check_dok_lainnya" className="inline-flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox
                id="check_dok_lainnya"
                className="size-3.5"
                checked={inputLainnya}
                onCheckedChange={(v) => setInputLainnya(v === true)}
              />
              input dokumen lainnya
            </label>
            <label
              htmlFor="check_pindah_sudah"
              title={modeTest ? 'Nonaktif dalam mode test' : (desktop ? 'Pindahkan file asli ke folder sudah setelah simpan' : 'Hanya tersedia di aplikasi desktop')}
              className={cn('inline-flex items-center gap-2 text-xs', (!desktop || modeTest) && 'cursor-not-allowed opacity-50')}
            >
              <Checkbox
                id="check_pindah_sudah"
                className="size-3.5"
                checked={desktop && pindahSudah && !modeTest}
                disabled={!desktop || modeTest}
                onCheckedChange={(v) => setPindahSudah(v === true)}
              />
                Pindah ke SUDAH
            </label>
          </div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle orientation="horizontal" id="gagang_tambah_dokumen" aria-label="Atur lebar kolom form dan pratinjau" />
        {/* Kolom 2: viewer (sisa). */}
        <ResizablePanel minSize="25%" id="panel_tambah_dokumen_pratinjau" className="min-h-0 min-w-0">
          <PenampilBerkas sumber={sumberBerkas} kualitas="asli" onKeluaran={setKeluaran} onProses={setProsesViewer} idPrefix="tambah_dokumen" />
        </ResizablePanel>
      </ResizablePanelGroup>
      <ProfilSantriDialog
        target={profilId != null ? { id: profilId, daftar: daftarIds } : null}
        onGanti={(id) => setProfilId(id)}
        onOpenChange={(o) => { if (!o) setProfilId(null); }}
      />
    </div>
  );
}
