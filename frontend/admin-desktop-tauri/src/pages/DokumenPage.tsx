import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage, isTauri, prefGet } from '../api/client';
import type { LokasiArsip } from '@/lib/arsipDokumen';
import { bisa } from '../api/auth';
import { useAuth } from '../auth/AuthContext';
import { listLembaga, type Lembaga } from '../api/master';
import { listSantri } from '../api/santri';
import { listPegawai } from '../api/pegawai';
import {
  hapusDokumen,
  izinDokumen,
  listDokumen,
  simpanDokumen,
  ubahDokumen,
  unggahBerkasDokumen,
  unduhBerkasDokumen,
  type DokumenRow,
  type TipeDokumen,
} from '../api/dokumen';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import TombolIkon from '@/components/TombolIkon';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import ComboCari from '@/components/ComboCari';
import { useDaftarTabel } from '@/hooks/useDaftarTabel';
import { useFilterGlobalAktif } from '@/hooks/useFilterGlobalAktif';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import { TopBarSearch } from '@/components/TopBarSearch';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import Pager from '@/components/Pager';
import { Download, FileUp, RefreshCw, Trash2, Upload } from '@/icons';
import DokumenImportDialog from '@/components/dokumen/DokumenImportDialog';
import DialogSinkronDokumen from '@/components/dokumen/DialogSinkronDokumen';
import { ambilSemuaBaris } from '@/lib/sinkronDokumen';
import { siapkanFileUntukServer } from '@/lib/konversiHeic';
import { toast } from 'sonner';
import { useEffect } from 'react';

interface Konfig {
  judul: string;
  tableKey: string;
  pemilikLabel: string;
  /** Kolom identitas pemilik pada dialog tambah (santri/pegawai pakai pemilih; lembaga pakai jenjang). */
  pemilihPemilik: 'santri' | 'pegawai' | 'jenjang';
}

const KONFIG: Record<TipeDokumen, Konfig> = {
  santri: { judul: 'Dokumen Santri', tableKey: 'dokumen_santri', pemilikLabel: 'Santri', pemilihPemilik: 'santri' },
  pegawai: { judul: 'Dokumen Guru', tableKey: 'dokumen_pegawai', pemilikLabel: 'Guru', pemilihPemilik: 'pegawai' },
  lembaga: { judul: 'Dokumen Madrasah', tableKey: 'dokumen_lembaga', pemilikLabel: 'Lembaga', pemilihPemilik: 'jenjang' },
};

