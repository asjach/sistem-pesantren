import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Plus } from '@/icons';
import type { CrosstabBaris, CrosstabKolom, CrosstabSel, CrosstabTagihan } from '../../api/keuangan';
import { cn } from '@/lib/utils';

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** Sel grid yang dirujuk oleh koordinat (bukan id tagihan, karena id hanya
 *  ada bila sel berisi). Dipakai menyimpan anchor/active saat memblok. */
interface CellRef { santriId: number; key: string }

/** Tagihan dalam persegi panjang grid antara dua sel (inklusif). Sel kosong
 *  (tanpa tagihan) dilewati. Baris & kolom diurutkan seperti tampilan. */
function blokTagihan(d: CrosstabTagihan, a: CellRef, b: CellRef): { sel: CrosstabSel; jenisId: number }[] {
  const rA = d.baris.findIndex((x) => x.santri_id === a.santriId);
  const cA = d.kolom.findIndex((x) => x.key === a.key);
  const rB = d.baris.findIndex((x) => x.santri_id === b.santriId);
  const cB = d.kolom.findIndex((x) => x.key === b.key);
  if (rA < 0 || cA < 0 || rB < 0 || cB < 0) return [];
  const r0 = Math.min(rA, rB), r1 = Math.max(rA, rB);
  const c0 = Math.min(cA, cB), c1 = Math.max(cA, cB);
  const out: { sel: CrosstabSel; jenisId: number }[] = [];
  for (let r = r0; r <= r1; r++) {
    const baris = d.baris[r];
    for (let c = c0; c <= c1; c++) {
      const k = d.kolom[c];
      const sel = baris.sel[k.key];
      if (sel) out.push({ sel, jenisId: k.jenis_id });
    }
  }
  return out;
}

/** Tetangga (dr,dc) suatu sel: apakah sel tetangga itu juga terpilih. Dipakai
 *  menggambar garis seleksi hanya di sisi LUAR blok agar garis antar sel
 *  terpilih tidak menjadi dobel. */
function tetanggaTerpilih(
  d: CrosstabTagihan | null,
  sel: ReadonlySet<number> | undefined,
  r: number, c: number, dr: number, dc: number,
): boolean {
  if (d === null) return false;
  const nr = r + dr;
  const nc = c + dc;
  if (nr < 0 || nc < 0 || nr >= d.baris.length || nc >= d.kolom.length) return false;
  const s = d.baris[nr].sel[d.kolom[nc].key];
  return s ? sel?.has(s.id) ?? false : false;
}

/** Box-shadow seleksi: garis 1px warna accent (`--ring`) digambar hanya pada
 *  sisi yang berbatasan dengan sel/aneh — sisi luar blok. Sisi antar sel yang
 *  sama-sama terpilih tidak digambar, sehingga grid bawaan (border) tinggal
 *  satu garis di dalam seleksi (tidak dobel). */
