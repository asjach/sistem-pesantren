import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ComboboxContent, ComboboxInput, ComboboxRoot, ComboboxTrigger } from '@/components/ui/combobox';
import KotakLabel, { hitungLebarKontrol, keCss } from '@/components/kotakLabel';

/** Rekursif: suntikkan `gaya` (className & properti lain) ke elemen bertipe
 *  `jenis` (ComboboxInput/Trigger/Content). Combobox Root tak me-render DOM
 *  (Fragment), jadi harus menelusuri pohon anak dan menyalin elemen yang cocok. */
function suntikGaya(node: ReactNode, jenis: unknown, kelas: string, gaya?: Record<string, unknown>): ReactNode {
  // Render-prop anak (mis. `ComboboxList` menerima fungsi) tak boleh dilewati:
  // `Children.map` atas fungsi mengembalikan array kosong dan daftar opsi
  // ikut hilang.
  if (typeof node === 'function') return node;
  return Children.map(node, (c) => {
    if (!isValidElement(c)) return c;
    const props = c.props as { children?: ReactNode; className?: string };
    if ((c.type as unknown) === jenis) {
      return cloneElement(c, {
        className: cn(props.className, kelas),
        ...(gaya ?? {}),
      } as { className?: string });
    }
    if (props.children === undefined || typeof props.children === 'function') return c;
    return cloneElement(c, { ...props, children: suntikGaya(props.children, jenis, kelas, gaya) });
  });
}

/** Gabungan label + combobox dalam satu kotak tanpa padding (Base UI Combobox).
 *
 *  - Label segaris (inline) di dalam kotak, dipisah dari zona kontrol lewat
 *    warna latar (tanpa garis pemisah).
 *  - Tanpa ukuran: kotak selebar induk, kontrol mengisi sisa ruang; di dalam
 *    toolbar tabel lebarnya ikut Kelola Tabel (bawaan LEBAR_BAWAHAN_FILTER).
 *  - `lebarLabel`/`lebarKombo` mengunci lebar; `lebarKombo` menyusut bila
 *    ruang induk tak cukup (dibatasi MIN_LEBAR_KONTROL).
 *  - Tinggi label & kontrol mengikuti tinggi kotak (`tinggi`, bawaan 26px).
 *  - Tombol panah diletakkan menumpuk di kanan zona (absolut) sehingga input
 *    memakai seluruh lebar zona dan popup (yang ditambatkan ke input) otomatis
 *    membentang sampai tepi kanan kotak.
 *  - `bisaCari` mengaktifkan pengetikan untuk mencari; bawaan mati (input
 *    read-only, tanpa caret berkedip).
 *  - Anak idealnya satu `ComboboxRoot`; kontrol lain dirender apa adanya. */
export default function LabeledCombobox({ label, htmlFor, lebarLabel, lebarKombo, lebarKotak, tinggi = 26, children, className, kelolaLebar = true, bisaCari = false }: {
  label: string;
  htmlFor?: string;
  lebarLabel?: number | string;
  lebarKombo?: number | string;
  /** Lebar TOTAL kotak (label + combobox); combobox mengisi sisa ruang. */
  lebarKotak?: number | string;
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
  const anakTunggal = Children.count(children) === 1 && isValidElement(children)
    ? (children as ReactElement)
    : null;
  if (anakTunggal === null || anakTunggal.type !== ComboboxRoot) {
    // Tanpa akar Combobox: tetap dirender di dalam kotak (tanpa suntikan gaya).
    return (
      <KotakLabel label={label} htmlFor={htmlFor} lebarLabel={lebarLabel} lebarKontrol={lebarKombo} lebarKotak={lebarKotak} tinggi={tinggi} className={className} kelolaLebar={kelolaLebar}>
        {() => children}
      </KotakLabel>
    );
  }

  const propsAnak = anakTunggal.props as { children?: ReactNode };
  /* `pr-6`: ruang kanan untuk tombol panah yang menumpuk. `readOnly` (bawaan)
     membuat input hanya menampilkan nilai terpilih — tanpa caret berkedip
     dan tanpa pengetikan, klik/panah tetap membuka daftar. */
  let isi = suntikGaya(
    propsAnak.children,
    ComboboxInput,
    'h-full w-full min-w-0 rounded-none border-0 pr-6 shadow-none focus-visible:ring-0 focus-visible:shadow-none',
    bisaCari ? undefined : { readOnly: true },
  );
  isi = suntikGaya(isi, ComboboxTrigger, 'absolute top-1/2 right-0 -translate-y-1/2');
  // Popup: border sama dengan kotak pembungkus.
  isi = suntikGaya(isi, ComboboxContent, 'border-foreground/30');

  return (
    <KotakLabel label={label} htmlFor={htmlFor} lebarLabel={lebarLabel} lebarKontrol={lebarKombo} lebarKotak={lebarKotak} tinggi={tinggi} className={className} kelolaLebar={kelolaLebar}>
      {() => cloneElement(anakTunggal, { ...(anakTunggal.props as object), children: isi })}
    </KotakLabel>
  );
}

export { hitungLebarKontrol as hitungLebarKombo, keCss };
