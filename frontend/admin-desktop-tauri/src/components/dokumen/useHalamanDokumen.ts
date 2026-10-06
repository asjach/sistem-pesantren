import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import { ambilBerkas, errorMessage, isTauri, prefGet } from '@/api/client';
import type { LokasiArsip } from '@/lib/arsipDokumen';
import {
  hapusDokumen,
  listDokumen,
  ubahDokumen,
  unduhBerkasDokumen,
  unggahBerkasDokumen,
  type DokumenRow,
  type TipeDokumen,
} from '@/api/dokumen';
import { referensiList, type ReferensiRow } from '@/api/master';
import {
  BATAS_BERKAS,
  EKSTENSI_PILIH,
  ekstensiDariNama,
  mimeDariEkstensi,
  pilihBerkasDokumen,
} from '@/lib/arsipDokumen';
import { siapkanFileUntukServer } from '@/lib/konversiHeic';
import { gantiEkstensi, type HasilGambar } from '@/lib/olahGambar';
import type { SumberBerkas } from '@/components/dokumen/PenampilBerkas';

/** Entitas pemilik dokumen yang memakai halaman ini (lembaga belum). */
export type EntitasDokumen = Extract<TipeDokumen, 'santri' | 'pegawai'>;

export interface OpsiHalamanDokumen {
  /** Pemilik dokumen: menentukan endpoint API, tipe arsip, & referensi jenis. */
  entitas: EntitasDokumen;
  /** Subjek terpilih (santri/pegawai); null = belum ada. */
  subjekId: number | null;
  /** Segarkan peta jumlah dokumen per subjek di halaman (badge "Dok"). */
  segarkanJumlah: () => void;
  /** Daftar jenjang aktif (opsi Lembaga santri + cakupan referensi jenis). */
  jenjangs: readonly string[];
  /** Filter global masih dimuat — gerbang muat referensi jenis pegawai. */
  filterLoading: boolean;
  /** Izin ubah pengguna → menggerbangi editor info dokumen. */
  bolehUbah: boolean;
}

/** SEMUA logika halaman "Dokumen Santri/Pegawai": daftar dokumen subjek
 *  terpilih, pratinjau, unduh/ganti/hapus, sinkron cermin, dan editor info.
 *  Perbedaan entitas (endpoint API, tipe arsip, referensi jenis, medan
 *  Lembaga santri) ditangani lewat parameter `entitas` supaya kedua halaman
 *  berbagi satu jalur kode. */