function bayangSeleksi(
  d: CrosstabTagihan | null,
  sel: ReadonlySet<number> | undefined,
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
  /** Id tagihan sel yang sedang aktif (dilingkasi di tabel). */
  terpilihId: number | null;
  /** Sel diklik kanan (atau diaktifkan lewat keyboard) → halaman membuka
   *  popover aksi pada sel itu. Klik kiri disiapkan untuk fitur lain.
   *  `anchor` = elemen sel, dipakai sebagai jangkar popover. */
  onPilih: (
    sel: CrosstabSel,
    meta: { nama: string; label: string; ayah_nama: string | null; ibu_nama: string | null; santri_id: number; foto_dokumen_id: number | null; foto_profil: boolean; kelas: string | null; jenjang_riwayat: string[] },
    anchor: HTMLElement,
    kolom: CrosstabKolom,
  ) => void;
  /** Sel KOSONG diklik → halaman membuka alur tambah tagihan (mis. dialog
   *  Buat Tagihan terisi santri+jenis+periode). Absen = sel kosong inert. */
  onTambah?: (baris: CrosstabBaris, kolom: CrosstabKolom, anchor: HTMLElement) => void;
  /** Id tagihan yang sedang dipilih (klik kiri). Dipakai menandai sel terpilih
   *  dan menggerakkan aksi batch (bayar/hapus) di bilah pilihan halaman. */
  selection?: ReadonlySet<number>;
  /** Ctrl/Cmd+Klik pada sel → toggle (tambah bila tak terpilih, lepas bila
   *  terpilih). `jenisId` kolom diikutkan supaya halaman bisa menyimpan info
   *  lengkap. */
  onTogglePilih?: (sel: CrosstabSel, jenisId: number) => void;
  /** Blok (tahan-geser, Shift+Klik, Shift+panah) → ganti seluruh pilihan
   *  dengan tagihan dalam persegi panjang grid. */
  onPilihBlok?: (items: { sel: CrosstabSel; jenisId: number }[]) => void;
  /** Klik kiri biasa → pilih SATU sel itu saja (ganti seluruh pilihan),
   *  seperti mengklik sel di Excel. */
  onPilihSatu?: (sel: CrosstabSel, jenisId: number) => void;
  /** Lepas (kurangi) blok tagihan dari pilihan — Ctrl/Cmd+tahan-geser. */
  onLepasBlok?: (items: { sel: CrosstabSel; jenisId: number }[]) => void;
  emptyText: string;
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
  selection, onTogglePilih, onPilihBlok, onPilihSatu, onLepasBlok,
  anchorRef, activeRef, draggingRef, dragStartRef, dragMovedRef,
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
  selection?: ReadonlySet<number>;
  /** Ctrl/Cmd+Klik → toggle satu sel (tambah/lepas). */
  onTogglePilih?: (sel: CrosstabSel, jenisId: number) => void;
  /** Blok pilihan (geser, Shift+Klik, Shift+panah). */
  onPilihBlok?: (items: { sel: CrosstabSel; jenisId: number }[]) => void;
  /** Klik kiri biasa → pilih SATU sel (ganti seluruh pilihan). */
  onPilihSatu?: (sel: CrosstabSel, jenisId: number) => void;
  /** Ctrl/Cmd+geser → lepas blok dari pilihan. */
  onLepasBlok?: (items: { sel: CrosstabSel; jenisId: number }[]) => void;
  /** Ref bersama untuk status memblok (dipegang induk agar stabil). */
  anchorRef: React.MutableRefObject<CellRef | null>;
  activeRef: React.MutableRefObject<CellRef | null>;
  draggingRef: React.MutableRefObject<boolean>;
  dragStartRef: React.MutableRefObject<CellRef | null>;
  dragMovedRef: React.MutableRefObject<boolean>;
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
          const label = labelSel(k);
          // Sel kosong: tombol tambah samar (muncul saat hover/fokus) —
          // mengekliknya membuka alur tambah tagihan untuk santri × kolom ini.
          return (
            <td key={k.key} className="group border-b border-r p-0.5 text-center">
              {onTambah ? (
                <button
                  type="button"
                  id={`btn_tagihan_tambah_${baris.santri_id}_${k.key}`}
                  title={`Tambah tagihan ${label} untuk ${baris.nama}`}
                  aria-label={`Tambah tagihan ${label} untuk ${baris.nama}`}
                  onClick={(e) => onTambah(baris, k, e.currentTarget)}
                  className="inline-flex w-full items-center justify-center rounded px-1.5 py-0.5 text-muted-foreground/40 opacity-0 hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-ring group-hover:opacity-100"
                >
                  <Plus size={13} />
                </button>
              ) : (
                <span className="text-muted-foreground/40">·</span>
              )}
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
            /* Tanda seleksi: garis 1px accent hanya di sisi LUAR blok (bukan
               antar sel terpilih) supaya garis di dalam blok tak jadi dobel.
               Grid bawaan (border-b/border-r) tetap menjadi satu garis pada
               sisi antar sel terpilih. */
            className="border-b border-r p-0.5"
            style={
              selection?.has(sel.id)
                ? { boxShadow: bayangSeleksi(data, selection, rIdx, idxC) }
                : undefined
            }
          >
            <span
              id={`btn_tagihan_sel_${sel.id}`}
              tabIndex={-1}
              /* Teks biasa (bukan <button>), tapi seluruh perilaku & warna
                 tetap sama. Klik kanan → buka popover aksi (preventDefault
                 menekan menu konteks browser). Enter/Spasi juga membuka popover
                 (ditangani manual di onKeyDown karena elemen kini teks, bukan
                 tombol) agar aksi detail/ubah/hapus tetap bisa dijangkau.
                 Pemilihan ganda ala Excel:
                 - Klik kiri biasa → pilih satu sel (ganti seluruh pilihan).
                 - Ctrl/Cmd+Klik → tambah/lepas satu sel (pilihan acak).
                 - Tahan-geser (pointerdown → enter sel lain → up) → blok pilih.
                 - Ctrl/Cmd+tahan-geser → blok lepas (kurangi dari pilihan).
                 - Shift+Klik / Shift+panah → blok persegi panjang dari anchor.
                 Logika pilih/batalkan ada di `onPointerUp`, BUKAN `onClick`:
                 `preventDefault` di `onPointerDown` menekan event `click` di
                 banyak browser, sehingga mengandalkan `onClick` membuat toggle
                 & batal pilihan tak pernah terpicu. */
              onContextMenu={(e) => { e.preventDefault(); onPilih(sel, meta, e.currentTarget, k); }}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                // Cegah seleksi teks & biarkan elemen dapat fokus.
                e.preventDefault();
                draggingRef.current = true;
                dragMovedRef.current = false;
                dragStartRef.current = { santriId: baris.santri_id, key: k.key };
                activeRef.current = { santriId: baris.santri_id, key: k.key };
                e.currentTarget.focus();
              }}
              onPointerEnter={(e) => {
                if (!draggingRef.current) return;
                dragMovedRef.current = true;
                const d = data;
                if (!d || !dragStartRef.current) return;
                const blok = blokTagihan(d, dragStartRef.current, { santriId: baris.santri_id, key: k.key });
                // Ctrl/Cmd tahan → lepas blok (kurangi); tanpa → ganti pilihan.
                if (e.ctrlKey || e.metaKey) onLepasBlok?.(blok);
                else onPilihBlok?.(blok);
              }}
              onPointerUp={(e) => {
                if (e.button !== 0) return;
                // Klik kiri mouse di sini (bukan onClick, lihat komentar
                // di atas). Klik susulan setelah geser: abaikan (blok sudah
                // diperbarui via onPointerEnter).
                if (dragMovedRef.current) { dragMovedRef.current = false; return; }
                const ref: CellRef = { santriId: baris.santri_id, key: k.key };
                if (e.ctrlKey || e.metaKey) {
                  // Ctrl/Cmd+Klik → toggle satu sel (tambah/lepas).
                  onTogglePilih?.(sel, k.jenis_id);
                } else if (e.shiftKey) {
                  const a = anchorRef.current;
                  const d = data;
                  if (a && d) onPilihBlok?.(blokTagihan(d, a, ref));
                } else {
                  // Klik kiri biasa → pilih SATU sel itu (ganti seluruh
                  // pilihan), seperti mengklik sel di Excel.
                  onPilihSatu?.(sel, k.jenis_id);
                }
                anchorRef.current = ref;
                activeRef.current = ref;
              }}
              onKeyDown={(e) => {
                // Enter/Spasi → buka popover aksi (pengganti aktivasi tombol).
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPilih(sel, meta, e.currentTarget, k); return; }
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
                if (tgtSel) document.getElementById(`btn_tagihan_sel_${tgtSel.id}`)?.focus();
              }}
              onFocus={() => { activeRef.current = { santriId: baris.santri_id, key: k.key }; }}
              onMouseEnter={(e) => onHoverMasuk(isiTooltip, e.currentTarget)}
              onMouseMove={(e) => onHoverGerak(isiTooltip, e)}
              onMouseLeave={onHoverKeluar}
              aria-describedby="tip_tagihan_sel"
              aria-pressed={selection?.has(sel.id) ?? false}
              className={cn(
                'block w-full cursor-default rounded px-1.5 py-0.5 text-right tabular-nums hover:ring-1 hover:ring-ring',
                kelasSel(sel),
                sel.terlambat ? 'font-semibold' : '',
              )}
            >
              {sel.nominal.toLocaleString('id')}
            </span>
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
 *  Sel berisi nominal dengan warna status. Klik kanan (atau Enter keyboard)
 *  membuka popover aksi per tagihan. Pemilihan sel gaya Excel:
 *  - klik kiri biasa → pilih satu sel (ganti pilihan);
 *  - Ctrl/Cmd+Klik → tambah/lepas sel (pilihan acak);
 *  - tahan-geser → blok pilih; Ctrl/Cmd+tahan-geser → blok lepas (kurangi);
 *  - Shift+Klik / Shift+panah → blok persegi panjang dari anchor. */
