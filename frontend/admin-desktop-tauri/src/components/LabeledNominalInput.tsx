import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import LabeledTextInput from '@/components/LabeledTextInput';
import { cn } from '@/lib/utils';
import { Calculator, Reset } from '@/icons';

/** Nominal cepat bawaan (rupiah) — 9 tombol, tampil 3 per baris. */
export const PRESET_NOMINAL = [
  1_000, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000,
];

/** Tombol angka: digit yang DITEMPEL ke nilai (seperti mengetik), jadi `00`/`000`
 *  menambah nol di belakang, bukan nominal 0. */
const TOMBOL_ANGKA = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '00', '000'];

/** Kelas tiap panel: `.pop-nominal` jadi jangkar override `--input` di `index.css`
 *  (border tombol ikut sewarna kotak pembungkus di mode gelap) sekaligus penanda
 *  panel saat pengujian. */
const KELAS_PANEL = 'pop-nominal pointer-events-auto w-60 border-foreground/30 p-2';

/** Border 1px tiap tombol — disamakan dengan border kotak pembungkus.
 *
 *  `-ml-px -mt-px`: tombol rapat (tanpa `gap`), jadi tanpa geseran ini dua
 *  border yang bersentuhan tampak 2px di garis dalam. Dengan margin negatif 1px
 *  border kiri/atas tiap tombol bertindihan tepat di atas border kanan/bawah
 *  tombol sebelumnya — persinggungan tetap 1px. Grid & flex `stretch` membuat
 *  tepi kanan/bawah baris terakhir tak bergeser, jadi sisi luar panel tetap rapi
 *  (kelebihan 1px hanya masuk ke padding panel).
 *
 *  Karena itu tombol selebar baris memakai `self-stretch`, BUKAN `w-full`: pada
 *  elemen berlebar eksplisit margin kiri negatif hanya menggeser kotaknya
 *  sehingga tepi kanannya kurang 1px; dengan lebar `auto` + stretch, kotaknya
 *  ikut melebar dan kedua tepinya tetap sejajar. */
const KELAS_TOMBOL = 'border border-foreground/30 -ml-px -mt-px';

const PANEL_NOMINAL = 'nominal';
const PANEL_ANGKA = 'angka';

/** Geometri panel terhadap kontrol.
 *
 *  Anchor-nya tombol kalkulator, dan tombol itu duduk 1px DI DALAM kotak
 *  (kotak punya border 1px), jadi tepi anchor tidak sama dengan tepi kotak:
 *  - `sideOffset: 0` → sisi panel jatuh tepat di garis border kotak sehingga
 *    keduanya bertindihan (sela 1px, bukan 2px).
 *  - `alignOffset: -1` → menggeser panel 1px ke kanan (tanda negatif ke arah
 *    sebaliknya pada `align="end"`, diukur di browser) agar tepi kanannya rata
 *    dengan tepi luar kotak, bukan 1px di dalamnya.
 *
 *  Diukur di browser (Playwright): sela panel↔kontrol 1px, kanan 0px. */
const OFFSET_SISI = 0;
const OFFSET_RATA = -1;

/** Apakah target interaksi berada di dalam panel berpenanda `panel`. */
const diDalamPanel = (target: EventTarget | null, panel: string) =>
  target instanceof Element && target.closest(`[data-panel="${panel}"]`) !== null;

/** Kotak label + input angka nominal dengan DUA panel yang terbuka bersamaan:
 *  - Panel NOMINAL (kumpulan nominal 3 per baris + tombol Reset) → di ATAS input.
 *  - Panel ANGKA (1-9, 0, 00, 000) → di BAWAH input.
 *
 *  Keduanya anak satu `Popover` yang sama sehingga terbuka/tertutup bersama.
 *  Radix menutup popover begitu ada interaksi yang dianggap "di luar" kontennya,
 *  karena itu tiap konten mencegah penutupan bila sasarannya panel sebelah — pada
 *  varian non-modal `onInteractOutside` dipanggil sebelum penutupan, jadi
 *  `preventDefault()` cukup menahannya. Tanpa itu, menekan tombol di satu panel
 *  akan ikut menutup panel lainnya.
 *
 *  Dikontrol penuh: `value` + `onValueChange` adalah SATU-SATUNYA jalur nilai.
 *  - Nominal selalu DITAMBAHKAN ke nilai — bukan `+`/`-` yang gampang dibaca
 *    sebagai operator biner (10 + 10 = 20), padahal maksudnya 10, 10, 10 = 30.
 *  - Tombol angka menempel ke nilai, sama seperti mengetik.
 *  - Tombol reset mengembalikan nilai ke 0.
 *
 *  `value` berupa teks angka (sama seperti `e.target.value` pada input number). */
