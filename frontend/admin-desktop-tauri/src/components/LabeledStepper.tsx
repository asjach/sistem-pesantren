import { useState } from 'react';
import KotakLabel, { hitungLebarKontrol, keCss } from '@/components/kotakLabel';
import { usePengaturanKotak } from '@/components/pengaturanKotak';
import { cn } from '@/lib/utils';

/** Gabungan label + stepper angka (−/+) dalam satu kotak tanpa padding.
 *
 *  Styling, penskalaan lebar, dan pendaftaran ke Kelola Tabel identik dengan
 *  `LabeledCombobox`/`LabeledTextInput` (ketiganya memakai shell `KotakLabel`)
 *  — bedanya hanya jenis kontrolnya: angka yang bisa diubah lewat tombol
 *  kurang/tambah atau diketik langsung.
 *
 *  - Label segaris (inline) di dalam kotak; tanpa ukuran, kotak selebar induk
 *    dan stepper mengisi sisa ruang. Di dalam toolbar tabel lebarnya mengikuti
 *    Kelola Tabel (bawaan `LEBAR_BAWAHAN_FILTER`).
 *  - `lebarLabel`/`lebarStepper` mengunci lebar; `lebarStepper` menyusut bila
 *    ruang induk tak cukup (dibatasi `MIN_LEBAR_KONTROL`).
 *  - Tinggi label & stepper mengikuti tinggi kotak (`tinggi`, bawaan 26px).
 *  - Nilai yang diketik disimpan sebagai draf selama fokus (seperti `SpinBox`)
 *    supaya pengguna bisa menghapus isinya; commit saat blur/Enter dan selalu
 *    dijepit ke rentang `min`..`max`.
 *  - Tombol ber-id `<id>_kurang`/`<id>_tambah` (snake_case, ikut `htmlFor`).
 *  - KLIK KANAN pada kotak membuka popover pengaturan ukuran KOTAK (sama
 *    seperti `LabeledCombobox`); butuh `htmlFor` sebagai identitas. */
export default function LabeledStepper({ label, htmlFor, labelTransparan = false, lebarLabel, lebarStepper, lebarKotak, tinggi = 26, className, kelolaLebar = true, value, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER, step = 1, disabled = false, onChange, ...props }: {
  label: string;
  htmlFor?: string;
  /** Label transparan (tanpa bg, teks bertitik dua); simpanan popover menang. */
  labelTransparan?: boolean;
  lebarLabel?: number | string;
  lebarStepper?: number | string;
  /** Lebar TOTAL kotak (label + stepper); stepper mengisi sisa ruang. */
  lebarKotak?: number | string;
  tinggi?: number | string;
  /** Matikan pendaftaran ke Kelola Tabel (kontrol bawaan toolbar). */
  kelolaLebar?: boolean;
  className?: string;
  /** Nilai terkontrol (angka). */
  value: number;
  /** Batas bawah (bawaan: tak dibatasi). */
  min?: number;
  /** Batas atas (bawaan: tak dibatasi). */
  max?: number;
  /** Langkah tombol −/+ (bawaan 1). */
  step?: number;
  disabled?: boolean;
  /** Dipanggil tiap nilai berubah — tombol, atau ketikan yang di-commit. */
  onChange: (n: number) => void;
} & Omit<React.ComponentProps<'input'>, 'className' | 'style' | 'type' | 'value' | 'onChange' | 'disabled'>) {
  const [draft, setDraft] = useState<string | null>(null);
  const id = props.id ?? htmlFor;
  const jepit = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  const commit = (raw: string | null) => {
    setDraft(null);
    if (raw === null || raw.trim() === '') return;
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    onChange(jepit(n));
  };
  const geser = (d: number) => {
    const dasar = draft !== null && draft.trim() !== '' && Number.isFinite(Number(draft))
      ? Number(draft)
      : value;
    setDraft(null);
    onChange(jepit(dasar + d));
  };
  const tombol = 'grid w-6 shrink-0 place-items-center text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40';
  const {
    refKotak, onContextMenu, tinggiEfektif, lebarKotakEfektif,
    lebarLabelEfektif, lebarKontrolEfektif, labelTransparanEfektif, bungkus,
  } = usePengaturanKotak({
    htmlFor, kelolaLebar, label, nama: 'stepper', labelTransparan,
    lebarLabel, lebarKontrol: lebarStepper, lebarKotak, tinggi,
  });
  return bungkus(
    <KotakLabel
      ref={refKotak}
      label={label}
      htmlFor={htmlFor}
      labelTransparan={labelTransparanEfektif}
      lebarLabel={lebarLabelEfektif}
      lebarKontrol={lebarKontrolEfektif}
      lebarKotak={lebarKotakEfektif}
      tinggi={tinggiEfektif}
      className={className}
      kelolaLebar={kelolaLebar}
      onContextMenu={onContextMenu}
    >
      {() => (
        <span className="flex h-full w-full items-stretch">
          <button
            type="button"
            id={id === undefined ? undefined : `${id}_kurang`}
            aria-label={`${label} kurang`}
            title={`Kurangi ${label}`}
            disabled={disabled || value <= min}
            className={tombol}
            onClick={() => geser(-step)}
          >
            <span aria-hidden className="text-sm leading-none">−</span>
          </button>
          <input
            {...props}
            id={id}
            type="text"
            inputMode="numeric"
            aria-label={props['aria-label'] ?? label}
            disabled={disabled}
            className={cn(
              'h-full min-w-0 flex-1 border-x border-foreground/15 bg-transparent px-1 text-center text-xs outline-none',
              'shadow-none focus-visible:ring-0 focus-visible:shadow-none disabled:opacity-60',
            )}
            value={draft ?? String(value)}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commit(draft)}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          />
          <button
            type="button"
            id={id === undefined ? undefined : `${id}_tambah`}
            aria-label={`${label} tambah`}
            title={`Tambah ${label}`}
            disabled={disabled || value >= max}
            className={tombol}
            onClick={() => geser(step)}
          >
            <span aria-hidden className="text-sm leading-none">+</span>
          </button>
        </span>
      )}
    </KotakLabel>
  );
}

export { hitungLebarKontrol as hitungLebarStepper, keCss };
