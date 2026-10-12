/** Panel popover yang MENEMPEL pada kotak kontrolnya.
 *
 *  Dipakai panel nominal (`tipeInput.tsx`) dan panel kalender
 *  (`PopoverKalender.tsx`). Keduanya anak SATU `Popover` sehingga
 *  terbuka/tertutup bersama: satu panel di atas kotak, satu di bawahnya.
 *
 *  Radix menutup popover begitu ada interaksi yang dianggap "di luar"
 *  kontennya; karena itu tiap panel mencegah penutupan bila sasarannya panel
 *  sebelah (`diDalamPanel`) — pada varian non-modal `onInteractOutside`
 *  dipanggil SEBELUM penutupan, jadi `preventDefault()` cukup menahannya.
 *  Tanpa itu, menekan tombol di satu panel akan ikut menutup panel lainnya. */

/** Kelas tiap panel: lebar & padding seragam, border sewarna kotak pembungkus,
 *  plus `penanda` — kelas penanda panel yang sekaligus jadi jangkar override
 *  `--input` di `index.css` dan penanda panel saat pengujian. */
export function kelasPanel(penanda: string): string {
  return `${penanda} pointer-events-auto w-60 border-foreground/30 p-2`;
}

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
export const KELAS_TOMBOL = 'border border-foreground/30 -ml-px -mt-px';

/** Border SAMAR untuk tombol grid yang bukan fokus utama panel (mis. daftar
 *  tahun & bulan di kalender) — tetap sewarna, hanya lebih pudar.
 *
 *  Di mode gelap lebih pudar lagi: `foreground` di sana hampir putih, jadi
 *  persentase yang sama terlihat jauh lebih tegas di atas panel yang gelap.
 *
 *  Varian gelapnya ditulis eksplisit karena tombol `outline` memasang
 *  `dark:border-input`, yang nilainya di-override per panel lewat `--input`
 *  (lihat `index.css`) sehingga tanpa `dark:…` border ini kembali tebal di
 *  mode gelap. */
export const KELAS_BORDER_SAMAR = 'border-foreground/15 dark:border-foreground/8';

/** Geometri panel terhadap kontrol.
 *
 *  Anchor-nya tombol `aksiKanan`, dan tombol itu duduk 1px DI DALAM kotak
 *  (kotak punya border 1px), jadi tepi anchor tidak sama dengan tepi kotak:
 *  - `sideOffset: 0` → sisi panel jatuh tepat di garis border kotak sehingga
 *    keduanya bertindihan (sela 1px, bukan 2px).
 *  - `alignOffset: -1` → menggeser panel 1px ke kanan (tanda negatif ke arah
 *    sebaliknya pada `align="end"`, diukur di browser) agar tepi kanannya rata
 *    dengan tepi luar kotak, bukan 1px di dalamnya.
 *
 *  Diukur di browser (Playwright): sela panel↔kontrol 1px, kanan 0px. */
export const OFFSET_SISI = 0;
export const OFFSET_RATA = -1;

/** Apakah target interaksi berada di dalam panel berpenanda `panel`. */
export function diDalamPanel(target: EventTarget | null, panel: string): boolean {
  return target instanceof Element && target.closest(`[data-panel="${panel}"]`) !== null;
}