export function useHalamanDokumen({
  entitas,
  subjekId,
  segarkanJumlah,
  jenjangs,
  filterLoading,
  bolehUbah,
}: OpsiHalamanDokumen) {
  const desktop = isTauri();

  // ----- Daftar dokumen milik subjek terpilih (kolom 1, baris 2) -----
  const [dokumens, setDokumens] = useState<DokumenRow[]>([]);
  const [loadingDok, setLoadingDok] = useState(false);
  /** Salinan arsip yang benar-benar ada di perangkat ini (kunci: id dokumen). */
  const [arsipAda, setArsipAda] = useState<Record<number, boolean>>({});
  const [hapusRow, setHapusRow] = useState<DokumenRow | null>(null);
  const [sinkronTerbuka, setSinkronTerbuka] = useState(false);
  const [tambahTerbuka, setTambahTerbuka] = useState(false);
  const [busy, setBusy] = useState(false);

  // ----- Pratinjau (kolom 2, baca-saja) -----
  const [dokId, setDokId] = useState<number | null>(null);
  const [pratinjau, setPratinjau] = useState<SumberBerkas | null>(null);

  // ----- Editor info dokumen (jenis/lembaga/catatan memicu selaras nama
  //  berkas; status/nama/lokasi edit data langsung) -----
  const [editJenis, setEditJenis] = useState('');
  const [editLembaga, setEditLembaga] = useState('');
  const [editCatatan, setEditCatatan] = useState('');
  const [editAktif, setEditAktif] = useState('Ya');
  const [editNama, setEditNama] = useState('');
  const [editLokasi, setEditLokasi] = useState('server');

  /** Opsi jenis dari referensi (sama dengan halaman Tambah). */
  const [jenisRows, setJenisRows] = useState<ReferensiRow[]>([]);

  // ----- Ganti berkas -----
  const [gantiRow, setGantiRow] = useState<DokumenRow | null>(null);
  const [gantiFile, setGantiFile] = useState<File | null>(null);
  const inputGantiWebRef = useRef<HTMLInputElement>(null);

  // ----- Keluaran viewer (hasil putar/crop/resize/editor) + status kotor -----
  const [keluaran, setKeluaran] = useState<HasilGambar | null>(null);
  const [kotor, setKotor] = useState(false);
  /** Pipeline viewer sibuk: Simpan dikunci agar tak mengunggah byte basi. */
  const [prosesViewer, setProsesViewer] = useState(false);
  /** Kunci remount viewer (Buang perubahan mengembalikan tampilan asli). */
  const [kunciViewer, setKunciViewer] = useState(0);

  /** Ambil satu baris dokumen segar dari server (dasar menyegarkan pratinjau). */
  const barisSegar = useCallback(async (subjek: number, cariId: number): Promise<DokumenRow | null> => {
    const p = await listDokumen(entitas, entitas === 'santri'
      ? { santri_id: subjek, per_page: 0 }
      : { pegawai_id: subjek, per_page: 0 });
    return p.data.find((d) => d.id === cariId) ?? null;
  }, [entitas]);

  const muatDokumen = useCallback(async (id: number, signal?: AbortSignal) => {
    setLoadingDok(true);
    try {
      const p = await listDokumen(entitas, entitas === 'santri'
        ? { santri_id: id, per_page: 0, signal }
        : { pegawai_id: id, per_page: 0, signal });
      if (signal?.aborted) return;
      setDokumens(p.data);
      // Petakan keberadaan salinan arsip (desktop saja, baris lokal/test) —
      // dasar mengaktifkan/mematikan aksi Ubah.
      if (!isTauri()) { setArsipAda({}); return; }
      const perlu = p.data.filter((d) => (d.penyimpanan ?? 'server') !== 'server' && d.nama_file);
      if (perlu.length === 0) { setArsipAda({}); return; }
      try {
        const { cariLokal } = await import('@/lib/arsipDokumen');
        const peta: Record<number, boolean> = {};
        for (const d of perlu) {
          peta[d.id] = d.nama_file
            ? (await cariLokal(d.nama_file, d.jenis_dokumen, entitas, d.penyimpanan ?? 'server')) !== null
            : false;
        }
        if (!signal?.aborted) setArsipAda(peta);
      } catch {
        if (!signal?.aborted) setArsipAda({});
      }
    } catch (e) {
      if (signal?.aborted) return;
      toast.error(errorMessage(e));
      setDokumens([]);
    } finally {
      setLoadingDok(false);
    }
  }, [entitas]);

  useEffect(() => {
    setDokId(null);
    setPratinjau(null);
    if (subjekId == null) { setDokumens([]); return; }
    const c = new AbortController();
    void muatDokumen(subjekId, c.signal);
    return () => c.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjekId, muatDokumen]);

  /** Ambil byte untuk pratinjau: arsip perangkat bila lokal/test, bila tidak dari server. */
  const muatPratinjau = useCallback(async (r: DokumenRow) => {
    setDokId(r.id);
    setPratinjau(null);
    try {
      const nama = r.nama_file ?? `dokumen-${r.id}`;
      const ext = ekstensiDariNama(nama);
      const mime = mimeDariEkstensi(ext);
      const lokasi = r.penyimpanan ?? 'server';
      if (lokasi !== 'server' && desktop && r.nama_file) {
        const { cariLokal } = await import('@/lib/arsipDokumen');
        const ketemu = await cariLokal(r.nama_file, r.jenis_dokumen, entitas, lokasi);
        if (ketemu) {
          setPratinjau({ bytes: ketemu.bytes, mime, nama });
          return;
        }
        // Cermin: salinan server selalu ada — jatuh ke unduh di bawah.
        if (lokasi !== 'cermin') {
          toast.error('Berkas tidak ada di arsip perangkat ini — hanya tersimpan di perangkat asal.');
          return;
        }
      }
      if ((lokasi === 'lokal' || lokasi === 'test') && !desktop) {
        toast.error('Berkas tersimpan di arsip perangkat, bukan di server. Buka lewat aplikasi desktop.');
        return;
      }
      const buf = await ambilBerkas(`/admin/dokumen/${entitas}/${r.id}/unduh`);
      setPratinjau({ bytes: new Uint8Array(buf), mime, nama });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [desktop, entitas]);

  /** Unduh menurut kolom penyimpanan: server langsung; lokal/test via
   *  dialog simpan native dari arsip perangkat (desktop). Tanpa tebak-tebakan. */
  const unduhCerdas = useCallback(async (r: DokumenRow) => {
    const lokasi = r.penyimpanan ?? 'server';
    if (lokasi === 'server' || !isTauri() || !r.nama_file) {
      await unduhBerkasDokumen(entitas, r.id, r.nama_file ?? 'dokumen').catch((e) => toast.error(errorMessage(e)));
      return;
    }
    try {
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { cariLokal } = await import('@/lib/arsipDokumen');
      const ketemu = await cariLokal(r.nama_file, r.jenis_dokumen, entitas, lokasi);
      if (!ketemu && lokasi !== 'cermin') {
        toast.error('Berkas tidak ada di arsip perangkat ini — hanya tersimpan di perangkat asal.');
        return;
      }
      // Cermin tanpa salinan lokal: salinan server selalu ada.
      const bytes = ketemu?.bytes ?? new Uint8Array(await ambilBerkas(`/admin/dokumen/${entitas}/${r.id}/unduh`));
      const tujuan = await save({
        defaultPath: r.nama_file,
        filters: [{ name: 'Dokumen', extensions: ['jpg', 'jpeg', 'png', 'pdf'] }],
      });
      if (!tujuan) return;
      await writeFile(tujuan, bytes);
      toast.success(`Tersimpan: ${String(tujuan).split('/').pop() ?? r.nama_file}`);
    } catch (e) {
      toast.warning(`Arsip lokal gagal dibaca: ${errorMessage(e)}`);
    }
  }, [entitas]);

  /** Aksi butuh desktop bila byte hanya ada di arsip perangkat tapi dibuka dari web. */
  const perluDesktop = useCallback(
    (r: DokumenRow) => !isTauri() && ((r.penyimpanan ?? 'server') === 'lokal' || (r.penyimpanan ?? 'server') === 'test'),
    [],
  );

  /** Bersihkan salinan arsip lokal (desktop, best-effort, diam bila tak ada). */
  const bersihkanArsip = useCallback(async (nama: string | null, jenis: string, lokasi: LokasiArsip) => {
    if (!isTauri() || !nama) return;
    try {
      const { PREF_FOLDER_ARSIP, PREF_FOLDER_ARSIP_TEST, ROOT_ARSIP_DOKUMEN, ROOT_ARSIP_TEST, akarArsip, hapusArsip } = await import('@/lib/arsipDokumen');
      const [r1, r2] = await Promise.all([
        prefGet(PREF_FOLDER_ARSIP).catch(() => null),
        prefGet(PREF_FOLDER_ARSIP_TEST).catch(() => null),
      ]);
      const akars = await Promise.all([
        akarArsip(typeof r1 === 'string' ? r1 : '', ROOT_ARSIP_DOKUMEN),
        akarArsip(typeof r2 === 'string' ? r2 : '', ROOT_ARSIP_TEST),
      ]);
      for (const akar of akars) {
        await hapusArsip(nama, jenis, akar, entitas, lokasi);
      }
    } catch (e) {
      toast.warning(`Arsip lokal gagal dibersihkan: ${errorMessage(e)}`);
    }
  }, [entitas]);

  const onHapus = useCallback(async () => {
    if (!hapusRow) return;
    setBusy(true);
    try {
      const nama = hapusRow.nama_file;
      const jenis = hapusRow.jenis_dokumen;
      const idHapus = hapusRow.id;
      await hapusDokumen(entitas, hapusRow.id);
      toast.success('Dokumen dihapus.');
      await bersihkanArsip(nama, jenis, (hapusRow.penyimpanan ?? 'server') === 'test' ? 'test' : 'lokal');
      setHapusRow(null);
      if (dokId === idHapus) { setDokId(null); setPratinjau(null); }
      if (subjekId != null) {
        await muatDokumen(subjekId);
        segarkanJumlah();
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [entitas, hapusRow, dokId, subjekId, muatDokumen, segarkanJumlah, bersihkanArsip]);

  /** Baris dokumen subjek terpilih (untuk dialog sinkron). */
  const ambilBarisSubjek = useCallback(async (): Promise<DokumenRow[]> => {
    if (subjekId == null) return [];
    const p = await listDokumen(entitas, entitas === 'santri'
      ? { santri_id: subjekId, per_page: 0 }
      : { pegawai_id: subjekId, per_page: 0 });
    return p.data;
  }, [entitas, subjekId]);

  const segarkanSetelahSinkron = useCallback(async () => {
    segarkanJumlah();
    if (subjekId == null) return;
    await muatDokumen(subjekId);
    if (dokId != null) {
      const baru = await barisSegar(subjekId, dokId);
      if (baru) void muatPratinjau(baru);
    }
  }, [barisSegar, subjekId, dokId, muatDokumen, muatPratinjau, segarkanJumlah]);

  /** Ubah aktif hanya bila nama berkas bisa ikut selaras: baris Server
   *  (backend yang memindah) atau arsipnya ada di perangkat ini (desktop
   *  yang memindah). Selain itu aksi dimatikan agar DB tak beda dari fisik. */
  const bisaSelaras = useCallback((r: DokumenRow) => {
    if ((r.penyimpanan ?? 'server') === 'server') return true;
    return desktop && arsipAda[r.id] === true;
  }, [desktop, arsipAda]);
  const judulSelaras = useCallback((r: DokumenRow) => {
    if ((r.penyimpanan ?? 'server') === 'server') return 'Ubah jenis/catatan — nama berkas ikut diselaraskan';
    if (!desktop) return 'Baris arsip perangkat hanya bisa diubah lewat aplikasi desktop';
    return arsipAda[r.id] === true
      ? 'Ubah jenis/catatan — salinan arsip ikut dipindah'
      : 'Salinan arsip tidak ada di perangkat ini — ubah dari perangkat asal';
  }, [desktop, arsipAda]);

  // Ganti baris terpilih → editor mengikuti nilai baris baru.
  useEffect(() => {
    const baris = dokumens.find((d) => d.id === dokId) ?? null;
    setEditJenis(baris?.jenis_dokumen ?? '');
    setEditLembaga(baris?.lembaga ?? '');
    setEditCatatan(baris?.catatan ?? '');
    setEditAktif(baris?.is_active === false ? 'Tidak' : 'Ya');
    setEditNama(baris?.nama_file ?? '');
    setEditLokasi(baris?.penyimpanan ?? 'server');
  }, [dokId, dokumens]);

  // Referensi jenis: santri per jenjang; pegawai sekali + dedupe (mode "Semua").
  useEffect(() => {
    if (entitas !== 'santri') return;
    if (jenjangs.length === 0) { setJenisRows([]); return; }
    let hidup = true;
    referensiList('jenis_dokumen_santri', jenjangs)
      .then((r) => { if (hidup) setJenisRows(r); })
      .catch(() => { if (hidup) setJenisRows([]); });
    return () => { hidup = false; };
  }, [entitas, jenjangs]);

  useEffect(() => {
    if (entitas !== 'pegawai') return;
    if (filterLoading) { setJenisRows([]); return; }
    let hidup = true;
    referensiList('jenis_dokumen_pegawai', jenjangs.length ? jenjangs : undefined)
      .then((r) => {
        if (!hidup) return;
        // Mode "Semua" menggabung baris per lembaga — dedupe per nama.
        const lihat = new Set<string>();
        setJenisRows(r.filter((x) => {
          const kunci = String(x.nama ?? x.kode).trim().toLowerCase();
          if (lihat.has(kunci)) return false;
          lihat.add(kunci);
          return true;
        }));
      })
      .catch(() => { if (hidup) setJenisRows([]); });
    return () => { hidup = false; };
  }, [entitas, filterLoading, jenjangs]);

  const opsiJenisUbah = useMemo(() => {
    const opsi = jenisRows.map((r) => ({ value: String(r.nama ?? r.kode), label: String(r.nama ?? r.kode) }));
    // Nilai tersimpan yang tak ada di referensi tetap bisa tampil/terpilih.
    const kini = editJenis.trim();
    if (kini !== '' && !opsi.some((o) => o.value === kini)) opsi.push({ value: kini, label: kini });
    return opsi;
  }, [jenisRows, editJenis]);

  const onUbah = useCallback(async () => {
    // Cari langsung (bukan dokPratinjau) agar callback bisa dideklarasikan
    // sebelum memo baris terpilih.
    const baris = dokumens.find((d) => d.id === dokId) ?? null;
    if (!baris || editJenis.trim() === '') return;
    // Hanya field yang berubah yang dikirim; jenis/lembaga/catatan memicu
    // selaras nama berkas, sisanya edit data langsung.
    const payload: Record<string, unknown> = { selaraskan_nama: true };
    if (editJenis.trim() !== (baris.jenis_dokumen ?? '')) payload.jenis_dokumen = editJenis.trim();
    if (entitas === 'santri' && editLembaga !== (baris.lembaga ?? '')) payload.lembaga = editLembaga || null;
    if ((editCatatan.trim() || '') !== (baris.catatan ?? '')) payload.catatan = editCatatan.trim() || null;
    const aktifAwal = baris.is_active === false ? 'Tidak' : 'Ya';
    if (editAktif !== aktifAwal) payload.is_active = editAktif === 'Ya';
    if (editNama.trim() !== (baris.nama_file ?? '')) payload.nama_file = editNama.trim() || null;
    if (editLokasi !== (baris.penyimpanan ?? 'server')) payload.penyimpanan = editLokasi;
    if (Object.keys(payload).length <= 1) return;
    setBusy(true);
    const namaLama = baris.nama_file;
    const jenisLama = baris.jenis_dokumen;
    const jenisBaru = editJenis.trim();
    const idUbah = baris.id;
    const lokasi = baris.penyimpanan ?? 'server';
    try {
      const hasil = await ubahDokumen(entitas, baris.id, payload);
      toast.success('Dokumen diubah.');
      const segar = hasil.data;
      setEditJenis(segar?.jenis_dokumen ?? jenisBaru);
      if (entitas === 'santri') setEditLembaga(segar?.lembaga ?? '');
      setEditCatatan(segar?.catatan ?? '');
      setEditAktif(segar?.is_active === false ? 'Tidak' : 'Ya');
      setEditNama(segar?.nama_file ?? '');
      setEditLokasi(segar?.penyimpanan ?? 'server');
      // Desktop: pindahkan salinan arsip mengikuti nama + folder baru.
      const namaBaru = hasil.data?.nama_file ?? null;
      if (desktop && lokasi !== 'server' && namaLama && namaBaru && namaBaru !== namaLama) {
        try {
          const { exists, mkdir, rename } = await import('@tauri-apps/plugin-fs');
          const { join } = await import('@tauri-apps/api/path');
          const { kandidatAkarArsip, cariArsip } = await import('@/lib/arsipDokumen');
          let pindah = false;
          for (const { akar, lokasi: lokasiArsip } of await kandidatAkarArsip(lokasi)) {
            const lama = await cariArsip(namaLama, jenisLama, akar, entitas, lokasiArsip);
            if (!lama) continue;
            const { folderArsip } = await import('@/lib/arsipDokumen');
            const folderTipe = await folderArsip(akar, lokasiArsip, entitas);
            await mkdir(folderTipe, { recursive: true });
            const baru = await join(folderTipe, namaBaru);
            if (await exists(baru)) {
              toast.warning('Metadata berubah; nama baru sudah dipakai di arsip — salinan lama dibiarkan.');
              pindah = true;
              break;
            }
            await rename(lama, baru);
            pindah = true;
            break;
          }
          if (!pindah) toast.warning('Metadata berubah; salinan arsip tidak ditemukan di perangkat ini.');
        } catch (e) {
          toast.warning(`Metadata berubah; arsip lokal gagal dipindah: ${errorMessage(e)}`);
        }
      }
      if (subjekId != null) {
        await muatDokumen(subjekId);
        if (dokId === idUbah) {
          const baru = await barisSegar(subjekId, idUbah);
          if (baru) void muatPratinjau(baru);
        }
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [entitas, dokumens, editJenis, editLembaga, editCatatan, editAktif, editNama, editLokasi, subjekId, dokId, desktop, muatDokumen, muatPratinjau, barisSegar]);

  /** Toggle aktif via klik kanan: aktif → nonaktifkan & sebaliknya. */
  const onToggleAktif = useCallback(async (row: DokumenRow) => {
    setBusy(true);
    try {
      const jadiAktif = !(row.is_active ?? true);
      await ubahDokumen(entitas, row.id, { is_active: jadiAktif });
      toast.success(jadiAktif ? 'Dokumen diaktifkan.' : 'Dokumen dinonaktifkan.');
      if (subjekId != null) await muatDokumen(subjekId);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [entitas, subjekId, muatDokumen]);

  async function onBrowseGanti() {
    if (desktop) {
      try {
        const b = await pilihBerkasDokumen(entitas === 'pegawai');
        if (!b) return;
        const { readFile } = await import('@tauri-apps/plugin-fs');
        const bytes = await readFile(b.path);
        setGantiFile(new File([new Uint8Array(bytes)], b.nama, { type: b.mime }));
      } catch (e) {
        toast.error(errorMessage(e));
      }
      return;
    }
    inputGantiWebRef.current?.click();
  }

  function onFileGantiWeb(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;
    if (entitas === 'santri') {
      const ext = ekstensiDariNama(f.name);
      if (!EKSTENSI_PILIH.includes(ext)) {
        toast.error(`Berkas harus ${EKSTENSI_PILIH.join('/').toUpperCase()} (HEIC/WEBP otomatis dikonversi).`);
        e.target.value = '';
        return;
      }
    }
    if (f.size > BATAS_BERKAS) {
      toast.error('Berkas melebihi 10 MB.');
      e.target.value = '';
      return;
    }
    setGantiFile(f);
  }

  /** Ganti isi berkas di lokasi yang sama (server diunggah, arsip
   *  perangkat ditulis ulang) + salinan arsip lama dibuang. */
  const terapkanGanti = useCallback(async (row: DokumenRow, file: File): Promise<boolean> => {
    setBusy(true);
    const namaLama = row.nama_file;
    const jenisLama = row.jenis_dokumen;
    const idLama = row.id;
    const lokasi = row.penyimpanan ?? 'server';
    try {
      if (lokasi !== 'server' && isTauri()) {
        const { targetTulisLokal, tulisGantiArsip } = await import('@/lib/arsipDokumen');
        const siapLokal = await siapkanFileUntukServer(file);
        if (siapLokal.dikonversi) toast.info('Berkas dikonversi ke JPG.');
        const target = await targetTulisLokal(namaLama ?? '', row.jenis_dokumen, entitas, lokasi);
        const namaBaru = await tulisGantiArsip({
          namaLama,
          jenis: row.jenis_dokumen,
          pemilik: row.pemilik ?? '',
          catatan: row.catatan ?? '',
          ext: ekstensiDariNama(siapLokal.file.name),
          data: new Uint8Array(await siapLokal.file.arrayBuffer()),
          lokasi: target.lokasi,
          tipe: entitas,
        });
        if (namaBaru !== namaLama) {
          await ubahDokumen(entitas, row.id, { nama_file: namaBaru });
        }
        toast.success('Berkas diganti.');
        if (subjekId != null) {
          await muatDokumen(subjekId);
          segarkanJumlah();
        }
        if (dokId === idLama && subjekId != null) {
          const baru = await barisSegar(subjekId, idLama);
          if (baru) void muatPratinjau(baru);
        }
        return true;
      }
      const siap = await siapkanFileUntukServer(file);
      if (siap.dikonversi) toast.info('Berkas HEIC dikonversi ke JPG.');
      await unggahBerkasDokumen(entitas, row.id, siap.file);
      toast.success('Berkas diganti.');
      await bersihkanArsip(namaLama, jenisLama, lokasi === 'test' ? 'test' : 'lokal');
      if (subjekId != null) {
        await muatDokumen(subjekId);
        segarkanJumlah();
      }
      // Segarkan pratinjau bila baris yang diganti sedang tampil.
      if (dokId === idLama && subjekId != null) {
        const baru = await barisSegar(subjekId, idLama);
        if (baru) void muatPratinjau(baru);
      }
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }, [entitas, subjekId, dokId, muatDokumen, segarkanJumlah, muatPratinjau, barisSegar, bersihkanArsip]);

  const onGanti = useCallback(async () => {
    if (!gantiRow || !gantiFile) return;
    if (await terapkanGanti(gantiRow, gantiFile)) {
      setGantiRow(null);
      setGantiFile(null);
    }
  }, [gantiRow, gantiFile, terapkanGanti]);

  /** Baris yang sedang dipratinjau — dasar mengaktifkan tombol ubah viewer. */
  const dokPratinjau = useMemo(() => dokumens.find((d) => d.id === dokId) ?? null, [dokumens, dokId]);
  /** Baris terpilih boleh diubah inline (izin + arsip tersedia bila perangkat). */
  const infoBisaUbah = dokPratinjau != null && bolehUbah && bisaSelaras(dokPratinjau);
  /** Ada perubahan yang belum disimpan (enam field edit inline santri /
   *  lima field pegawai — tanpa Lembaga). */
  const infoKotor = dokPratinjau != null
    && (editJenis.trim() !== (dokPratinjau.jenis_dokumen ?? '')
      || (entitas === 'santri' && editLembaga !== (dokPratinjau.lembaga ?? ''))
      || (editCatatan.trim() || '') !== (dokPratinjau.catatan ?? '')
      || editAktif !== (dokPratinjau.is_active === false ? 'Tidak' : 'Ya')
      || editNama.trim() !== (dokPratinjau.nama_file ?? '')
      || editLokasi !== (dokPratinjau.penyimpanan ?? 'server'));
  const bisaUbahViewer = bolehUbah && dokPratinjau !== null && !perluDesktop(dokPratinjau);

  /** Kembalikan enam field editor ke nilai baris terpilih. */
  const resetEdit = useCallback(() => {
    setEditJenis(dokPratinjau?.jenis_dokumen ?? '');
    setEditLembaga(dokPratinjau?.lembaga ?? '');
    setEditCatatan(dokPratinjau?.catatan ?? '');
    setEditAktif(dokPratinjau?.is_active === false ? 'Tidak' : 'Ya');
    setEditNama(dokPratinjau?.nama_file ?? '');
    setEditLokasi(dokPratinjau?.penyimpanan ?? 'server');
  }, [dokPratinjau]);

  /** Simpan hasil edit viewer: arsip perangkat ditulis balik di tempat
   *  (lokasi tak berubah); server diunggah seperti Ganti. */
  const onSimpanEdit = useCallback(async () => {
    if (!dokPratinjau || !keluaran || !pratinjau) return;
    const lokasi = dokPratinjau.penyimpanan ?? 'server';
    if (lokasi !== 'server' && isTauri() && dokPratinjau.nama_file) {
      setBusy(true);
      try {
        const namaBaru = gantiEkstensi(pratinjau.nama, keluaran.ext);
        const { targetTulisLokal, tulisBalikArsip } = await import('@/lib/arsipDokumen');
        const target = await targetTulisLokal(dokPratinjau.nama_file, dokPratinjau.jenis_dokumen, entitas, lokasi);
        await tulisBalikArsip(dokPratinjau.nama_file, namaBaru, dokPratinjau.jenis_dokumen, keluaran.bytes, entitas, target.lokasi);
        if (namaBaru !== dokPratinjau.nama_file) {
          await ubahDokumen(entitas, dokPratinjau.id, { nama_file: namaBaru });
        }
        toast.success('Berkas diganti.');
        if (subjekId != null) {
          await muatDokumen(subjekId);
          const baru = await barisSegar(subjekId, dokPratinjau.id);
          if (baru) void muatPratinjau(baru);
        }
      } catch (e) {
        toast.error(errorMessage(e));
      } finally {
        setBusy(false);
      }
      return;
    }
    const file = new File(
      [keluaran.bytes.buffer as ArrayBuffer],
      gantiEkstensi(pratinjau.nama, keluaran.ext),
      { type: keluaran.mime },
    );
    await terapkanGanti(dokPratinjau, file);
  }, [entitas, dokPratinjau, keluaran, pratinjau, terapkanGanti, subjekId, muatDokumen, muatPratinjau, barisSegar]);

  const lokasiLabel = (r: DokumenRow) =>
    (r.penyimpanan ?? 'server') === 'lokal' ? 'Lokal'
    : (r.penyimpanan ?? 'server') === 'test' ? 'Test'
    : (r.penyimpanan ?? 'server') === 'cermin' ? 'Cermin' : 'Server';

  return {
    dokumens,
    loadingDok,
    muatDokumen,
    ambilBarisSubjek,
    dokId,
    pratinjau,
    muatPratinjau,
    unduhCerdas,
    perluDesktop,
    hapusRow,
    setHapusRow,
    onHapus,
    sinkronTerbuka,
    setSinkronTerbuka,
    tambahTerbuka,
    setTambahTerbuka,
    segarkanSetelahSinkron,
    editJenis,
    setEditJenis,
    editLembaga,
    setEditLembaga,
    editCatatan,
    setEditCatatan,
    editAktif,
    setEditAktif,
    editNama,
    setEditNama,
    editLokasi,
    setEditLokasi,
    opsiJenisUbah,
    onUbah,
    resetEdit,
    onToggleAktif,
    dokPratinjau,
    infoBisaUbah,
    infoKotor,
    bisaUbahViewer,
    bisaSelaras,
    judulSelaras,
    lokasiLabel,
    gantiRow,
    setGantiRow,
    gantiFile,
    setGantiFile,
    inputGantiWebRef,
    onBrowseGanti,
    onFileGantiWeb,
    onGanti,
    keluaran,
    setKeluaran,
    kotor,
    setKotor,
    prosesViewer,
    setProsesViewer,
    kunciViewer,
    setKunciViewer,
    onSimpanEdit,
    busy,
  };
}
