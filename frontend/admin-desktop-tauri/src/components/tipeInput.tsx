import { useState, type ComponentProps, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Calculator, Reset } from '@/icons';

/** Registry TIPE kontrol input untuk `LabeledTextInput`.
 *
 *  Tiap tipe punya bawaannya sendiri; tipe yang tak terdaftar (atau tak ada
 *  pilihannya) tetap memakai `Input` bawaan apa adanya. Pengguna memilih
 *  tipe dari baris "Tipe input:" pada popover pengaturan kotak (klik-kanan),
 *  jadi satu komponen bisa dipakai untuk beberapa kebutuhan tanpa membuat
 *  komponen baru per jenis data.
 *
 *  - `label`  → teks di combobox popover.
 *  - `type`   → atribut native `Input`; absen berarti `text`.
 *  - `attrs`  → atribut bawaan tipe; yang menentukan pemanggil tetap menang.
 *  - `aksiKanan` → konten di ujung kanan zona kontrol (mis. kalkulator rupiah). */

/** Kunci tipe input — juga nilai yang disimpan pada setelan kotak. */
export type KunciTipeInput =
  | 'teks'
  | 'teks_rahasia'
  | 'angka'
  | 'nominal'
  | 'tanggal'
  | 'bulan'
  | 'waktu'
  | 'tanggal_waktu'
  | 'email'
  | 'pencarian'
  | 'telepon'
  | 'url';

/** Konteks yang diteruskan ke `aksiKanan` sebuah tipe. */
export interface KonteksTipeInput {
  /** Id kontrol (`htmlFor`) supaya tombol di dalam panel punya id unik. */
  htmlFor?: string;
  /** Nilai berjalan; `''` bila input tak terkontrol. */
  nilai: string;
  /** Tulis nilai baru lewat `onChange` pemanggil; tanpa `onChange` = input
   *  dikendalikan `LabeledTextInput` secara internal (uncontrolled). */
  setNilai: (nilaiBaru: string) => void;
}

/** Bawaan satu tipe input. */
export interface DefinisiTipeInput {
  /** Teks di combobox "Tipe input:" pada popover pengaturan. */
  label: string;
  /** Atribut native untuk `Input`; absen = `text`. */
  type?: string;
  /** Atribut bawaan tipe ini (bila pemanggil tak menentukan). */
  attrs?: Partial<Omit<ComponentProps<typeof Input>, 'className' | 'style' | 'type'>>;
  /** Konten di ujung kanan zona kontrol (mis. kalkulator rupiah). */
  aksiKanan?: (ctx: KonteksTipeInput) => ReactNode;
}

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

/** Tombol kalkulator + dua panel (nominal cepat & papan angka) untuk tipe
 *  `nominal` (rupiah).
 *
 *  Dua panelnya anak satu `Popover` sehingga terbuka/tertutup bersama. Radix
 *  menutup popover begitu ada interaksi yang dianggap "di luar" kontennya,
 *  karena itu tiap konten mencegah penutupan bila sasarannya panel sebelah —
 *  pada varian non-modal `onInteractOutside` dipanggil sebelum penutupan, jadi
 *  `preventDefault()` cukup menahannya. Tanpa itu, menekan tombol di satu panel
 *  akan ikut menutup panel lainnya.
 *
 *  - Nominal selalu DITAMBAHKAN ke nilai — bukan `+`/`-` yang gampang dibaca
 *    sebagai operator biner (10 + 10 = 20), padahal maksudnya 10, 10, 10 = 30.
 *  - Tombol angka menempel ke nilai, sama seperti mengetik.
 *  - Tombol reset mengembalikan nilai ke 0.
 *
 *  `nilai` berupa teks angka (sama seperti `e.target.value` pada input number). */
export function AksiKananNominal({ htmlFor, nilai, setNilai, preset = PRESET_NOMINAL }: KonteksTipeInput & {
  /** Daftar nominal cepat di panel atas. */
  preset?: number[];
}) {
  const [buka, setBuka] = useState(false);

  /** Nominal ditambahkan ke nilai berjalan (nilai kosong/bukan angka = 0). */
  const tambahNominal = (n: number) => setNilai(String((Number(nilai) || 0) + n));

  /** Tombol angka menempel ke teks nilai; nol di depan dibuang (`00` → `0`). */
  const tempelAngka = (d: string) => {
    const dasar = nilai === '0' ? '' : nilai;
    setNilai((dasar + d).replace(/^0+(?=\d)/, ''));
  };

  return (
    <Popover open={buka} onOpenChange={setBuka}>
      <PopoverTrigger asChild>
        <Button
          id={htmlFor === undefined ? undefined : `btn_preset_${htmlFor}`}
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
            onClick={() => setNilai('0')}
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
  );
}

/** Tipe input yang tersedia (urutan = urutan di combobox popover). Tipe tanpa
 *  `aksiKanan`/`attrs` khusus tetap memakai `Input` bawaan. */
const DAFTAR: Record<KunciTipeInput, DefinisiTipeInput> = {
  teks: { label: 'Teks', type: 'text' },
  teks_rahasia: { label: 'Teks Rahasia', type: 'password' },
  angka: { label: 'Angka', type: 'number', attrs: { inputMode: 'numeric' } },
  nominal: {
    label: 'Nominal (Uang)',
    type: 'number',
    attrs: { inputMode: 'numeric' },
    aksiKanan: (ctx) => <AksiKananNominal {...ctx} />,
  },
  tanggal: { label: 'Tanggal', type: 'date' },
  bulan: { label: 'Bulan', type: 'month' },
  waktu: { label: 'Waktu', type: 'time' },
  tanggal_waktu: { label: 'Tanggal & Waktu', type: 'datetime-local' },
  email: { label: 'Email', type: 'email' },
  pencarian: { label: 'Pencarian', type: 'search' },
  telepon: { label: 'Telepon', type: 'tel' },
  url: { label: 'URL', type: 'url' },
};

/** Kunci tipe yang terdaftar; dipakai untuk memvalidasi nilai dari simpanan. */
export const KUNCI_TIPE_INPUT = Object.keys(DAFTAR) as KunciTipeInput[];

/** Baris pilihan untuk combobox "Tipe input:" (label + nilai registry). */
export const OPSI_TIPE_INPUT = KUNCI_TIPE_INPUT.map((nilai) => ({ label: DAFTAR[nilai].label, nilai }));

/** Definisi satu tipe; `undefined` bila kunci tak dikenal → `Input` bawaan. */
export function definisiTipe(kunci: string | undefined): DefinisiTipeInput | undefined {
  if (kunci === undefined) return undefined;
  return DAFTAR[kunci as KunciTipeInput];
}

/** Kunci tipe bawaan untuk `type` native yang diteruskan pemanggil. */
export function kunciDariTypeNative(type: string | undefined): KunciTipeInput | undefined {
  if (type === undefined) return 'teks';
  const cocok = KUNCI_TIPE_INPUT.find((k) => DAFTAR[k].type === type);
  return cocok ?? 'teks';
}