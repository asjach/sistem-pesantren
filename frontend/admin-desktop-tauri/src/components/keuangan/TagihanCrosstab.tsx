import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import type { CrosstabBaris, CrosstabKolom, CrosstabSel, CrosstabTagihan } from '../../api/keuangan';
import { cn } from '@/lib/utils';

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** Sel grid yang dirujuk oleh koordinat (bukan id tagihan, karena id hanya
 *  ada bila sel berisi). Dipakai menyimpan anchor/active saat memblok. */
export interface CellRef { santriId: number; key: string }

/** Satu sel pilihan: santri × kolom. `sel` absen = sel kosong (santri belum
 *  punya tagihan pada kolom itu) — tetap bisa dipilih untuk Buat Massal. */
export interface SelBlok {
  santriId: number; key: string; jenisId: number; sel?: CrosstabSel;
}

/** Tagihan dalam persegi panjang grid antara dua sel (inklusif). Sel kosong
 *  (tanpa tagihan) ikut. Baris & kolom diurutkan seperti tampilan. */
function blokTagihan(d: CrosstabTagihan, a: CellRef, b: CellRef): SelBlok[] {
  const rA = d.baris.findIndex((x) => x.santri_id === a.santriId);
  const cA = d.kolom.findIndex((x) => x.key === a.key);
  const rB = d.baris.findIndex((x) => x.santri_id === b.santriId);
  const cB = d.kolom.findIndex((x) => x.key === b.key);
  if (rA < 0 || cA < 0 || rB < 0 || cB < 0) return [];
  const r0 = Math.min(rA, rB), r1 = Math.max(rA, rB);
  const c0 = Math.min(cA, cB), c1 = Math.max(cA, cB);
  const out: SelBlok[] = [];
  for (let r = r0; r <= r1; r++) {
    const baris = d.baris[r];
    for (let c = c0; c <= c1; c++) {
      const k = d.kolom[c];
      out.push({ santriId: baris.santri_id, key: k.key, jenisId: k.jenis_id, sel: baris.sel[k.key] });
    }
  }
  return out;
}

/** Tetangga (dr,dc) suatu sel: apakah sel tetangga itu juga terpilih. Dipakai
 *  menggambar garis seleksi hanya di sisi LUAR blok agar garis antar sel
 *  terpilih tidak menjadi dobel. */
function tetanggaTerpilih(
  d: CrosstabTagihan | null,
  sel: ReadonlySet<string> | undefined,
  r: number, c: number, dr: number, dc: number,
): boolean {
  if (d === null) return false;
  const nr = r + dr;
  const nc = c + dc;
  if (nr < 0 || nc < 0 || nr >= d.baris.length || nc >= d.kolom.length) return false;
  return sel?.has(kunciSel({ santriId: d.baris[nr].santri_id, key: d.kolom[nc].key })) ?? false;
}

/** Sel grid dalam persegi panjang antara dua sel (inklusif) — TERMASUK sel
 *  kosong. Dipakai menggambar blok pratinjau saat menggeser: yang digambar
 *  adalah bentuk persegi panjangnya, bukan sekadar sel yang punya tagihan. */
function selGrid(d: CrosstabTagihan, a: CellRef, b: CellRef): CellRef[] {
  const rA = d.baris.findIndex((x) => x.santri_id === a.santriId);
  const cA = d.kolom.findIndex((x) => x.key === a.key);
  const rB = d.baris.findIndex((x) => x.santri_id === b.santriId);
  const cB = d.kolom.findIndex((x) => x.key === b.key);
  if (rA < 0 || cA < 0 || rB < 0 || cB < 0) return [];
  const out: CellRef[] = [];
  for (let r = Math.min(rA, rB); r <= Math.max(rA, rB); r++) {
    for (let c = Math.min(cA, cB); c <= Math.max(cA, cB); c++) {
      out.push({ santriId: d.baris[r].santri_id, key: d.kolom[c].key });
    }
  }
  return out;
}

/** Kunci `santriId\u0000key` untuk Set sel grid. */
export function kunciSel(ref: CellRef): string {
  return `${ref.santriId}\u0000${ref.key}`;
}

/** Box-shadow seleksi: garis 1px warna accent (`--ring`) digambar hanya pada
 *  sisi yang berbatasan dengan sel/aneh — sisi luar blok. Sisi antar sel yang
 *  sama-sama terpilih tidak digambar, sehingga grid bawaan (border) tinggal
 *  satu garis di dalam seleksi (tidak dobel). */
function bayangSeleksi(
  d: CrosstabTagihan | null,
  sel: ReadonlySet<string> | undefined,
  r: number, c: number,
): string {
  const sisi: string[] = [];
  if (!tetanggaTerpilih(d, sel, r, c, -1, 0)) sisi.push('inset 0 1px 0 0 var(--ring)'); // atas
  if (!tetanggaTerpilih(d, sel, r, c, 0, 1)) sisi.push('inset -1px 0 0 0 var(--ring)');  // kanan
  if (!tetanggaTerpilih(d, sel, r, c, 1, 0)) sisi.push('inset 0 -1px 0 0 var(--ring)');  // bawah
  if (!tetanggaTerpilih(d, sel, r, c, 0, -1)) sisi.push('inset 1px 0 0 0 var(--ring)');  // kiri
  return sisi.join(', ');
}

/** Label kolom: bulan untuk jenis bulanan; kolom non-bulanan tanpa sub-label
 *  (satu jenis = satu kolom, namanya sudah di header grup tepat di atasnya). */
export function labelKolom(k: CrosstabKolom): string {
  if (k.tipe === 'bulanan') {
    if (k.periode !== null && k.periode.length >= 7) {
      return BULAN[Number(k.periode.slice(5, 7)) - 1] ?? k.periode;
    }
    return k.periode ?? 'Tagihan';
  }
  return '';
}

/** Ringkasan sel untuk judul/actions: "Infaq Bulanan · Jul 2025". */
export function labelSel(k: CrosstabKolom): string {
  if (k.tipe === 'bulanan' && k.periode !== null && k.periode.length >= 7) {
    return `${k.jenis_nama} · ${BULAN[Number(k.periode.slice(5, 7)) - 1] ?? ''} ${k.periode.slice(0, 4)}`;
  }
  return `${k.jenis_nama} · ${k.periode ?? 'sekali'}`;
}

interface Props {
  data: CrosstabTagihan | null;
  loading: boolean;
  /** Id tagihan yang sedang aktif (dilingkasi di tabel) — hanya dipakai
   *  menampilkan popover aksi per tagihan. Pilihan (klik kiri) bergerak di
   *  state lokal tabel, jadi mengklik sel TIDAK memicu render ulang halaman
   *  dan tidak membuka popover apa pun. */
  terpilihId: number | null;
  /** Permintaan aksi per tagihan dari luar tabel (klik kanan / Enter). Halaman
   *  mengisi `aksi` (sel + rect sel dalam koordinat layar) dan crosstab
   *  memetakannya kembali ke elemen sel setelah render selesai. */
  aksi?: { sel: CrosstabSel; meta: MetaSel; kolom: CrosstabKolom; jangkar: DOMRect } | null;
  /** Peta hasil aksi: tagihan + elemen sel + kolomnya → halaman membuka
   *  popover aksi. Dipanggil sekali per perubahan `aksi`. */
  onPilih: (
    sel: CrosstabSel,
    meta: { nama: string; label: string; ayah_nama: string | null; ibu_nama: string | null; santri_id: number; foto_dokumen_id: number | null; foto_profil: boolean; kelas: string | null; jenjang_riwayat: string[] },
    anchor: HTMLElement,
    kolom: CrosstabKolom,
  ) => void;
  /** Sel KOSONG diklik → halaman membuka alur tambah tagihan (mis. dialog
   *  Buat Tagihan terisi santri+jenis+periode). Absen = sel kosong inert. */
  onTambah?: (baris: CrosstabBaris, kolom: CrosstabKolom, anchor: HTMLElement) => void;
  /** Kunci sel terpilih (klik kiri, termasuk sel kosong). Dipakai menandai
   *  sel terpilih dan menggerakkan aksi batch di bilah pilihan halaman. */
  selection?: ReadonlySet<string>;
  /** Ctrl/Cmd+Klik pada sel → toggle (tambah bila tak terpilih, lepas bila
   *  terpilih). `jenisId` kolom diikutkan supaya halaman bisa menyimpan info
   *  lengkap. */
  onTogglePilih?: (sel: SelBlok) => void;
  /** Blok (tahan-geser, Shift+Klik, Shift+panah) → ganti seluruh pilihan
   *  dengan tagihan dalam persegi panjang grid. */
  onPilihBlok?: (items: SelBlok[]) => void;
  /** Klik kiri biasa → jadikan sel itu anchor (titik awal blok), seperti
   *  mengklik sel di Excel.
   *  `kunci` = `santriId:key` sel yang diklik, supaya penyorotnya pindah. */
  onKlikSel?: (sel: SelBlok) => void;
  /** Tahan-geser DIMULAI (pointerdown) → pemanggil mencatat keadaan pilihan saat
   *  itu, supaya satu gesture drag memakai satu mode irisan dari awal ke akhir. */
  onMulaiGeser?: (kunciAwal: string) => void;
  /** Tahan-geser (tanpa modifier) → blok MENTAH; halaman mengiriskan dengan
   *  pilihan lama lalu mengirim hasilnya balik lewat prop `selection`. */
  onPilihIrisan?: (items: SelBlok[]) => void;
  /** Ctrl/Cmd+tahan-geser → blok baru ditaruh di ATAS pilihan lama. */
  onTambahBlok?: (items: SelBlok[]) => void;
  /** Lepas (kurangi) blok tagihan dari pilihan — Alt/Option+tahan-geser. */
  onLepasBlok?: (items: SelBlok[]) => void;
  /** Gesture seleksi selesai (pointer dilepas / blok lewat keyboard) →
   *  elemen sel tempat pelepasan + apakah gesture itu MEMILIH BANYAK
   *  (geser/Ctrl/Shift). Dipakai halaman menampilkan popover aksi batch di
   *  dekat seleksi; klik satu sel biasa mengirim `false` supaya popover tak
   *  muncul hanya karena mengklik. */
  onSeleksiRilis?: (anchor: HTMLElement, multi: boolean) => void;
  /** Gesture geser BENAR-BENAR berakhir (tombol dilepas) — termasuk saat
   *  pelepasan terjadi di luar tabel. Dipakai halaman melepas keadaan khusus
   *  gesture ("mode irisan"), supaya gesture berikutnya memulai seleksi baru
   *  alih-alih terus diiriskan dengan pilihan gesture sebelumnya. */
  onGeserSelesai?: () => void;
  /** Klik KANAN pada sel → halaman membuka aksi per tagihan tanpa tabel harus
   *  memegang state popover (dilaporkan beserta rect sel, dalam koordinat layar). */
  onAksiKanan?: (sel: CrosstabSel, meta: MetaSel, kolom: CrosstabKolom, kotak: DOMRect) => void;
  /** Klik kanan sel KOSONG → halaman membuka panel batch (bila pilihan > 1). */
  onAksiKosong?: (sel: SelBlok, kolom: CrosstabKolom, anchor: HTMLElement) => void;
  /** Geser menyentuh sel baru → laporkan persegi panjang yang disorot. */
  onPratinjau?: (grid: CellRef[]) => void;
  emptyText: string;
}

