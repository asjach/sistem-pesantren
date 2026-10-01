import { useEffect, useMemo, useState } from 'react';
import { ambilBerkas, errorMessage, isTauri, prefGet } from '@/api/client';
import { bisa } from '@/api/auth';
import { useAuth } from '@/auth/AuthContext';
import { updateSantri, type SantriPenuh } from '@/api/santri';
import { listDokumen, unggahBerkasDokumen, type DokumenRow } from '@/api/dokumen';
import { gantiEkstensi, type HasilGambar } from '@/lib/olahGambar';
import { Button } from '@/components/ui/button';
import { FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import TombolIkon from '@/components/TombolIkon';
import { ChevronLeft, ChevronRight, Save, Undo2, X } from '@/icons';
import PenampilBerkas, { type SumberBerkas } from '@/components/dokumen/PenampilBerkas';
import {
  ekstensiDariNama,
  mimeDariEkstensi,
} from '@/lib/arsipDokumen';
import { BAGIAN_IDENTITAS, fieldUntuk } from '@/components/santri/bagianIdentitas';
import {
  SANTRI_IDENTITAS_FIELDS,
  TGL_KEYS,
  TURUNAN_KEYS,
  hanyaIdentitas,
  nilaiIdentitas,
} from '@/components/santri/kolomIdentitas';
import type { ExcelField } from '@/components/ExcelTable';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/** Label manusiawi untuk kunci yang definisinya masih berupa nama kolom DB. */
const LABEL: Record<string, string> = {
  nama: 'Nama lengkap',
  nik: 'NIK',
  nisn: 'NISN',
  jk: 'Jenis kelamin',
  tipe_santri: 'Tipe santri',
  no_kk: 'No. KK',
  email_santri: 'Email',
  ayah_nik: 'NIK',
  ibu_nik: 'NIK',
  wali_nik: 'NIK',
};

/** Label tampil: peta khusus didahulukan, lalu prefiks pihak
 *  (`Ayah — `, `Ibu — `, `Wali — `) dipangkas karena panel sudah berkelompok. */
function labelTampil(kunci: string, bawaan: string): string {
  return LABEL[kunci] ?? bawaan.replace(/^(Ayah|Ibu|Wali) — /, '');
}

/** Ubah detail santri: form identitas buku induk (kolom `santri`) memakai
 *  definisi kolom yang sama dengan Buku Induk agar label/validator seragam.
 *  `daftar` + `onGanti` mengaktifkan pindah santri tetangga (melingkar). */
export function EditSantriDialog({ santri, daftar = [], onGanti, open, onOpenChange, onSaved }: {
  santri: SantriPenuh | null;
  daftar?: SantriPenuh[];
  onGanti?: (s: SantriPenuh) => void;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
}) {
  const [nilai, setNilai] = useState<Record<string, string | null>>({});
  /** Nilai saat dialog dibuka — dipakai menandai baris yang sudah diubah
   *  (belum disimpan), seperti sel "dirty" di tabel utama. */
  const [awal, setAwal] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const desktop = isTauri();
  const canLihatDok = bisa(user, 'dokumen_santri.lihat');

  // ----- Dokumen santri untuk kolom viewer (edit penuh seperti Lihat Dokumen) -----
  const [dokumens, setDokumens] = useState<DokumenRow[]>([]);
  const [dokId, setDokId] = useState<number | null>(null);
  const [pratinjau, setPratinjau] = useState<SumberBerkas | null>(null);
  /** Keterangan di tengah viewer bila berkas tak bisa diakses (tanpa toast). */
  const [galatPratinjau, setGalatPratinjau] = useState('');
  /** Keluaran viewer + status kotor/proses untuk bar Simpan/Buang. */
  const [keluaran, setKeluaran] = useState<HasilGambar | null>(null);
  const [kotor, setKotor] = useState(false);
  const [prosesViewer, setProsesViewer] = useState(false);
  /** Kunci remount viewer (Buang perubahan mengembalikan tampilan asli). */
  const [kunciViewer, setKunciViewer] = useState(0);

  useEffect(() => {
    if (!open || !santri || !canLihatDok) { setDokumens([]); setDokId(null); setPratinjau(null); return; }
    let hidup = true;
    const c = new AbortController();
    listDokumen('santri', { santri_id: santri.id, per_page: 0, signal: c.signal })
      .then((p) => {
        if (!hidup) return;
        setDokumens(p.data);
        setDokId(p.data[0]?.id ?? null);
      })
      .catch(() => { if (hidup) setDokumens([]); });
    return () => { hidup = false; c.abort(); };
  }, [open, santri, canLihatDok]);

  /** Ambil byte pratinjau: arsip perangkat bila lokal/test, bila tidak dari server. */
  useEffect(() => {
    setPratinjau(null);
    setGalatPratinjau('');
    if (!open || dokId == null) return;
    const r = dokumens.find((d) => d.id === dokId) ?? null;
    if (!r || !r.nama_file) return;
    let hidup = true;
    (async () => {
      try {
        const nama = r.nama_file as string;
        const ext = ekstensiDariNama(nama);
        const mime = mimeDariEkstensi(ext);
        const lokasi = r.penyimpanan ?? 'server';
        if (lokasi !== 'server' && desktop) {
          const { readFile } = await import('@tauri-apps/plugin-fs');
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
            const target = await cariArsip(nama, r.jenis_dokumen, akar, 'santri');
            if (target) {
              const bytes = await readFile(target);
              if (hidup) setPratinjau({ bytes: new Uint8Array(bytes), mime, nama });
              return;
            }
          }
          if (hidup) setGalatPratinjau('Berkas tidak ada di arsip perangkat ini — hanya tersimpan di perangkat asal.');
          return;
        }
        if (lokasi !== 'server' && !desktop) {
          setGalatPratinjau('Berkas tersimpan di arsip perangkat, bukan di server. Buka lewat aplikasi desktop.');
          return;
        }
        const buf = await ambilBerkas(`/admin/dokumen/santri/${r.id}/unduh`);
        if (hidup) setPratinjau({ bytes: new Uint8Array(buf), mime, nama });
      } catch (e) {
        if (hidup) setGalatPratinjau(errorMessage(e));
      }
    })();
    return () => { hidup = false; };
  }, [open, dokId, dokumens, desktop]);

  const fields = useMemo(
    () => SANTRI_IDENTITAS_FIELDS.filter((f) => f.kind !== 'static' && !TURUNAN_KEYS.has(f.key)),
    [],
  );

  useEffect(() => {
    if (open && santri) {
      const v = nilaiIdentitas(santri);
      setNilai(v);
      setAwal(v);
    }
  }, [open, santri]);

  const ubah = (k: string, v: string) => setNilai((s) => ({ ...s, [k]: v }));

  /** Navigasi santri tetangga (urutan tabel asal, melingkar). */
  const idxSantri = santri ? daftar.findIndex((s) => s.id === santri.id) : -1;
  const bisaTetangga = onGanti != null && daftar.length > 1 && idxSantri >= 0;
  const santriMundur = () => {
    if (!bisaTetangga) return;
    onGanti?.(daftar[(idxSantri - 1 + daftar.length) % daftar.length]);
  };
  const santriMaju = () => {
    if (!bisaTetangga) return;
    onGanti?.(daftar[(idxSantri + 1) % daftar.length]);
  };

  /** Dokumen aktif + navigasi melingkar (dipakai header dan viewer). */
  const dokIdx = dokumens.findIndex((d) => d.id === dokId);
  const dokAktif = dokIdx >= 0 ? dokumens[dokIdx] : null;
  const dokKosong = dokumens.length === 0;
  const dokPosisi = dokIdx < 0 ? 0 : dokIdx;
  const dokMundur = () => {
    if (dokKosong) return;
    setDokId(dokumens[(dokPosisi - 1 + dokumens.length) % dokumens.length].id);
  };
  const dokMaju = () => {
    if (dokKosong) return;
    setDokId(dokumens[(dokPosisi + 1) % dokumens.length].id);
  };
  const dokJudul = dokAktif ? `${dokAktif.jenis_dokumen} (${dokIdx + 1}/${dokumens.length})` : null;

  /** Aksi butuh desktop bila byte hanya ada di arsip perangkat tapi dibuka dari web. */
  const perluDesktop = (r: DokumenRow) => !isTauri() && (r.penyimpanan ?? 'server') !== 'server';
  const canUbahDok = bisa(user, 'dokumen_santri.ubah');
  const bisaUbahViewer = canUbahDok && dokAktif !== null && !perluDesktop(dokAktif);

  /** Bersihkan salinan arsip lokal (desktop, best-effort, diam bila tak ada). */
  async function bersihkanArsip(nama: string | null, jenis: string) {
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
  }

  /** Muat ulang daftar + pratinjau sesudah ganti berkas. */
  async function segarkanDokumen(santriId: number, tampilId: number) {
    try {
      const p = await listDokumen('santri', { santri_id: santriId, per_page: 0 });
      setDokumens(p.data);
      if (p.data.some((d) => d.id === tampilId)) {
        // Picu muat ulang pratinjau baris yang sama.
        setDokId(null);
        requestAnimationFrame(() => setDokId(tampilId));
      }
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  /** Simpan hasil edit viewer sebagai ganti berkas tersimpan. */
  async function onSimpanEdit() {
    if (!dokAktif || !keluaran || !pratinjau || !santri) return;
    setBusy(true);
    const namaLama = dokAktif.nama_file;
    const jenisLama = dokAktif.jenis_dokumen;
    const idLama = dokAktif.id;
    try {
      const file = new File(
        [keluaran.bytes.buffer as ArrayBuffer],
        gantiEkstensi(pratinjau.nama, keluaran.ext),
        { type: keluaran.mime },
      );
      await unggahBerkasDokumen('santri', dokAktif.id, file);
      toast.success('Berkas diganti.');
      await bersihkanArsip(namaLama, jenisLama);
      await segarkanDokumen(santri.id, idLama);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  /** true bila nilai field berubah sejak dialog dibuka. */
  const berubah = (k: string) => (nilai[k] ?? null) !== (awal[k] ?? null);


  async function simpan() {
    if (!santri) return;
    for (const f of fields) {
      const pesan = f.validate?.(nilai[f.key] ?? null);
      if (pesan) { toast.error(pesan); return; }
    }
    setBusy(true);
    try {
      const profil: Record<string, string | null> = hanyaIdentitas(nilai);
      await updateSantri(santri.id, profil);
      toast.success('Detail santri disimpan.');
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Penuhi layar (margin 24px tiap sisi): posisi + flex via style agar
          pasti menang dari kelas bawaan DialogContent (Tailwind v4 memakai
          properti `translate`, bukan `transform`, untuk centering). */}
      <DialogContent
        className="max-w-none gap-2 overflow-visible max-h-none p-3 sm:max-w-none"
        style={{ inset: 24, transform: 'none', translate: 'none', display: 'flex', flexDirection: 'column', width: 'auto' }}
        showCloseButton={false}
      >
        <DialogHeader className="flex shrink-0 flex-row items-center gap-2">
          <div className="min-w-0 flex-1">
            <DialogTitle>Ubah detail: {santri?.nama_lengkap}</DialogTitle>
          </div>
          {dokJudul && (
            <p
              className="min-w-0 flex-1 truncate text-center text-xs text-muted-foreground"
              title={dokAktif?.nama_file ? `${dokJudul} — ${dokAktif.nama_file}` : dokJudul}
            >
              {dokJudul}
            </p>
          )}
          <div className="flex shrink-0 items-center gap-1">
            {bisaTetangga && (
              <>
                <TombolIkon
                  tip="Santri sebelumnya"
                  id="btn_santri_sebelum_edit_santri"
                  size="icon"
                  variant="outline"
                  onClick={santriMundur}
                >
                  <ChevronLeft size={14} />
                </TombolIkon>
                <TombolIkon
                  tip="Santri berikutnya"
                  id="btn_santri_berikut_edit_santri"
                  size="icon"
                  variant="outline"
                  onClick={santriMaju}
                >
                  <ChevronRight size={14} />
                </TombolIkon>
                <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />
              </>
            )}
            <Button id="btn_simpan_edit_santri" type="button" size="sm" disabled={busy} onClick={() => void simpan()}>Simpan</Button>
            <DialogClose
              aria-label="Tutup"
              className="flex size-6 shrink-0 items-center justify-center rounded-xs text-destructive ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
            >
              <X size={16} />
            </DialogClose>
          </div>
        </DialogHeader>
        {/* Isi: form (kolom 1, 400px bisa digeser 300–500) + viewer dokumen (kolom 2). */}
        <ResizablePanelGroup orientation="horizontal" id="grup_edit_santri" className="min-h-0 flex-1 overflow-hidden">
          <ResizablePanel
            defaultSize={canLihatDok ? 400 : 100}
            minSize={canLihatDok ? 300 : 0}
            maxSize={canLihatDok ? 500 : 100}
            id="panel_edit_santri_form"
            className="min-h-0"
          >
          <div className="flex h-full min-h-0 flex-col pr-1">
          {/* Area isi mengisi sisa tinggi dialog + menggulir sendiri. */}
          <form
            className="h-full min-h-0 scroll-tanpa-bar space-y-6 overflow-y-auto"
            onSubmit={(e) => { e.preventDefault(); void simpan(); }}
          >
          {BAGIAN_IDENTITAS.map((b) => (
            <section key={b.judul} className="space-y-3">
              <h3 className="border-b pb-1 text-sm font-semibold">{b.judul}</h3>
              {/* Satu kolom: panel susun ke bawah, tiap panel melebar penuh
                  supaya baris label–kontrol punya ruang lega dan mudah dibaca. */}
              <div className="space-y-4">
                {b.panels.map((p) => {
                  // Panel boleh memuat kunci yang tidak punya kolom (mis. `id`
                  // pada profil) — dilewati, tidak bisa diedit.
                  const isi = p.kunci
                    .map((k) => ({ kunci: k, f: fieldUntuk(k) }))
                    .filter((x): x is { kunci: string; f: ExcelField } =>
                      x.f != null && x.f.kind !== 'static' && !TURUNAN_KEYS.has(x.f.key));
                  if (isi.length === 0) return null;
                  return (
                    <fieldset key={p.judul} className="min-w-0">
                      <legend className="mb-1.5 text-sm font-semibold">{p.judul}</legend>
                      {/* Tampilan tabel: label dan kontrol sebaris, baris
                          berdempet tanpa jarak — dipisah garis tipis, sama
                          seperti baris label–nilai pada dialog profil. */}
                      <div className="overflow-hidden rounded-lg border">
                        {isi.map(({ f }) => {
                          const id = `input_edit_santri_${f.key}`;
                          const val = nilai[f.key] ?? '';
                          const dirty = berubah(f.key);
                          // Kontrol TANPA kotak sendiri: garis baris yang jadi
                          // pemisah, sehingga tidak ada garis dobel dan kontrol
                          // tidak menumpuk. Fokus tetap jelas lewat
                          // latar + cincin tipis, dan nilai yang diubah diberi
                          // warna aksen (sel "dirty" di tabel utama).
                           const kelasKontrol = cn(
                             'h-6 w-full rounded-none border-0 bg-transparent px-2 text-xs shadow-none',
                            'focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring/50',
                            dirty && 'bg-accent/15',
                          );
                          const kontrol = f.kind === 'select' ? (
                            <Select
                              value={val === '' ? '_kosong' : val}
                              onValueChange={(v) => ubah(f.key, v === '_kosong' ? '' : v)}
                            >
                              <SelectTrigger id={id} className={kelasKontrol}>
                                <SelectValue placeholder="—" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectItem value="_kosong">—</SelectItem>
                                  {(f.choices ?? []).map((c) => (
                                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              id={id}
                              className={kelasKontrol}
                              type={TGL_KEYS.has(f.key) ? 'date' : 'text'}
                              value={val}
                              maxLength={f.maxLength}
                              onChange={(e) => ubah(f.key, e.target.value)}
                            />
                          );
                          return (
                            <div
                              key={f.key}
                              className={cn(
                                'grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] items-center gap-2 border-t transition-colors hover:bg-muted/40',
                                dirty && 'bg-accent/10',
                              )}
                            >
                              <FieldLabel
                                htmlFor={id}
                                className="truncate pl-2 text-xs leading-4 text-muted-foreground"
                                title={labelTampil(f.key, f.label)}
                              >
                                {labelTampil(f.key, f.label)}
                              </FieldLabel>
                              {kontrol}
                            </div>
                          );
                        })}
                      </div>
                    </fieldset>
                  );
                })}
              </div>
            </section>
          ))}
          </form>
          </div>
          </ResizablePanel>
          {canLihatDok && (
            <>
              <ResizableHandle withHandle orientation="horizontal" id="gagang_edit_santri" aria-label="Atur lebar kolom form dan dokumen" />
              <ResizablePanel minSize="25%" id="panel_edit_santri_dokumen" className="min-h-0 min-w-0">
                <div className="flex h-full min-h-0 flex-col gap-1.5 pl-1">
                  {kotor && keluaran && dokId !== null && (
                    <div className="flex shrink-0 items-center gap-2 rounded-md border border-dashed px-2 py-1">
                      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                        {prosesViewer ? 'Menyiapkan hasil…' : 'Ada perubahan belum disimpan.'}
                      </span>
                      <TombolIkon tip="Buang perubahan" variant="outline" size="icon" onClick={() => setKunciViewer((k) => k + 1)}>
                        <Undo2 size={14} />
                      </TombolIkon>
                      <TombolIkon tip={prosesViewer ? 'Menyiapkan hasil…' : 'Simpan hasil edit'} id="btn_simpan_edit_dok_dialog" size="icon" disabled={busy || prosesViewer} onClick={() => void onSimpanEdit()}>
                        <Save size={14} />
                      </TombolIkon>
                    </div>
                  )}
                  <div className="relative min-h-0 flex-1">
                    {!dokKosong && (
                      <>
                        <TombolIkon
                          tip="Dokumen sebelumnya"
                          id="btn_dok_sebelum_edit_santri"
                          size="icon"
                          variant="outline"
                          onClick={dokMundur}
                          className="absolute top-1/2 left-2 z-10 -translate-y-1/2 rounded-full bg-background/80 shadow-md backdrop-blur"
                        >
                          <ChevronLeft size={14} />
                        </TombolIkon>
                        <TombolIkon
                          tip="Dokumen berikutnya"
                          id="btn_dok_berikut_edit_santri"
                          size="icon"
                          variant="outline"
                          onClick={dokMaju}
                          className="absolute top-1/2 right-2 z-10 -translate-y-1/2 rounded-full bg-background/80 shadow-md backdrop-blur"
                        >
                          <ChevronRight size={14} />
                        </TombolIkon>
                      </>
                    )}
                    <PenampilBerkas
                      key={`edit_santri_${dokId ?? 'kosong'}_${kunciViewer}`}
                      sumber={pratinjau}
                      kualitas="asli"
                      onKeluaran={setKeluaran}
                      onKotor={setKotor}
                      onProses={setProsesViewer}
                      idPrefix="edit_santri"
                      bisaUbah={bisaUbahViewer}
                      teksKosong={galatPratinjau || 'Belum ada dokumen.'}
                    />
                  </div>
                </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </DialogContent>
    </Dialog>
  );
}