function TagihanCrosstab({ data, loading, terpilihId, onPilih, onTambah, selection, onTogglePilih, onPilihBlok, onPilihSatu, onLepasBlok, emptyText }: Props) {
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
  /* Akhiri drag bila pointer dilepas di luar sel (mis. di luar tabel). */
  useEffect(() => {
    const akhiri = () => { draggingRef.current = false; dragMovedRef.current = false; };
    window.addEventListener('pointerup', akhiri);
    return () => window.removeEventListener('pointerup', akhiri);
  }, []);
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
  /** Wadah gulir; sekaligus offsetParent cincin sel terpilih. */
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tinggiGrup, setTinggiGrup] = useState(0);
  /** Sel yang sedang di-hover + elemen selnya (jangkar kartu). */
  const [hover, setHover] = useState<{ isi: TooltipSel; anchor: HTMLElement } | null>(null);
  /* Cincin sel terpilih digambar sebagai overlay, bukan class di tiap sel.
    mengoper `terpilihId` ke baris berarti props SEMUA baris berubah tiap
     klik → memo tak berlaku → ribuan tombol dirender ulang (~250ms, memblokir
     main thread) dan popover ikut terlambat muncul. Overlay cuma satu
     elemen, jadi yang dirender ulang hanya dirinya sendiri. */
  const [cincin, setCincin] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const wadah = scrollRef.current;
    if (wadah === null || terpilihId === null) { setCincin(null); return; }
    const sel = wadah.querySelector<HTMLElement>(`#btn_tagihan_sel_${terpilihId}`);
    if (sel === null) { setCincin(null); return; }
    /* offsetParent tak bisa dipakai: untuk elemen di dalam <td>, offsetParent
       adalah sel itu sendiri (aturan CSSOM View), bukan container kita --
       offsetLeft hanya memberi padding td. Jadi diukur dari rect, lalu
       ditambah scroll agar dalam koordinat konten (cincin ikut tergulir). */
    const kotakWadah = wadah.getBoundingClientRect();
    const kotakSel = sel.getBoundingClientRect();
    /* clientLeft/clientTop = lebar border container; rect memuat border, sedangkan
       koordinat `left/top` diukur dari padding box → tanpa dikurangi, cincin
       bergeser 1px. */
    setCincin({
      left: kotakSel.left - kotakWadah.left - wadah.clientLeft + wadah.scrollLeft,
      top: kotakSel.top - kotakWadah.top - wadah.clientTop + wadah.scrollTop,
      width: kotakSel.width,
      height: kotakSel.height,
    });
  }, [terpilihId, data]);

  /** Elemen jangkar HoverCard (diposisikan di atas sel yang di-hover). */
  const jangkarRef = useRef<HTMLDivElement | null>(null);
  /** Tenggang sebelum menutup, agar perpindahan sel tak berkedip. */
  const tutupRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Posisi terakhir saat kartu ditutup karena klik. Pointer harus bergerak
   *  jauh dari titik ini dulu, supaya jittersaat klik tak menyalakannya
   *  kembali (dan menumpuk dengan popover). */
  const agarJauhRef = useRef<{ x: number; y: number } | null>(null);

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
              selection={selection}
              onTogglePilih={onTogglePilih}
              onPilihBlok={onPilihBlok}
              onPilihSatu={onPilihSatu}
              onLepasBlok={onLepasBlok}
              anchorRef={anchorRef}
              activeRef={activeRef}
              draggingRef={draggingRef}
              dragStartRef={dragStartRef}
              dragMovedRef={dragMovedRef}
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
      {cincin !== null && (
        <div
          id="cincin_sel_tagihan"
          aria-hidden
          /* pointer-events-none: cincin tak boleh menutupi selnya sendiri. */
          className="pointer-events-none absolute z-20 rounded ring-2 ring-ring"
          style={{ left: cincin.left, top: cincin.top, width: cincin.width, height: cincin.height }}
        />
      )}
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
