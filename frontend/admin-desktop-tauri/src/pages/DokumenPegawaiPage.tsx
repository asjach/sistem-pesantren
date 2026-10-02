import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ambilBerkas, errorMessage, isTauri, prefGet } from '../api/client';
import type { LokasiArsip } from '@/lib/arsipDokumen';
import { bisa } from '../api/auth';
import { useAuth } from '../auth/AuthContext';
import { listPegawai, type Pegawai } from '../api/pegawai';
import { listDokumen, hapusDokumen, ubahDokumen, unggahBerkasDokumen, unduhBerkasDokumen, type DokumenRow } from '../api/dokumen';
import { referensiList, type ReferensiRow } from '../api/master';
import { Button } from '@/components/ui/button';
import TombolIkon from '@/components/TombolIkon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useFilterGlobalAktif } from '@/hooks/useFilterGlobalAktif';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { TopBarSearch } from '@/components/TopBarSearch';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import ComboCari from '@/components/ComboCari';
import { cn } from '@/lib/utils';
import {
  BATAS_BERKAS,
  ekstensiDariNama,
  mimeDariEkstensi,
  pilihBerkasDokumen,
} from '@/lib/arsipDokumen';
import PenampilBerkas, { type SumberBerkas } from '@/components/dokumen/PenampilBerkas';
import DialogSinkronDokumen from '@/components/dokumen/DialogSinkronDokumen';
import TambahDokumenPegawaiDialog from '@/components/dokumen/TambahDokumenPegawaiDialog';
import { siapkanFileUntukServer } from '@/lib/konversiHeic';
import { gantiEkstensi, type HasilGambar } from '@/lib/olahGambar';
import { Check, Download, FolderOpen, MoreVertical, Plus, RefreshCw, Save, Trash2, Undo2, Upload, X } from '@/icons';
import { toast } from 'sonner';

/** Halaman Dokumen Pegawai — tata letak sama dengan Tambah Dokumen.
 *  Kolom 1 baris 1: tabel Daftar Pegawai; baris 2: tabel Daftar Dokumen
 *  milik pegawai terpilih (klik baris = pratinjau di kolom 2).
 *  Kolom 2: pratinjau baca-saja + aksi Unduh/Ganti per baris. */
