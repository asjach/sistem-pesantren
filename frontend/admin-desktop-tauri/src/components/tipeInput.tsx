import { useState, type ComponentProps, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxRoot, ComboboxTrigger,
} from '@/components/ui/combobox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import PopoverKalender from '@/components/PopoverKalender';
import PopoverBulan from '@/components/PopoverBulan';
import { diDalamPanel, kelasPanel, KELAS_TOMBOL, OFFSET_RATA, OFFSET_SISI } from '@/components/panelMenempel';
import { cn } from '@/lib/utils';
import {
  bulanDariTampilan, bulanKeTampilan, bulanLengkap, FORMAT_TANGGAL_BAWAAN, formatTanggalPola,
  maskBulan, POLA_FORMAT_TANGGAL, polaTanggal,
} from '@/lib/tanggal';
import { Calculator, Reset } from '@/icons';

/** Registry TIPE kontrol input untuk `LabeledTextInput`.
 *
 *  Tiap tipe punya bawaannya sendiri; tipe yang tak terdaftar (atau tak ada
 *  pilihannya) tetap memakai `Input` bawaan apa adanya. Pengguna memilih
 *  tipe dari baris "Tipe" pada popover pengaturan kotak (klik-kanan),
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

/** Konteks yang diteruskan ke `render` sebuah pengaturan tipe. */
export interface KonteksPengaturanTipe<T = unknown> {
  /** Id kontrol (`htmlFor`) supaya isian di panel punya id unik. */
  htmlFor?: string;
  /** Nilai yang berlaku sekarang (setelan tersimpan, atau `bawaan` tipe). */
  nilai: T;
  /** Tulis nilai baru; `null` = hapus setelan → kembali ke `bawaan` tipe. */
  setNilai: (nilaiBaru: T | null) => void;
}

/** Format TAMPILAN nilai input + kebalikannya.
 *
 *  Dipakai tipe yang teks di kotaknya BEDA dari nilai sebenarnya (mis. pemisah
 *  ribuan pada `nominal`, `dd/mm/yyyy` pada `tanggal`). Aturannya: yang dipakai
 *  aplikasi — dan dikirim ke server — SELALU hasil `nilai()`, tidak pernah yang
 *  tampak di kotak. `tampil()` hanya untuk mata pengguna. */
export interface FormatNilai {
  /** Nilai sebenarnya → teks yang ditampilkan di kotak. */
  tampil: (nilai: string) => string;
  /** Teks di kotak (ketikan/tempelan pengguna) → nilai sebenarnya. */
  nilai: (teks: string) => string;
  /** Penyaring KETIKAN (mask) untuk format yang tak bisa dibalik sambil
   *  diketik — mis. tanggal: "12/1" belum tanggal sah sehingga `nilai()`-nya
   *  kosong, padahal ketikan itu harus tetap terlihat di kotak. Menerima teks
   *  kotak apa adanya, mengembalikan teks yang seharusnya ada di sana
   *  (mis. "121" → "12/1"). Absen = kotak selalu menampilkan `tampil(nilai())`
   *  (seperti pemisah ribuan). */
  ketik?: (teks: string) => string;
  /** Teks kotak yang sudah LENGKAP tapi bukan nilai sah (mis. "31/02/2026").
   *  Dipakai menandai kotaknya (`aria-invalid`) supaya salah ketik tak
   *  diam-diam jadi nilai kosong. Absen = tak ada teks yang ditandai. */
  takSah?: (teks: string) => boolean;
  /** Judul (`title`) kotak saat teksnya ditandai `takSah` — bawaannya menyebut
   *  tanggal, jadi format lain (mis. bulan) memakai kalimatnya sendiri. */
  judulTakSah?: string;
}

/** Pemisah ribuan gaya Indonesia: `50000` ⇄ `50.000`.
 *
 *  Hanya DIGIT yang dianggap angka — titik, spasi, atau `Rp` yang ikut tersalin
 *  dari tempat lain dibuang; nol di depan dibuang seperti tombol papan angka
 *  (supaya `007` → `7`, bukan `7` di layar tapi `007` di database). */
export const FORMAT_RIBUAN: FormatNilai = {
  tampil: (nilai) => (/^\d+$/.test(nilai) ? Number(nilai).toLocaleString('id') : nilai),
  nilai: (teks) => teks.replace(/\D/g, '').replace(/^0+(?=\d)/, ''),
};

