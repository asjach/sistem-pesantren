import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage, isTauri } from '../api/client';
import { listSantri, type Santri } from '../api/santri';
import { listKelas, referensiList, type Kelas, type ReferensiRow } from '../api/master';
import { simpanDokumen } from '../api/dokumen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import { Checkbox } from '@/components/ui/checkbox';
import ComboCari from '@/components/ComboCari';
import Pager from '@/components/Pager';
import { usePager } from '@/hooks/usePager';
import { useFilterGlobalAktif } from '@/hooks/useFilterGlobalAktif';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import { TopBarSearch } from '@/components/TopBarSearch';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { useAksiProfilSantri } from '@/components/santri/useAksiProfilSantri';
import { cn } from '@/lib/utils';
import {
  BATAS_BERKAS,
  EKSTENSI_BOLEH,
  bacaBerkasUntukUnggah,
  ekstensiDariNama,
  formatUkuran,
  mimeDariEkstensi,
  namaArsip,
  pilihBerkasDokumen,
  pindahKeSudah,
  salinKeArsip,
} from '@/lib/arsipDokumen';
import { toast } from 'sonner';

/** Keanggotaan aktif (untuk NIS & jenjang tampil) atau baris pertama. */
function anggotaTampil(s: Santri) {
  const aktif = s.lembaga_aktif?.find((l) => l.is_active_lembaga === 'Ya');
  return aktif ?? s.lembaga_aktif?.[0] ?? null;
}

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
    tingkat: tingkatAktif,
    kelas: kelasAktif,
    loading: filterLoading,
  } = useFilterGlobalAktif();
  const { aksiProfil, dialogProfil } = useAksiProfilSantri();

  // ----- Daftar santri (kolom 1, atas) -----
  const [cari, setCari] = useState('');
  const [cariTunda, setCariTunda] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setCariTunda(cari), 350);
    return () => clearTimeout(t);
  }, [cari]);

  /** Opsi kelas untuk memetakan nama filter global → id param server. */
  const [kelasOpsi, setKelasOpsi] = useState<Kelas[]>([]);
  useEffect(() => {
    if (filterLoading || jenjangs.length === 0) { setKelasOpsi([]); return; }
    let hidup = true;
    listKelas({ jenjang: jenjangs, tahun_ajaran: tahunAjaranNames, per_page: 1000 })
      .then((p) => { if (hidup) setKelasOpsi(p.data); })
      .catch(() => { if (hidup) setKelasOpsi([]); });
    return () => { hidup = false; };
  }, [filterLoading, jenjangs, tahunAjaranNames]);
  const kelasFilterIds = useMemo(
    () => kelasOpsi.filter((k) => kelasAktif.includes(k.nama_kelas)).map((k) => k.id),
    [kelasOpsi, kelasAktif],
  );

  const [santris, setSantris] = useState<Santri[]>([]);
  const [loadingSantri, setLoadingSantri] = useState(false);
  const [err, setErr] = useState('');
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pager = usePager('tambah_dokumen_santri');
  const muatSantri = useCallback(async (halaman: number, perPage: number, signal?: AbortSignal) => {
    if (!pager.ready || filterLoading || jenjangs.length === 0) { setSantris([]); return; }
    setLoadingSantri(true);
    setErr('');
    try {
      const res = await listSantri({
        jenjang: jenjangs,
        tingkat: tingkatAktif.length ? tingkatAktif : undefined,
        kelas_id: kelasFilterIds.length ? kelasFilterIds : undefined,
        q: cariTunda || undefined,
        page: halaman,
        per_page: perPage,
        signal,
      });
      setSantris(res.data);
      setTotal(res.total);
      setLastPage(res.last_page);
      pager.sync(res.current_page, res.last_page);
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') setErr(errorMessage(e));
    } finally {
      setLoadingSantri(false);
    }
  }, [pager, filterLoading, jenjangs, tingkatAktif, kelasFilterIds, cariTunda]);

  useEffect(() => {
    if (!pager.ready) return;
    const c = new AbortController();
    pager.goFirst();
    void muatSantri(1, pager.perPage, c.signal);
    return () => c.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pager.ready, filterLoading, jenjangs, tingkatAktif, kelasFilterIds, cariTunda]);

  const [santriId, setSantriId] = useState<number | null>(null);
  const santriTerpilih = useMemo(
    () => santris.find((s) => s.id === santriId) ?? null,
    [santris, santriId],
  );

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

  // ----- Berkas: path lokal (desktop) atau File (browser) -----
  const [berkasPath, setBerkasPath] = useState<string | null>(null);
  const [berkasWeb, setBerkasWeb] = useState<File | null>(null);
  const [berkasNama, setBerkasNama] = useState('');
  const [berkasUkuran, setBerkasUkuran] = useState(0);
  const [berkasMime, setBerkasMime] = useState('');
  const inputWebRef = useRef<HTMLInputElement>(null);
  const btnBrowseRef = useRef<HTMLButtonElement>(null);

  const [pratinjau, setPratinjau] = useState<string | null>(null);
  useEffect(() => {
    let hidup = true;
    let url: string | null = null;
    (async () => {
      if (berkasPath && desktop) {
        const { convertFileSrc } = await import('@tauri-apps/api/core');
        if (hidup) setPratinjau(convertFileSrc(berkasPath));
      } else if (berkasWeb) {
        url = URL.createObjectURL(berkasWeb);
        if (hidup) setPratinjau(url);
        else URL.revokeObjectURL(url);
      } else if (hidup) {
        setPratinjau(null);
      }
    })();
    return () => {
      hidup = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [berkasPath, berkasWeb, desktop]);

  function resetBerkas() {
    setBerkasPath(null);
    setBerkasWeb(null);
    setBerkasNama('');
    setBerkasUkuran(0);
    setBerkasMime('');
    if (inputWebRef.current) inputWebRef.current.value = '';
  }

  async function onBrowse() {
    if (desktop) {
      try {
        const b = await pilihBerkasDokumen();
        if (!b) return;
        resetBerkas();
        setBerkasPath(b.path);
        setBerkasNama(b.nama);
        setBerkasUkuran(b.ukuran);
        setBerkasMime(b.mime);
      } catch (e) {
        toast.error(errorMessage(e));
      }
      return;
    }
    inputWebRef.current?.click();
  }

  function onFileWeb(e: React.ChangeEvent<HTMLInputElement>) {
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
    resetBerkas();
    setBerkasWeb(f);
    setBerkasNama(f.name);
    setBerkasUkuran(f.size);
    setBerkasMime(f.type || mimeDariEkstensi(ext));
  }

  // ----- Opsi pasca-simpan -----
  const [inputLainnya, setInputLainnya] = useState(false);
  const [pindahSudah, setPindahSudah] = useState(true);

  const [busy, setBusy] = useState(false);
  const bisaSimpan = santriId != null && jenis.trim() !== '' && !busy;

  async function bukaPilihLagi() {
    if (desktop) {
      try {
        const b = await pilihBerkasDokumen();
        if (!b) return;
        resetBerkas();
        setBerkasPath(b.path);
        setBerkasNama(b.nama);
        setBerkasUkuran(b.ukuran);
        setBerkasMime(b.mime);
      } catch (e) {
        toast.error(errorMessage(e));
      }
      return;
    }
    // Browser dapat memblokir dialog terprogram: coba buka, fallback fokus.
    inputWebRef.current?.click();
    btnBrowseRef.current?.focus();
  }

  async function onSimpan() {
    if (!bisaSimpan || santriId == null) return;
    setBusy(true);
    try {
      let fileUp: File | undefined;
      if (berkasPath && desktop) {
        fileUp = await bacaBerkasUntukUnggah({
          path: berkasPath, nama: berkasNama, ukuran: berkasUkuran, mime: berkasMime,
        });
      } else if (berkasWeb) {
        fileUp = berkasWeb;
      }
      await simpanDokumen('santri', {
        santri_id: santriId,
        jenis_dokumen: jenis.trim(),
        ...(catatan.trim() ? { catatan: catatan.trim() } : {}),
      }, fileUp);
      // Arsip lokal (desktop + ada berkas): salin selalu, pindah bila dicentang.
      if (desktop && berkasPath) {
        try {
          const namaFileArsip = namaArsip(
            santriTerpilih?.nama_lengkap ?? `santri-${santriId}`,
            jenis.trim(),
            catatan.trim(),
            ekstensiDariNama(berkasNama),
          );
          await salinKeArsip(berkasPath, namaFileArsip, jenis.trim());
          let pesan = 'Dokumen disimpan dan disalin ke arsip.';
          if (pindahSudah) {
            await pindahKeSudah(berkasPath);
            pesan += ' File asli dipindah ke folder sudah.';
          }
          toast.success(pesan);
        } catch (e) {
          toast.success('Dokumen disimpan.');
          toast.warning(`Arsip lokal gagal: ${errorMessage(e)}`);
        }
      } else {
        toast.success('Dokumen disimpan.');
      }
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

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <TopBarSearch value={cari} onChange={setCari} placeholder="Cari santri…" />
      <PengaturanHalaman tampil={{ tingkat: true, kelas: true }} />
      {!desktop && (
        <p className="rounded-lg border bg-card px-4 py-2 text-xs text-muted-foreground">
          Arsip file lokal (salin arsip + folder sudah) hanya tersedia di aplikasi desktop.
        </p>
      )}
      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
        {/* Kolom 1: form (400px). */}
        <section className="flex min-h-0 w-[400px] shrink-0 flex-col gap-3 overflow-y-auto rounded-xl border bg-card p-4">
          <div className="grid gap-1.5">
            <FieldLabel>Daftar santri</FieldLabel>
            <div className="max-h-56 overflow-y-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr className="text-left">
                    <th className="px-2 py-1.5 font-medium">Nama</th>
                    <th className="px-2 py-1.5 font-medium">NIS</th>
                    <th className="px-2 py-1.5 font-medium">Jenjang</th>
                    <th className="w-8 px-1 py-1.5"><span className="sr-only">Aksi</span></th>
                  </tr>
                </thead>
                <tbody>
                  {loadingSantri ? (
                    <tr><td colSpan={4} className="px-2 py-3 text-center text-muted-foreground">Memuat…</td></tr>
                  ) : santris.length === 0 ? (
                    <tr><td colSpan={4} className="px-2 py-3 text-center text-muted-foreground">Tidak ada santri pada filter ini.</td></tr>
                  ) : santris.map((s) => {
                    const a = anggotaTampil(s);
                    const aktif = s.id === santriId;
                    return (
                      <tr
                        key={s.id}
                        onClick={() => setSantriId(s.id)}
                        aria-selected={aktif}
                        className={cn(
                          'cursor-pointer border-t',
                          aktif ? 'bg-accent font-medium' : 'hover:bg-muted/60',
                        )}
                      >
                        <td className="px-2 py-1.5">{s.nama_lengkap}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{a?.nis_lokal ?? '—'}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{a?.jenjang ?? '—'}</td>
                        <td className="px-1 py-1" onClick={(e) => e.stopPropagation()}>
                          {aksiProfil(s.id, { prefix: 'tambah_dok', daftar: daftarIds })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pager
              page={pager.page}
              lastPage={lastPage}
              total={total}
              perPage={pager.perPage}
              onPage={(p) => { pager.setPage(p); void muatSantri(p, pager.perPage); }}
              onPerPage={(pp) => { pager.setPerPage(pp); void muatSantri(1, pp); }}
            />
          </div>
          <div className="grid gap-1.5">
            <FieldLabel htmlFor="combo_jenis_tambah_dokumen">Jenis Dokumen</FieldLabel>
            <ComboCari
              id="combo_jenis_tambah_dokumen"
              value={jenis}
              onChange={setJenis}
              options={opsiJenis}
              placeholder="Pilih jenis dokumen…"
              className="w-full"
            />
          </div>
          <div className="grid gap-1.5">
            <FieldLabel>Berkas (JPG/PNG/PDF, maks 10 MB, opsional)</FieldLabel>
            <div className="flex items-center gap-2">
              <Button ref={btnBrowseRef} variant="outline" onClick={() => void onBrowse()}>
                Browse…
              </Button>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={berkasNama}>
                {berkasNama ? `${berkasNama} (${formatUkuran(berkasUkuran)})` : 'Belum ada berkas dipilih.'}
              </span>
              {berkasNama && (
                <Button variant="ghost" size="sm" onClick={resetBerkas} title="Hapus pilihan berkas">
                  Hapus
                </Button>
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
          <div className="grid gap-1.5">
            <FieldLabel htmlFor="input_catatan_tambah_dokumen">Catatan (opsional)</FieldLabel>
            <Input
              id="input_catatan_tambah_dokumen"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="check_dok_lainnya" className="inline-flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                id="check_dok_lainnya"
                checked={inputLainnya}
                onCheckedChange={(v) => setInputLainnya(v === true)}
              />
              input dokumen lainnya
            </label>
            <label
              htmlFor="check_pindah_sudah"
              title={desktop ? 'Pindahkan file asli ke folder sudah setelah simpan' : 'Hanya tersedia di aplikasi desktop'}
              className={cn('inline-flex items-center gap-2 text-sm', !desktop && 'cursor-not-allowed opacity-50')}
            >
              <Checkbox
                id="check_pindah_sudah"
                checked={desktop && pindahSudah}
                disabled={!desktop}
                onCheckedChange={(v) => setPindahSudah(v === true)}
              />
              Pindahkan ke folder SUDAH
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => navigate('/dokumen-santri')}>
              Batal
            </Button>
            <Button id="btn_simpan_tambah_dokumen" disabled={!bisaSimpan} onClick={() => void onSimpan()}>
              Simpan
            </Button>
          </div>
        </section>
        {/* Kolom 2: viewer (sisa). */}
        <section aria-label="Pratinjau berkas" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
          {!pratinjau ? (
            <p className="m-auto px-6 text-center text-sm text-muted-foreground">
              Belum ada berkas dipilih — pilih lewat Browse untuk melihat pratinjau di sini.
            </p>
          ) : berkasMime.startsWith('image/') ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <img src={pratinjau} alt="" className="m-auto max-h-full max-w-full object-contain p-2" />
          ) : (
            <iframe title="Pratinjau PDF" src={pratinjau} className="min-h-0 flex-1" />
          )}
        </section>
      </div>
      {dialogProfil}
    </div>
  );
}
