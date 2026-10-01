import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ambilBerkas, errorMessage, isTauri, prefGet } from '../api/client';
import { bisa } from '../api/auth';
import { useAuth } from '../auth/AuthContext';
import { listSantri, type Santri } from '../api/santri';
import { listDokumen, hapusDokumen, ubahDokumen, unggahBerkasDokumen, unduhBerkasDokumen, type DokumenRow } from '../api/dokumen';
import { listKelas, referensiList, type Kelas, type ReferensiRow } from '../api/master';
import { listRiwayatBelajar } from '../api/siklus';
import { Button } from '@/components/ui/button';
import TombolIkon from '@/components/TombolIkon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useFilterGlobalAktif } from '@/hooks/useFilterGlobalAktif';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { TopBarSearch } from '@/components/TopBarSearch';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import ComboCari from '@/components/ComboCari';
import { ProfilSantriDialog } from '@/components/ProfilSantriDialog';
import { cn } from '@/lib/utils';
import { jenjangTampilSantri, urutSantriFilter, type InfoUrutSantri } from '@/lib/urut';
import {
  BATAS_BERKAS,
  EKSTENSI_BOLEH,
  ekstensiDariNama,
  mimeDariEkstensi,
  pilihBerkasDokumen,
} from '@/lib/arsipDokumen';
import PenampilBerkas, { type SumberBerkas } from '@/components/dokumen/PenampilBerkas';
import { gantiEkstensi, type HasilGambar } from '@/lib/olahGambar';
import { Check, Download, FolderOpen, MoreVertical, Pencil, Save, Trash2, Undo2, Upload, X } from '@/icons';
import { toast } from 'sonner';

/** Halaman Lihat Dokumen — tata letak sama dengan Tambah Dokumen.
 *  Kolom 1 baris 1: tabel Daftar Santri; baris 2: tabel Daftar Dokumen
 *  milik santri terpilih (klik baris = pratinjau di kolom 2).
 *  Kolom 2: pratinjau baca-saja + aksi Unduh/Ganti per baris. */
