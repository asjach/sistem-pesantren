import { type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import KotakLabel, { hitungLebarKontrol, keCss } from '@/components/kotakLabel';
import { cn } from '@/lib/utils';

/** Gabungan label + input teks dalam satu kotak tanpa padding.
 *
 *  Styling, penskalaan lebar, dan pendaftaran ke Kelola Tabel identik dengan
 *  `LabeledCombobox` (keduanya memakai shell `KotakLabel`) — bedanya hanya
 *  jenis kontrolnya: input teks yang bisa diketik bebas.
 *
 *  - Label segaris (inline) di dalam kotak; tanpa ukuran, kotak selebar induk
 *    dan input mengisi sisa ruang. Di dalam toolbar tabel lebarnya mengikuti
 *    Kelola Tabel (bawaan `LEBAR_BAWAHAN_FILTER`).
 *  - `lebarLabel`/`lebarInput` mengunci lebar; `lebarInput` menyusut bila ruang
 *    induk tak cukup (dibatasi `MIN_LEBAR_KONTROL`).
 *  - Tinggi label & input mengikuti tinggi kotak (`tinggi`, bawaan 26px).
 *  - `type`, `placeholder`, `value`, `onChange`, dan seterusnya diteruskan ke
 *    `Input`; `className` tambahan digabung di atas kelas bawaan.
 *  - `aksiKanan` menempelkan konten (mis. tombol) di ujung kanan zona kontrol
 *    secara absolut; input diberi ruang kanan agar teks tak tertimpa. */
export default function LabeledTextInput({ label, htmlFor, lebarLabel, lebarInput, lebarKotak, tinggi = 26, className, kelolaLebar = true, aksiKanan, ...props }: {
  label: string;
  htmlFor?: string;
  lebarLabel?: number | string;
  lebarInput?: number | string;
  /** Lebar TOTAL kotak (label + input); input mengisi sisa ruang. */
  lebarKotak?: number | string;
  tinggi?: number | string;
  /** Matikan pendaftaran ke Kelola Tabel (kontrol bawaan toolbar). */
  kelolaLebar?: boolean;
  className?: string;
  /** Konten di ujung kanan zona kontrol (tombol dsb), ditumpuk absolut. */
  aksiKanan?: ReactNode;
} & Omit<React.ComponentProps<typeof Input>, 'className' | 'style'>) {
  return (
    <KotakLabel
      label={label}
      htmlFor={htmlFor}
      lebarLabel={lebarLabel}
      lebarKontrol={lebarInput}
      lebarKotak={lebarKotak}
      tinggi={tinggi}
      className={className}
      kelolaLebar={kelolaLebar}
    >
      {(kelasKontrol) => (
        <>
          <Input
            {...props}
            id={props.id ?? htmlFor}
            className={cn(kelasKontrol, aksiKanan !== undefined && 'pr-7')}
          />
          {aksiKanan !== undefined && (
            <span className="absolute inset-y-0 right-0 flex items-center">{aksiKanan}</span>
          )}
        </>
      )}
    </KotakLabel>
  );
}

export { hitungLebarKontrol as hitungLebarInput, keCss };