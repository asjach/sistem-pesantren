import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LEBAR_BAWAHAN_FILTER } from '@/components/kelolaTabel/jenis';
import { daftarkanFilter, hapusFilter, pakaiLebarFilter } from '@/components/excel/lebarFilter';

/** Satuan CSS: angka = px, string dipakai apa adanya. */
export function keCss(v: number | string): string {
  return typeof v === 'number' ? `${v}px` : v;
}

/** Batas bawah kontrol: di bawah ini isi tak terbaca + ikon berdesakan. */
export const MIN_LEBAR_KONTROL = 40;

/** Lebar kontrol saat ruang induk tak cukup: `200 − 10 − 10 − 80 = 100`.
 *  Lebar yang diminta tetap dipakai bila ruang cukup; tak pernah di bawah
 *  batas bawah agar isi & ikon tetap terbaca. */
export function hitungLebarKontrol(tersedia: number, labelPx: number, diminta: number): number {
  return Math.max(MIN_LEBAR_KONTROL, Math.min(diminta, tersedia - labelPx));
}

/** Shell "1 kotak": label inline di kiri + zona kontrol di kanan.
 *
 *  Dipakai bersama oleh komponen custom yang menggabungkan label + kontrol
 *  (LabeledCombobox, LabeledTextInput). `children` berupa render-prop yang
 *  menerima kelas untuk diterapkan pada kontrol — shell再也不 tahu detail
 *  kontrolnya (input, select trigger, dsb).
 *
 *  - `lebarKotak` mengunci lebar total kotak; label tetap mengikuti teksnya dan
 *    kontrol mengisi sisa ruang.
 *  - Tanpa `lebarKontrol`/`lebarLabel`: kotak selebar induk, kontrol mengisi
 *    sisa ruang. Bila di dalam toolbar tabel (ada konteks Kelola Tabel),
 *    lebar KOTAK mengikuti override tersimpan per filter (kunci = htmlFor),
 *    bawaannya LEBAR_BAWAHAN_FILTER.
 *  - Lebar yang dikunci eksplisit: kotak rangkul isi, dan kontrol menyusut
 *    bila ruang induk tak cukup. */
export default function KotakLabel({ label, htmlFor, lebarLabel, lebarKontrol, lebarKotak, tinggi = 26, children, className, kelolaLebar = true }: {
  label: string;
  htmlFor?: string;
  lebarLabel?: number | string;
  lebarKontrol?: number | string;
  /** Lebar TOTAL kotak (label + kontrol). Kontrol mengisi sisa ruang; dipakai
   *  kontrol toolbar yang lebarnya disimpan sebagai satu angka utuh. */
  lebarKotak?: number | string;
  tinggi?: number | string;
  /** Render-prop: menerima kelas kontrol (penuh, tanpa border sendiri). */
  children: (kelasKontrol: string) => ReactNode;
  className?: string;
  /** Matikan pendaftaran ke Kelola Tabel (kontrol bawaan toolbar). */
  kelolaLebar?: boolean;
}) {
  const kontrolKunci = lebarKontrol !== undefined;
  /* Ruang tersisa di induk setelah label & border: kontrol menyusut agar kotak
     tak meluber (mis. induk 200px + padding 20px, label 80px → 100px). */
  const [lebarEfektif, setLebarEfektif] = useState<number | null>(null);
  const refKotak = useRef<HTMLSpanElement | null>(null);
  useLayoutEffect(() => {
    if (!kontrolKunci) { setLebarEfektif(null); return; }
    const kotak = refKotak.current;
    const induk = kotak?.parentElement ?? null;
    if (kotak === null || induk === null) return;
    const hitung = () => {
      if (induk.clientWidth === 0) { setLebarEfektif(null); return; }
      const cs = getComputedStyle(induk);
      const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      const geser = kotak.offsetLeft - induk.getBoundingClientRect().left;
      const labelPx = kotak.firstElementChild instanceof HTMLElement ? kotak.firstElementChild.offsetWidth : 0;
      // clientWidth masih memuat padding; kurangi padding + geser dari kotak.
      const tersedia = induk.clientWidth - pad - geser;
      setLebarEfektif(hitungLebarKontrol(tersedia, labelPx, Number(lebarKontrol)));
    };
    hitung();
    const ro = new ResizeObserver(hitung);
    ro.observe(induk);
    return () => ro.disconnect();
  }, [kontrolKunci, lebarKontrol, label]);
  const lebarKontrolEfektif = kontrolKunci
    ? (lebarEfektif === null ? keCss(lebarKontrol) : `${lebarEfektif}px`)
    : undefined;

  /* Pendaftaran ke Kelola Tabel: di dalam toolbar tabel (ada konteks), lebar
     KOTAK (label + kontrol) dapat override tersimpan per filter (kunci =
     htmlFor). Tanpa override, diseragamkan LEBAR_BAWAHAN_FILTER (sama
     seperti FilterField). Lebar yang dikunci eksplisit tetap menang. */
  const konteks = pakaiLebarFilter();
  const kunci = konteks && htmlFor && kelolaLebar ? htmlFor : '';
  const override = kunci ? konteks?.lebar[kunci] : undefined;
  useLayoutEffect(() => {
    if (!konteks || kunci === '') return;
    const kotak = refKotak.current;
    const px = override === undefined && kotak !== null
      ? Math.round(kotak.getBoundingClientRect().width)
      : undefined;
    daftarkanFilter(konteks.tableKey, kunci, label, px && px > 0 ? px : undefined);
    return () => hapusFilter(konteks.tableKey, kunci);
  }, [konteks, kunci, label, override]);
  const lebarKotakEfektif = lebarKotak ?? (kunci === '' || kontrolKunci
    ? undefined
    : override ?? LEBAR_BAWAHAN_FILTER);

  return (
    <span
      ref={refKotak}
      className={cn(
        'items-stretch overflow-hidden rounded-md border border-foreground/30 bg-transparent',
        // Lebar kontrol terkunci → kotak rangkul isi; lebar kotak terkunci →
        // lebar tetap; selain itu kotak mengikuti induk.
        kontrolKunci ? 'inline-flex w-max' : 'flex w-full',
        lebarKotak !== undefined && kontrolKunci === false && 'w-full',
        'focus-within:ring-1 focus-within:ring-ring/60',
        className,
      )}
      style={{
        height: keCss(tinggi),
        ...(lebarKotakEfektif !== undefined ? { width: keCss(lebarKotakEfektif), flex: 'none' } : {}),
      }}
    >
      <label
        htmlFor={htmlFor}
        className="flex w-max shrink-0 items-center bg-muted/70 px-2 text-xs whitespace-nowrap text-muted-foreground dark:bg-foreground/10"
        style={lebarLabel === undefined ? undefined : { width: keCss(lebarLabel) }}
      >
        {label}
      </label>
      <span
        className="relative flex min-w-0 flex-1 items-stretch"
        style={lebarKontrolEfektif !== undefined ? { width: lebarKontrolEfektif, flex: 'none' } : undefined}
      >
        {children('h-full w-full min-w-0 rounded-none border-0 shadow-none focus-visible:ring-0 focus-visible:shadow-none')}
      </span>
    </span>
  );
}