export default function LihatDokumenSantriPage() {
  const { user } = useAuth();
  const desktop = isTauri();
  const canUbah = bisa(user, 'dokumen_santri.ubah');
  const canHapus = bisa(user, 'dokumen_santri.hapus');
  const {
    jenjangs,
    tahunAjaranNames,
    semesters,
    tingkat: tingkatAktif,
    kelas: kelasAktif,
    loading: filterLoading,
  } = useFilterGlobalAktif();

  // ----- Daftar santri (kolom 1, baris 1) -----
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

  // ----- Daftar dokumen milik santri terpilih (kolom 1, baris 2) -----
  const [dokumens, setDokumens] = useState<DokumenRow[]>([]);
  const [loadingDok, setLoadingDok] = useState(false);
  /** Salinan arsip yang benar-benar ada di perangkat ini (kunci: id dokumen). */
  const [arsipAda, setArsipAda] = useState<Record<number, boolean>>({});
  const muatDokumen = useCallback(async (sid: number, signal?: AbortSignal) => {
    setLoadingDok(true);
    try {
      const p = await listDokumen('santri', { santri_id: sid, per_page: 0, signal });
      if (signal?.aborted) return;
      setDokumens(p.data);
      // Petakan keberadaan salinan arsip (desktop saja, baris lokal/test) —
      // dasar mengaktifkan/mematikan aksi Ubah.
      if (!isTauri()) { setArsipAda({}); return; }
      const perlu = p.data.filter((d) => (d.penyimpanan ?? 'server') !== 'server' && d.nama_file);
      if (perlu.length === 0) { setArsipAda({}); return; }
      try {
        const { PREF_FOLDER_ARSIP, PREF_FOLDER_ARSIP_TEST, ROOT_ARSIP_DOKUMEN, ROOT_ARSIP_TEST, akarArsip, cariArsip } = await import('@/lib/arsipDokumen');
        const [a, b] = await Promise.all([
          prefGet(PREF_FOLDER_ARSIP).catch(() => null),
          prefGet(PREF_FOLDER_ARSIP_TEST).catch(() => null),
        ]);
        const akars = await Promise.all([
          akarArsip(typeof a === 'string' ? a : '', ROOT_ARSIP_DOKUMEN),
          akarArsip(typeof b === 'string' ? b : '', ROOT_ARSIP_TEST),
        ]);
        const peta: Record<number, boolean> = {};
        for (const d of perlu) {
          let ketemu = false;
          for (const akar of akars) {
            if ((await cariArsip(d.nama_file as string, d.jenis_dokumen, akar, 'santri')) !== null) { ketemu = true; break; }
          }
          peta[d.id] = ketemu;
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
    if (santriId == null) { setDokumens([]); return; }
    const c = new AbortController();
    void muatDokumen(santriId, c.signal);
    return () => c.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [santriId, muatDokumen]);

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
        const { exists, readFile } = await import('@tauri-apps/plugin-fs');
        const { PREF_FOLDER_ARSIP, PREF_FOLDER_ARSIP_TEST, ROOT_ARSIP_DOKUMEN, ROOT_ARSIP_TEST, akarArsip, cariArsip } = await import('@/lib/arsipDokumen');
        const [a, b] = await Promise.all([
          prefGet(PREF_FOLDER_ARSIP).catch(() => null),
          prefGet(PREF_FOLDER_ARSIP_TEST).catch(() => null),
        ]);
        const akars = await Promise.all([
          akarArsip(typeof a === 'string' ? a : '', ROOT_ARSIP_DOKUMEN),
          akarArsip(typeof b === 'string' ? b : '', ROOT_ARSIP_TEST),
        ]);
        for (const akar of akars) {
          const target = await cariArsip(r.nama_file, r.jenis_dokumen, akar, 'santri');
          if (target) {
            const bytes = await readFile(target);
            setPratinjau({ bytes: new Uint8Array(bytes), mime, nama });
            return;
          }
        }
        toast.error('Berkas tidak ada di arsip perangkat ini — hanya tersimpan di perangkat asal.');
        return;
      }
      if (lokasi !== 'server' && !desktop) {
        toast.error('Berkas tersimpan di arsip perangkat, bukan di server. Buka lewat aplikasi desktop.');
        return;
      }
      const buf = await ambilBerkas(`/admin/dokumen/santri/${r.id}/unduh`);
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
      await unduhBerkasDokumen('santri', r.id, r.nama_file ?? 'dokumen').catch((e) => toast.error(errorMessage(e)));
      return;
    }
    try {
      const { exists, readFile, writeFile } = await import('@tauri-apps/plugin-fs');
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { PREF_FOLDER_ARSIP, PREF_FOLDER_ARSIP_TEST, ROOT_ARSIP_DOKUMEN, ROOT_ARSIP_TEST, akarArsip, cariArsip } = await import('@/lib/arsipDokumen');
      const [a, b] = await Promise.all([
        prefGet(PREF_FOLDER_ARSIP).catch(() => null),
        prefGet(PREF_FOLDER_ARSIP_TEST).catch(() => null),
      ]);
      const akars = await Promise.all([
        akarArsip(typeof a === 'string' ? a : '', ROOT_ARSIP_DOKUMEN),
        akarArsip(typeof b === 'string' ? b : '', ROOT_ARSIP_TEST),
      ]);
      for (const akar of akars) {
        const target = await cariArsip(r.nama_file, r.jenis_dokumen, akar, 'santri');
        if (target) {
          const bytes = await readFile(target);
          const tujuan = await save({
            defaultPath: r.nama_file,
            filters: [{ name: 'Dokumen', extensions: ['jpg', 'jpeg', 'png', 'pdf'] }],
          });
          if (!tujuan) return;
          await writeFile(tujuan, bytes);
          toast.success(`Tersimpan: ${String(tujuan).split('/').pop() ?? r.nama_file}`);
          return;
        }
      }
      toast.error('Berkas tidak ada di arsip perangkat ini — hanya tersimpan di perangkat asal.');
    } catch (e) {
      toast.warning(`Arsip lokal gagal dibaca: ${errorMessage(e)}`);
    }
  }, []);

  /** Aksi butuh desktop bila byte hanya ada di arsip perangkat tapi dibuka dari web. */
  const perluDesktop = useCallback(
    (r: DokumenRow) => !isTauri() && (r.penyimpanan ?? 'server') !== 'server',
    [],
  );

  /** Bersihkan salinan arsip lokal (desktop, best-effort, diam bila tak ada). */
  const bersihkanArsip = useCallback(async (nama: string | null, jenis: string) => {
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
        await hapusArsip(nama, jenis, akar, 'santri');
      }
    } catch (e) {
      toast.warning(`Arsip lokal gagal dibersihkan: ${errorMessage(e)}`);
    }
  }, []);

  // ----- Hapus dokumen -----
  const [hapusRow, setHapusRow] = useState<DokumenRow | null>(null);

  const onHapus = useCallback(async () => {
    if (!hapusRow) return;
    setBusy(true);
    try {
      const nama = hapusRow.nama_file;
      const jenis = hapusRow.jenis_dokumen;
      const idHapus = hapusRow.id;
      await hapusDokumen('santri', hapusRow.id);
      toast.success('Dokumen dihapus.');
      await bersihkanArsip(nama, jenis);
      setHapusRow(null);
      if (dokId === idHapus) { setDokId(null); setPratinjau(null); }
      if (santriId != null) {
        await muatDokumen(santriId);
        void muatJumlahSantri().then(setJumlahSantri);
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [hapusRow, dokId, santriId, muatDokumen, muatJumlahSantri, bersihkanArsip]);

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

  // ----- Ubah jenis/catatan -----
  const [editRow, setEditRow] = useState<DokumenRow | null>(null);
  const [editJenis, setEditJenis] = useState('');
  const [editLembaga, setEditLembaga] = useState('');
  const [editCatatan, setEditCatatan] = useState('');

  /** Opsi jenis dari referensi (sama dengan halaman Tambah). */
  const [jenisRows, setJenisRows] = useState<ReferensiRow[]>([]);
  useEffect(() => {
    if (jenjangs.length === 0) { setJenisRows([]); return; }
    let hidup = true;
    referensiList('jenis_dokumen_santri', jenjangs)
      .then((r) => { if (hidup) setJenisRows(r); })
      .catch(() => { if (hidup) setJenisRows([]); });
    return () => { hidup = false; };
  }, [jenjangs]);
  const opsiJenisUbah = useMemo(() => {
    const opsi = jenisRows.map((r) => ({ value: String(r.nama ?? r.kode), label: String(r.nama ?? r.kode) }));
    // Nilai tersimpan yang tak ada di referensi tetap bisa tampil/terpilih.
    const kini = editJenis.trim();
    if (kini !== '' && !opsi.some((o) => o.value === kini)) opsi.push({ value: kini, label: kini });
    return opsi;
  }, [jenisRows, editJenis]);

  function bukaUbah(r: DokumenRow) {
    setEditJenis(r.jenis_dokumen ?? '');
    setEditLembaga(r.lembaga ?? '');
    setEditCatatan(r.catatan ?? '');
    setEditRow(r);
  }

  const onUbah = useCallback(async () => {
    if (!editRow || editJenis.trim() === '') return;
    setBusy(true);
    const namaLama = editRow.nama_file;
    const jenisLama = editRow.jenis_dokumen;
    const jenisBaru = editJenis.trim();
    const idUbah = editRow.id;
    const lokasi = editRow.penyimpanan ?? 'server';
    try {
      const hasil = await ubahDokumen('santri', editRow.id, {
        jenis_dokumen: jenisBaru,
        lembaga: editLembaga || null,
        catatan: editCatatan.trim() || null,
        // Pemanggil menjamin byte ikut pindah (lihat bisaSelaras).
        selaraskan_nama: true,
      });
      toast.success('Dokumen diubah.');
      setEditRow(null);
      // Desktop: pindahkan salinan arsip mengikuti nama + folder baru.
      const namaBaru = hasil.data?.nama_file ?? null;
      if (desktop && lokasi !== 'server' && namaLama && namaBaru && namaBaru !== namaLama) {
        try {
          const { exists, mkdir, rename } = await import('@tauri-apps/plugin-fs');
          const { join } = await import('@tauri-apps/api/path');
          const { PREF_FOLDER_ARSIP, PREF_FOLDER_ARSIP_TEST, ROOT_ARSIP_DOKUMEN, ROOT_ARSIP_TEST, akarArsip, cariArsip } = await import('@/lib/arsipDokumen');
          const [a, b] = await Promise.all([
            prefGet(PREF_FOLDER_ARSIP).catch(() => null),
            prefGet(PREF_FOLDER_ARSIP_TEST).catch(() => null),
          ]);
          const akars = await Promise.all([
            akarArsip(typeof a === 'string' ? a : '', ROOT_ARSIP_DOKUMEN),
            akarArsip(typeof b === 'string' ? b : '', ROOT_ARSIP_TEST),
          ]);
          let pindah = false;
          for (const akar of akars) {
            const lama = await cariArsip(namaLama, jenisLama, akar, 'santri');
            if (!lama) continue;
            const folderTipe = await join(akar, 'santri');
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
      if (santriId != null) {
        await muatDokumen(santriId);
        if (dokId === idUbah) {
          const p = await listDokumen('santri', { santri_id: santriId, per_page: 0 });
          const baru = p.data.find((dd) => dd.id === idUbah);
          if (baru) void muatPratinjau(baru);
        }
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [editRow, editJenis, editLembaga, editCatatan, santriId, dokId, desktop, muatDokumen, muatPratinjau]);

  // ----- Ganti berkas -----
  const [gantiRow, setGantiRow] = useState<DokumenRow | null>(null);
  const [gantiFile, setGantiFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const inputGantiWebRef = useRef<HTMLInputElement>(null);

  async function onBrowseGanti() {
    if (desktop) {
      try {
        const b = await pilihBerkasDokumen();
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
        const { tulisGantiArsip } = await import('@/lib/arsipDokumen');
        const namaBaru = await tulisGantiArsip({
          namaLama,
          jenis: row.jenis_dokumen,
          pemilik: row.pemilik ?? '',
          catatan: row.catatan ?? '',
          ext: ekstensiDariNama(file.name),
          data: new Uint8Array(await file.arrayBuffer()),
          lokasi,
          tipe: 'santri',
        });
        if (namaBaru !== namaLama) {
          await ubahDokumen('santri', row.id, { nama_file: namaBaru });
        }
        toast.success('Berkas diganti.');
        if (santriId != null) {
          await muatDokumen(santriId);
          void muatJumlahSantri().then(setJumlahSantri);
        }
        if (dokId === idLama && santriId != null) {
          const p = await listDokumen('santri', { santri_id: santriId, per_page: 0 });
          const baru = p.data.find((d) => d.id === idLama);
          if (baru) void muatPratinjau(baru);
        }
        return true;
      }
      await unggahBerkasDokumen('santri', row.id, file);
      toast.success('Berkas diganti.');
      await bersihkanArsip(namaLama, jenisLama);
      if (santriId != null) {
        await muatDokumen(santriId);
        void muatJumlahSantri().then(setJumlahSantri);
      }
      // Segarkan pratinjau bila baris yang diganti sedang tampil.
      if (dokId === idLama && santriId != null) {
        const p = await listDokumen('santri', { santri_id: santriId, per_page: 0 });
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
  }, [santriId, dokId, muatDokumen, muatJumlahSantri, muatPratinjau, bersihkanArsip]);

  const onGanti = useCallback(async () => {
    if (!gantiRow || !gantiFile) return;
    if (await terapkanGanti(gantiRow, gantiFile)) {
      setGantiRow(null);
      setGantiFile(null);
    }
  }, [gantiRow, gantiFile, terapkanGanti]);

  const daftarIds = useMemo(() => santris.map((s) => s.id), [santris]);

  /** Keluaran viewer (hasil putar/crop/resize/editor) + status kotor. */
  const [keluaran, setKeluaran] = useState<HasilGambar | null>(null);
  const [kotor, setKotor] = useState(false);
  /** Pipeline viewer sibuk: Simpan dikunci agar tak mengunggah byte basi. */
  const [prosesViewer, setProsesViewer] = useState(false);
  /** Kunci remount viewer (Buang perubahan mengembalikan tampilan asli). */
  const [kunciViewer, setKunciViewer] = useState(0);
  /** Baris yang sedang dipratinjau — dasar mengaktifkan tombol ubah viewer. */
  const dokPratinjau = useMemo(() => dokumens.find((d) => d.id === dokId) ?? null, [dokumens, dokId]);
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
        const { tulisBalikArsip } = await import('@/lib/arsipDokumen');
        await tulisBalikArsip(dokPratinjau.nama_file, namaBaru, dokPratinjau.jenis_dokumen, keluaran.bytes, 'santri');
        if (namaBaru !== dokPratinjau.nama_file) {
          await ubahDokumen('santri', dokPratinjau.id, { nama_file: namaBaru });
        }
        toast.success('Berkas diganti.');
        if (santriId != null) {
          await muatDokumen(santriId);
          const p = await listDokumen('santri', { santri_id: santriId, per_page: 0 });
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
  }, [dokPratinjau, keluaran, pratinjau, terapkanGanti, santriId, muatDokumen, muatPratinjau]);

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
  const lokasiLabel = (r: DokumenRow) =>
    (r.penyimpanan ?? 'server') === 'lokal' ? 'Lokal' : (r.penyimpanan ?? 'server') === 'test' ? 'Test' : 'Server';

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <TopBarSearch value={cari} onChange={setCari} placeholder="Cari santri…" />
      <PengaturanHalaman tampil={sumber === 'filter' ? { tahun_ajaran: true, semester: true, tingkat: true, kelas: true } : {}} />
      <ResizablePanelGroup orientation="horizontal" id="grup_lihat_dokumen" className="min-h-0 flex-1 overflow-hidden">
        {/* Kolom 1: daftar santri (baris 1) + daftar dokumen (baris 2). */}
        <ResizablePanel defaultSize={400} minSize={300} maxSize="70%" id="panel_lihat_dokumen_daftar" className="min-h-0">
          <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto rounded-xl border bg-card p-4">
          <div className="flex min-h-0 flex-1 flex-col gap-1.5">
            <FieldLabel id="label_sumber_santri_lihat">Daftar santri</FieldLabel>
            <div id="radio_sumber_santri_lihat" role="radiogroup" aria-labelledby="label_sumber_santri_lihat" className="flex flex-wrap gap-2">
              {([
                ['filter', 'Filter Santri'],
                ['buku', 'Buku Induk'],
              ] as const).map(([nilai, label]) => (
                <label
                  key={nilai}
                  htmlFor={`radio_sumber_lihat_${nilai}`}
                  className="inline-flex h-6 cursor-pointer items-center gap-2 rounded-full border bg-card px-3 py-0 text-xs has-checked:border-primary has-checked:bg-accent has-checked:font-semibold"
                >
                  <input
                    type="radio"
                    id={`radio_sumber_lihat_${nilai}`}
                    name="sumber_santri_lihat"
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
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-1.5">
            <FieldLabel id="label_daftar_dokumen_lihat">Daftar dokumen{santriId != null && dokumens.length > 0 ? ` (${dokumens.length})` : ''}</FieldLabel>
            <div className="min-h-[120px] flex-1 overflow-y-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr className="text-left">
                    <th className="px-2 py-1 font-medium">Jenis</th>
                    <th className="px-2 py-1 font-medium">Berkas</th>
                    <th className="px-2 py-1 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {santriId == null ? (
                    <tr><td colSpan={3} className="px-2 py-3 text-center text-muted-foreground">Pilih santri dahulu.</td></tr>
                  ) : loadingDok ? (
                    <tr><td colSpan={3} className="px-2 py-3 text-center text-muted-foreground">Memuat…</td></tr>
                  ) : dokumens.length === 0 ? (
                    <tr><td colSpan={3} className="px-2 py-3 text-center text-muted-foreground">Belum ada dokumen.</td></tr>
                  ) : dokumens.map((d) => {
                    const aktif = d.id === dokId;
                    const kunci = perluDesktop(d);
                    return (
                      <tr
                        key={d.id}
                        onClick={() => { if (!kunci) void muatPratinjau(d); }}
                        title={kunci ? 'Berkas hanya ada di arsip perangkat — buka lewat aplikasi desktop' : 'Klik untuk pratinjau'}
                        aria-selected={aktif}
                        className={cn(
                          'border-t',
                          kunci ? 'opacity-60' : 'cursor-pointer',
                          aktif ? 'bg-accent font-medium' : (!kunci && 'hover:bg-muted/60'),
                        )}
                      >
                        <td className="px-2 py-1">
                          {d.jenis_dokumen}
                          {d.lembaga ? <Badge variant="outline" className="ml-1 py-0 text-[10px] leading-3">{d.lembaga}</Badge> : null}
                          {d.is_active === false ? <span className="ml-1 text-[10px] text-muted-foreground">(nonaktif)</span> : null}
                        </td>
                        <td className="max-w-40 truncate px-2 py-1 text-muted-foreground" title={d.nama_file ?? undefined}>
                          {d.nama_file ?? '—'} · {lokasiLabel(d)}
                        </td>
                        <td className="px-2 py-1 text-right">
                          <span className="inline-block" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  id={`btn_aksi_dok_lihat_${d.id}`}
                                  size="sm"
                                  variant="ghost"
                                  title="Aksi dokumen"
                                  className="size-6 px-0"
                                >
                                  <MoreVertical size={14} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {canUbah && (
                                  <DropdownMenuItem
                                    disabled={!bisaSelaras(d)}
                                    title={judulSelaras(d)}
                                    onClick={() => bukaUbah(d)}
                                  >
                                    <Pencil size={14} /> Ubah
                                  </DropdownMenuItem>
                                )}
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
                                    onClick={() => void (async () => {
                                      setBusy(true);
                                      try {
                                        await ubahDokumen('santri', d.id, { is_active: true });
                                        toast.success('Dokumen diaktifkan.');
                                        if (santriId != null) await muatDokumen(santriId);
                                      } catch (e) {
                                        toast.error(errorMessage(e));
                                      } finally {
                                        setBusy(false);
                                      }
                                    })()}
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle orientation="horizontal" id="gagang_lihat_dokumen" aria-label="Atur lebar kolom daftar dan pratinjau" />
        {/* Kolom 2: pratinjau + edit (fungsi sama dengan Tambah Dokumen). */}
        <ResizablePanel minSize="25%" id="panel_lihat_dokumen_pratinjau" className="min-h-0 min-w-0">
          <div className="flex h-full min-h-0 flex-col gap-1.5">
            {kotor && keluaran && dokId !== null && (
              <div className="flex shrink-0 items-center gap-2 rounded-md border border-dashed px-2 py-1">
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {prosesViewer ? 'Menyiapkan hasil…' : 'Ada perubahan belum disimpan.'}
                </span>
                <TombolIkon tip="Buang perubahan" variant="outline" size="icon" onClick={() => setKunciViewer((k) => k + 1)}>
                  <Undo2 size={14} />
                </TombolIkon>
                <TombolIkon tip={prosesViewer ? 'Menyiapkan hasil…' : 'Simpan hasil edit'} id="btn_simpan_edit_dok_lihat" size="icon" disabled={busy || prosesViewer} onClick={() => void onSimpanEdit()}>
                  <Save size={14} />
                </TombolIkon>
              </div>
            )}
            <div className="min-h-0 flex-1">
              <PenampilBerkas
                key={`lihat_dokumen_${dokId ?? 'kosong'}_${kunciViewer}`}
                sumber={pratinjau}
                kualitas="asli"
                onKeluaran={setKeluaran}
                onKotor={setKotor}
                onProses={setProsesViewer}
                idPrefix="lihat_dokumen"
                bisaUbah={bisaUbahViewer}
                teksKosong="Belum ada dokumen dipilih — pilih santri lalu klik baris dokumen."
              />
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
      <ProfilSantriDialog
        target={profilId != null ? { id: profilId, daftar: daftarIds } : null}
        onGanti={(id) => setProfilId(id)}
        onOpenChange={(o) => { if (!o) setProfilId(null); }}
      />
      <AlertDialog open={hapusRow !== null} onOpenChange={(o) => { if (!o) setHapusRow(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus dokumen "{hapusRow?.jenis_dokumen}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Dokumen milik santri terpilih dihapus permanen beserta berkas fisiknya.
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
      <Dialog open={editRow !== null} onOpenChange={(o) => { if (!o) setEditRow(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ubah dokumen</DialogTitle>
            <DialogDescription>Jenis dan catatan milik santri terpilih.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <FieldLabel htmlFor="combo_ubah_jenis_dok_lihat">Jenis dokumen</FieldLabel>
              <ComboCari
                id="combo_ubah_jenis_dok_lihat"
                inputId="input_ubah_jenis_dok_lihat"
                value={editJenis}
                onChange={setEditJenis}
                options={opsiJenisUbah}
                placeholder="Pilih jenis…"
                className="w-full"
              />
            </div>
            <div className="grid gap-1.5">
              <FieldLabel htmlFor="combo_ubah_lembaga_dok_lihat">Lembaga pemakaian (opsional)</FieldLabel>
              <ComboCari
                id="combo_ubah_lembaga_dok_lihat"
                inputId="input_ubah_lembaga_dok_lihat"
                value={editLembaga}
                onChange={setEditLembaga}
                options={[{ value: '', label: '—' }, ...jenjangs.map((j) => ({ value: j, label: j }))]}
                placeholder="Tanpa lembaga…"
                className="w-full"
              />
            </div>
            <div className="grid gap-1.5">
              <FieldLabel htmlFor="input_ubah_catatan_dok_lihat">Catatan</FieldLabel>
              <Input
                id="input_ubah_catatan_dok_lihat"
                value={editCatatan}
                onChange={(e) => setEditCatatan(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <TombolIkon tip="Batal" variant="outline" size="icon" onClick={() => setEditRow(null)}>
              <X size={14} />
            </TombolIkon>
            <TombolIkon tip="Simpan perubahan" id="btn_proses_ubah_dok_lihat" size="icon" disabled={editJenis.trim() === '' || busy} onClick={() => void onUbah()}>
              <Save size={14} />
            </TombolIkon>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
            id="input_ganti_dok_lihat"
            type="file"
            accept=".jpg,.jpeg,.png,.pdf"
            className="hidden"
            onChange={onFileGantiWeb}
          />
          <DialogFooter>
            <TombolIkon tip="Batal" variant="outline" size="icon" onClick={() => setGantiRow(null)}>
              <X size={14} />
            </TombolIkon>
            <TombolIkon tip="Ganti berkas" id="btn_proses_ganti_dok_lihat" size="icon" disabled={!gantiFile || busy} onClick={() => void onGanti()}>
              <Upload size={14} />
            </TombolIkon>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
