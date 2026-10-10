import { Children, cloneElement, isValidElement, useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ComboboxContent, ComboboxInput, ComboboxRoot, ComboboxTrigger } from '@/components/ui/combobox';
import { daftarkanFilter, hapusFilter, pakaiLebarFilter } from '@/components/excel/lebarFilter';
import { LEBAR_BAWAHAN_FILTER } from '@/components/kelolaTabel/jenis';

/** Satuan CSS: angka = px, string dipakai apa adanya. */
function keCss(v: number | string): string {
  return typeof v === 'number' ? `${v}px` : v;
}

/** Batas bawah kombo: di bawah ini isi tak terbaca + panah berdesakan. */
const MIN_LEBAR_KOMBO = 40;

/** Lebar kombo saat ruang induk tak cukup: `200 − 10 − 10 − 80 = 100`.
 *  Lebar yang diminta tetap dipakai bila ruang cukup; tak pernah di bawah
 *  batas bawah agar isi & panah tetap terbaca. */
export function hitungLebarKombo(tersedia: number, labelPx: number, diminta: number): number {
  return Math.max(MIN_LEBAR_KOMBO, Math.min(diminta, tersedia - labelPx));
}

/** Rekursif: suntikkan `gaya` (className & style) ke elemen bertipe `jenis`
 *  (ComboboxInput, ComboboxContent). Combobox Root tak me-render DOM (Fragment),
 *  jadi harus menelusuri pohon anak dan menyalin elemen yang cocok. */
function suntikGaya(node: ReactNode, jenis: unknown, kelas: string, gaya?: Record<string, unknown>): ReactNode {
  // Render-prop anak (mis. `ComboboxList` menerima fungsi) tak boleh dilewati:
  // `Children.map` atas fungsi mengembalikan array kosong dan daftar opsi
  // ikut hilang.
  if (typeof node === 'function') return node;
  return Children.map(node, (c) => {
    if (!isValidElement(c)) return c;
    const props = c.props as { children?: ReactNode; className?: string; style?: CSSProperties };
    if ((c.type as unknown) === jenis) {
      return cloneElement(c, {
        className: cn(props.className, kelas),
        style: { ...props.style, ...(gaya?.style as CSSProperties | undefined) },
        ...(gaya === undefined ? {} : Object.fromEntries(
          Object.entries(gaya).filter(([k]) => k !== 'style'),
        )),
      } as { className?: string; style?: CSSProperties });
    }
    if (props.children === undefined || typeof props.children === 'function') return c;
    return cloneElement(c, { ...props, children: suntikGaya(props.children, jenis, kelas, gaya) });
  });
}

/** Gabungan label + combobox dalam satu kotak tanpa padding.
 *
 *  - Kotak selebar induk (`flex w-full`); label segaris (inline) dengan
 *    combobox, dipisah garis tipis.
 *  - Label selebar isi (`w-max`), kecuali `lebarLabel` mengunci.
 *  - Zona kombo mengisi sisa ruang (`flex-1`); `lebarKombo` mengunci bila
 *    diisi. Isi yang kepanjangan terpotong elipsis — lebar tak pernah
 *    berubah mengikuti pilihan.
 *  - Tinggi label & combobox mengikuti tinggi kotak (`tinggi`, bawaan 26px
 *    mengikuti standar kontrol): label merentang penuh, input Combobox di
 *    dalamnya dipaksa penuh + tanpa border sendiri (border milik kotak).
 *  - Border kotak dipertegas (`foreground/30`) agar terbaca di light & dark.
 *  - Anak idealnya satu `Combobox` (Base UI, pencarian bawaan); kontrol lain
 *    tetap dirender apa adanya
 *    di dalam zona kombo. */