export default function LabeledNominalInput({ preset = PRESET_NOMINAL, value, onValueChange, ...props }: {
  /** Daftar nominal cepat di panel atas. */
  preset?: number[];
  /** Nilai terkontrol (teks angka). */
  value: string;
  /** Dipanggil tiap nilai berubah — diketik, ditempel dari angka, atau nominal. */
  onValueChange: (nilai: string) => void;
} & Omit<React.ComponentProps<typeof LabeledTextInput>, 'aksiKanan' | 'type' | 'value' | 'onChange' | 'defaultValue'>) {
  const [buka, setBuka] = useState(false);

  /** Nominal ditambahkan ke nilai berjalan (nilai kosong/bukan angka = 0). */
  const tambahNominal = (n: number) => onValueChange(String((Number(value) || 0) + n));

  /** Tombol angka menempel ke teks nilai; nol di depan dibuang (`00` → `0`). */
  const tempelAngka = (d: string) => {
    const dasar = value === '0' ? '' : value;
    onValueChange((dasar + d).replace(/^0+(?=\d)/, ''));
  };

  return (
    <LabeledTextInput
      type="number"
      inputMode="numeric"
      nama="nominal"
      {...props}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      aksiKanan={
        <Popover open={buka} onOpenChange={setBuka}>
          <PopoverTrigger asChild>
            <Button
              id={props.htmlFor === undefined ? undefined : `btn_preset_${props.htmlFor}`}
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Pilih nominal cepat"
              title="Pilih nominal cepat"
              className="h-full rounded-none text-muted-foreground"
            >
              <Calculator className="size-4" />
            </Button>
          </PopoverTrigger>

          {/* Panel ATAS: nominal cepat + reset. `avoidCollisions=false` menjaga
              sisi tetap, supaya panel atas tak bertukar ke bawah lalu menimpa
              panel angka saat ruang sempit. */}
          <PopoverContent
            data-panel={PANEL_NOMINAL}
            side="top"
            align="end"
            sideOffset={OFFSET_SISI}
            alignOffset={OFFSET_RATA}
            avoidCollisions={false}
            className={KELAS_PANEL}
            onInteractOutside={(e) => { if (diDalamPanel(e.target, PANEL_ANGKA)) e.preventDefault(); }}
          >
            <div className="flex flex-col">
              <div role="group" aria-label="Nominal cepat" className="grid grid-cols-3">
                {preset.map((n) => (
                  <Button
                    key={n}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(KELAS_TOMBOL, 'justify-end tabular-nums')}
                    onClick={() => tambahNominal(n)}
                  >
                    {n.toLocaleString('id')}
                  </Button>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(KELAS_TOMBOL, 'self-stretch')}
                aria-label="Reset ke 0"
                title="Reset ke 0"
                onClick={() => onValueChange('0')}
              >
                <Reset className="size-4" />
                Reset
              </Button>
            </div>
          </PopoverContent>

          {/* Panel BAWAH: papan tombol angka. */}
          <PopoverContent
            data-panel={PANEL_ANGKA}
            side="bottom"
            align="end"
            sideOffset={OFFSET_SISI}
            alignOffset={OFFSET_RATA}
            avoidCollisions={false}
            className={KELAS_PANEL}
            onInteractOutside={(e) => { if (diDalamPanel(e.target, PANEL_NOMINAL)) e.preventDefault(); }}
          >
            <div role="group" aria-label="Tombol angka" className="grid grid-cols-3">
              {TOMBOL_ANGKA.map((d) => (
                <Button
                  key={d}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(KELAS_TOMBOL, 'tabular-nums')}
                  onClick={() => tempelAngka(d)}
                >
                  {d}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      }
    />
  );
}
