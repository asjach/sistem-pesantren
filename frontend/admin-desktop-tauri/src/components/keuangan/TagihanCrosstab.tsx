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
  if (!tetanggaTerpilih(d, sel, r, c, -1, 0)) sisi.push('inset 0 1px 0 0 var(--ring)');
  if (!tetanggaTerpilih(d, sel, r, c, 0, 1)) sisi.push('inset -1px 0 0 0 var(--ring)');
  if (!tetanggaTerpilih(d, sel, r, c, 1, 0)) sisi.push('inset 0 -1px 0 0 var(--ring)');
  if (!tetanggaTerpilih(d, sel, r, c, 0, -1)) sisi.push('inset 1px 0 0 0 var(--ring)');
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

/** Satu baris tabel. `memo` + props stabil → saat tooltip berpindah sel, hanya
 *  baris yang di-hover yang dirender ulang, bukan seluruh tabel (ratusan sel). */
const BarisCrosstab = memo(function BarisCrosstab({
  baris, kolom, data, onHoverMasuk, onHoverGerak, onHoverKeluar,
  selection, onTogglePilih, onPilihBlok, onKlikSel, onPilihIrisan, onMulaiGeser, onTambahBlok, onLepasBlok, onSeleksiRilis,
  onAksiKanan, onAksiKosong, onPratinjau, laporkanPratinjau, closeHover, agarJauhRef, pratinjau, onLepasAnchor,
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

  const kelas = baris.kelas ?? '';

  const rIdx = data?.baris.findIndex((x) => x.santri_id === baris.santri_id) ?? -1;

  return (
    <tr>

      <th scope="row" className="sticky left-0 z-10 max-w-64 border-b border-r bg-card py-1 pl-2 pr-0.5 text-left font-normal">
        <span className="flex items-center gap-1.5">

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

          const lewatiKosong = (e: React.PointerEvent<HTMLElement>) => {
            if (!draggingRef.current) return;
            const d = data;
            if (!d || !dragStartRef.current) return;
            const sampaiKosong: CellRef = { santriId: baris.santri_id, key: k.key };
            const gridGeser = selGrid(d, dragStartRef.current, sampaiKosong);
            onPratinjau?.(gridGeser);
            laporkanPratinjau?.(gridGeser);
            activeRef.current = sampaiKosong;

            const blok = blokTagihan(d, dragStartRef.current, sampaiKosong);
            if (e.ctrlKey || e.metaKey) { onTambahBlok?.(blok); return; }
            if (e.altKey) { onLepasBlok?.(blok); return; }

            if (!e.ctrlKey && !e.metaKey && !e.altKey) dragMovedRef.current = true;
            pernahGeserRef.current = true;
            onPilihIrisan?.(blok);
          };

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

          <td
            key={k.key}
            id={`btn_tagihan_sel_${sel.id}`}
            tabIndex={-1}

            className={cn(
              'relative cursor-default border-b border-r p-0.5 text-right tabular-nums hover:z-10',

              selection?.has(kunciSel({ santriId: baris.santri_id, key: k.key })) ? '' : `hover:shadow-[inset_0_0_0_1px_var(--ring)]`,
              kelasSel(sel),
              sel.terlambat ? 'font-semibold' : '',
            )}
            style={{
              boxShadow: selection?.has(kunciSel({ santriId: baris.santri_id, key: k.key }))
                ? bayangSeleksi(data, selection, rIdx, idxC)
                : undefined,

              backgroundImage: (selection?.has(kunciSel({ santriId: baris.santri_id, key: k.key })) || pratinjau?.has(`${baris.santri_id}\u0000${k.key}`))
                ? 'linear-gradient(color-mix(in srgb, var(--accent) 14%, transparent), color-mix(in srgb, var(--accent) 14%, transparent))'
                : undefined,
            }}
            onContextMenu={(e) => {

                if (e.ctrlKey || e.metaKey) return;
                e.preventDefault();

                closeHover();

                onLepasAnchor?.();

                e.currentTarget.focus();

                const kotak = e.currentTarget.getBoundingClientRect();
                agarJauhRef.current = { x: kotak.left + kotak.width / 2, y: kotak.top + kotak.height / 2 };
                onAksiKanan?.(sel, meta, k, kotak);
              }}
            onPointerDown={(e) => {
              if (e.button !== 0) return;

              e.preventDefault();

              onLepasAnchor?.();

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

              const gridGeser = selGrid(d, dragStartRef.current, sampaiRef);
              onPratinjau?.(gridGeser);
              laporkanPratinjau?.(gridGeser);

              activeRef.current = sampaiRef;
              const blok = blokTagihan(d, dragStartRef.current, sampaiRef);

              if (e.ctrlKey || e.metaKey) { onTambahBlok?.(blok); return; }

              if (e.altKey) { onLepasBlok?.(blok); return; }

              dragMovedRef.current = true;
              pernahGeserRef.current = true;
              onPilihIrisan?.(blok);
            }}
            onPointerUp={(e) => {
              if (e.button !== 0) return;

              onHoverKeluar();
              const ref: CellRef = { santriId: baris.santri_id, key: k.key };

              if (dragMovedRef.current) {
                dragMovedRef.current = false;
                anchorRef.current = ref;
                activeRef.current = ref;
                return;
              }
              if (e.ctrlKey || e.metaKey) {

                onTogglePilih?.({ santriId: baris.santri_id, key: k.key, jenisId: k.jenis_id, sel });
                anchorRef.current = ref;
                activeRef.current = ref;
                onSeleksiRilis?.(e.currentTarget, true);
                return;
              }
              if (e.shiftKey) {

                const a = anchorRef.current;
                const d = data;
                if (a && d) onPilihBlok?.(blokTagihan(d, a, ref));
              } else {

                onKlikSel?.({ santriId: baris.santri_id, key: k.key, jenisId: k.jenis_id, sel });
                anchorRef.current = ref;
                activeRef.current = ref;
                onSeleksiRilis?.(e.currentTarget, false);
                return;
              }
              anchorRef.current = ref;
              activeRef.current = ref;

              onSeleksiRilis?.(e.currentTarget, true);
            }}
            onKeyDown={(e) => {

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

              if (e.shiftKey && tgtEl) onSeleksiRilis?.(tgtEl, true);
            }}
            onFocus={() => { activeRef.current = { santriId: baris.santri_id, key: k.key }; }}

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

  const selection = useMemo(() => new Set(pilihanLuar ?? []), [pilihanLuar]);

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

  const pilihBlokRef = useRef(onPilihBlok);
  pilihBlokRef.current = onPilihBlok;
  const klikSelRef = useRef(onKlikSel);
  klikSelRef.current = onKlikSel;
  const rilisRef = useRef(onSeleksiRilis);
  rilisRef.current = onSeleksiRilis;
  const onGeserSelesaiRef = useRef(onGeserSelesai);
  onGeserSelesaiRef.current = onGeserSelesai;

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

  }, [aksi, cariSel, onPilih]);

  const gabungKunci = new Set(
    grup
      .filter((g) => g.kolom.length === 1 && g.kolom[0].tipe === 'non_bulanan')
      .map((g) => g.kolom[0].key),
  );

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

  const pilihRef = useRef(onPilih);
  pilihRef.current = onPilih;

  /** Cermin `terpilihId` (ada popover = tak ada kartu hover) untuk callback
   *  yang harus tetap stabil, jadi tak perlu masuk ke dependensi useCallback. */
  const adaPopoverRef = useRef(terpilihId !== null);
  adaPopoverRef.current = terpilihId !== null;

  const hoverGerak = useCallback((isi: TooltipSel, e: React.MouseEvent<HTMLElement>) => {
    if (adaPopoverRef.current) return;
    const agarJauh = agarJauhRef.current;
    if (agarJauh === null) return;
    if (Math.hypot(e.clientX - agarJauh.x, e.clientY - agarJauh.y) < 6) return;
    agarJauhRef.current = null;
    setHover({ isi, anchor: e.currentTarget });
  }, []);

  const baruPilihRef = useRef(false);
  const pilihStabil = useCallback(
    (
      sel: CrosstabSel,
      meta: { nama: string; label: string; ayah_nama: string | null; ibu_nama: string | null; santri_id: number; foto_dokumen_id: number | null; foto_profil: boolean; kelas: string | null; jenjang_riwayat: string[] },
      anchor: HTMLElement,
      kolom: CrosstabKolom,
    ) => {

      if (baruPilihRef.current) return;
      baruPilihRef.current = true;
      setTimeout(() => { baruPilihRef.current = false; }, 0);

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

  useEffect(() => {
    const akhiri = (ev: PointerEvent) => {
      if (!draggingRef.current) return;

      hoverKeluar();

      setPratinjau(null);

      const wadah = scrollRef.current;
      const mulai = dragStartRef.current;
      if (mulai !== null && pernahGeserRef.current) {

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

      onGeserSelesaiRef.current?.();
    };
    window.addEventListener('pointerup', akhiri);
    return () => window.removeEventListener('pointerup', akhiri);
  }, [data, onSeleksiRilis, hoverKeluar]);

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

  useEffect(() => {
    if (terpilihId === null) return;
    if (tutupRef.current !== null) { clearTimeout(tutupRef.current); tutupRef.current = null; }
    setHover(null);
  }, [terpilihId]);

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

  return (
    <div id="crosstab_tagihan_scroll" ref={scrollRef} className="relative -ml-px h-full overflow-auto border bg-card">
      <table id="tbl_tagihan_crosstab" className="w-full border-separate border-spacing-0 text-xs">
        <thead>
          <tr ref={grupRef}>

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

          id="tip_tagihan_sel"
          role="tooltip"
          align="center"
          sideOffset={6}
          collisionPadding={12}

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

export default memo(TagihanCrosstab);
