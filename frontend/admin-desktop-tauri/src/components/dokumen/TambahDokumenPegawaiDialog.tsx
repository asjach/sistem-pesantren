import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage, isTauri, prefGet } from '@/api/client';
import { listPegawai, type Pegawai } from '@/api/pegawai';
import { listDokumen, simpanDokumen } from '@/api/dokumen';
import { referensiList, listLembaga, type Lembaga, type ReferensiRow } from '@/api/master';
import TombolIkon from '@/components/TombolIkon';
import ComboCari from '@/components/ComboCari';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Check, FolderOpen, Save, X } from '@/icons';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import { Checkbox } from '@/components/ui/checkbox';
import { useFilterGlobalAktif } from '@/hooks/useFilterGlobalAktif';
import { Separator } from '@/components/ui/separator';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { PAGE_SHELL } from '@/components/PageHeader';
import { cn } from '@/lib/utils';
import {
  BATAS_BERKAS,
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

/** Dialog Tambah Dokumen Pegawai — isi dua kolom: form (400px) + viewer berkas.
 *  Alur: klik nama pegawai di tabel → pilih lembaga penempatan (wajib) →
 *  pilih jenis dokumen → pilih berkas (catatan opsional) → Simpan.
 *  Di aplikasi desktop, berkas disalin ke arsip lokal dan (opsional via
 *  checkbox) file asli dipindah ke folder `sudah`. */
export default function TambahDokumenPegawaiDialog({
  terbuka,
  onTutup,
  onSelesai,
  pemilik,
}: {
  terbuka: boolean;
  onTutup: () => void;
  /** Dipanggil setelah simpan berhasil (pemanggil memuat ulang daftar). */
  onSelesai?: () => void;
  /** Pegawai pemilik dokumen — terkunci dari halaman pemanggil (dialog ini tak
   *  punya tabel daftar; pegawai dipilih di halaman Dokumen Pegawai). */
  pemilik: { id: number; namaLengkap: string; nipp: string | null; penempatanAktif: string[] };
}) {
  const desktop = isTauri();
  const { jenjangs, tahunAjaranNames, loading: filterLoading } = useFilterGlobalAktif();

  // ----- Pemilik terkunci dari halaman pemanggil -----
  const pegawaiId = pemilik.id;
  const pegawaiTerpilih = useMemo(
    () => ({ id: pemilik.id, nama_lengkap: pemilik.namaLengkap, nipp: pemilik.nipp }),
    [pemilik.id, pemilik.namaLengkap, pemilik.nipp],
  );
  /** Penempatan aktif pegawai = opsi field Lembaga (wajib). */
  const penempatanAktif = pemilik.penempatanAktif;

  // ----- Jenis dokumen (ref; tanpa filter = semua lembaga) -----
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
  const opsiJenis = useMemo(
    () => jenisRows.map((r) => ({ value: String(r.nama ?? r.kode), label: String(r.nama ?? r.kode) })),
    [jenisRows],
  );
  const [jenis, setJenis] = useState('');
  const [catatan, setCatatan] = useState('');

  /** Jumlah dokumen per pegawai (kunci: pegawai_id) — satu fetch; tanpa
   *  filter = seluruh lingkup akses. */
  const [jumlahPegawai, setJumlahPegawai] = useState<Record<number, number>>({});
  const muatJumlahPegawai = useCallback(async (): Promise<Record<number, number>> => {
    try {
      const p = await listDokumen('pegawai', { jenjang: jenjangs.length ? jenjangs : undefined, per_page: 0 });
      const hitung: Record<number, number> = {};
      for (const d of p.data) {
        const pid = d.pegawai_id;
        if (pid != null) hitung[pid] = (hitung[pid] ?? 0) + 1;
      }
      return hitung;
    } catch {
      return {};
    }
  }, [jenjangs]);
  useEffect(() => {
    let hidup = true;
    void muatJumlahPegawai().then((h) => { if (hidup) setJumlahPegawai(h); });
    return () => { hidup = false; };
  }, [muatJumlahPegawai]);

  /** Jumlah dokumen per jenis milik pegawai terpilih (kunci: lowercase). */
  const [jumlahJenis, setJumlahJenis] = useState<Record<string, number>>({});
  const muatJumlahJenis = useCallback(async (pid: number): Promise<Record<string, number>> => {
    try {
      const p = await listDokumen('pegawai', { jenjang: jenjangs.length ? jenjangs : undefined, per_page: 0 });
      const hitung: Record<string, number> = {};
      for (const d of p.data) {
        if (d.pegawai_id !== pid) continue;
        const kunci = (d.jenis_dokumen ?? '').trim().toLowerCase();
        if (kunci) hitung[kunci] = (hitung[kunci] ?? 0) + 1;
      }
      return hitung;
    } catch {
      return {};
    }
  }, [jenjangs]);
  useEffect(() => {
    if (pegawaiId == null) { setJumlahJenis({}); return; }
    let hidup = true;
    void muatJumlahJenis(pegawaiId).then((h) => { if (hidup) setJumlahJenis(h); });
    return () => { hidup = false; };
  }, [pegawaiId, muatJumlahJenis]);

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
        const b = await pilihBerkasDokumen(true);
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
  const [inputLainnya, setInputLainnya] = useState(true);
  const [pindahSudah, setPindahSudah] = useState(true);
  const [busy, setBusy] = useState(false);
  // Mode penyimpanan perangkat (diatur di Pengaturan → Server; hanya dibaca).
  const [modeDokumen, setModeDokumen] = useState<'server' | 'lokal' | 'test'>('server');
  const [folderArsip, setFolderArsip] = useState('');
  const [folderArsipTest, setFolderArsipTest] = useState('');

  const modeEfektif = desktop && modeDokumen !== 'server' ? 'lokal' : 'server';
  /** Mode test = perilaku lokal ke folder uji; folder `sudah/` tidak disentuh saat test. */
  const modeTest = desktop && modeDokumen === 'test';

  // Persistensi setelan perangkat (pola pager/sidebar). Checkbox "input
  // dokumen lainnya" & "pindah ke SUDAH" sengaja tak disimpan: selalu true.
  useEffect(() => {
    let hidup = true;
    (async () => {
      try {
        const [m, f, ft] = await Promise.all([
          prefGet(PREF_MODE_DOKUMEN),
          prefGet(PREF_FOLDER_ARSIP),
          prefGet(PREF_FOLDER_ARSIP_TEST),
        ]);
        if (!hidup) return;
        if (m === 'server' || m === 'lokal' || m === 'test') setModeDokumen(m);
        if (typeof f === 'string') setFolderArsip(f);
        if (typeof ft === 'string') setFolderArsipTest(ft);
      } catch {
        /* penyimpanan terkunci: pakai bawaan */
      }
    })();
    return () => { hidup = false; };
  }, []);
  /** Lembaga penempatan (wajib di backend): bawaan penempatan aktif tunggal. */
  const [jenjangDok, setJenjangDok] = useState('');
  useEffect(() => {
    if (terbuka) setJenjangDok(penempatanAktif.length === 1 ? penempatanAktif[0] : '');
  }, [terbuka, penempatanAktif]);

  /** Berkas + lembaga penempatan wajib di halaman ini. */
  const bisaSimpan = pegawaiId != null && jenjangDok !== '' && jenis.trim() !== '' && sumberBerkas !== null && keluaran !== null && !prosesViewer && !busy;

  async function bukaPilihLagi() {
    await onBrowse();
    if (!desktop) btnBrowseRef.current?.focus();
  }

  async function onSimpan() {
    if (!bisaSimpan || pegawaiId == null || !sumberBerkas || !keluaran) return;
    setBusy(true);
    try {
      if (modeEfektif === 'lokal') {
        // Mode lokal/test: metadata + cadangan nama ke server, byte hanya di drive.
        const tersimpan = await simpanDokumen('pegawai', {
          pegawai_id: pegawaiId,
          jenjang: jenjangDok,
          jenis_dokumen: jenis.trim(),
          ...(catatan.trim() ? { catatan: catatan.trim() } : {}),
          tujuan: modeTest ? 'test' : 'lokal',
          ekstensi: keluaran.ext,
        });
        const namaArsipBaru = tersimpan.data?.nama_file
          || namaArsip(pegawaiTerpilih?.nama_lengkap ?? `pegawai-${pegawaiId}`, jenis.trim(), catatan.trim(), keluaran.ext);
        if (desktop && berkasPath) {
          try {
            const akar = await akarArsip(
              modeTest ? folderArsipTest : folderArsip,
              modeTest ? ROOT_ARSIP_TEST : ROOT_ARSIP_DOKUMEN,
            );
            await tulisArsip(keluaran.bytes, namaArsipBaru, akar, 'pegawai', modeTest ? 'test' : 'lokal');
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
        await simpanDokumen('pegawai', {
          pegawai_id: pegawaiId,
          jenjang: jenjangDok,
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
      // Angka jenis dokumen langsung terupdate tanpa ganti pegawai.
      void muatJumlahJenis(pegawaiId).then(setJumlahJenis);
      void muatJumlahPegawai().then(setJumlahPegawai);
      // Reset form (pilihan pegawai + lembaga penempatan + checkbox dipertahankan).
      setJenis('');
      setCatatan('');
      resetBerkas();
      if (inputLainnya) await bukaPilihLagi();
      onSelesai?.();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={terbuka} onOpenChange={(o) => { if (!o && !busy) onTutup(); }}>
      {/* Close bawaan (absolute top-4 right-4) disembunyikan: pada dialog
          selayar penuh ia menimpa judul. Dipasang sendiri sebaris judul. */}
      {/* ESC menutup dialog lewat onOpenChange; onEscapeKeyDown mencegah
          penutupan saat proses simpan berjalan agar data tak hilang sendiri. */}
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => { if (busy) e.preventDefault(); }}
        className="flex h-[calc(100dvh-3rem)] max-h-[calc(100dvh-3rem)] w-[calc(100vw-3rem)] max-w-none flex-col gap-0 overflow-hidden rounded-xl p-0 sm:max-w-none">
        <DialogHeader className="flex-row items-center justify-between gap-2 border-b px-2 py-2">
          <DialogTitle>Tambah Dokumen Pegawai</DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" aria-label="Tutup" onClick={onTutup}>
              <X size={14} />
            </Button>
          </DialogClose>
        </DialogHeader>
        <div className={cn(PAGE_SHELL, 'min-h-0 overflow-y-auto p-0')}>
      <ResizablePanelGroup orientation="horizontal" id="grup_tambah_dokumen_pegawai" className="min-h-0 flex-1 overflow-hidden">
        {/* Kolom 1: form (400px, bisa digeser). */}
        <ResizablePanel defaultSize={400} minSize={300} maxSize="70%" id="panel_tambah_dokumen_pegawai_form" className="min-h-0">
          <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto rounded-xl border bg-card p-4">
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="info_pegawai_tambah_dokumen">Pegawai</FieldLabel>
            <div id="info_pegawai_tambah_dokumen" className="rounded-md border bg-muted/40 px-2.5 py-2 text-xs">
              <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                <dt className="text-muted-foreground">ID</dt>
                <dd>{pemilik.id}</dd>
                <dt className="text-muted-foreground">Nama</dt>
                <dd className="font-medium">{pemilik.namaLengkap}</dd>
                <dt className="text-muted-foreground">NIPP</dt>
                <dd>{pemilik.nipp || "-" + ""}</dd>
                <dt className="text-muted-foreground">Penempatan</dt>
                <dd>{pemilik.penempatanAktif.length > 0 ? pemilik.penempatanAktif.join(", ") : "-"}</dd>
              </dl>
            </div>
          </div>
          <Separator />
          <div className="flex items-center gap-2">
            <FieldLabel htmlFor="input_lembaga_tambah_dokumen_pegawai" className="shrink-0">Lembaga</FieldLabel>
            <ComboCari
              id="combo_lembaga_tambah_dokumen_pegawai"
              inputId="input_lembaga_tambah_dokumen_pegawai"
              value={jenjangDok}
              onChange={setJenjangDok}
              options={penempatanAktif.map((j) => ({ value: j, label: j }))}
              placeholder={penempatanAktif.length > 0 ? 'Pilih penempatan…' : 'Pegawai tanpa penempatan aktif'}
              className="min-w-0 flex-1"
            />
          </div>
          <div className="grid gap-1.5">
            <FieldLabel id="label_jenis_tambah_dokumen_pegawai">Jenis Dokumen</FieldLabel>
            {opsiJenis.length === 0 ? (
              <p className="text-xs text-muted-foreground">Belum ada jenis dokumen di referensi.</p>
            ) : (
              <div id="list_jenis_tambah_dokumen_pegawai" role="listbox" aria-labelledby="label_jenis_tambah_dokumen_pegawai" className="rounded-md border">
                {opsiJenis.map((o) => {
                  const jumlah = jumlahJenis[o.value.trim().toLowerCase()] ?? 0;
                  const aktif = jenis === o.value;
                  return (
                    <button
                      key={o.value}
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
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <FieldLabel htmlFor="input_catatan_tambah_dokumen_pegawai" className="shrink-0">Catatan</FieldLabel>
            <Input
              id="input_catatan_tambah_dokumen_pegawai"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="opsional"
              className="min-w-0 flex-1"
            />
          </div>
          <div id="box_browse_tambah_dokumen_pegawai" className="grid gap-1.5 rounded-md border border-dashed bg-muted/40 p-2.5">
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
              id="input_berkas_web_tambah_dokumen_pegawai"
              type="file"
              className="hidden"
              onChange={onFileWeb}
            />
          </div>
          <div className="flex justify-end gap-2">
            <span className="mr-auto self-center text-xs text-muted-foreground">
              Mode: {modeTest ? 'Test (folder uji)' : (modeEfektif === 'lokal' ? 'Lokal (berkas di drive perangkat ini)' : 'Server')}
            </span>
          </div>
          <Separator />
          <div className="flex flex-row flex-wrap items-center gap-x-4 gap-y-2">
            <label htmlFor="check_dok_pegawai_lainnya" className="inline-flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox
                id="check_dok_pegawai_lainnya"
                className="size-3.5"
                checked={inputLainnya}
                onCheckedChange={(v) => setInputLainnya(v === true)}
              />
              input dokumen lainnya
            </label>
            <label
              htmlFor="check_pindah_sudah_pegawai"
              title={modeTest ? 'Nonaktif dalam mode test' : (desktop ? 'Pindahkan file asli ke folder sudah setelah simpan' : 'Hanya tersedia di aplikasi desktop')}
              className={cn('inline-flex items-center gap-2 text-xs', (!desktop || modeTest) && 'cursor-not-allowed opacity-50')}
            >
              <Checkbox
                id="check_pindah_sudah_pegawai"
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
        <ResizableHandle withHandle orientation="horizontal" id="gagang_tambah_dokumen_pegawai" aria-label="Atur lebar kolom form dan pratinjau" />
        {/* Kolom 2: viewer (sisa). */}
        <ResizablePanel minSize="25%" id="panel_tambah_dokumen_pegawai_pratinjau" className="min-h-0 min-w-0">
          <PenampilBerkas sumber={sumberBerkas} kualitas="asli" onKeluaran={setKeluaran} onProses={setProsesViewer} idPrefix="tambah_dokumen_pegawai" />
        </ResizablePanel>
      </ResizablePanelGroup>
        </div>
        <DialogFooter className="border-t px-2 py-2">
          <Button variant="outline" onClick={onTutup} disabled={busy}>Batal</Button>
          <Button id="btn_simpan_tambah_dokumen_pegawai" onClick={() => void onSimpan()} disabled={!bisaSimpan}>
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