export default function LabeledCombobox({ label, htmlFor, lebarLabel, lebarKombo, tinggi = 26, children, className, kelolaLebar = true, bisaCari = false }: {
  label: string;
  htmlFor?: string;
  lebarLabel?: number | string;
  lebarKombo?: number | string;
  tinggi?: number | string;
  children: ReactNode;
  className?: string;
  /** Matikan pendaftaran ke Kelola Tabel (kontrol bawaan toolbar). */
  kelolaLebar?: boolean;
  /** Izinkan mengetik untuk mencari di daftar. Bawaan: mati — input hanya
   *  menampilkan nilai terpilih (tanpa caret berkedip), klik/panah tetap
   *  membuka daftar. */
  bisaCari?: boolean;
}) {
  const komboKunci = lebarKombo !== undefined;
  /* Ruang tersisa di induk setelah label & border: kombo menyusut agar kotak tak
     meluber (mis. induk 200px + padding 20px, label 80px → kombo 100px). */
  const [lebarEfektif, setLebarEfektif] = useState<number | null>(null);
  const refKotak = useRef<HTMLSpanElement | null>(null);
  useLayoutEffect(() => {
    if (!komboKunci) { setLebarEfektif(null); return; }
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
      setLebarEfektif(hitungLebarKombo(tersedia, labelPx, Number(lebarKombo)));
    };
    hitung();
    const ro = new ResizeObserver(hitung);
    ro.observe(induk);
    return () => ro.disconnect();
  }, [komboKunci, lebarKombo, label]);
  const lebarKomboEfektif = komboKunci
    ? (lebarEfektif === null ? keCss(lebarKombo) : `${lebarEfektif}px`)
    : undefined;

  /* Pendaftaran ke Kelola Tabel: di dalam toolbar tabel (ada konteks), lebar
     KOTAK (label + combobox) dapat override tersimpan per filter (kunci =
     htmlFor). Tanpa override, diseragamkan LEBAR_BAWAHAN_FILTER (sama
     seperti FilterField). `lebarKombo` eksplisit tetap menang. */
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
  const lebarKotak = kunci === '' || komboKunci
    ? undefined
    : override ?? LEBAR_BAWAHAN_FILTER;

  let isi = children;
  const anakTunggal = Children.count(children) === 1 && isValidElement(children)
    ? (children as ReactElement)
    : null;
  if (anakTunggal !== null && anakTunggal.type === ComboboxRoot) {
    const propsAnak = anakTunggal.props as { children?: ReactNode };
    // Input: penuh, tanpa border sendiri (border milik kotak), tanpa cincin
    // fokus (bakalnya terpotong jadi batang warna sisi kotak).
    // `pr-6`: ruang kanan untuk tombol panah yang menumpuk. `readOnly` (bawaan)
    // membuat input hanya menampilkan nilai terpilih — tanpa caret berkedip
    // dan tanpa pengetikan, klik/panah tetap membuka daftar.
    let anak = suntikGaya(
      propsAnak.children,
      ComboboxInput,
      'h-full w-full min-w-0 rounded-none border-0 pr-6 shadow-none focus-visible:ring-0 focus-visible:shadow-none',
      bisaCari ? undefined : { readOnly: true },
    );
    // Panah menumpuk di kanan zona → input memakai seluruh lebar zona, dan
    // popup (ditambatkan ke input) otomatis sampai tepi kanan kotak.
    anak = suntikGaya(anak, ComboboxTrigger, 'absolute top-1/2 right-0 -translate-y-1/2');
    // Popup: border sama dengan kotak pembungkus.
    anak = suntikGaya(anak, ComboboxContent, 'border-foreground/30');
    isi = cloneElement(anakTunggal, { ...(anakTunggal.props as object), children: anak });
  }

  return (
    <span
      ref={refKotak}
      className={cn(
        'items-stretch overflow-hidden rounded-md border border-foreground/30 bg-transparent',
        // Lebar terkunci → kotak rangkul isi (label + kombo), bukan penuh.
        komboKunci ? 'inline-flex w-max' : 'flex w-full',
        'focus-within:ring-1 focus-within:ring-ring/60',
        className,
      )}
      style={{
        height: keCss(tinggi),
        ...(lebarKotak !== undefined ? { width: lebarKotak, flex: 'none' } : {}),
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
        style={komboKunci ? { width: lebarKomboEfektif, flex: 'none' } : undefined}
      >
        {isi}
      </span>
    </span>
  );
}