export default function DokumenPegawaiPage() {
  const { user } = useAuth();
  const desktop = isTauri();
  const canUbah = bisa(user, 'dokumen_pegawai.ubah');
  const canHapus = bisa(user, 'dokumen_pegawai.hapus');
  const canTambah = bisa(user, 'dokumen_pegawai.tambah');
  const { jenjangs, tahunAjaranNames, loading: filterLoading } = useFilterGlobalAktif();

  // ----- Daftar pegawai (kolom 1, baris 1) -----
  const [cari, setCari] = useState('');
  const [cariTunda, setCariTunda] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setCariTunda(cari), 350);
    return () => clearTimeout(t);
  }, [cari]);

  /** Sumber daftar: filter pegawai topBar vs buku induk (scope admin). */
  const [sumber, setSumber] = useState<'filter' | 'buku'>('filter');

  const [pegawais, setPegawais] = useState<Pegawai[]>([]);
  const [loadingPegawai, setLoadingPegawai] = useState(false);
  const [err, setErr] = useState('');

  /** True bila pegawai punya penempatan aktif di lembaga_pegawai. Saat
   *  `jenjang` tidak kosong, penempatan aktif harus di salah satu jenjang itu. */
  function punyaPenempatanAktif(p: Pegawai, jenjang: readonly string[]): boolean {
    return (p.penempatan ?? []).some((t) => t.is_active_lembaga === 'Ya'
      && (jenjang.length === 0 || jenjang.includes(t.jenjang)));
  }

  /** Daftar pegawai dimuat utuh tanpa pagination (per_page=0 = semua baris).
   *  Filter kosong (mode "Semua") = tanpa filter, bukan daftar kosong.
   *  Mode "Filter Pegawai" hanya menampilkan pegawai dengan penempatan AKTIF
   *  di lembaga_pegawai (dalam lingkup jenjang filter); mode "Buku Induk"
   *  menampilkan seluruh baris pegawai, aktif maupun tidak. */
  const muatPegawai = useCallback(async (signal?: AbortSignal) => {
    if (filterLoading) { setPegawais([]); return; }
    setLoadingPegawai(true);
    setErr('');
    try {
      const res = await listPegawai({
        ...(sumber === 'filter'
          ? {
              jenjang: jenjangs.length ? jenjangs : undefined,
              tahun_ajaran: tahunAjaranNames.length ? tahunAjaranNames : undefined,
            }
          : {}),
        q: cariTunda || undefined,
        per_page: 0,
        signal,
      });
      const urut = [...res.data].sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap, 'id'));
      setPegawais(sumber === 'filter' ? urut.filter((p) => punyaPenempatanAktif(p, jenjangs)) : urut);
    } catch (e) {
      if (signal?.aborted) return;
      setErr(errorMessage(e));
    } finally {
      setLoadingPegawai(false);
    }
  }, [sumber, filterLoading, jenjangs, tahunAjaranNames, cariTunda]);

  useEffect(() => {
    const c = new AbortController();
    void muatPegawai(c.signal);
    return () => c.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sumber, filterLoading, jenjangs, tahunAjaranNames, cariTunda]);

  const [pegawaiId, setPegawaiId] = useState<number | null>(null);

  /** Jumlah dokumen per pegawai (kunci: pegawai_id) — satu fetch; tanpa
   *  filter = seluruh lingkup akses. */
  const [jumlahPegawai, setJumlahPegawai] = useState<Record<number, number>>({});
  // Tanpa filter jenjang + satu baris per dokumen: sama dengan daftar dokumen
  // per pegawai (yang hanya disaring pegawai_id), sehingga badge "Dok"
  // tidak pernah lebih kecil dari isi daftar.
  const muatJumlahPegawai = useCallback(async (): Promise<Record<number, number>> => {
    try {
      const p = await listDokumen('pegawai', { per_page: 0 });
      const hitung: Record<number, number> = {};
      for (const d of p.data) {
        const pid = d.pegawai_id;
        if (pid != null) hitung[pid] = (hitung[pid] ?? 0) + 1;
      }
      return hitung;
    } catch {
      return {};
    }
  }, []);
  useEffect(() => {
    let hidup = true;
    void muatJumlahPegawai().then((h) => { if (hidup) setJumlahPegawai(h); });
    return () => { hidup = false; };
  }, [muatJumlahPegawai]);

  // ----- Daftar dokumen milik pegawai terpilih (kolom 1, baris 2) -----
  const [dokumens, setDokumens] = useState<DokumenRow[]>([]);
  const [loadingDok, setLoadingDok] = useState(false);
  /** Salinan arsip yang benar-benar ada di perangkat ini (kunci: id dokumen). */
  const [arsipAda, setArsipAda] = useState<Record<number, boolean>>({});
  const muatDokumen = useCallback(async (pid: number, signal?: AbortSignal) => {
    setLoadingDok(true);
    try {
      const p = await listDokumen('pegawai', { pegawai_id: pid, per_page: 0, signal });
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
            ? (await cariLokal(d.nama_file, d.jenis_dokumen, 'pegawai', d.penyimpanan ?? 'server')) !== null
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
  }, []);
  useEffect(() => {
    setDokId(null);
    setPratinjau(null);
    if (pegawaiId == null) { setDokumens([]); return; }
    const c = new AbortController();
    void muatDokumen(pegawaiId, c.signal);
    return () => c.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pegawaiId, muatDokumen]);

  // ----- Pratinjau (kolom 2, baca-saja) -----
  const [dokId, setDokId] = useState<number | null>(null);
  const [pratinjau, setPratinjau] = useState<SumberBerkas | null>(null);

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
        const ketemu = await cariLokal(r.nama_file, r.jenis_dokumen, 'pegawai', lokasi);
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
      const buf = await ambilBerkas(`/admin/dokumen/pegawai/${r.id}/unduh`);
      setPratinjau({ bytes: new Uint8Array(buf), mime, nama });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [desktop]);

  /** Unduh menurut kolom penyimpanan: server langsung; lokal/test via
   *  dialog simpan native dari arsip perangkat (desktop). Tanpa tebak-tebakan. */
  const unduhCerdas = useCallback(async (r: DokumenRow) => {
    const lokasi = r.penyimpanan ?? 'server';
    if (lokasi === 'server' || !isTauri() || !r.nama_file) {
      await unduhBerkasDokumen('pegawai', r.id, r.nama_file ?? 'dokumen').catch((e) => toast.error(errorMessage(e)));
      return;
    }
    try {
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { cariLokal } = await import('@/lib/arsipDokumen');
      const ketemu = await cariLokal(r.nama_file, r.jenis_dokumen, 'pegawai', lokasi);
      if (!ketemu && lokasi !== 'cermin') {
        toast.error('Berkas tidak ada di arsip perangkat ini — hanya tersimpan di perangkat asal.');
        return;
      }
      // Cermin tanpa salinan lokal: salinan server selalu ada.
      const bytes = ketemu?.bytes ?? new Uint8Array(await ambilBerkas(`/admin/dokumen/pegawai/${r.id}/unduh`));
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
  }, []);

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
        await hapusArsip(nama, jenis, akar, 'pegawai', lokasi);
      }
    } catch (e) {
      toast.warning(`Arsip lokal gagal dibersihkan: ${errorMessage(e)}`);
    }
  }, []);

  // ----- Hapus dokumen -----
  const [hapusRow, setHapusRow] = useState<DokumenRow | null>(null);

  // ----- Sinkron cermin (pegawai ini / semua pegawai) -----
  const [sinkronTerbuka, setSinkronTerbuka] = useState(false);
  const [tambahTerbuka, setTambahTerbuka] = useState(false);
  const namaPegawaiAktif = useMemo(
    () => pegawais.find((x) => x.id === pegawaiId)?.nama_lengkap ?? '',
    [pegawais, pegawaiId],
  );
  const segarkanSetelahSinkron = useCallback(async () => {
    void muatJumlahPegawai().then(setJumlahPegawai);
    if (pegawaiId == null) return;
    await muatDokumen(pegawaiId);
    if (dokId != null) {
      const p = await listDokumen('pegawai', { pegawai_id: pegawaiId, per_page: 0 });
      const baru = p.data.find((d) => d.id === dokId);
      if (baru) void muatPratinjau(baru);
    }
  }, [pegawaiId, dokId, muatDokumen, muatJumlahPegawai, muatPratinjau]);

  const onHapus = useCallback(async () => {
    if (!hapusRow) return;
    setBusy(true);
    try {
      const nama = hapusRow.nama_file;
      const jenis = hapusRow.jenis_dokumen;
      const idHapus = hapusRow.id;
      await hapusDokumen('pegawai', hapusRow.id);
      toast.success('Dokumen dihapus.');
      await bersihkanArsip(nama, jenis, (hapusRow.penyimpanan ?? 'server') === 'test' ? 'test' : 'lokal');
      setHapusRow(null);
      if (dokId === idHapus) { setDokId(null); setPratinjau(null); }
      if (pegawaiId != null) {
        await muatDokumen(pegawaiId);
        void muatJumlahPegawai().then(setJumlahPegawai);
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [hapusRow, dokId, pegawaiId, muatDokumen, muatJumlahPegawai, bersihkanArsip]);

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

  // ----- Ubah inline di segmen Info dokumen (jenis + catatan memicu
  //  selaras nama berkas; status/nama/lokasi edit data langsung) -----
  const [editJenis, setEditJenis] = useState('');
  const [editCatatan, setEditCatatan] = useState('');
  const [editAktif, setEditAktif] = useState('Ya');
  const [editNama, setEditNama] = useState('');
  const [editLokasi, setEditLokasi] = useState('server');
  // Ganti baris terpilih → editor mengikuti nilai baris baru.
  useEffect(() => {
    const baris = dokumens.find((d) => d.id === dokId) ?? null;
    setEditJenis(baris?.jenis_dokumen ?? '');
    setEditCatatan(baris?.catatan ?? '');
    setEditAktif(baris?.is_active === false ? 'Tidak' : 'Ya');
    setEditNama(baris?.nama_file ?? '');
    setEditLokasi(baris?.penyimpanan ?? 'server');
  }, [dokId, dokumens]);

  /** Opsi jenis dari referensi (sama dengan halaman Tambah). */
  const [jenisRows, setJenisRows] = useState<ReferensiRow[]>([]);
  useEffect(() => {
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
  }, [filterLoading, jenjangs]);
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
    // Hanya field yang berubah yang dikirim; jenis/catatan memicu selaras
    // nama berkas, sisanya edit data langsung.
    const payload: Record<string, unknown> = { selaraskan_nama: true };
    if (editJenis.trim() !== (baris.jenis_dokumen ?? '')) payload.jenis_dokumen = editJenis.trim();
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
      const hasil = await ubahDokumen('pegawai', baris.id, payload);
      toast.success('Dokumen diubah.');
      const segar = hasil.data;
      setEditJenis(segar?.jenis_dokumen ?? jenisBaru);
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
            const lama = await cariArsip(namaLama, jenisLama, akar, 'pegawai', lokasiArsip);
            if (!lama) continue;
            const { folderArsip } = await import('@/lib/arsipDokumen');
            const folderTipe = await folderArsip(akar, lokasiArsip, 'pegawai');
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
      if (pegawaiId != null) {
        await muatDokumen(pegawaiId);
        if (dokId === idUbah) {
          const p = await listDokumen('pegawai', { pegawai_id: pegawaiId, per_page: 0 });
          const baru = p.data.find((dd) => dd.id === idUbah);
          if (baru) void muatPratinjau(baru);
        }
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [dokumens, editJenis, editCatatan, editAktif, editNama, editLokasi, pegawaiId, dokId, desktop, muatDokumen, muatPratinjau]);

  // ----- Ganti berkas -----
  const [gantiRow, setGantiRow] = useState<DokumenRow | null>(null);
  const [gantiFile, setGantiFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const inputGantiWebRef = useRef<HTMLInputElement>(null);

  async function onBrowseGanti() {
    if (desktop) {
      try {
        const b = await pilihBerkasDokumen(true);
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

  function onFileGantiWeb(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;
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
        const target = await targetTulisLokal(namaLama ?? '', row.jenis_dokumen, 'pegawai', lokasi);
        const namaBaru = await tulisGantiArsip({
          namaLama,
          jenis: row.jenis_dokumen,
          pemilik: row.pemilik ?? '',
          catatan: row.catatan ?? '',
          ext: ekstensiDariNama(siapLokal.file.name),
          data: new Uint8Array(await siapLokal.file.arrayBuffer()),
          lokasi: target.lokasi,
          tipe: 'pegawai',
        });
        if (namaBaru !== namaLama) {
          await ubahDokumen('pegawai', row.id, { nama_file: namaBaru });
        }
        toast.success('Berkas diganti.');
        if (pegawaiId != null) {
          await muatDokumen(pegawaiId);
          void muatJumlahPegawai().then(setJumlahPegawai);
        }
        if (dokId === idLama && pegawaiId != null) {
          const p = await listDokumen('pegawai', { pegawai_id: pegawaiId, per_page: 0 });
          const baru = p.data.find((d) => d.id === idLama);
          if (baru) void muatPratinjau(baru);
        }
        return true;
      }
      const siap = await siapkanFileUntukServer(file);
      if (siap.dikonversi) toast.info('Berkas HEIC dikonversi ke JPG.');
      await unggahBerkasDokumen('pegawai', row.id, siap.file);
      toast.success('Berkas diganti.');
      await bersihkanArsip(namaLama, jenisLama, lokasi === 'test' ? 'test' : 'lokal');
      if (pegawaiId != null) {
        await muatDokumen(pegawaiId);
        void muatJumlahPegawai().then(setJumlahPegawai);
      }
      // Segarkan pratinjau bila baris yang diganti sedang tampil.
      if (dokId === idLama && pegawaiId != null) {
        const p = await listDokumen('pegawai', { pegawai_id: pegawaiId, per_page: 0 });
        const baru = p.data.find((d) => d.id === idLama);
        if (baru) void muatPratinjau(baru);
      }
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }, [pegawaiId, dokId, muatDokumen, muatJumlahPegawai, muatPratinjau, bersihkanArsip]);

  const onGanti = useCallback(async () => {
    if (!gantiRow || !gantiFile) return;
    if (await terapkanGanti(gantiRow, gantiFile)) {
      setGantiRow(null);
      setGantiFile(null);
    }
  }, [gantiRow, gantiFile, terapkanGanti]);

  /** Keluaran viewer (hasil putar/crop/resize/editor) + status kotor. */
  const [keluaran, setKeluaran] = useState<HasilGambar | null>(null);
  const [kotor, setKotor] = useState(false);
  /** Pipeline viewer sibuk: Simpan dikunci agar tak mengunggah byte basi. */
  const [prosesViewer, setProsesViewer] = useState(false);
  /** Kunci remount viewer (Buang perubahan mengembalikan tampilan asli). */
  const [kunciViewer, setKunciViewer] = useState(0);
  /** Baris yang sedang dipratinjau — dasar mengaktifkan tombol ubah viewer. */
  const dokPratinjau = useMemo(() => dokumens.find((d) => d.id === dokId) ?? null, [dokumens, dokId]);
  /** Pegawai terpilih (fallback nama guru bila baris tak memuat join). */
  const pegawaiDipilih = useMemo(() => pegawais.find((p) => p.id === pegawaiId) ?? null, [pegawais, pegawaiId]);
  /** Baris terpilih boleh diubah inline (izin + arsip tersedia bila perangkat). */
  const infoBisaUbah = dokPratinjau != null && canUbah && bisaSelaras(dokPratinjau);
  /** Ada perubahan yang belum disimpan (lima field edit inline). */
  const infoKotor = dokPratinjau != null
    && (editJenis.trim() !== (dokPratinjau.jenis_dokumen ?? '')
      || (editCatatan.trim() || '') !== (dokPratinjau.catatan ?? '')
      || editAktif !== (dokPratinjau.is_active === false ? 'Tidak' : 'Ya')
      || editNama.trim() !== (dokPratinjau.nama_file ?? '')
      || editLokasi !== (dokPratinjau.penyimpanan ?? 'server'));
  const bisaUbahViewer = canUbah && dokPratinjau !== null && !perluDesktop(dokPratinjau);

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
        const target = await targetTulisLokal(dokPratinjau.nama_file, dokPratinjau.jenis_dokumen, 'pegawai', lokasi);
        await tulisBalikArsip(dokPratinjau.nama_file, namaBaru, dokPratinjau.jenis_dokumen, keluaran.bytes, 'pegawai', target.lokasi);
        if (namaBaru !== dokPratinjau.nama_file) {
          await ubahDokumen('pegawai', dokPratinjau.id, { nama_file: namaBaru });
        }
        toast.success('Berkas diganti.');
        if (pegawaiId != null) {
          await muatDokumen(pegawaiId);
          const p = await listDokumen('pegawai', { pegawai_id: pegawaiId, per_page: 0 });
          const baru = p.data.find((d) => d.id === dokPratinjau.id);
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
  }, [dokPratinjau, keluaran, pratinjau, terapkanGanti, pegawaiId, muatDokumen, muatPratinjau]);

  /** Toggle aktif via klik kanan: aktif → nonaktifkan & sebaliknya. */
  const onToggleAktif = useCallback(async (row: DokumenRow) => {
    setBusy(true);
    try {
      const jadiAktif = !(row.is_active ?? true);
      await ubahDokumen('pegawai', row.id, { is_active: jadiAktif });
      toast.success(jadiAktif ? 'Dokumen diaktifkan.' : 'Dokumen dinonaktifkan.');
      if (pegawaiId != null) await muatDokumen(pegawaiId);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [pegawaiId, muatDokumen]);

  const lokasiLabel = (r: DokumenRow) =>
    (r.penyimpanan ?? 'server') === 'lokal' ? 'Lokal'
    : (r.penyimpanan ?? 'server') === 'test' ? 'Test'
    : (r.penyimpanan ?? 'server') === 'cermin' ? 'Cermin' : 'Server';
  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <TopBarSearch value={cari} onChange={setCari} placeholder="Cari pegawai…" />
      <PengaturanHalaman tampil={{}} />
      <ResizablePanelGroup orientation="horizontal" id="grup_lihat_dokumen_pegawai" className="min-h-0 flex-1 overflow-hidden">
        {/* Kolom 1: daftar pegawai (baris 1) + daftar dokumen (baris 2). */}
        <ResizablePanel defaultSize={400} minSize={300} maxSize="70%" id="panel_lihat_dokumen_pegawai_daftar" className="min-h-0">
          <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto rounded-xl border bg-card p-4">
          <div className="flex min-h-0 flex-1 flex-col gap-1.5">
            <FieldLabel id="label_sumber_pegawai_lihat">Daftar pegawai</FieldLabel>
            <div id="radio_sumber_pegawai_lihat" role="radiogroup" aria-labelledby="label_sumber_pegawai_lihat" className="flex flex-wrap gap-2">
              {([
                ['filter', 'Filter Pegawai'],
                ['buku', 'Buku Induk'],
              ] as const).map(([nilai, label]) => (
                <label
                  key={nilai}
                  htmlFor={`radio_sumber_lihat_pegawai_${nilai}`}
                  className="inline-flex h-6 cursor-pointer items-center gap-2 rounded-full border bg-card px-3 py-0 text-xs has-checked:border-primary has-checked:bg-accent has-checked:font-semibold"
                >
                  <input
                    type="radio"
                    id={`radio_sumber_lihat_pegawai_${nilai}`}
                    name="sumber_pegawai_lihat"
                    value={nilai}
                    checked={sumber === nilai}
                    onChange={() => { setSumber(nilai); setPegawaiId(null); }}
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
                    <th className="px-2 py-1 font-medium">NIPP</th>
                    <th className="px-2 py-1 font-medium">Dok</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingPegawai ? (
                    <tr><td colSpan={3} className="px-2 py-1 text-center text-muted-foreground">Memuat…</td></tr>
                  ) : pegawais.length === 0 ? (
                    <tr><td colSpan={3} className="px-2 py-1 text-center text-muted-foreground">{sumber === 'filter' ? 'Tidak ada pegawai pada filter ini.' : 'Tidak ada pegawai.'}</td></tr>
                  ) : pegawais.map((p) => {
                    const aktif = p.id === pegawaiId;
                    const n = jumlahPegawai[p.id] ?? 0;
                    return (
                      <tr
                        key={p.id}
                        onClick={() => setPegawaiId(p.id)}
                        title="Klik untuk memilih"
                        aria-selected={aktif}
                        className={cn(
                          'cursor-pointer border-t',
                          aktif ? 'bg-accent font-medium' : 'hover:bg-muted/60',
                        )}
                      >
                        <td className="px-2 py-1">
                          {p.nama_lengkap}
                          {p.status_aktif !== 'Ya' && <Badge variant="destructive" className="ml-1 py-0 align-middle text-[9px] leading-3">Nonaktif</Badge>}
                        </td>
                        <td className="px-2 py-1 text-muted-foreground">{p.nipp ?? '—'}</td>
                        <td className="px-2 py-1"><Badge variant={n > 0 ? 'secondary' : 'outline'} className="py-0 leading-4">{n}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <FieldLabel id="label_daftar_dokumen_lihat_pegawai">Daftar dokumen{pegawaiId != null && dokumens.length > 0 ? ` (${dokumens.length})` : ''}</FieldLabel>
              {desktop && canUbah && pegawaiId != null && (
                <Button
                  id="tombol_sinkron_dok_lihat_pegawai"
                  size="sm"
                  variant="outline"
                  onClick={() => setSinkronTerbuka(true)}
                  title="Sinkronkan dokumen pegawai ini (cermin dua arah)"
                >
                  <RefreshCw size={14} /> Sinkronkan
                </Button>
              )}
            </div>
            <div className="min-h-[120px] flex-1 overflow-y-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr className="text-left">
                    <th className="px-2 py-1 font-medium">Jenis</th>
                    <th className="px-2 py-1 font-medium">Catatan</th>
                    <th className="px-2 py-1 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pegawaiId == null ? (
                    <tr><td colSpan={3} className="px-2 py-3 text-center text-muted-foreground">Pilih pegawai dahulu.</td></tr>
                  ) : loadingDok ? (
                    <tr><td colSpan={3} className="px-2 py-3 text-center text-muted-foreground">Memuat…</td></tr>
                  ) : dokumens.length === 0 ? (
                    <tr><td colSpan={3} className="px-2 py-3 text-center text-muted-foreground">Belum ada dokumen.</td></tr>
                  ) : dokumens.map((d) => {
                    const aktif = d.id === dokId;
                    const kunci = perluDesktop(d);
                    return (
                      <ContextMenu key={d.id}>
                        <ContextMenuTrigger asChild>
                      <tr
                        onClick={() => { if (!kunci) void muatPratinjau(d); }}
                        title={kunci ? 'Berkas hanya ada di arsip perangkat — buka lewat aplikasi desktop' : 'Klik untuk pratinjau'}
                        aria-selected={aktif}
                        className={cn(
                          'border-t',
                          kunci ? 'opacity-60' : 'cursor-pointer',
                          aktif ? 'bg-accent font-medium' : (!kunci && 'hover:bg-muted/60'),
                        )}
                      >
                        <td className="px-2">
                          <span
                            title={d.is_active === false ? 'Nonaktif' : 'Aktif'}
                            className={cn(
                              'mr-1.5 inline-block size-2 rounded-full align-middle',
                              d.is_active === false ? 'bg-red-500' : 'bg-green-500',
                            )}
                          />
                          {d.jenis_dokumen}
                        </td>
                        <td className="max-w-40 truncate px-2 text-muted-foreground" title={d.catatan ?? undefined}>{d.catatan || '—'}</td>
                        <td className="px-2 text-right">
                          <span className="inline-block" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  id={`btn_aksi_dok_lihat_pegawai_${d.id}`}
                                  size="sm"
                                  variant="ghost"
                                  title="Aksi dokumen"
                                  className="size-6 px-0"
                                >
                                  <MoreVertical size={14} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {d.nama_file && (
                                  <DropdownMenuItem
                                    disabled={kunci}
                                    title={kunci ? 'Berkas hanya ada di arsip perangkat — buka lewat aplikasi desktop' : 'Unduh berkas'}
                                    onClick={() => void unduhCerdas(d)}
                                  >
                                    <Download size={14} /> Unduh
                                  </DropdownMenuItem>
                                )}
                                {canUbah && (
                                  <DropdownMenuItem
                                    disabled={kunci}
                                    title={kunci ? 'Baris arsip perangkat hanya bisa diganti lewat aplikasi desktop' : 'Ganti berkas'}
                                    onClick={() => { setGantiFile(null); setGantiRow(d); }}
                                  >
                                    <Upload size={14} /> Ganti
                                  </DropdownMenuItem>
                                )}
                                {canUbah && d.is_active === false && (
                                  <DropdownMenuItem
                                    title="Jadikan dokumen aktif (menonaktifkan yang lain se-kunci)"
                                    onClick={() => void onToggleAktif(d)}
                                  >
                                    <Check size={14} /> Jadikan aktif
                                  </DropdownMenuItem>
                                )}
                                {canHapus && (
                                  <DropdownMenuItem
                                    disabled={kunci}
                                    title={kunci ? 'Baris arsip perangkat hanya bisa dihapus lewat aplikasi desktop (agar salinannya ikut bersih)' : 'Hapus dokumen'}
                                    onClick={() => setHapusRow(d)}
                                  >
                                    <Trash2 size={14} /> Hapus
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </span>
                        </td>
                      </tr>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          {canUbah && (
                            <ContextMenuItem
                              id={`menu_toggle_aktif_dok_lihat_pegawai_${d.id}`}
                              disabled={busy}
                              onClick={() => void onToggleAktif(d)}
                            >
                              {d.is_active === false ? <Check size={14} /> : <X size={14} />}
                              {d.is_active === false ? 'Aktifkan' : 'Nonaktifkan'}
                            </ContextMenuItem>
                          )}
                        </ContextMenuContent>
                      </ContextMenu>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <FieldLabel id="label_info_dokumen_lihat_pegawai">Info dokumen</FieldLabel>
              {infoKotor && (
                <>
                  <TombolIkon
                    tip="Kembalikan ke nilai awal"
                    id="btn_reset_info_dok_lihat_pegawai"
                    size="icon"
                    variant="ghost"
                    className="size-6"
                    disabled={busy}
                    onClick={() => {
                      setEditJenis(dokPratinjau?.jenis_dokumen ?? '');
                      setEditCatatan(dokPratinjau?.catatan ?? '');
                      setEditAktif(dokPratinjau?.is_active === false ? 'Tidak' : 'Ya');
                      setEditNama(dokPratinjau?.nama_file ?? '');
                      setEditLokasi(dokPratinjau?.penyimpanan ?? 'server');
                    }}
                  >
                    <Undo2 size={14} />
                  </TombolIkon>
                  <TombolIkon
                    tip="Simpan perubahan jenis/catatan"
                    id="btn_simpan_info_dok_lihat_pegawai"
                    size="icon"
                    variant="ghost"
                    className="size-6"
                    disabled={busy || editJenis.trim() === '' || !infoBisaUbah}
                    onClick={() => void onUbah()}
                  >
                    <Save size={14} />
                  </TombolIkon>
                </>
              )}
            </div>
            {dokPratinjau == null ? (
              <div className="h-44 overflow-y-auto rounded-md border px-2 py-1.5">
                <p className="text-xs text-muted-foreground">Pilih baris dokumen untuk melihat info.</p>
              </div>
            ) : (
              <dl id="info_dokumen_lihat_pegawai" className="grid h-44 grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 overflow-y-auto rounded-md border px-2 py-1.5 text-xs">
                <dt className="text-muted-foreground">Nama guru</dt>
                <dd>{dokPratinjau.nama_lengkap ?? pegawaiDipilih?.nama_lengkap ?? '—'}</dd>
                <dt className="text-muted-foreground">Jenis</dt>
                <dd>
                  {infoBisaUbah ? (
                    <ComboCari
                      id="combo_jenis_info_dok_lihat_pegawai"
                      inputId="input_jenis_info_dok_lihat_pegawai"
                      value={editJenis}
                      onChange={setEditJenis}
                      options={opsiJenisUbah}
                      placeholder="Pilih jenis…"
                      className="w-full"
                    />
                  ) : (
                    <span title={canUbah && dokPratinjau ? judulSelaras(dokPratinjau) : undefined}>{dokPratinjau.jenis_dokumen}</span>
                  )}
                </dd>
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  {infoBisaUbah ? (
                    <ComboCari
                      id="combo_status_info_dok_lihat_pegawai"
                      inputId="input_status_info_dok_lihat_pegawai"
                      value={editAktif}
                      onChange={setEditAktif}
                      options={[{ value: 'Ya', label: 'Aktif' }, { value: 'Tidak', label: 'Nonaktif' }]}
                      placeholder="Pilih status…"
                      className="w-full"
                    />
                  ) : (
                    dokPratinjau.is_active === false ? 'Nonaktif' : 'Aktif'
                  )}
                </dd>
                <dt className="text-muted-foreground">Nama berkas</dt>
                <dd>
                  {infoBisaUbah ? (
                    <Input
                      id="input_nama_info_dok_lihat_pegawai"
                      value={editNama}
                      onChange={(e) => setEditNama(e.target.value)}
                      placeholder="nama berkas…"
                      className="h-6 text-xs"
                    />
                  ) : (
                    <span className="block truncate" title={dokPratinjau.nama_file ?? undefined}>{dokPratinjau.nama_file ?? '—'}</span>
                  )}
                </dd>
                <dt className="text-muted-foreground">Lokasi</dt>
                <dd>
                  {infoBisaUbah ? (
                    <ComboCari
                      id="combo_lokasi_info_dok_lihat_pegawai"
                      inputId="input_lokasi_info_dok_lihat_pegawai"
                      value={editLokasi}
                      onChange={setEditLokasi}
                      options={[
                        { value: 'server', label: 'Server' },
                        { value: 'lokal', label: 'Lokal' },
                        { value: 'test', label: 'Test' },
                        ...((dokPratinjau.penyimpanan ?? 'server') === 'cermin'
                          ? [{ value: 'cermin', label: 'Cermin' }]
                          : []),
                      ]}
                      placeholder="Pilih lokasi…"
                      className="w-full"
                    />
                  ) : (
                    lokasiLabel(dokPratinjau)
                  )}
                </dd>
                <dt className="text-muted-foreground">Catatan</dt>
                <dd>
                  {infoBisaUbah ? (
                    <Input
                      id="input_catatan_info_dok_lihat_pegawai"
                      value={editCatatan}
                      onChange={(e) => setEditCatatan(e.target.value)}
                      placeholder="opsional"
                      className="h-6 text-xs"
                    />
                  ) : (
                    <span className="block truncate" title={dokPratinjau.catatan ?? undefined}>{dokPratinjau.catatan || '—'}</span>
                  )}
                </dd>
              </dl>
            )}
          </div>
          {canTambah && (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              <Button
                id="tombol_tambah_dok_lihat_pegawai"
                size="sm"
                disabled={!pegawaiDipilih}
                onClick={() => setTambahTerbuka(true)}
                title={pegawaiDipilih ? 'Tambah dokumen untuk pegawai ini' : 'Pilih pegawai dahulu'}
              >
                <Plus size={14} /> Tambah Dokumen
              </Button>
            </div>
          )}
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle orientation="horizontal" id="gagang_lihat_dokumen_pegawai" aria-label="Atur lebar kolom daftar dan pratinjau" />
        {/* Kolom 2: pratinjau + edit (fungsi sama dengan Tambah Dokumen). */}
        <ResizablePanel minSize="25%" id="panel_lihat_dokumen_pegawai_pratinjau" className="min-h-0 min-w-0">
          <div className="flex h-full min-h-0 flex-col gap-1.5">
            {kotor && keluaran && dokId !== null && (
              <div className="flex shrink-0 items-center gap-2 rounded-md border border-dashed px-2 py-1">
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {prosesViewer ? 'Menyiapkan hasil…' : 'Ada perubahan belum disimpan.'}
                </span>
                <TombolIkon tip="Buang perubahan" variant="outline" size="icon" onClick={() => setKunciViewer((k) => k + 1)}>
                  <Undo2 size={14} />
                </TombolIkon>
                <TombolIkon tip={prosesViewer ? 'Menyiapkan hasil…' : 'Simpan hasil edit'} id="btn_simpan_edit_dok_lihat_pegawai" size="icon" disabled={busy || prosesViewer} onClick={() => void onSimpanEdit()}>
                  <Save size={14} />
                </TombolIkon>
              </div>
            )}
            <div className="min-h-0 flex-1">
              <PenampilBerkas
                key={`lihat_dokumen_pegawai_${dokId ?? 'kosong'}_${kunciViewer}`}
                sumber={pratinjau}
                kualitas="asli"
                onKeluaran={setKeluaran}
                onKotor={setKotor}
                onProses={setProsesViewer}
                idPrefix="lihat_dokumen_pegawai"
                bisaUbah={bisaUbahViewer}
                teksKosong="Belum ada dokumen dipilih — pilih pegawai lalu klik baris dokumen."
              />
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
      {pegawaiDipilih && (
        <TambahDokumenPegawaiDialog
          terbuka={tambahTerbuka}
          pemilik={{
            id: pegawaiDipilih.id,
            namaLengkap: pegawaiDipilih.nama_lengkap,
            nipp: pegawaiDipilih.nipp,
            penempatanAktif: [...new Set((pegawaiDipilih.penempatan ?? [])
              .filter((t) => t.is_active_lembaga === 'Ya')
              .map((t) => t.jenjang))],
          }}
          onTutup={() => setTambahTerbuka(false)}
          onSelesai={() => { void segarkanSetelahSinkron(); }}
        />
      )}
      <DialogSinkronDokumen
        tipe="pegawai"
        terbuka={sinkronTerbuka}
        onTutup={() => setSinkronTerbuka(false)}
        ambilBaris={async () => (pegawaiId == null
          ? []
          : (await listDokumen('pegawai', { pegawai_id: pegawaiId, per_page: 0 })).data)}
        lingkup={pegawaiId == null ? 'Pegawai belum dipilih' : `Pegawai: ${namaPegawaiAktif || `#${pegawaiId}`}`}
        onSelesai={() => { void segarkanSetelahSinkron(); }}
      />
      <AlertDialog open={hapusRow !== null} onOpenChange={(o) => { if (!o) setHapusRow(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus dokumen "{hapusRow?.jenis_dokumen}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Dokumen milik pegawai terpilih dihapus permanen beserta berkas fisiknya.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogCancel disabled={busy} aria-label="Batal">
                  <X size={14} />
                </AlertDialogCancel>
              </TooltipTrigger>
              <TooltipContent><p>Batal</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={busy} aria-label="Hapus dokumen" onClick={() => void onHapus()}>
                  <Trash2 size={14} />
                </AlertDialogAction>
              </TooltipTrigger>
              <TooltipContent><p>Hapus dokumen</p></TooltipContent>
            </Tooltip>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={gantiRow !== null} onOpenChange={(o) => { if (!o) setGantiRow(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ganti berkas: {gantiRow?.jenis_dokumen}</DialogTitle>
            <DialogDescription>Berkas lama diganti di lokasi yang sama; salinan arsip lama (bila ada) ikut dibuang.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <TombolIkon tip="Pilih berkas" variant="outline" size="icon" onClick={() => void onBrowseGanti()}>
              <FolderOpen size={14} />
            </TombolIkon>
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={gantiFile?.name}>
              {gantiFile ? `${gantiFile.name} (${(gantiFile.size / 1024).toFixed(0)} KB)` : 'Belum ada berkas dipilih.'}
            </span>
          </div>
            <input
              ref={inputGantiWebRef}
              id="input_ganti_dok_lihat_pegawai"
              type="file"
              className="hidden"
              onChange={onFileGantiWeb}
            />
          <DialogFooter>
            <TombolIkon tip="Batal" variant="outline" size="icon" onClick={() => setGantiRow(null)}>
              <X size={14} />
            </TombolIkon>
            <TombolIkon tip="Ganti berkas" id="btn_proses_ganti_dok_lihat_pegawai" size="icon" disabled={!gantiFile || busy} onClick={() => void onGanti()}>
              <Upload size={14} />
            </TombolIkon>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