/** Tanggal: nilai sebenarnya ISO `YYYY-MM-DD`, yang tampak mengikuti POLA
 *  format kotak — bawaan `dd/mm/yyyy`, bisa diganti pengguna dari baris
 *  "Format" di popover (lihat `PENGATURAN_FORMAT_TANGGAL`).
 *
 *  Berbeda dengan pemisah ribuan, format ini TAK bisa dibalik sambil diketik
 *  ("12/1" bukan nilai sah) — karena itu ada `ketik` (mask) yang menyisipkan
 *  pemisah sendiri dan membaca tempelan ISO apa adanya. Nilai yang diteruskan
 *  ke pemanggil tetap ISO, sama seperti `input type="date"`. */
export const FORMAT_TANGGAL: FormatNilai = formatTanggalPola(FORMAT_TANGGAL_BAWAAN);

/** Bulan: nilai sebenarnya `YYYY-MM`, yang tampak `mm/yyyy`. Selain digit,
 *  kotaknya menerima KETIKAN CEPAT nama bulan — `okt 2026`, `okt26` (dua digit
 *  tahun: `26` = 2026, `98` = 1998), `september26` — yang tetap terlihat saat
 *  diketik lalu dibakukan jadi `mm/yyyy` begitu kotaknya ditinggalkan.
 *
 *  Sama seperti `FORMAT_TANGGAL` (mask ketikan + tak bisa dibalik sambil
 *  diketik) — bedanya tanpa bagian hari, jadi nilainya TETAP `YYYY-MM` seperti
 *  `input type="month"`. */
export const FORMAT_BULAN: FormatNilai = {
  tampil: bulanKeTampilan,
  nilai: bulanDariTampilan,
  ketik: maskBulan,
  takSah: (teks) => bulanLengkap(teks) && bulanDariTampilan(teks) === '',
  judulTakSah: 'Bulan tidak dikenal (mis. 10/2026 atau "okt 2026")',
};

/** PENGATURAN khusus milik satu tipe: baris di popover pengaturan kotak yang
 *  muncul HANYA saat tipe itu aktif, dan yang mengubah bawaan tipe itu sendiri
 *  (mis. daftar nominal cepat pada tipe `nominal`).
 *
 *  Bedanya dengan `attrs`/`aksiKanan`: keduanya konstanta di kode, sedangkan
 *  `pengaturan` bisa DIUBAH PENGGUNA dari popover dan disimpan per kotak
 *  (tabel `komponen_custom`, kunci `setelan.tipe.<kunci>`). */
export interface PengaturanTipe<T = unknown> {
  /** Kunci di `setelan.tipe` — dipakai menyimpan nilai per kotak. */
  kunci: string;
  /** Teks label baris di popover. */
  label: string;
  /** Tooltip penjelas di label. */
  judul?: string;
  /** Nilai bawaan tipe; dipakai bila kotak belum punya setelan. */
  bawaan: T;
  /** Isian baris di popover (nilai berlaku + penulisnya). Ditulis sebagai
   *  METHOD (bukan properti fungsi) supaya `PengaturanTipe<number[]>` tetap
   *  assignable ke `PengaturanTipe<unknown>` di `DefinisiTipeInput`. */
  render(ctx: KonteksPengaturanTipe<T>): ReactNode;
  /** Turunkan bawaan tipe dari nilai pengaturan (mis. `aksiKanan` ber-preset
   *  milik pengguna). Dipanggil `definisiTipe`; absen = tak ada turunan. */
  terapkan?(nilai: T | undefined): Partial<DefinisiTipeInput>;
}

/** Bawaan satu tipe input. */
export interface DefinisiTipeInput {
  /** Teks di combobox "Tipe" pada popover pengaturan. */
  label: string;
  /** Atribut native untuk `Input`; absen = `text`. */
  type?: string;
  /** Atribut bawaan tipe ini (bila pemanggil tak menentukan). */
  attrs?: Partial<Omit<ComponentProps<typeof Input>, 'className' | 'style' | 'type'>>;
  /** Konten di ujung kanan zona kontrol (mis. kalkulator rupiah, kalender). */
  aksiKanan?: (ctx: KonteksTipeInput) => ReactNode;
  /** Pengaturan yang bisa diubah pengguna dari popover (opsional per tipe). */
  pengaturan?: PengaturanTipe<unknown>;
  /** Format tampilan nilai (mis. pemisah ribuan, tanggal). Bila ada, `type`
   *  native ikut ditentukan tipe ini — pemisah ribuan/`dd/mm/yyyy` bukan isi
   *  yang sah untuk `number`/`date` sehingga teksnya tak akan tampil. */
  format?: FormatNilai;
  /** `type` native yang tetap DIMENGERTI sebagai tipe ini walau `type` kotaknya
   *  berbeda — mis. `tanggal` memakai kotak teks ber-mask, tapi pemanggil yang
   *  menulis `type="date"` tetap terbaca sebagai Tanggal (baris "Tipe" & tombol
   *  kalendernya ikut muncul). Dipakai `kunciDariTypeNative`. */
  typeNative?: string[];
}