/** Metadata sel crosstab (nama santri, orang tua, kelas, foto) — bagian dari
 *  payload aksi yang ditukar dengan halaman. */
export interface MetaSel {
  nama: string; label: string; ayah_nama: string | null; ibu_nama: string | null; santri_id: number;
  foto_dokumen_id: number | null; foto_profil: boolean; kelas: string | null; jenjang_riwayat: string[];
}

interface GrupKolom {
  jenisId: number;
  jenisNama: string;
  kolom: CrosstabKolom[];
}

/** Kelompokkan kolom berurutan per jenis (untuk header dua tingkat). */
function grupKolom(kolom: CrosstabKolom[]): GrupKolom[] {
  const grup: GrupKolom[] = [];
  for (const k of kolom) {
    const terakhir = grup[grup.length - 1];
    if (terakhir && terakhir.jenisId === k.jenis_id) {
      terakhir.kolom.push(k);
    } else {
      grup.push({ jenisId: k.jenis_id, jenisNama: k.jenis_nama, kolom: [k] });
    }
  }
  return grup;
}

/**
 * Warna sel menurut status tunggakan:
 * - lunas → hijau
 * - terlambat (lewat jatuh tempo) → merah / amber
 * - belum jatuh tempo → sengaja dibuat SAMAR: belum jadi hutang, jadi tidak
 *   perlu bersaing dengan sel tunggakan dalam menarik perhatian.
 */
function kelasSel(sel: CrosstabSel): string {
  if (sel.status === 'lunas') {
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
  }
  if (sel.status === 'sebagian') {
    return sel.terlambat
      ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300'
      : 'bg-amber-500/5 text-amber-700/45 dark:text-amber-300/45';
  }

  return sel.terlambat
    ? 'bg-destructive/10 text-destructive'
    : 'bg-muted/20 text-muted-foreground/50';
}

/** "Juli 2025" dari periode bulanan 'YYYY-MM'. */
function periodePanjang(periode: string): string {
  const [y, b] = periode.split('-');
  return `${BULAN[Number(b) - 1] ?? b} ${y}`;
}

/** Data satu sel yang ditampilkan di kartu hover. */
interface TooltipSel {
  nama: string;
  jenisNama: string;
  tipe: CrosstabKolom['tipe'];
  periode: string | null;
  nominal: number;
  terbayar: number;
  sisa: number;
}

const LEBAR_TOOLTIP = 224;
const TINGGI_TOOLTIP = 200;
/** Jarak tooltip dari kursor (x, y) — dipakai juga sebagai posisi awal render. */
const JARAK_X = 12;
const JARAK_Y = 18;

/**
 * Letak tooltip. Ditulis langsung ke DOM (bukan state) — posisi mengikuti
 * kursor pada tiap frame mouse; lewat state akan merender ulang seluruh
 * tabel (ratusan sel) tiap gerakan dan terasa berat.
 */
function NeedleLetak(el: HTMLElement | null, x: number, y: number): void {
  if (el === null) return;
  el.style.left = `${Math.max(8, Math.min(x + JARAK_X, window.innerWidth - LEBAR_TOOLTIP - 8))}px`;
  el.style.top = `${Math.max(8, y + TINGGI_TOOLTIP > window.innerHeight ? y - TINGGI_TOOLTIP : y + JARAK_Y)}px`;
}

/** Satu baris tabel. `memo` + props stabil → saat tooltip berpindah sel, hanya
 *  baris yang di-hover yang dirender ulang, bukan seluruh tabel (ratusan sel). */
