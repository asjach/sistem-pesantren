import { forwardRef, useCallback, useLayoutEffect, useRef, useState, type MutableRefObject, type MouseEventHandler, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LEBAR_BAWAHAN_FILTER } from '@/components/kelolaTabel/jenis';
import { pakaiLebarFilter } from '@/components/excel/lebarFilter';
import { useSetelanKomponen } from '@/components/komponenCustom';

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
 *  (LabeledCombobox, LabeledInput). `children` berupa render-prop yang
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
export interface KotakLabelProps {
  label: string;
  htmlFor?: string;
  /** Label transparan (tanpa bg): teks diakhiri titik dua ("Keaktifan:").
   *  Bawaan true. */
  labelTransparan?: boolean;
  /** Sembunyikan label sepenuhnya: zona label tak dirender dan kontrol mengisi
   *  penuh kotak. Bawaan false (label tampil). */
  tanpaLabel?: boolean;
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
  /** Klik kanan pada kotak (mis. membuka pengaturan ukuran dropdown). */
  onContextMenu?: MouseEventHandler<HTMLSpanElement>;
  /** Node tambahan di dalam kotak SETELAH zona kontrol (mis. tombol arah
   *  urut). Dipisah garis tipis agar terbaca satu kontrol berbagi kotak. */
  tambahan?: ReactNode;
}

/** `forwardRef` supaya kotak bisa jadi jangkar popover (mis. pengaturan ukuran
 *  dropdown pada LabeledCombobox); ref-nya digabung dengan ref pengukuran
 *  internal agar keduanya menunjuk elemen yang sama. */
const KotakLabel = forwardRef<HTMLSpanElement, KotakLabelProps>(function KotakLabel({
  label, htmlFor, labelTransparan = true, tanpaLabel = false, lebarLabel, lebarKontrol, lebarKotak, tinggi = 26, children, className, kelolaLebar = true, onContextMenu, tambahan,
}, refDepan) {
  const kontrolKunci = lebarKontrol !== undefined;
  /* Ruang tersisa di induk setelah label & border: kontrol menyusut agar kotak
     tak meluber (mis. induk 200px + padding 20px, label 80px → 100px). */
  const [lebarEfektif, setLebarEfektif] = useState<number | null>(null);
  const refKotak = useRef<HTMLSpanElement | null>(null);
  /* Ref gabungan: pengukuran internal + ref dari luar (mis. jangkar popover). */
  const pasangRef = useCallback((el: HTMLSpanElement | null) => {
    refKotak.current = el;
    if (typeof refDepan === 'function') refDepan(el);
    else if (refDepan != null) (refDepan as MutableRefObject<HTMLSpanElement | null>).current = el;
  }, [refDepan]);
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

  /* Lebar KOTAK: dari setelan komponen (server, tabel `komponen_custom`) bila
     ada; tanpa itu, di dalam toolbar tabel memakai LEBAR_BAWAHAN_FILTER (sama
     dengan FilterField). Lebar yang dikunci eksplisit tetap menang. */
  const konteks = pakaiLebarFilter();
  const kunci = konteks && htmlFor && kelolaLebar ? htmlFor : '';
  const override = useSetelanKomponen(konteks?.tableKey ?? '', kunci).lebar;
  const lebarKotakEfektif = lebarKotak ?? (kunci === '' || kontrolKunci
    ? undefined
    : override ?? LEBAR_BAWAHAN_FILTER);

  return (
    <span
      ref={pasangRef}
      onContextMenu={onContextMenu}
      className={cn(
        'items-stretch overflow-hidden rounded-md border border-foreground/30 bg-transparent',
        /* Label transparan: kotak memakai bg kontrol (`dark:bg-input/30`)
           agar bg label & kontrol SAMA di kedua mode. */
        labelTransparan && 'dark:bg-input/30',
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
      {tanpaLabel ? (
        /* Label disembunyikan secara VISUAL, tapi tetap ada di pohon
           aksesibilitas supaya kontrolnya masih punya nama yang terbaca
           pembaca layar (dulu label itulah satu-satunya penamaan). */
        label === '' ? null : <label htmlFor={htmlFor} className="sr-only">{label}</label>
      ) : (
        <label
          htmlFor={htmlFor}
          className={cn(
            'flex w-max shrink-0 items-center px-2 text-xs whitespace-nowrap text-muted-foreground',
            labelTransparan ? 'bg-transparent pr-1' : 'bg-muted/70 dark:bg-foreground/10',
          )}
          style={lebarLabel === undefined ? undefined : { width: keCss(lebarLabel) }}
        >
          {labelTransparan && !label.endsWith(':') ? `${label}:` : label}
        </label>
      )}
      <span
        className={cn(
          'relative flex min-w-0 flex-1 items-stretch',
          /* Label transparan: bg kontrol (dark:bg-input/30 bawaan Input)
             dinetralkan agar kotak hanya 1 lapis — sama dengan zona label;
             padding kiri input dirapatkan agar teks dekat ":" (±2 spasi). */
          labelTransparan && '[&_input]:dark:bg-transparent',
          labelTransparan && '[&_input]:pl-1',
        )}
        style={lebarKontrolEfektif !== undefined ? { width: lebarKontrolEfektif, flex: 'none' } : undefined}
      >
        {children('h-full w-full min-w-0 rounded-none border-0 shadow-none focus-visible:ring-0 focus-visible:shadow-none')}
      </span>
      {tambahan != null && (
        <span className="flex shrink-0 items-stretch border-l border-foreground/30">{tambahan}</span>
      )}
    </span>
  );
});

export default KotakLabel;