/** Nominal cepat bawaan (rupiah) — 9 tombol, tampil 3 per baris. */
export const PRESET_NOMINAL = [
  1_000, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000,
];

/** Tombol angka: digit yang DITEMPEL ke nilai (seperti mengetik), jadi `00`/`000`
 *  menambah nol di belakang, bukan nominal 0. */
const TOMBOL_ANGKA = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '00', '000'];

/** Kelas panel nominal (lihat `panelMenempel.ts` untuk geometrinya). */
const KELAS_PANEL = kelasPanel('pop-nominal');

const PANEL_NOMINAL = 'nominal';
const PANEL_ANGKA = 'angka';

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

/** Isian daftar nominal cepat (teks dipisah koma) untuk baris pengaturan tipe
 *  `nominal` di popover. Di-commit saat blur/Enter; kosong = hapus setelan
 *  (kembali ke `PRESET_NOMINAL`). Titik/ruang dipakai sebagai pemisah juga,
 *  supaya "1.000 5.000" dari kebiasaan mengetik tetap terbaca. */
function IsianPresetNominal({ id, nilai, setNilai }: { id?: string; nilai: number[]; setNilai: (v: number[] | null) => void }) {
  const [draf, setDraf] = useState<string | null>(null);
  const commit = () => {
    if (draf === null) return;
    const angka = draf
      .split(/[^\d]+/)
      .filter((t) => t !== '')
      .map((t) => Number(t))
      .filter((n) => Number.isFinite(n) && n > 0);
    setDraf(null);
    setNilai(angka.length === 0 ? null : angka);
  };
  return (
    <Input
      id={id}
      value={draf ?? nilai.join(', ')}
      placeholder="1000, 5000, 10000"
      aria-label="Preset nominal cepat"
      className="h-[26px] text-xs"
      onChange={(e) => setDraf(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
    />
  );
}

/** Baca nilai pengaturan sebagai daftar nominal positif. Nilai dari server
 *  dianggap tak tepercaya, jadi disaring ulang di sini. */
function sebagaiPreset(v: unknown): number[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const angka = v.filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0);
  return angka.length === 0 ? undefined : angka;
}

/** Pengaturan tipe `nominal`: daftar nominal cepat di panel kalkulator. */
const PENGATURAN_PRESET_NOMINAL: PengaturanTipe = {
  kunci: 'preset',
  label: 'Preset cepat',
  judul: 'Nominal yang tampil di panel kalkulator. Pisahkan dengan koma; kosongkan untuk kembali ke bawaan.',
  bawaan: PRESET_NOMINAL,
  render: ({ htmlFor, nilai, setNilai }) => (
    <IsianPresetNominal
      id={htmlFor}
      nilai={sebagaiPreset(nilai) ?? PRESET_NOMINAL}
      setNilai={(v) => setNilai(v)}
    />
  ),
  /* Hanya turunkan `aksiKanan` bila pengguna memang menyetel presetsendiri;
     tanpa itu bawaan tipe (kalkulator ber-`PRESET_NOMINAL`) yang dipakai. */
  terapkan: (preset) => {
    const angka = sebagaiPreset(preset);
    return angka === undefined
      ? {}
      : { aksiKanan: (ctx) => <AksiKananNominal {...ctx} preset={angka} /> };
  },
};

/** Pilihan pola format tanggal untuk baris "Format" pada kotak bertipe
 *  `tanggal` (label = polanya sendiri, mis. `dd-mm-yyyy`). */
export const OPSI_FORMAT_TANGGAL = POLA_FORMAT_TANGGAL.map((p) => ({ label: p.label, nilai: p.kunci }));

/** Combobox pola format tanggal di popover pengaturan kotak bertipe `tanggal`.
 *  Yang disimpan = polanya (mis. `dd-mm-yyyy`), bukan teks tanggalnya. */
function ComboboxFormatTanggal({ id, nilai, setNilai }: {
  id?: string;
  /** Pola yang sedang berlaku; sudah divalidasi `polaTanggal`. */
  nilai: string;
  setNilai: (nilaiBaru: string) => void;
}) {
  return (
    <div className="relative min-w-0">
      <ComboboxRoot
        items={OPSI_FORMAT_TANGGAL}
        itemToStringLabel={(o) => o.label}
        isItemEqualToValue={(a, b) => a.nilai === b.nilai}
        value={OPSI_FORMAT_TANGGAL.find((o) => o.nilai === nilai) ?? OPSI_FORMAT_TANGGAL[0]}
        onValueChange={(o) => { if (o !== null) setNilai(o.nilai); }}
      >
        <ComboboxInput id={id} className="pr-7" placeholder="Pilih format…" />
        <ComboboxTrigger className="absolute top-1/2 right-0 -translate-y-1/2" aria-label="Buka daftar format tanggal" />
        <ComboboxContent>
          <ComboboxEmpty>Tidak ada format.</ComboboxEmpty>
          <ComboboxList>
            {(o) => <ComboboxItem key={o.nilai} value={o}>{o.label}</ComboboxItem>}
          </ComboboxList>
        </ComboboxContent>
      </ComboboxRoot>
    </div>
  );
}

/** Pengaturan tipe `tanggal`: pola format kotak (tampilan, mask ketikan, dan
 *  placeholder). Yang dikirim ke server TETAP ISO `YYYY-MM-DD` apa pun
 *  pilihannya, jadi menyimpan nilainya tak bergantung pada format tampilan. */
const PENGATURAN_FORMAT_TANGGAL: PengaturanTipe = {
  kunci: 'format',
  label: 'Format',
  judul: 'Pola tampilan tanggal di kotak (mis. 12-10-2026 atau 2026-10-12). Nilai yang dikirim ke server tetap ISO YYYY-MM-DD.',
  bawaan: FORMAT_TANGGAL_BAWAAN,
  render: ({ htmlFor, nilai, setNilai }) => (
    <ComboboxFormatTanggal id={htmlFor} nilai={polaTanggal(nilai)} setNilai={setNilai} />
  ),
  /* Pola bawaan tak perlu diturunkan: `FORMAT_TANGGAL` memang sudah persis pola
     itu (termasuk placeholder "dd/mm/yyyy" milik definisi tipe). Jadi hanya pola
     LAIN yang mengganti format + placeholder kotaknya. */
  terapkan: (format) => {
    const pola = polaTanggal(format);
    if (pola === FORMAT_TANGGAL_BAWAAN) return {};
    return {
      format: formatTanggalPola(pola),
      /* `attrs` digantikan UTUH: placeholder harus ikut pola yang dipilih, dan
         papan angka hanya cocok untuk pola tanpa nama bulan. */
      attrs: { inputMode: pola.includes('Mmm') ? undefined : 'numeric', placeholder: pola },
    };
  },
};

/** Tipe input yang tersedia (urutan = urutan di combobox popover). Tipe tanpa
 *  `aksiKanan`/`attrs` khusus tetap memakai `Input` bawaan. */
const DAFTAR: Record<KunciTipeInput, DefinisiTipeInput> = {
  teks: { label: 'Teks', type: 'text' },
  teks_rahasia: { label: 'Teks Rahasia', type: 'password' },
  angka: { label: 'Angka', type: 'number', attrs: { inputMode: 'numeric' } },
  nominal: {
    label: 'Nominal (Uang)',
    /* `text`, BUKAN `number`: pemisah ribuan ("50.000") bukan angka yang sah di
       `type=number` sehingga teksnya tak akan tampil. Papan ketik angka tetap
       diminta lewat `inputMode` di `attrs`. */
    type: 'text',
    attrs: { inputMode: 'numeric' },
    aksiKanan: (ctx) => <AksiKananNominal {...ctx} />,
    pengaturan: PENGATURAN_PRESET_NOMINAL,
    format: FORMAT_RIBUAN,
  },
  tanggal: {
    label: 'Tanggal',
    /* Kotak teks ber-mask `dd/mm/yyyy` + kalender sendiri, BUKAN `date` native:
       tampilan & popover pemilihnya milik webview (ikut locale, tak bisa
       distyle/dites). Nilai yang dipakai aplikasi & dikirim ke server tetap ISO
       `YYYY-MM-DD` lewat `format` — sama seperti `input type="date"`. */
    type: 'text',
    attrs: { inputMode: 'numeric', placeholder: 'dd/mm/yyyy' },
    format: FORMAT_TANGGAL,
    aksiKanan: (ctx) => <PopoverKalender {...ctx} />,
    typeNative: ['date'],
    pengaturan: PENGATURAN_FORMAT_TANGGAL,
  },
  bulan: {
    label: 'Bulan',
    /* Kotak teks ber-mask `mm/yyyy` + pemilih bulan sendiri, BUKAN `month`
       native: alasannya sama dengan `tanggal` — tampilan & popover pemilihnya
       milik webview (ikut locale, tak bisa distyle/dites). Nilai yang dipakai
       aplikasi & dikirim ke server tetap `YYYY-MM`, sama seperti input native. */
    type: 'text',
    attrs: { inputMode: 'numeric', placeholder: 'mm/yyyy' },
    format: FORMAT_BULAN,
    aksiKanan: (ctx) => <PopoverBulan {...ctx} />,
    typeNative: ['month'],
  },
  waktu: { label: 'Waktu', type: 'time' },
  tanggal_waktu: { label: 'Tanggal & Waktu', type: 'datetime-local' },
  email: { label: 'Email', type: 'email' },
  pencarian: { label: 'Pencarian', type: 'search' },
  telepon: { label: 'Telepon', type: 'tel' },
  url: { label: 'URL', type: 'url' },
};

/** Kunci tipe yang terdaftar; dipakai untuk memvalidasi nilai dari simpanan. */
export const KUNCI_TIPE_INPUT = Object.keys(DAFTAR) as KunciTipeInput[];

/** Baris pilihan untuk combobox "Tipe" (label + nilai registry). */
export const OPSI_TIPE_INPUT = KUNCI_TIPE_INPUT.map((nilai) => ({ label: DAFTAR[nilai].label, nilai }));

/** Definisi satu tipe; `undefined` bila kunci tak dikenal → `Input` bawaan.
 *  `nilaiPengaturan` (setelan `setelan.tipe` kotak ini) menurunkan bawaan tipe
 *  lewat `pengaturan.terapkan`, mis. `nominal` dengan preset milik pengguna. */
export function definisiTipe(kunci: string | undefined, nilaiPengaturan?: unknown): DefinisiTipeInput | undefined {
  if (kunci === undefined) return undefined;
  const def = DAFTAR[kunci as KunciTipeInput];
  if (def === undefined) return undefined;
  const terapkan = def.pengaturan?.terapkan;
  if (terapkan === undefined) return def;
  return { ...def, ...(terapkan as (v: unknown) => Partial<DefinisiTipeInput>)(nilaiPengaturan) };
}

/** Setelan per-tipe satu komponen: kunci pengaturan → nilai. */
export type SetelanTipe = Record<string, unknown>;

/** Nilai pengaturan tipe yang berlaku: setelan tersimpan, atau `bawaan` tipe. */
export function nilaiPengaturanTipe(def: DefinisiTipeInput | undefined, setelan: SetelanTipe): unknown {
  const p = def?.pengaturan;
  if (p === undefined) return undefined;
  const tersimpan = setelan[p.kunci];
  return tersimpan === undefined ? p.bawaan : tersimpan;
}

/** Batas jumlah kunci setelan tipe (selaras validasi backend `setelan.tipe`). */
export const MAKS_KUNCI_TIPE = 20;

/** Normalisasi setelan per-tipe dari simpanan/server: kunci asing dibuang,
 *  nilai harus skalar atau larik skalar (kedalaman 1) dengan panjang wajar. */
export function normalkanSetelanTipe(v: unknown): SetelanTipe {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return {};
  const hasil: SetelanTipe = {};
  for (const [kunci, nilai] of Object.entries(v as Record<string, unknown>)) {
    if (Object.keys(hasil).length >= MAKS_KUNCI_TIPE) break;
    if (kunci === '' || kunci.length > 40) continue;
    if (Array.isArray(nilai)) {
      if (nilai.length > 50) continue;
      if (nilai.every((n) => typeof n === 'string' || typeof n === 'number' || typeof n === 'boolean')) {
        hasil[kunci] = nilai;
      }
      continue;
    }
    if (typeof nilai === 'string' || typeof nilai === 'number' || typeof nilai === 'boolean') {
      hasil[kunci] = nilai;
    }
  }
  return hasil;
}

/** Kunci tipe bawaan untuk `type` native yang diteruskan pemanggil. Selain
 *  mencocokkan `type` definisi, `typeNative` tipe juga diakui — mis.
 *  `type="date"` → `tanggal` walau kotaknya kini teks ber-mask. */
export function kunciDariTypeNative(type: string | undefined): KunciTipeInput | undefined {
  if (type === undefined) return 'teks';
  const cocok = KUNCI_TIPE_INPUT.find(
    (k) => DAFTAR[k].type === type || DAFTAR[k].typeNative?.includes(type) === true,
  );
  return cocok ?? 'teks';
}