const BarisCrosstab = memo(function BarisCrosstab({
  baris, kolom, data, onPilih, onTambah, onHoverMasuk, onHoverGerak, onHoverKeluar,
  selection, onTogglePilih, onPilihBlok, onKlikSel, onPilihIrisan, onMulaiGeser, onTambahBlok, onLepasBlok, onSeleksiRilis, onGeserSelesai,
  onAksiKanan, onAksiKosong, onPratinjau, laporkanPratinjau, closeHover, agarJauhRef, pratinjau, anchorKunci, onLepasAnchor,
  anchorRef, activeRef, draggingRef, dragStartRef, dragMovedRef, pernahGeserRef,
}: {
  baris: CrosstabBaris;
  kolom: CrosstabKolom[];
  /** Seluruh data crosstab (dipakai menghitung koordinat grid saat memblok). */
  data: CrosstabTagihan | null;
  onPilih: (
    sel: CrosstabSel,
    meta: { nama: string; label: string; ayah_nama: string | null; ibu_nama: string | null; santri_id: number; foto_dokumen_id: number | null; foto_profil: boolean; kelas: string | null; jenjang_riwayat: string[] },
    anchor: HTMLElement,
    kolom: CrosstabKolom,
  ) => void;
  onTambah?: (baris: CrosstabBaris, kolom: CrosstabKolom, anchor: HTMLElement) => void;
  onHoverMasuk: (isi: TooltipSel, anchor: HTMLElement) => void;
  onHoverGerak: (isi: TooltipSel, e: React.MouseEvent<HTMLElement>) => void;
  onHoverKeluar: () => void;
  /** Id tagihan terpilih (klik kiri); null = tak ada. */
  selection?: ReadonlySet<string>;
  /** Ctrl/Cmd+Klik → toggle satu sel (tambah/lepas). */
  onTogglePilih?: (sel: SelBlok) => void;
  /** Blok pilihan (geser, Shift+Klik, Shift+panah). */
  onPilihBlok?: (items: SelBlok[]) => void;
  /** Klik kiri biasa → jadikan sel anchor (ganti sorotan). */
  onKlikSel?: (sel: SelBlok) => void;
  /** Tahan-geser DIMULAI (pointerdown) → pemanggil mencatat keadaan pilihan
   *  saat itu, supaya satu gesture drag memakai satu mode irisan yang konsisten
   *  dari sel pertama sampai terakhir. */
  onMulaiGeser?: (kunciAwal: string) => void;
  /** Tahan-geser biasa → blok MENTAH; pemanggil yang mengiriskan dengan pilihan
   *  lama (ia pemegang pilihan otoritatif lalu mengirim hasilnya balik lewat
   *  prop `selection`). */
  onPilihIrisan?: (items: SelBlok[]) => void;
  /** Ctrl/Cmd+tahan-geser → blok baru ditaruh di atas pilihan lama. */
  onTambahBlok?: (items: SelBlok[]) => void;
  /** Alt/Option+tahan-geser → lepas blok dari pilihan. */
  onLepasBlok?: (items: SelBlok[]) => void;
  /** Gesture seleksi selesai → elemen sel pelepasan + penanda multi-select. */
  onSeleksiRilis?: (anchor: HTMLElement, multi: boolean) => void;
  /** Gesture geser benar-benar berakhir (tombol dilepas). */
  onGeserSelesai?: () => void;
  /** Klik kanan sel → halaman membuka aksi per tagihan. */
  onAksiKanan?: (sel: CrosstabSel, meta: MetaSel, kolom: CrosstabKolom, kotak: DOMRect) => void;
  /** Klik kanan sel KOSONG → halaman membuka panel batch (bila pilihan > 1). */
  onAksiKosong?: (sel: SelBlok, kolom: CrosstabKolom, anchor: HTMLElement) => void;
  /** Geser menyentuh sel baru → gambar persegi panjang sebagai sorotan. */
  onPratinjau?: (grid: CellRef[]) => void;
  /** Geser menyentuh sel baru → laporkan persegi panjang ke pemanggil. */
  laporkanPratinjau?: (grid: CellRef[]) => void;
  /** Tutup kartu info sel seketika (klik kanan/aksi) — state kartu ada di tabel. */
  closeHover: () => void;
  /** Posisi terakhir saat kartu ditutup karena klik (jitter guard). */
  agarJauhRef: React.MutableRefObject<{ x: number; y: number } | null>;
  /** Sel grid yang disorot blok pratinjau (persegi panjang sedang digeser). */
  pratinjau: ReadonlySet<string> | null;
  /** Kunci sel anchor (`santriId:key`) — penyorot titik awal blok. */
  anchorKunci: string | null;
  /** Lepas sorotan titik-awal (klik kanan pindah ke sel lain). */
  onLepasAnchor?: () => void;
  /** Ref bersama untuk status memblok (dipegang induk agar stabil). */
  anchorRef: React.MutableRefObject<CellRef | null>;
  activeRef: React.MutableRefObject<CellRef | null>;
  draggingRef: React.MutableRefObject<boolean>;
  dragStartRef: React.MutableRefObject<CellRef | null>;
  dragMovedRef: React.MutableRefObject<boolean>;
  /** Setia selama gesture menggeser (tidak dibersihkan onPointerUp sel). */
  pernahGeserRef: React.MutableRefObject<boolean>;
}) {
  const orangTua = [baris.ayah_nama, baris.ibu_nama].filter((n): n is string => !!n && n.trim() !== '').join(' · ');
  /* Cuma nama kelas — tingkat ("4") sudah tercermin dari kelas ("4B"), jadi
     menampilkan keduanya bikin baris kecil jadi panjang tanpa informasi baru. */
  const kelas = baris.kelas ?? '';
  /* Indeks baris dalam data crosstab — dipakai menghitung tetangga atas/bawah
     untuk menggambar garis seleksi 1px hanya di sisi luar blok. */
  const rIdx = data?.baris.findIndex((x) => x.santri_id === baris.santri_id) ?? -1;

  return (
    <tr>
      {/* Kolom Santri: nama, titik keaktifan, lalu baris kecil untuk orang tua
          & kelas. `sticky left-0` memuat tiga baris, jadi lebar maksimal
          dilonggarkan sedikit dari max-w-56 (nama saja) supaya kelas & nama
          orang tua tak terpotong di kelas yang panjang. */}
      <th scope="row" className="sticky left-0 z-10 max-w-64 border-b border-r bg-card py-1 pl-2 pr-0.5 text-left font-normal">
        <span className="flex items-center gap-1.5">
          {/* Hijau = masih aktif pada TA filter; merah = sudah Pindah/Keluar.
              Ditampilkan, bukan disaring: tagihannya tetap ada dan tetap dihitung di tunggakan. */}
          <span
            className={cn('size-1.5 shrink-0 rounded-full', baris.aktif ? 'bg-emerald-500' : 'bg-destructive')}
            title={baris.aktif ? 'Aktif' : `Tidak aktif — ${baris.status_akhir ?? 'pindah'}`}
          />
          <span className="min-w-0 truncate font-medium">{baris.nama}</span>
        </span>
        {(orangTua !== '' || kelas !== '') && (
          <span className="mt-px block truncate pl-3 text-[8px] leading-tight text-muted-foreground/70">
            {[orangTua, kelas].filter(Boolean).join(' · ')}
          </span>
        )}
      </th>
      {kolom.map((k, idxC) => {
        const sel = baris.sel[k.key];
        if (!sel) {
          /* Sel kosong ikut grid seleksi: dilewati saat menggeser (pratinjau
             + pilihan, untuk Buat Massal). */
          const lewatiKosong = (e: React.PointerEvent<HTMLElement>) => {
            if (!draggingRef.current) return;
            const d = data;
            if (!d || !dragStartRef.current) return;
            const sampaiKosong: CellRef = { santriId: baris.santri_id, key: k.key };
            const gridGeser = selGrid(d, dragStartRef.current, sampaiKosong);
            onPratinjau?.(gridGeser);
            laporkanPratinjau?.(gridGeser);
            activeRef.current = sampaiKosong;
            // Sama seperti sel terisi: laporkan blok mentah (termasuk sel
            // kosong) agar pilihan ikut terisi saat drag dimulai/dilewati
            // sel kosong — bukan cuma pratinjaunya yang digambar.
            const blok = blokTagihan(d, dragStartRef.current, sampaiKosong);
            if (e.ctrlKey || e.metaKey) { onTambahBlok?.(blok); return; }
            if (e.altKey) { onLepasBlok?.(blok); return; }
            // Geser dari/ke sel kosong tetap dihitung sebagai drag: pelepasan
            // tak boleh berubah jadi "pilih satu sel" (mode irisan) maupun
            // dilaporkan sebagai klik tunggal (tidak ada multi-select).
            if (!e.ctrlKey && !e.metaKey && !e.altKey) dragMovedRef.current = true;
            pernahGeserRef.current = true;
            onPilihIrisan?.(blok);
          };
          // Sel kosong: TANPA tombol tambah (disengaja — tambah satuan diganti
          // Buat Massal lewat seleksi + klik kanan). Klik biasa memilih satu
          // sel ini, Ctrl/Cmd+Klik toggle, Shift+Klik blok dari anchor,
          // klik kanan membuka panel batch bila pilihan > 1, dan gesture
          // geser bisa dimulai dari sini.
          const refKosong: CellRef = { santriId: baris.santri_id, key: k.key };
          const kunciKosong = kunciSel(refKosong);
          const kosongTerpilih = selection?.has(kunciKosong) ?? false;
          const selKosong: SelBlok = { santriId: baris.santri_id, key: k.key, jenisId: k.jenis_id };
          return (
            <td
              key={k.key}
              id={`td_tagihan_kosong_${baris.santri_id}_${k.key}`}
              className="group border-b border-r p-0.5 text-center"
              onPointerEnter={lewatiKosong}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                onLepasAnchor?.();
                onMulaiGeser?.(kunciKosong);
                draggingRef.current = true;
                dragMovedRef.current = false;
                pernahGeserRef.current = false;
                dragStartRef.current = refKosong;
                activeRef.current = refKosong;
              }}
              onPointerUp={(e) => {
                if (e.button !== 0) return;
                onHoverKeluar();
                if (dragMovedRef.current) {
                  dragMovedRef.current = false;
                  anchorRef.current = refKosong;
                  activeRef.current = refKosong;
                  return;
                }
                if (e.ctrlKey || e.metaKey) {
                  onTogglePilih?.(selKosong);
                  anchorRef.current = refKosong;
                  activeRef.current = refKosong;
                  onSeleksiRilis?.(e.currentTarget, true);
                  return;
                }
                if (e.shiftKey) {
                  const a = anchorRef.current;
                  const d = data;
                  if (a && d) onPilihBlok?.(blokTagihan(d, a, refKosong));
                  anchorRef.current = refKosong;
                  activeRef.current = refKosong;
                  onSeleksiRilis?.(e.currentTarget, true);
                  return;
                }
                onPilihBlok?.([selKosong]);
                anchorRef.current = refKosong;
                activeRef.current = refKosong;
                onSeleksiRilis?.(e.currentTarget, false);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                closeHover();
                onLepasAnchor?.();
                onAksiKosong?.(selKosong, k, e.currentTarget);
              }}
              style={kosongTerpilih ? { boxShadow: bayangSeleksi(data, selection, rIdx, idxC) } : undefined}
            >
              <span className="text-muted-foreground/40" onPointerEnter={lewatiKosong}>·</span>
            </td>
          );
        }
        const isiTooltip: TooltipSel = {
          nama: baris.nama, jenisNama: k.jenis_nama, tipe: k.tipe, periode: k.periode,
          nominal: sel.nominal, terbayar: sel.terbayar, sisa: sel.sisa,
        };
        const meta = {
          nama: baris.nama, label: labelSel(k),
          ayah_nama: baris.ayah_nama, ibu_nama: baris.ibu_nama, santri_id: baris.santri_id,
          foto_dokumen_id: baris.foto_dokumen_id, foto_profil: baris.foto_profil,
          kelas: baris.kelas, jenjang_riwayat: baris.jenjang_riwayat,
        };
        return (
          /* Sel tagihan = <td> telanjang (tanpa elemen dalam). Seluruh perilaku
             (id, fokus, pointer, hover, warna status) menempel di <td> itu
             sendiri, jadi tak ada kotak kedua di dalam sel.

             Kelas `relative`: <td> dengan `position: static` bukan containing
             block yang andal untuk ring/outline, dan `overflow` tabel bisa
             memotong sorotan. `z-index` diset saat hover agar outline-nya
             tidak tertimpa sel tetangga.

             Pemilihan ganda ala Excel:
             - Klik kiri biasa → sorotan/anchor pindah ke satu sel.
             - Ctrl/Cmd+Klik → tambah/lepas satu sel (pilihan acak).
             - Tahan-geser → blok pilih (irisan dengan pilihan lama).
             - Ctrl/Cmd+tahan-geser → blok baru ditambahkan ke pilihan.
             - Alt/Option+tahan-geser → blok lepas (kurangi dari pilihan).
             - Shift+Klik / Shift+panah → blok persegi panjang dari anchor.
             Klik kanan → aksi per tagihan (preventDefault menekan menu konteks
             browser); Enter/Spasi juga membukanya (ditangani manual di
             onKeyDown karena sel kini <td>, bukan tombol) agar detail/ubah/
             hapus tetap terjangkau.
             Logika pilih/batalkan ada di `onPointerUp`, BUKAN `onClick`:
             `preventDefault` di `onPointerDown` menekan event `click` di
             banyak browser, sehingga mengandalkan `onClick` membuat toggle
             & batal pilihan tak pernah terpicu. */
          <td
            key={k.key}
            id={`btn_tagihan_sel_${sel.id}`}
            tabIndex={-1}
            /* Tanda seleksi: garis 1px accent hanya di sisi LUAR blok (bukan
               antar sel terpilih) supaya garis di dalam blok tak jadi dobel.
               Grid bawaan (border-b/border-r) tetap menjadi satu garis pada
               sisi antar sel terpilih.

               Hover TIDAK memakai outline lagi (dulu hover:outline-1 +
               hover:outline-ring). Outline digambar di LUAR border-box,
               sedangkan garis seleksi digambar di DALAM lewat inset
               box-shadow. Pada sel yang terpilih lalu di-hover, keduanya
               jatuh berdampingan (1 piksel seleksi + 1 piksel outline) dan
               tampak sebagai DUA garis yang menempel. Sekarang hover digambar
               di dalam memakai inset box-shadow yang sama seperti seleksi,
               sehingga pada sel terpilih garisnya menempati piksel yang SAMA
               dan tetap terbaca satu garis. */
            /* anchorKunci TIDAK dipakai untuk menandai sel secara visual: atas
               permintaan, penanda ring-nya dihapus. Ia tetap jadi state logika
               (acuan blok geser / Shift), supaya perilaku seleksi tak berubah. */
            className={cn(
              'relative cursor-default border-b border-r p-0.5 text-right tabular-nums hover:z-10',
              /* Saat TIDAK terpilih: hover menggambar garis ring 1px di dalam
                 (arbitrary box-shadow, lihat BAYANG_HOVER). Saat terpilih
                 kelas ini tidak dipasang — garisnya sudah dari bayangSeleksi,
                 dan menumpuk keduanya (inset outline vs inset shadow pada
                 sisi sama) membuat garis tampak menebal/bergeser. */
              selection?.has(kunciSel({ santriId: baris.santri_id, key: k.key })) ? '' : `hover:shadow-[inset_0_0_0_1px_var(--ring)]`,
              kelasSel(sel),
              sel.terlambat ? 'font-semibold' : '',
            )}
            style={{
              boxShadow: selection?.has(kunciSel({ santriId: baris.santri_id, key: k.key }))
                ? bayangSeleksi(data, selection, rIdx, idxC)
                : undefined,
              /* Overlay RANGE terpilih DAN blok yang sedang digeser memakai
                 gaya yang SAMA (accent tipis). Digambar lewat background-image
                 (gradien 1 warna), bukan background-color, karena:
                   - warna latar sel dipakai untuk status tagihan (hijau lunas /
                     kuning sebagian / merah terlambat) dan tak boleh hilang;
                   - latar pekat (accent penuh) membuat teks nominal tak
                     terbaca saat menggeser, jadi pratinjau pun memakai
                     ketipisan yang sama seperti seleksi biasa. Bedanya hanya
                     pada garis tepi blok, yang tetap digambar seleksi ini. */
              backgroundImage: (selection?.has(kunciSel({ santriId: baris.santri_id, key: k.key })) || pratinjau?.has(`${baris.santri_id}\u0000${k.key}`))
                ? 'linear-gradient(color-mix(in srgb, var(--accent) 14%, transparent), color-mix(in srgb, var(--accent) 14%, transparent))'
                : undefined,
            }}
            onContextMenu={(e) => {
              // Di macOS, Ctrl+Klik = gestur klik-kanan sistem: browser
              // memicu `contextmenu` walau tombol fisiknya kiri. Karena
                // Ctrl/Cmd+Klik dimaksudkan untuk toggle seleksi (bukan menu
                // konteks), acungkan dulu — biar pointerup yang memproses
                // toggle. Klik kanan sungguhan (tanpa ctrl/meta) tetap
                // membuka aksi per tagihan.
                if (e.ctrlKey || e.metaKey) return;
                e.preventDefault();
                // Klik kanan TIDAK mengubah pilihan: pilihan yang sudah dibangun
                // (mis. range hasil drag) harus tetap utuh, supaya klik kanan di
                // dalamnya bisa membuka AKSI BATCH untuk seluruh range itu.
                // Kalau pilihan diganti jadi satu sel, aksi batch kehilangan
                // jalan masuk. Kartu info sel ditutup seketika supaya tak
                // menumpuk dengan popover; penutupan ini milik tabel karena
                // state kartunya di sini (halaman hanya menerima permintaan
                // aksinya).
                closeHover();
                // Sorotan titik-awal dilepas: penandanya kini tak terlihat, tapi
                // state-nya tetap harus bersih agar acuan blok berikutnya tidak
                // memakai sel lama.
                onLepasAnchor?.();
                // Fokus DOM ikut dipindahkan; tanpa ini elemen sel lama tetap
                // memegang fokus sehingga garis `focus-visible`-nya masih
                // menyala walau anchor sudah dilepas.
                e.currentTarget.focus();
                // Catat posisi klik: pointer harus bergerak jauh dari titik ini
                // sebelum kartu boleh hidup lagi (jitter saat klik).
                const kotak = e.currentTarget.getBoundingClientRect();
                agarJauhRef.current = { x: kotak.left + kotak.width / 2, y: kotak.top + kotak.height / 2 };
                onAksiKanan?.(sel, meta, k, kotak);
              }}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              // Cegah seleksi teks & biarkan elemen dapat fokus.
              e.preventDefault();
              // Gesture baru dimulai → lepas ring titik-awal milik klik kiri
              // sebelumnya. Tanpa ini ring sel lama tetap menyala selama drag
              // di tempat lain (dua sel tampak "aktif" sekaligus).
              onLepasAnchor?.();
              // Catat keadaan pilihan DI AWAL gesture (dipakai memilih mode
              // irisan yang konsisten selama drag).
              onMulaiGeser?.(kunciSel({ santriId: baris.santri_id, key: k.key }));
              draggingRef.current = true;
              dragMovedRef.current = false;
              pernahGeserRef.current = false;
              dragStartRef.current = { santriId: baris.santri_id, key: k.key };
              activeRef.current = { santriId: baris.santri_id, key: k.key };
              e.currentTarget.focus();
            }}
            onPointerEnter={(e) => {
              if (!draggingRef.current) return;
              const d = data;
              if (!d || !dragStartRef.current) return;
              const sampaiRef: CellRef = { santriId: baris.santri_id, key: k.key };
              // Pratinjau selalu digambar lebih dulu (bentuk persegi panjang
              // yang sedang digeser, apa pun modifier-nya) — sekaligus
              // dilaporkan ke pemanggil.
              const gridGeser = selGrid(d, dragStartRef.current, sampaiRef);
              onPratinjau?.(gridGeser);
              laporkanPratinjau?.(gridGeser);
              // Sel aktif mengikuti posisi terakhir (dipakai komit pelepasan
              // di listener window + navigasi panah sesudah geser).
              activeRef.current = sampaiRef;
              const blok = blokTagihan(d, dragStartRef.current, sampaiRef);
              // Ctrl/Cmd tahan-geser = menambah ke pilihan ala Excel: blok
              // baru ditaruh di ATAS pilihan lama (union), bukan menggantinya.
              if (e.ctrlKey || e.metaKey) { onTambahBlok?.(blok); return; }
              // Alt/Option tahan-geser → kurangi blok dari pilihan.
              if (e.altKey) { onLepasBlok?.(blok); return; }
              // Geser biasa: yang dipilih adalah IRISAN blok dengan pilihan
              // lama (sel di luar pilihan lama diabaikan). Perhitungannya
              // diserahkan ke halaman lewat `onPilihIrisan` — crosstab hanya
              // meneruskan BLOK mentah, karena halaman yang memegang pilihan
              // otoritatif dan tahu kapan pilihan kosong (geser pertama harus
              // boleh memulai seleksi). Pratinjau tetap digambar di sini.
              // Sekaligus menandai gesture sebagai drag: pelepasan tak boleh
              // menambah sel.
              dragMovedRef.current = true;
              pernahGeserRef.current = true;
              onPilihIrisan?.(blok);
            }}
            onPointerUp={(e) => {
              if (e.button !== 0) return;
              // Gestur seleksi selesai → tutup kartu info sel; kartu yang
              // mengikuti kursor hanya akan menutupi popover aksi yang
              // muncul di sel ini.
              onHoverKeluar();
              const ref: CellRef = { santriId: baris.santri_id, key: k.key };
              // Klik susulan setelah geser: abaikan perubahan pilihan (blok
              // sudah diperbarui via onPointerEnter). Pelaporan multi-select
              // ditangani listener window (lihat catatan di sana).
              if (dragMovedRef.current) {
                dragMovedRef.current = false;
                anchorRef.current = ref;
                activeRef.current = ref;
                return;
              }
              if (e.ctrlKey || e.metaKey) {
                // Ctrl/Cmd+Klik → toggle satu sel (tambah/lepas) = multi-select.
                onTogglePilih?.({ santriId: baris.santri_id, key: k.key, jenisId: k.jenis_id, sel });
                anchorRef.current = ref;
                activeRef.current = ref;
                onSeleksiRilis?.(e.currentTarget, true);
                return;
              }
              if (e.shiftKey) {
                // Shift+Klik → blok persegi panjang dari anchor (ganti pilihan).
                const a = anchorRef.current;
                const d = data;
                if (a && d) onPilihBlok?.(blokTagihan(d, a, ref));
              } else {
                // Klik kiri biasa → geser sorotan ke sel ini (ganti seluruh
                // pilihan), seperti mengklik sel di Excel. Ini BUKAN
                // multi-select: popover batch tidak dibuka.
                onKlikSel?.({ santriId: baris.santri_id, key: k.key, jenisId: k.jenis_id, sel });
                anchorRef.current = ref;
                activeRef.current = ref;
                onSeleksiRilis?.(e.currentTarget, false);
                return;
              }
              anchorRef.current = ref;
              activeRef.current = ref;
              // Shift+Klik memilih blok → multi-select.
              onSeleksiRilis?.(e.currentTarget, true);
            }}
            onKeyDown={(e) => {
              // Enter/Spasi → buka aksi per tagihan (satu-satunya jalan
              // keyboard; klik kiri murni seleksi).
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onAksiKanan?.(sel, meta, k, e.currentTarget.getBoundingClientRect());
                return;
              }
              const d = data;
              if (!d) return;
              const arah = e.key === 'ArrowLeft' ? [-1, 0]
                : e.key === 'ArrowRight' ? [1, 0]
                : e.key === 'ArrowUp' ? [0, -1]
                : e.key === 'ArrowDown' ? [0, 1] : null;
              if (arah === null) return;
              e.preventDefault();
              const cur = activeRef.current ?? { santriId: baris.santri_id, key: k.key };
              const r = d.baris.findIndex((x) => x.santri_id === cur.santriId);
              const c = d.kolom.findIndex((x) => x.key === cur.key);
              if (r < 0 || c < 0) return;
              const nr = Math.max(0, Math.min(d.baris.length - 1, r + arah[1]));
              const nc = Math.max(0, Math.min(d.kolom.length - 1, c + arah[0]));
              const target = { santriId: d.baris[nr].santri_id, key: d.kolom[nc].key };
              if (e.shiftKey) {
                if (!anchorRef.current) anchorRef.current = cur;
                onPilihBlok?.(blokTagihan(d, anchorRef.current, target));
              }
              activeRef.current = target;
              const tgtSel = d.baris[nr].sel[d.kolom[nc].key];
              const tgtEl = tgtSel ? document.getElementById(`btn_tagihan_sel_${tgtSel.id}`) : null;
              tgtEl?.focus();
              // Shift+panah = multi-select → popover batch boleh muncul.
              if (e.shiftKey && tgtEl) onSeleksiRilis?.(tgtEl, true);
            }}
            onFocus={() => { activeRef.current = { santriId: baris.santri_id, key: k.key }; }}
            /* Kartu info sel dimatikan selama drag bulk-selection: pointer
               melintasi banyak sel dan kartu yang mengikuti kursor hanya
               menutupi sel yang sedang dipilih. */
            onMouseEnter={(e) => { if (draggingRef.current) return; onHoverMasuk(isiTooltip, e.currentTarget); }}
            onMouseMove={(e) => { if (draggingRef.current) return; onHoverGerak(isiTooltip, e); }}
            onMouseLeave={onHoverKeluar}
              aria-describedby="tip_tagihan_sel"
              aria-pressed={selection?.has(kunciSel({ santriId: baris.santri_id, key: k.key })) ?? false}
            >
              {sel.nominal.toLocaleString('id')}
            </td>
        );
      })}
      <td className="border-b border-l p-0.5 text-right tabular-nums">{baris.total_tagihan.toLocaleString('id')}</td>
      <td className="border-b border-l p-0.5 text-right tabular-nums">{baris.total_terbayar.toLocaleString('id')}</td>
      <td className={`border-b border-l p-0.5 text-right tabular-nums ${baris.tunggakan > 0 ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
        {baris.tunggakan.toLocaleString('id')}
      </td>
    </tr>
  );
});

/**
 * Mematikan pointer pada pembungkus Popper milik Radix.
 *
 * `pointer-events: none` pada isi kartu saja tak cukup: Radix menyisipkan
 * `<div data-radix-popper-content-wrapper>` yang tetap menahan pointer, sehingga
 * sel yang tertutup kartu tak bisa di-hover. Wrapper itu ikut dimatikan.
 */
function WrapperTanPointer({ children }: { children: React.ReactNode }) {
  const ref = useCallback((el: HTMLDivElement | null) => {
    const bungkus = el?.parentElement?.parentElement;
    if (bungkus instanceof HTMLElement) bungkus.style.pointerEvents = 'none';
  }, []);
  return <div ref={ref}>{children}</div>;
}

/** Isi kartu hover: rincian tagihan per sel (dipakai di dalam HoverCardContent). */
function IsiKartuTagihan({ data }: { data: TooltipSel }) {
  return (
    <div className="text-xs">
      <p className="font-semibold">{data.nama}</p>
      <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
        <dt className="text-muted-foreground">Nama Tarif</dt>
        <dd className="text-right">{data.jenisNama}</dd>
        {data.tipe === 'bulanan' && data.periode !== null && (
          <>
            <dt className="text-muted-foreground">Periode</dt>
            <dd className="text-right">{periodePanjang(data.periode)}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Nominal Tagihan</dt>
        <dd className="text-right tabular-nums">Rp {data.nominal.toLocaleString('id')}</dd>
        <dt className="text-muted-foreground">Nominal Terbayar</dt>
        <dd className="text-right tabular-nums">Rp {data.terbayar.toLocaleString('id')}</dd>
        <dt className="text-muted-foreground">Sisa</dt>
        <dd className={`text-right font-semibold tabular-nums ${data.sisa > 0 ? 'text-destructive' : ''}`}>
          Rp {data.sisa.toLocaleString('id')}
        </dd>
      </dl>
    </div>
  );
}

/** Tabel silang tagihan: baris = santri, kolom = jenis (bulanan per bulan).
 *  Sel berisi nominal dengan warna status.
 *
 *  KLIK KIRI murni untuk seleksi sel — tidak ada popover yang muncul; aksi per
 *  tagihan hanya dari KLIK KANAN (atau Enter saat sel disorot). Pilihan sel
 *  gaya Excel:
 *  - klik kiri biasa → sorotan/anchor pindah ke satu sel;
 *  - Ctrl/Cmd+Klik → tambah/lepas sel (pilihan acak);
 *  - tahan-geser → blok pilih (irisan dengan pilihan yang sudah ada);
 *  - Ctrl/Cmd+tahan-geser → blok baru ditambahkan ke pilihan;
 *  - Alt/Option+tahan-geser → blok lepas (kurangi dari pilihan);
 *  - Shift+Klik / Shift+panah → blok persegi panjang dari anchor. */
function TagihanCrosstab({
  data, loading, terpilihId, aksi, onPilih, onTambah,
  selection: pilihanLuar, onTogglePilih, onPilihBlok, onKlikSel, onPilihIrisan, onMulaiGeser, onTambahBlok, onLepasBlok,
  onSeleksiRilis, onGeserSelesai, onAksiKanan, onAksiKosong, onPratinjau, emptyText,
}: Props) {
  const kolom = data?.kolom ?? [];
  const baris: CrosstabBaris[] = data?.baris ?? [];
  const grup = grupKolom(kolom);
  /* State memblok dipegang ref agar stabil (tidak memicu render ulang tabel
     saat gesture berjalan) dan bisa dibaca dari handler sel. */
  const anchorRef = useRef<CellRef | null>(null);
  const activeRef = useRef<CellRef | null>(null);
  const draggingRef = useRef(false);
  const dragStartRef = useRef<CellRef | null>(null);
  const dragMovedRef = useRef(false);
  /** Setia selama gesture benar-benar menggeser. BERBEDA dari `dragMovedRef`
   *  yang dibersihkan `onPointerUp` sel: listener window `pointerup` berjalan
   *  SETELAH handler React itu, jadi ia tak bisa lagi membedakan drag dari
   *  klik lewat `dragMovedRef`. Penanda ini hanya direset di pointerdown. */
  const pernahGeserRef = useRef(false);

  /* ---- Pilihan sel (klik kiri) & pratinjau blok ----
     Id tagihan terpilih dipegang di SINI, bukan di halaman: selama menggeser
     blok, pilihan berubah tiap sel yang dilewati. Kalau state-nya di halaman,
     tiap sel berarti satu render ulang seluruh halaman Keuangan (ratusan baris
     crosstab ikut dirender ulang) — itulah yang membuat geser terasa berat.
     Tabel hanya melaporkan hasil gesture sekali saat tombol dilepas. */
  const selection = useMemo(() => new Set(pilihanLuar ?? []), [pilihanLuar]);
  /* Pilihan bendera lokal: sel yang dipilih sebelum halaman sempat
     memperbaruinya (mis. langsung Shift+Klik dua kali berturut-turut).
     Selama tak kosong, ia yang menang atas `selection` dari halaman. */
  const [pilihanLokal, setPilihanLokal] = useState<Set<string> | null>(null);
  const pilihan = pilihanLokal ?? selection;
  const pilihanRef = useRef<ReadonlySet<string>>(pilihan);
  pilihanRef.current = pilihan;
  /** Pembuang pilihan lokal SETELAH pilihan halaman ikut berubah, supaya tak
   *  ada render yang sempat menampilkan pilihan kosong. */
  const buangLokalRef = useRef(false);
  useEffect(() => {
    if (!buangLokalRef.current) return;
    buangLokalRef.current = false;
    setPilihanLokal(null);
  }, [pilihanLuar]);
  /** Sel grid anchor (`santriId:key`) — penyorot titik awal blok. null =
   *  sorotan disembunyikan agar crosstab tetap bersih saat pilihan dibatalkan
   *  dari luar (tombol "Batal Pilih"). */
  const [anchorKunci, setAnchorKunci] = useState<string | null>(null);
  /** Sel grid yang disorot blok pratinjau selama menggeser (persegi panjang). */
  const [pratinjau, setPratinjau] = useState<ReadonlySet<string> | null>(null);
  /** Posisi terakhir saat kartu info ditutup karena klik — pointer harus
   *  bergerak jauh dari titik ini dulu, supaya jitter saat klik tak
   *  menyalakannya kembali (dan menumpuk dengan popover). */
  const agarJauhRef = useRef<{ x: number; y: number } | null>(null);

  /* Handler seleksi dibungkus ref + useCallback agar identitasnya stabil:
     props memo pada baris tak boleh berubah tiap render, atau tabel ratusan
     baris ini dirender ulang seluruhnya tiap kali pilihan bergeser. */
  const pilihBlokRef = useRef(onPilihBlok);
  pilihBlokRef.current = onPilihBlok;
  const klikSelRef = useRef(onKlikSel);
  klikSelRef.current = onKlikSel;
  const rilisRef = useRef(onSeleksiRilis);
  rilisRef.current = onSeleksiRilis;
  const onGeserSelesaiRef = useRef(onGeserSelesai);
  onGeserSelesaiRef.current = onGeserSelesai;
  /* Cermin untuk komit pelepasan di listener window (butuh identitas stabil
     tanpa menambah dependensi effect). */
  const irisanRef = useRef(onPilihIrisan);
  irisanRef.current = onPilihIrisan;
  const tambahBlokRef = useRef(onTambahBlok);
  tambahBlokRef.current = onTambahBlok;
  const lepasBlokRef = useRef(onLepasBlok);
  lepasBlokRef.current = onLepasBlok;

  /** Lepas sorotan titik-awal (dipakai klik kanan yang beralih ke sel lain). */
  const lepasAnchor = useCallback(() => {
    setAnchorKunci(null);
  }, []);
  /** Klik kiri: sorotan (dan anchor) pindah ke sel itu; pilihan diganti. */
  const klikSel = useCallback((sel: SelBlok) => {
    const kunci = kunciSel(sel);
    setAnchorKunci(kunci);
    const dulu = new Set<string>([kunci]);
    setPilihanLokal(dulu);
    pilihanRef.current = dulu;
    buangLokalRef.current = true;
    klikSelRef.current?.(sel);
  }, []);
  /** Tahan-geser biasa: blok mentah diserahkan ke halaman, yang mengiriskan
   *  dengan pilihan lama dan mengirim hasilnya kembali lewat prop `selection`.
   *  Crosstab TIDAK menebak hasilnya sendiri — menghitung dari blok mentah akan
   *  menyorot sel di luar pilihan lama dan membuat mode irisan tak konsisten.
   *  Selama gesture, pilihan lokal dibiarkan kosong agar pilihan otoritatif
   *  halaman yang tampil. */
  const geserIrisan = useCallback((items: SelBlok[]) => {
    onPilihIrisan?.(items);
  }, [onPilihIrisan]);
  /** Ctrl/Cmd+tahan-geser: blok baru ditambahkan ke pilihan lama. */
  const geserTambah = useCallback((items: SelBlok[]) => {
    const baru = new Set(pilihanRef.current);
    for (const it of items) baru.add(kunciSel(it));
    setPilihanLokal(baru);
    pilihanRef.current = baru;
    buangLokalRef.current = true;
    onTambahBlok?.(items);
  }, [onTambahBlok]);
  /** Shift+Klik / Shift+panah: blok persegi panjang dari anchor. */
  const geserBlok = useCallback((items: SelBlok[]) => {
    const baru = new Set(items.map((it) => kunciSel(it)));
    setPilihanLokal(baru);
    pilihanRef.current = baru;
    buangLokalRef.current = true;
    pilihBlokRef.current?.(items);
  }, []);
  /** Lepas blok dari pilihan (Alt/Option+tahan-geser). */
  const geserLepas = useCallback((items: SelBlok[]) => {
    const baru = new Set(pilihanRef.current);
    for (const it of items) baru.delete(kunciSel(it));
    setPilihanLokal(baru);
    pilihanRef.current = baru;
    buangLokalRef.current = true;
    onLepasBlok?.(items);
  }, [onLepasBlok]);
  /** Gesture selesai: laporkan jangkar + apakah multi-select. */
  const seleksiRilis = useCallback((el: HTMLElement, multi: boolean) => {
    rilisRef.current?.(el, multi);
  }, []);
  /** Geser menyentuh sel baru → gambar persegi panjang sebagai pratinjau blok. */
  const pratampak = useCallback((grid: CellRef[]) => {
    if (grid.length === 0) { setPratinjau(null); return; }
    const s = new Set<string>();
    for (const g of grid) s.add(`${g.santriId}\u0000${g.key}`);
    setPratinjau(s);
  }, []);

  /* Aksi per tagihan (klik kanan / Enter) datang dari luar sebagai rect sel.
     Rect itu berasal dari snapshot DOM SEBELUM tabel ini dirender ulang, jadi
     elemennya harus dicari ulang dari rect-nya: pemetaan langsung ke sel
     membuat popover menempel pada baris yang salah begitu tabel bergeser. */
  const kotakSama = useCallback((el: HTMLElement, t: DOMRect): boolean => {
    const r = el.getBoundingClientRect();
    if (t.width > 0 && r.width > 0 && (Math.abs(r.left - t.left) > 1 || Math.abs(r.top - t.top) > 1)) return false;
    return Math.abs(r.height - t.height) <= 1;
  }, []);
  const cariSel = useCallback((id: number, target: DOMRect | null): HTMLElement | null => {
    const semua = document.querySelectorAll<HTMLElement>(`[id^="btn_tagihan_sel_"]`);
    let pertama: HTMLElement | null = null;
    for (const el of semua) {
      if (el.id !== `btn_tagihan_sel_${id}`) continue;
      if (pertama === null) pertama = el;
      if (target === null || kotakSama(el, target)) return el;
    }
    return pertama;
  }, [kotakSama]);
  useEffect(() => {
    if (aksi == null) return;
    const el = cariSel(aksi.sel.id, aksi.jangkar);
    if (el !== null) onPilih(aksi.sel, aksi.meta, el, aksi.kolom);
    // `aksi` identitasnya sudah stabil dari halaman (memo), jadi effect ini
    // hanya jalan sekali per permintaan aksi.
  }, [aksi, cariSel, onPilih]);

  /* Grup non-bulanan satu kolom digabung jadi satu sel header (rowSpan=2):
     tak ada sub-label yang perlu ditampilkan di baris kedua. */
  const gabungKunci = new Set(
    grup
      .filter((g) => g.kolom.length === 1 && g.kolom[0].tipe === 'non_bulanan')
      .map((g) => g.kolom[0].key),
  );

  // Tinggi baris header grup diukur, bukan di-hardcode: baris daun harus
  // menempel tepat di bawahnya, dan salah ukur => sel data terlihat
  // menembus header saat digulir.
  const grupRef = useRef<HTMLTableRowElement>(null);
  /** Wadah gulir. */
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tinggiGrup, setTinggiGrup] = useState(0);
  /** Sel yang sedang di-hover + elemen selnya (jangkar kartu). */
  const [hover, setHover] = useState<{ isi: TooltipSel; anchor: HTMLElement } | null>(null);

  /** Elemen jangkar HoverCard (diposisikan di atas sel yang di-hover). */
  const jangkarRef = useRef<HTMLDivElement | null>(null);
  /** Tenggang sebelum menutup, agar perpindahan sel tak berkedip. */
  const tutupRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Handler stabil (dipakai props memo BarisCrosstab): `onPilih` & friends
  // dibuat ulang tiap render bila ditulis inline, sehingga memo tidak berlaku.
  const pilihRef = useRef(onPilih);
  pilihRef.current = onPilih;

  /** Cermin `terpilihId` (ada popover = tak ada kartu hover) untuk callback
   *  yang harus tetap stabil, jadi tak perlu masuk ke dependensi useCallback. */
  const adaPopoverRef = useRef(terpilihId !== null);
  adaPopoverRef.current = terpilihId !== null;

  /* Kartu sengaja dimatikan saat klik. Kalau pointer lalu bergerak (mis. saat
     popover ditutup), kartu boleh hidup lagi — tapi hanya setelah keluar dari
     titik klik, supaya gerak kecil saat klik tidak langsung menumpukkannya. */
  const hoverGerak = useCallback((isi: TooltipSel, e: React.MouseEvent<HTMLElement>) => {
    if (adaPopoverRef.current) return;
    const agarJauh = agarJauhRef.current;
    if (agarJauh === null) return;
    if (Math.hypot(e.clientX - agarJauh.x, e.clientY - agarJauh.y) < 6) return;
    agarJauhRef.current = null;
    setHover({ isi, anchor: e.currentTarget });
  }, []);

  /* Idempoten per gesture: di browser nyata `click` tak pernah menyusul
     `pointerdown` (Radix membatalkan event itu), tapi di jsdom tetap datang —
     dan klik keyboard hanya menghasilkan `click`.

     Flag ini di-reset lewat task berikutnya; sisa event gesture (pointerup,
     click) diproses browser dalam satu task input, jadi masih terpasang saat
     `click` tiba. */
  const baruPilihRef = useRef(false);
  const pilihStabil = useCallback(
    (
      sel: CrosstabSel,
      meta: { nama: string; label: string; ayah_nama: string | null; ibu_nama: string | null; santri_id: number; foto_dokumen_id: number | null; foto_profil: boolean; kelas: string | null; jenjang_riwayat: string[] },
      anchor: HTMLElement,
      kolom: CrosstabKolom,
    ) => {
      // Gesture ini sudah diproses (pointerdown lebih dulu) — abaikan click
      // yang menyusul agar `onPilih` tak dipanggil dua kali.
      if (baruPilihRef.current) return;
      baruPilihRef.current = true;
      setTimeout(() => { baruPilihRef.current = false; }, 0);

      // Klik kanan / Enter keyboard membuka popover aksi → tutup kartu hover
      // seketika,
      // jangan sampai dua-duanya menumpuk di atas sel yang sama. Pointer tak
      // bergerak lagi, jadi mouseenter tak akan menyalakannya kembali.
      if (tutupRef.current !== null) { clearTimeout(tutupRef.current); tutupRef.current = null; }
      const kotak = anchor.getBoundingClientRect();
      agarJauhRef.current = { x: kotak.left + kotak.width / 2, y: kotak.top + kotak.height / 2 };
      setHover(null);
      pilihRef.current(sel, meta, anchor, kolom);
    },
    [],
  );
  const hoverMasuk = useCallback((isi: TooltipSel, anchor: HTMLElement) => {
    if (adaPopoverRef.current) return;
    if (tutupRef.current !== null) { clearTimeout(tutupRef.current); tutupRef.current = null; }
    setHover({ isi, anchor });
  }, []);
  const hoverKeluar = useCallback(() => {
    if (tutupRef.current !== null) clearTimeout(tutupRef.current);
    tutupRef.current = setTimeout(() => setHover(null), 400);
  }, []);
  /** Tutup kartu info SEKETIKA (tanpa tenggang) — dipakai klik kanan, supaya
   *  kartu tak menumpuk dengan popover aksi yang muncul di sel yang sama. */
  const hoverKeluarSeketika = useCallback(() => {
    if (tutupRef.current !== null) { clearTimeout(tutupRef.current); tutupRef.current = null; }
    setHover(null);
  }, []);

  /* Akhiri drag bila pointer dilepas di luar sel (mis. di luar tabel).
     Pelepasan DI LUAR wadah tak diterima sel mana pun, sehingga gestur geser
     blok bisa selesai tanpa sinyal rilis — kabari dari sini, memakai sel awal
     geser sebagai jangkar popover aksi (dan tutup kartu info). Pelepasan di
     dalam wadah sudah ditangani `onPointerUp` milik sel.

     Ditaruh setelah `hoverKeluar`: array dependensinya memakainya, dan array
     dievaluasi saat render — bila effect berada di atas deklarasinya akan
     kena TDZ. */
  useEffect(() => {
    const akhiri = (ev: PointerEvent) => {
      if (!draggingRef.current) return;
      // Geser selesai → kartu info sel ditutup (lihat catatan di onPointerUp).
      hoverKeluar();
      // Pratinjau blok selalu dibuang saat tombol dilepas.
      setPratinjau(null);
      /* Laporan multi-select dikirim DI SINI, bukan dari onPointerUp sel:
         listener window ini dipasang di fase yang sama dan mereset
         dragMovedRef lebih dulu, sehingga cabang drag di onPointerUp React
         sudah melihat dragMovedRef = false dan tak pernah melaporkannya.

         HANYA saat gesture ini benar-benar menggeser (`dragMovedRef`): klik
         tunggal juga memicu pointerup di window, dan kalau ikut dilaporkan
         sebagai multi-select, popover aksi batch muncul hanya karena mengklik
         — persis yang tidak diinginkan.

         Jangkar = sel tempat pelepasan bila masih di dalam tabel; kalau
         dilepas di luar tabel, pakai sel awal geser. */
      const wadah = scrollRef.current;
      const mulai = dragStartRef.current;
      if (mulai !== null && pernahGeserRef.current) {
        // Komit blok sampai sel AKTIF terakhir (bukan cuma yang sempat
        // pointerenter): pelepasan di atas tooltip/overlay tak mengenai sel
        // mana pun, tapi bloknya tetap harus lengkap. Idempoten.
        const d = data;
        const akhir = activeRef.current ?? mulai;
        if (d !== null) {
          const blok = blokTagihan(d, mulai, akhir);
          if (ev.ctrlKey || ev.metaKey) { tambahBlokRef.current?.(blok); }
          else if (ev.altKey) { lepasBlokRef.current?.(blok); }
          else { irisanRef.current?.(blok); }
        }
        const didalam = wadah !== null && ev.target instanceof Node && wadah.contains(ev.target);
        let el: HTMLElement | null = null;
        if (didalam && ev.target instanceof Element) {
          el = ev.target.closest<HTMLElement>('[id^="btn_tagihan_sel_"]');
        }
        if (el === null) {
          const baris = data?.baris.find((b) => b.santri_id === mulai.santriId);
          const selMulai = baris?.sel[mulai.key];
          el = selMulai ? document.getElementById(`btn_tagihan_sel_${selMulai.id}`) : null;
        }
        if (el !== null) onSeleksiRilis?.(el, true);
      }
      draggingRef.current = false;
      dragMovedRef.current = false;
      /* Gesture benar-benar berakhir → beri tahu pemanggil supaya ia melepas
         keadaan "mode geser" (mis. penanda irisan). Tanpa ini, gesture
         berikutnya masih dianggap lanjutan gesture sebelumnya. */
      onGeserSelesaiRef.current?.();
    };
    window.addEventListener('pointerup', akhiri);
    return () => window.removeEventListener('pointerup', akhiri);
  }, [data, onSeleksiRilis, hoverKeluar]);

  /* Radix HoverCard tidak punya virtualRef seperti PopoverAnchor, jadi
     jangkarnya harus elemen nyata. Kita taruh satu elemen tak terlihat persis
     di atas sel yang di-hover; posisinya ditulis sebelum browser melukis. */
  const tempatkanJangkar = useCallback(() => {
    const el = jangkarRef.current;
    if (el === null || hover === null) return;
    const r = hover.anchor.getBoundingClientRect();
    el.style.left = `${r.left}px`;
    el.style.top = `${r.top}px`;
    el.style.width = `${r.width}px`;
    el.style.height = `${r.height}px`;
  }, [hover]);

  useLayoutEffect(tempatkanJangkar, [tempatkanJangkar]);

  /* Popover aksi terbuka → tutup kartu yang masih nyangkut (mis. popover
     dibuka lewat keyboard saat pointer astral di sel lain). Tanpa ini kartu
     tetap menggantung di atas panel yang sama. */
  useEffect(() => {
    if (terpilihId === null) return;
    if (tutupRef.current !== null) { clearTimeout(tutupRef.current); tutupRef.current = null; }
    setHover(null);
  }, [terpilihId]);

  /* Tabel digulir → tutup kartu. Radix tidak memantau pergeseran posisi
     jangkar, jadi tanpa ini kartu melayang jauh dari sel asalnya.

     Wadah diambil dari `scrollRef`, bukan `getElementById`, dan dependensinya
     `adaKolom`: sebelumnya efeknya dependensi kosong, jadi saat tab Tagihan
     di-mount sementara data masih dimuat, komponen return lebih dulu
     (lihat `kolom.length === 0` di bawah) → wadahnya belum ada → effect
     batal dan tidak pernah diulang. Akibatnya "gulir → tutup kartu" tidak
     berlaku di kunjungan pertama. Terverifikasi lewat
     `DOMDebugger.getEventListeners`: mount pertama `[]`, setelah pindah tab
     lalu kembali `["scroll"]`. */
  const adaKolom = kolom.length > 0;
  useEffect(() => {
    const wrap = scrollRef.current;
    if (wrap === null) return;
    const tutup = () => {
      if (tutupRef.current !== null) { clearTimeout(tutupRef.current); tutupRef.current = null; }
      setHover(null);
    };
    wrap.addEventListener('scroll', tutup, { passive: true });
    return () => wrap.removeEventListener('scroll', tutup);
  }, [adaKolom]);
  useLayoutEffect(() => {
    const el = grupRef.current;
    if (!el) return;
    const ukur = () => setTinggiGrup(el.getBoundingClientRect().height);
    ukur();
    const ro = new ResizeObserver(ukur);
    ro.observe(el);
    return () => ro.disconnect();
  }, [grup.length, kolom.length]);

  if (kolom.length === 0) {
    return <p className="p-8 text-center text-sm text-muted-foreground">{loading ? 'Memuat…' : emptyText}</p>;
  }

  /* `-ml-px`: tepi kiri menimpa garis rail/panel supaya sambungannya 1px,
     bukan 2px berdempetan. */
  return (
    <div id="crosstab_tagihan_scroll" ref={scrollRef} className="relative -ml-px h-full overflow-auto border bg-card">
      <table id="tbl_tagihan_crosstab" className="w-full border-separate border-spacing-0 text-xs">
        <thead>
          <tr ref={grupRef}>
            {/* `pl-5` (20px) = `pl-2` sel + titik 6px + gap 6px: label sejajar
                teks nama, bukan titik keaktifan. */}
            <th rowSpan={2} className="sticky left-0 top-0 z-30 border-b border-r bg-muted py-2 pl-5 pr-2 text-left align-middle">
              Santri
            </th>
            {grup.map((g) => {
              const gabung = g.kolom.length === 1 && gabungKunci.has(g.kolom[0].key);
              return (
                <th
                  key={g.jenisId}
                  colSpan={gabung ? undefined : g.kolom.length}
                  rowSpan={gabung ? 2 : undefined}
                  title={gabung ? labelSel(g.kolom[0]) : undefined}
                  className="sticky top-0 z-20 border-b border-r bg-muted px-1.5 py-[3.5px] text-center align-middle font-medium"
                >
                  {g.jenisNama}
                </th>
              );
            })}
            <th rowSpan={2} className="sticky top-0 z-20 border-b border-l bg-muted p-2 text-right align-middle">Tagihan</th>
            <th rowSpan={2} className="sticky top-0 z-20 border-b border-l bg-muted p-2 text-right align-middle">Terbayar</th>
            <th rowSpan={2} className="sticky top-0 z-20 border-b border-l bg-muted p-2 text-right align-middle" title="Sisa tagihan yang sudah lewat jatuh tempo">
              Tunggakan
            </th>
          </tr>
          <tr>
            {kolom.filter((k) => !gabungKunci.has(k.key)).map((k) => (
              <th
                key={k.key}
                style={{ top: tinggiGrup }}
                className={`sticky z-10 border-b border-r bg-muted px-1.5 py-[3.5px] text-center font-normal ${k.tipe === 'non_bulanan' ? 'text-muted-foreground' : ''}`}
                title={labelSel(k)}
              >
                {labelKolom(k)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {baris.map((r) => (
            <BarisCrosstab
              key={r.santri_id}
              baris={r}
              kolom={kolom}
              data={data}
              onPilih={pilihStabil}
              onTambah={onTambah}
              onHoverMasuk={hoverMasuk}
              onHoverGerak={hoverGerak}
              onHoverKeluar={hoverKeluar}
              selection={pilihan}
              onTogglePilih={onTogglePilih}
              onPilihBlok={geserBlok}
              onKlikSel={klikSel}
              onPilihIrisan={geserIrisan}
              onMulaiGeser={onMulaiGeser}
              onTambahBlok={geserTambah}
              onLepasBlok={geserLepas}
              onSeleksiRilis={seleksiRilis}
              onAksiKanan={onAksiKanan}
              onAksiKosong={onAksiKosong}
              onPratinjau={pratampak}
              laporkanPratinjau={onPratinjau}
              closeHover={hoverKeluarSeketika}
              agarJauhRef={agarJauhRef}
              pratinjau={pratinjau}
              anchorKunci={anchorKunci}
              onLepasAnchor={lepasAnchor}
              anchorRef={anchorRef}
              activeRef={activeRef}
              draggingRef={draggingRef}
              dragStartRef={dragStartRef}
              dragMovedRef={dragMovedRef}
              pernahGeserRef={pernahGeserRef}
            />
          ))}
          {baris.length === 0 && (
            <tr>
              <td colSpan={kolom.length + 4} className="p-8 text-center text-muted-foreground">
                {loading ? 'Memuat…' : emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <HoverCard
      open={hover !== null}
      /* `open` di sini dikontrol, jadi tanpa onOpenChange permintaan tutup dari
         Radix (mis. Escape) diabaikan: kartu tetap terbuka sekaligus memakan
         Escape yang seharusnya sampai ke popover. */
      onOpenChange={(o) => { if (!o) { if (tutupRef.current !== null) { clearTimeout(tutupRef.current); tutupRef.current = null; } setHover(null); } }}
      openDelay={0}
      closeDelay={200}
    >
        <HoverCardTrigger asChild>
          <div
            ref={jangkarRef}
            aria-hidden
            className="pointer-events-none fixed z-0 h-0 w-0 opacity-0"
          />
        </HoverCardTrigger>
        <HoverCardContent
          /* Radix tak memberi role pada content; kita pasang agar
             aria-describedby pada sel tetap menunjuk elemen yang benar. */
          id="tip_tagihan_sel"
          role="tooltip"
          align="center"
          sideOffset={6}
          collisionPadding={12}
          /* Kartu TIDAK interaktif → pointer-events-none. Tanpa ini kartu
             menutupi sel di bawahnya dan pointer tak pernah sampai ke sana,
             sehingga sel yang tertutup tak bisa di-hover. Tembusnya membuat
             hover selalu mendarat di sel yang sebenarnya di bawah kursor,
             dan kartu ikut berganti isi.
             Border `border-ring/50` (bukan `border` bawaan 12%): kartu
             mengambang di atas tabel yang ramai, jadi garis tipis
             low-contrast bawaan hilang di antara warna sel. */
          className="pointer-events-none w-56 border-ring/50 p-2.5"
        >
          {hover !== null && (
            <WrapperTanPointer>
              <IsiKartuTagihan data={hover.isi} />
            </WrapperTanPointer>
          )}
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}

/* `memo`: tabel ini berat (ratusan baris × puluhan kolom), sedangkan props-nya
   stabil kecuali `data`/`loading`/pilihan sel. Tanpa memo, tiap perubahan state
   halaman (mis. mengetik di pencarian, buka dialog) ikut merekonsiliasi seluruh
   tabel dan membuat interaksi lain (termasuk membuka dropdown) terasa lambat. */
export default memo(TagihanCrosstab);