/** Satu implementasi untuk tiga halaman dokumen; perbedaan hanya konfigurasi. */
export default function DokumenPage({ tipe }: { tipe: TipeDokumen }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const izin = izinDokumen(tipe);
  const canTambah = bisa(user, izin.tambah);
  const canUbah = bisa(user, izin.ubah);
  const canHapus = bisa(user, izin.hapus);
  const konfig = KONFIG[tipe];
  const { jenjangs } = useFilterGlobalAktif();

  const [cari, setCari] = useState('');
  const [sinkronTerbuka, setSinkronTerbuka] = useState(false);
  /** Sinkron massal: sementara lingkup santri (pola dipakai ulang tipe lain). */
  const sinkronMassal = tipe === 'santri' && isTauri() && canUbah;
  const [importOpen, setImportOpen] = useState(false);
  const [tambahOpen, setTambahOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hapusRow, setHapusRow] = useState<DokumenRow | null>(null);

  // Opsi pemilik (santri/pegawai) + lembaga untuk dialog tambah.
  const [lembagas, setLembagas] = useState<Lembaga[]>([]);
  const [opsiPemilik, setOpsiPemilik] = useState<{ value: string; label: string }[]>([]);
  const [pemilik, setPemilik] = useState('');
  const [jenjangPemilik, setJenjangPemilik] = useState('');
  const [jenis, setJenis] = useState('');
  const [catatan, setCatatan] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [unggahRow, setUnggahRow] = useState<DokumenRow | null>(null);
  const [unggahFile, setUnggahFile] = useState<File | null>(null);

  useEffect(() => {
    let hidup = true;
    listLembaga({ per_page: 1000 }).then((p) => { if (hidup) setLembagas(p.data); }).catch(() => {});
    return () => { hidup = false; };
  }, []);

  const bukaTambah = useCallback(() => {
    setPemilik(''); setJenjangPemilik(''); setJenis(''); setCatatan(''); setFile(null);
    setOpsiPemilik([]);
    setTambahOpen(true);
    if (konfig.pemilihPemilik !== 'jenjang') {
      if (konfig.pemilihPemilik === 'santri') {
        listSantri({ jenjang: jenjangs.length ? jenjangs : undefined, per_page: 1000 })
          .then((p) => setOpsiPemilik(p.data.map((s) => ({ value: String(s.id), label: s.nama_lengkap }))))
          .catch((e) => toast.error(errorMessage(e)));
      } else {
        listPegawai({ jenjang: jenjangs.length ? jenjangs : undefined, per_page: 1000 })
          .then((p) => setOpsiPemilik(p.data.map((s) => ({ value: String(s.id), label: s.nama_lengkap }))))
          .catch((e) => toast.error(errorMessage(e)));
      }
    }
  }, [konfig.pemilihPemilik, jenjangs]);

  const { rows, loading, err, load, lastPage, total, pager } = useDaftarTabel<DokumenRow>({
    tableKey: konfig.tableKey,
    search: cari,
    ambil: (a) => listDokumen(tipe, {
      jenjang: jenjangs.length ? jenjangs : undefined,
      q: a.search || undefined,
      page: a.page,
      per_page: a.perPage,
      signal: a.signal,
    }),
    deps: [jenjangs],
  });

  const fields: ExcelField[] = useMemo(() => [
    { key: 'pemilik', label: konfig.pemilikLabel, width: 200, kind: 'static', sumber: null },
    ...(tipe === 'santri' ? [{ key: 'nis', label: 'NIS Lokal', width: 110, kind: 'static' as const, sumber: null }] : []),
    ...(tipe === 'lembaga' ? [{ key: 'lembaga_nama', label: 'Nama Lembaga', width: 180, kind: 'static' as const, sumber: null }] : []),
    { key: 'jenis_dokumen', label: 'Jenis Dokumen', width: 170, kind: 'text', maxLength: 100, sumber: null },
    { key: 'nama_file', label: 'Nama Berkas', width: 190, kind: 'static', sumber: null },
    { key: 'lokasi', label: 'Lokasi', width: 90, kind: 'static', sumber: null },
    { key: 'catatan', label: 'Catatan', width: 220, kind: 'text', sumber: null },
  ], [konfig.pemilikLabel, tipe]);

  const nilaiBaris = useCallback((r: DokumenRow): Record<string, string | null> => ({
    pemilik: r.pemilik ?? '—',
    nis: r.nis_lokal ?? '—',
    lembaga_nama: r.lembaga_nama ?? r.lembaga_jenjang ?? '—',
    jenis_dokumen: r.jenis_dokumen ?? '',
    // Tampil = nama template langsung (kolom path sudah dicabut).
    nama_file: r.nama_file ?? null,
    lokasi: r.penyimpanan === 'lokal' ? 'Lokal' : r.penyimpanan === 'test' ? 'Test' : r.penyimpanan === 'cermin' ? 'Cermin' : 'Server',
    catatan: r.catatan ?? '',
  }), []);

  async function commitBaris(id: number, f: Record<string, string | null>) {
    await ubahDokumen(tipe, id, {
      ...(f.jenis_dokumen !== undefined ? { jenis_dokumen: f.jenis_dokumen || null } : {}),
      ...(f.catatan !== undefined ? { catatan: f.catatan || null } : {}),
    });
  }

  const onTambah = useCallback(async () => {
    setBusy(true);
    try {
      let fileKirim: File | undefined;
      if (file) {
        const siapTambah = await siapkanFileUntukServer(file);
        if (siapTambah.dikonversi) toast.info('Berkas HEIC dikonversi ke JPG.');
        fileKirim = siapTambah.file;
      }
      await simpanDokumen(tipe, {
        ...(tipe === 'santri' ? { santri_id: Number(pemilik) } : {}),
        ...(tipe === 'pegawai' ? { pegawai_id: Number(pemilik), jenjang: jenjangPemilik } : {}),
        ...(tipe === 'lembaga' ? { jenjang: jenjangPemilik } : {}),
        jenis_dokumen: jenis,
        ...(catatan ? { catatan } : {}),
      }, fileKirim);
      toast.success('Dokumen disimpan.');
      setTambahOpen(false);
      pager.goFirst();
      await load(1);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [tipe, pemilik, jenjangPemilik, jenis, catatan, file, pager, load]);

  /** Bersihkan salinan arsip lokal (desktop, best-effort, diam bila tak ada).
   *  File asli di folder `sudah/` milik pengguna — tidak disentuh. */
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
        await hapusArsip(nama, jenis, akar, tipe, lokasi);
      }
    } catch (e) {
      toast.warning(`Arsip lokal gagal dibersihkan: ${errorMessage(e)}`);
    }
  }, []);

  const onUnggah = useCallback(async () => {
    if (!unggahRow || !unggahFile) return;
    setBusy(true);
    // Tangkap nama lama sebelum refresh — salinan arsipnya ikut dibuang bila ganti berhasil.
    const namaLama = unggahRow.nama_file;
    const jenisLama = unggahRow.jenis_dokumen;
    const lokasi = unggahRow.penyimpanan ?? 'server';
    try {
      // Arsip perangkat: tulis ulang di lokasi yang sama (lokasi tak berubah).
      if (lokasi !== 'server' && isTauri()) {
        const { ekstensiDariNama, targetTulisLokal, tulisGantiArsip } = await import('@/lib/arsipDokumen');
        const target = await targetTulisLokal(namaLama ?? '', unggahRow.jenis_dokumen, tipe, lokasi);
        const namaBaru = await tulisGantiArsip({
          namaLama,
          jenis: unggahRow.jenis_dokumen,
          pemilik: unggahRow.pemilik ?? '',
          catatan: unggahRow.catatan ?? '',
          ext: ekstensiDariNama(unggahFile.name),
          data: new Uint8Array(await unggahFile.arrayBuffer()),
          lokasi: target.lokasi,
          tipe,
        });
        if (namaBaru !== namaLama) {
          await ubahDokumen(tipe, unggahRow.id, { nama_file: namaBaru });
        }
        toast.success('Berkas diunggah.');
        setUnggahRow(null);
        setUnggahFile(null);
        await load();
        return;
      }
      const siapGanti = await siapkanFileUntukServer(unggahFile);
      if (siapGanti.dikonversi) toast.info('Berkas HEIC dikonversi ke JPG.');
      await unggahBerkasDokumen(tipe, unggahRow.id, siapGanti.file);
      toast.success('Berkas diunggah.');
      await bersihkanArsip(namaLama, jenisLama, lokasi === 'test' ? 'test' : 'lokal');
      setUnggahRow(null);
      setUnggahFile(null);
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [tipe, unggahRow, unggahFile, load, bersihkanArsip]);

  const onHapus = useCallback(async () => {
    if (!hapusRow) return;
    setBusy(true);
    try {
      const nama = hapusRow.nama_file;
      const jenis = hapusRow.jenis_dokumen;
      await hapusDokumen(tipe, hapusRow.id);
      toast.success('Dokumen dihapus.');
      await bersihkanArsip(nama, jenis, (hapusRow.penyimpanan ?? 'server') === 'test' ? 'test' : 'lokal');
      setHapusRow(null);
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [tipe, hapusRow, load, bersihkanArsip]);

  /** Unduh menurut kolom penyimpanan: server langsung; lokal/test via
   *  dialog simpan native dari arsip perangkat (desktop). Tanpa tebak-tebakan. */
  const unduhCerdas = useCallback(async (r: DokumenRow) => {
    const lokasi = r.penyimpanan ?? 'server';
    if (lokasi === 'server' || !isTauri() || !r.nama_file) {
      await unduhBerkasDokumen(tipe, r.id, r.nama_file ?? 'dokumen').catch((e) => toast.error(errorMessage(e)));
      return;
    }
    try {
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { cariLokal } = await import('@/lib/arsipDokumen');
      const { ambilBerkas } = await import('@/api/client');
      const ketemu = await cariLokal(r.nama_file, r.jenis_dokumen, tipe, lokasi);
      if (!ketemu && lokasi !== 'cermin') {
        toast.error('Berkas tidak ada di arsip perangkat ini — hanya tersimpan di perangkat asal.');
        return;
      }
      // Cermin tanpa salinan lokal: salinan server selalu ada.
      const bytes = ketemu?.bytes ?? new Uint8Array(await ambilBerkas(`/admin/dokumen/${tipe}/${r.id}/unduh`));
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
  }, [tipe]);

  /** Aksi butuh desktop bila byte hanya ada di arsip perangkat tapi dibuka dari web. */
  const perluDesktop = useCallback(
    (r: DokumenRow) => !isTauri() && ((r.penyimpanan ?? 'server') === 'lokal' || (r.penyimpanan ?? 'server') === 'test'),
    [],
  );

  const renderActions = useCallback((r: DokumenRow) => (
    <>
      {canUbah && (
        <TombolIkon
          tip={perluDesktop(r) ? 'Baris arsip perangkat hanya bisa diganti lewat aplikasi desktop' : (r.nama_file ? 'Ganti berkas' : 'Unggah berkas')}
          id={`btn_unggah_dok_${r.id}`}
          size="sm"
          variant="outline"
          disabled={perluDesktop(r)}
          onClick={() => { setUnggahFile(null); setUnggahRow(r); }}
        >
          <Upload size={14} />
        </TombolIkon>
      )}
      {r.nama_file && (
        <TombolIkon
          tip={perluDesktop(r) ? 'Berkas hanya ada di arsip perangkat — buka lewat aplikasi desktop' : 'Unduh berkas'}
          id={`btn_unduh_dok_${r.id}`}
          size="sm"
          variant="outline"
          disabled={perluDesktop(r)}
          onClick={() => void unduhCerdas(r)}
        >
          <Download size={14} />
        </TombolIkon>
      )}
      {canHapus && (
        <TombolIkon
          tip={perluDesktop(r) ? 'Baris arsip perangkat hanya bisa dihapus lewat aplikasi desktop (agar salinannya ikut bersih)' : 'Hapus dokumen'}
          id={`btn_hapus_dok_${r.id}`}
          size="sm"
          variant="destructive"
          disabled={perluDesktop(r)}
          onClick={() => setHapusRow(r)}
        >
          <Trash2 size={14} />
        </TombolIkon>
      )}
    </>
  ), [canUbah, canHapus, tipe, unduhCerdas, perluDesktop]);

  const bisaSimpanTambah = tipe === 'santri' ? pemilik !== '' : (tipe === 'pegawai' ? pemilik !== '' && jenjangPemilik !== '' : jenjangPemilik !== '');

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <PengaturanHalaman tampil={{ semester: false, tingkat: false, kelas: false }} tabel={[{ key: konfig.tableKey, judul: konfig.judul, fields }]} />
      <TopBarSearch value={cari} onChange={setCari} placeholder={`Cari ${konfig.judul.toLowerCase()}…`} />
      <ExcelTable
        tableKey={konfig.tableKey}
        fields={fields}
        rows={rows}
        getValues={nilaiBaris}
        loading={loading}
        emptyText="Belum ada dokumen."
        canEdit={canUbah}
        onCommit={commitBaris}
        onSaved={() => {}}
        addButton={(canTambah || sinkronMassal) ? (
          <>
            {canTambah && (
              <>
                <Button
                  id={`btn_tambah_dok_${tipe}`}
                  onClick={() => { if (tipe === 'santri') navigate('/dokumen-santri/tambah'); else bukaTambah(); }}
                >
                  Tambah
                </Button>
                <Button id={`btn_import_dok_${tipe}`} variant="outline" onClick={() => setImportOpen(true)}>
                  <FileUp data-icon="inline-start" size={16} /> Import
                </Button>
              </>
            )}
            {sinkronMassal && (
              <Button
                id="btn_sinkron_dok_santri"
                variant="outline"
                onClick={() => setSinkronTerbuka(true)}
                title="Sinkronkan SEMUA dokumen santri dalam filter/pencarian aktif (cermin dua arah)"
              >
                <RefreshCw data-icon="inline-start" size={16} /> Sinkronkan
              </Button>
            )}
          </>
        ) : null}
        renderActions={renderActions}
      />
      <Pager
        page={pager.page}
        lastPage={lastPage}
        total={total}
        perPage={pager.perPage}
        onPage={(p) => { pager.setPage(p); load(p); }}
        onPerPage={(pp) => { pager.setPerPage(pp); load(1, pp); }}
      />

      {sinkronMassal && (
        <DialogSinkronDokumen
          tipe="santri"
          terbuka={sinkronTerbuka}
          onTutup={() => setSinkronTerbuka(false)}
          ambilBaris={() => ambilSemuaBaris('santri', {
            jenjang: jenjangs.length ? jenjangs : undefined,
            q: cari || undefined,
          })}
          lingkup={`Semua dokumen santri (filter: ${jenjangs.join(', ') || 'semua jenjang'}${cari ? `, cari: ${cari}` : ''})`}
          onSelesai={() => { void load(pager.page); }}
        />
      )}
      <Dialog open={tambahOpen} onOpenChange={setTambahOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah dokumen {konfig.judul.toLowerCase()}</DialogTitle>
            <DialogDescription>Berkas opsional — boleh diisi kemudian lewat tombol unggah di baris.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {konfig.pemilihPemilik === 'jenjang' ? (
              <div className="grid gap-1.5">
                <FieldLabel htmlFor={`select_lembaga_dok_${tipe}`}>Lembaga</FieldLabel>
                <Select value={jenjangPemilik} onValueChange={setJenjangPemilik}>
                  <SelectTrigger id={`select_lembaga_dok_${tipe}`}><SelectValue placeholder="Pilih lembaga" /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {lembagas.map((l) => <SelectItem key={l.jenjang} value={l.jenjang}>{l.jenjang} — {l.nama}</SelectItem>)}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid gap-1.5">
                <FieldLabel htmlFor={`combo_pemilik_dok_${tipe}`}>{konfig.pemilikLabel}</FieldLabel>
                <ComboCari id={`combo_pemilik_dok_${tipe}`} value={pemilik} onChange={setPemilik} options={opsiPemilik} placeholder={`Pilih ${konfig.pemilikLabel.toLowerCase()}…`} />
              </div>
            )}
            {tipe === 'pegawai' && (
              <div className="grid gap-1.5">
                <FieldLabel htmlFor={`select_lembaga_dok_${tipe}`}>Lembaga penempatan</FieldLabel>
                <Select value={jenjangPemilik} onValueChange={setJenjangPemilik}>
                  <SelectTrigger id={`select_lembaga_dok_${tipe}`}><SelectValue placeholder="Pilih lembaga" /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {(jenjangs.length ? lembagas.filter((l) => jenjangs.includes(l.jenjang)) : lembagas).map((l) => <SelectItem key={l.jenjang} value={l.jenjang}>{l.jenjang} — {l.nama}</SelectItem>)}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-1.5">
              <FieldLabel htmlFor={`input_jenis_dok_${tipe}`}>Jenis dokumen</FieldLabel>
              <Input id={`input_jenis_dok_${tipe}`} value={jenis} onChange={(e) => setJenis(e.target.value)} maxLength={100} placeholder="mis. Kartu Keluarga / Ijazah / Izin Operasional" />
            </div>
            <div className="grid gap-1.5">
              <FieldLabel htmlFor={`input_catatan_dok_${tipe}`}>Catatan</FieldLabel>
              <Input id={`input_catatan_dok_${tipe}`} value={catatan} onChange={(e) => setCatatan(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <FieldLabel htmlFor={`input_file_dok_${tipe}`}>Berkas (JPG/PNG/PDF, maks 10 MB)</FieldLabel>
              <Input id={`input_file_dok_${tipe}`} type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTambahOpen(false)}>Batal</Button>
            <Button id={`btn_simpan_dok_${tipe}`} disabled={!bisaSimpanTambah || jenis.trim() === '' || busy} onClick={() => void onTambah()}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={unggahRow !== null} onOpenChange={(o) => { if (!o) setUnggahRow(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Unggah berkas: {unggahRow?.jenis_dokumen}</DialogTitle>
            <DialogDescription>{unggahRow?.pemilik} — berkas lama (bila ada) akan diganti di lokasi yang sama.</DialogDescription>
          </DialogHeader>
          <Input id={`input_unggah_dok_${tipe}`} type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setUnggahFile(e.target.files?.[0] ?? null)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnggahRow(null)}>Batal</Button>
            <Button id={`btn_proses_unggah_dok_${tipe}`} disabled={!unggahFile || busy} onClick={() => void onUnggah()}>Unggah</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={hapusRow !== null} onOpenChange={(o) => { if (!o) setHapusRow(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus dokumen "{hapusRow?.jenis_dokumen}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Dokumen milik {hapusRow?.pemilik ?? '—'} dihapus permanen beserta berkas fisiknya.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={busy} onClick={() => void onHapus()}>
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DokumenImportDialog open={importOpen} onOpenChange={setImportOpen} tipe={tipe} onSelesai={() => { pager.goFirst(); void load(1); }} />
    </div>
  );
}
