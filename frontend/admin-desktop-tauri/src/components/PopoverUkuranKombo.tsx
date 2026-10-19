import { useState, type ReactNode, type RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { PopoverContent } from '@/components/ui/popover';
import SpinBox from '@/components/SpinBox';
import {
  ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxRoot, ComboboxTrigger,
} from '@/components/ui/combobox';
import { ChevronDown, ChevronUp, ClipboardPaste, Copy, RotateCcw } from '@/icons';
import {
  LEBAR_KOMBO_MAKS,
  LEBAR_KOMBO_MIN,
  LEBAR_KONTROL_MAKS,
  LEBAR_KONTROL_MIN,
  LEBAR_LABEL_MAKS,
  LEBAR_LABEL_MIN,
  LANGKAH_STEPPER_MAKS,
  LANGKAH_STEPPER_MIN,
  TINGGI_KOMBO_MAKS,
  TINGGI_KOMBO_MIN,
  type UbahUkuranKombo,
} from '@/components/ukuranKombo';

/** Langkah tombol −/+ (px) — 1px terlalu halus untuk ukuran kotak. */
const LANGKAH_TINGGI = 2;
const LANGKAH_LEBAR = 10;
const LANGKAH_LABEL = 4;

/* Lebar tiap SEL grid ukuran (px) = label baris (48) + stepper (84) + tombol
   reset ikon (24) + 2 celah 6px = 168px. Dipatok, bukan `flex-1`, supaya
   posisi stepper tak bergeser saat isi panel bertambah/berkurang.

   Angka lebar PANEL ditulis literal di kelas Tailwind (`w-[370px]`, …) karena
   pemindai Tailwind hanya menemukan kelas yang tertulis utuh di sumber. Isi
   panel = 370 − border 2×1 − padding p-3 (2×12) = 344px = 2 sel 168px + celah
   8px. Baris "Lainnya" memakai lebar PENUH 344px, jadi panel tak pernah
   melebar saat bagian itu dibuka — hanya tingginya yang bertambah. */

/** Lebar label baris (px) — SAMA semua baris supaya stepper sejajar. */
const LEBAR_LABEL_BARIS = 48;
/** Lebar label baris COMBOBOX (px) — SAMA semua baris pilihan ("Tipe",
 *  "Format", "Mengembang", "Warna Label:", "Nilai awal") supaya combobox-nya
 *  rata kiri. Lebih longgar dari baris stepper karena "Mengembang"/"Warna
 *  Label:" lebih panjang dari "Tinggi"/"Total"; kalau dipatok 48px teksnya
 *  meluber dan ketimpa kontrol di sebelahnya. */
const LEBAR_LABEL_KOMBO = 84;
/** Lebar kotak stepper (px) — SAMA semua baris; cukup untuk 4 digit. */
const LEBAR_STEPPER = 84;

/** Pilihan sisi yang mengembang saat lebar total diubah (baris "Mengembang"). */
const OPSI_MENGEMBANG = [{ label: 'Label', nilai: 'Label' }, { label: 'Kontrol', nilai: 'Kontrol' }];
/** Pilihan gaya label (baris "Warna Label:"). */
const OPSI_WARNA_LABEL = [{ label: 'Transparan', nilai: 'Transparan' }, { label: 'Tidak Transparan', nilai: 'Tidak Transparan' }];
/** Tampil/sembunyi label kotak. */
const OPSI_LABEL_TAMPIL = [{ label: 'Tampil', nilai: 'Tampil' }, { label: 'Sembunyi', nilai: 'Sembunyi' }];

/** Baris alat: label polos + stepper kompak + tombol reset per-baris. */
function BarisUkuran({ id, teks, stepper, resetId, resetLabel, adaAturan, onReset }: {
  id: string;
  teks: string;
  stepper: ReactNode;
  resetId: string;
  resetLabel: string;
  adaAturan: boolean;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor={id} className="shrink-0 text-xs whitespace-nowrap text-muted-foreground" style={{ width: LEBAR_LABEL_BARIS }}>{teks}</label>
      <div className="min-w-0 flex-1">{stepper}</div>
      <Button
        id={resetId}
        type="button"
        variant="ghost"
        size="icon-xs"
        disabled={!adaAturan}
        onClick={onReset}
        aria-label={resetLabel}
        title={resetLabel}
        className="shrink-0 text-muted-foreground"
      >
        <RotateCcw />
      </Button>
    </div>
  );
}

/** Baris "label + combobox" untuk pilihan bernama (baris "Mengembang",
 *  "Warna Label:", "Tipe", dan "Nilai awal"; baris "Format" dari pengaturan
 *  tipe memakai lebar yang sama supaya combobox-nya rata kiri). Label jadi
 *  nama aksesibel kontrol lewat `htmlFor` — tanpa `aria-label` yang bisa
 *  bentrok dengan teks yang terlihat.
 *
 *  `lebarLabel` mengunci lebar label (px); bawaan = selebar baris combobox
 *  lain (`LEBAR_LABEL_KOMBO`) supaya kontrolnya rata kiri.
 *
 *  `labelOpsi` memetakan nilai → teks yang ditampilkan (baris "Tipe"
 *  menampilkan "Nominal (Uang)", bukan kunci `nominal`). Tanpa itu, nilai
 *  ditampilkan apa adanya. */
function BarisPilihan({ id, teks, judul, opsi, nilai, placeholder, namaDaftar, onPilih, lebarLabel = LEBAR_LABEL_KOMBO, resetId, resetLabel, adaAturan, onReset }: {
  id: string;
  teks: string;
  /** Tooltip penjelas di label. */
  judul: string;
  /** Pilihan: `label` untuk tampilan, `nilai` untuk disimpan. */
  opsi: { label: string; nilai: string }[];
  /** Pilihan yang sedang aktif (harus salah satu dari `opsi`). */
  nilai: string;
  placeholder: string;
  /** Nama aksi membuka daftar (aria-label tombol chevron). */
  namaDaftar: string;
  /** Menyimpan nilai pilihan baru (label sudah diterjemahkan pemanggil). */
  onPilih: (nilaiBaru: string) => void;
  /** Lebar label terkunci (px); bawaan = `LEBAR_LABEL_KOMBO` supaya
   *  combobox semua baris rata kiri. */
  lebarLabel?: number;
  resetId?: string;
  resetLabel?: string;
  /** Ada setelan tersimpan untuk baris ini? (menentukan tombol reset) */
  adaAturan?: boolean;
  onReset?: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <label
        htmlFor={id}
        className="shrink-0 text-xs whitespace-nowrap text-muted-foreground"
        style={{ width: lebarLabel }}
        title={judul}
      >
        {teks}
      </label>
      <div className="relative min-w-0 flex-1">
        <ComboboxRoot
          items={opsi}
          itemToStringLabel={(o) => o.label}
          isItemEqualToValue={(a, b) => a.nilai === b.nilai}
          value={opsi.find((o) => o.nilai === nilai) ?? null}
          onValueChange={(o) => { if (o !== null) onPilih(o.nilai); }}
        >
          <ComboboxInput id={id} className="pr-7" placeholder={placeholder} />
          <ComboboxTrigger className="absolute top-1/2 right-0 -translate-y-1/2" aria-label={namaDaftar} />
          <ComboboxContent>
            <ComboboxEmpty>Tidak ada pilihan.</ComboboxEmpty>
            <ComboboxList>
              {(o) => <ComboboxItem key={o.nilai} value={o}>{o.label}</ComboboxItem>}
            </ComboboxList>
          </ComboboxContent>
        </ComboboxRoot>
      </div>
      {onReset !== undefined && (
        <Button
          id={resetId}
          type="button"
          variant="ghost"
          size="icon-xs"
          disabled={!adaAturan}
          onClick={onReset}
          aria-label={resetLabel}
          title={resetLabel}
          className="shrink-0 text-muted-foreground"
        >
          <RotateCcw />
        </Button>
      )}
    </div>
  );
}

/** Jepit ke rentang (px bulat). */
const jepit = (n: number, min: number, maks: number) => Math.min(maks, Math.max(min, Math.round(n)));

/** Apakah target interaksi berada di dalam popup daftar opsi (ber-portal ke
 *  `body`, jadi di luar DOM panel)? */
const diDalamDaftarOpsi = (target: EventTarget | null) =>
  target instanceof Element && target.closest('[data-slot="combobox-content"]') !== null;

/** Isi popover pengaturan ukuran KOTAK combobox — dibuka lewat KLIK KANAN
 *  pada kotak `LabeledCombobox` (lihat `LabeledCombobox`).
 *
 *  Tata letaknya dua tingkat:
 *  - GRID UKURAN 2 KOLOM (selalu terlihat): baris atas = ukuran kotak
 *    (Tinggi, Total), baris bawah = pembagian lebarnya (Label, Kontrol).
 *  - "Lainnya" (Tipe, Langkah, pengaturan tipe, Mengembang, Warna Label,
 *    Nilai awal) ada DI BAWAH grid itu dan BISA DILIPAT — bawaan TERBUKA
 *    supaya seluruh pengaturan langsung terlihat. Ia selebar panel, jadi
 *    keadaannya tak melebarkan panel.
 *
 *  Total, label, dan kontrol SALING TERHUBUNG: total = label + kontrol.
 *  - Ubah label → kontrol menyesuaikan (total tetap); ubah kontrol → label
 *    menyesuaikan. Sisi lawan dijepit ke rentangnya, jadi sisi yang diubah
 *    pun tertahan bila lawan mentok.
 *  - Ubah total → sisi yang BERTANDA expanding yang terdampak (bawaan:
 *    kontrol); total tertulis mengikuti hasil aktual bila sisi itu mentok.
 *  - Tepat satu sisi mengembang (satu baris pilihan "Mengembang": Label ↔ Kontrol).
 *
 *  Komponen ini "bodoh": ia hanya menampilkan nilai & memanggil balik. Sumber
 *  penyimpanannya ditentukan pemanggil — SERVER (saat combobox hidup di
 *  toolbar tabel, berlaku global) atau perangkat (combobox form biasa).
 *
 *  Di kepalanya ada ikon SALIN & TEMPEL setelan: salin kotak ini, lalu tempel
 *  ke kotak lain (termasuk kotak di halaman lain) — lihat `salinSetelan.ts`.
 *
 *  Popover tak punya tombol tutup: KLIK KIRI DI LUAR menutupnya (kecuali klik
 *  pada daftar opsi combobox di dalamnya, yang ber-portal ke `body`). Escape
 *  sengaja tak menutup supaya mengetik di isian panel tak berarti keluar. */
export default function PopoverUkuranKombo({ kunci, refKotak, label, nama = 'combobox', tipeKontrol, opsiTipe, adaTipeKontrol, onSalin, onTempel, bisaSalin, asalSalinan, pengaturanTipe, adaPengaturanTipe, onUbahTipeKontrol, tinggi, lebar, lebarLabel, lebarKontrol, adaTinggi, adaLebar, adaLebarLabel, adaLebarKontrol, adaExpand, adaLabelTransparan, adaNilaiDefault, expandLabel, labelTransparan, tanpaLabel, opsi, nilaiDefault, langkah, adaLangkah, onUbah, onReset, onResetBaris }: {
  kunci: string;
  /** Ref elemen KOTAK yang sedang diatur. Isi kotak (label + kontrol) berada
   *  di luar DOM panel ini, jadi perlu rujukan untuk membedakan "pengguna
   *  masih memakai kontrol yang sedang ia atur" dari "klik di luar". */
  refKotak?: RefObject<HTMLElement | null>;
  /** Label kotak yang sedang diatur — ditampilkan agar jelas komponen mana
   *  yang berubah. */
  label?: string;
  /** Kata ganti jenis kotak di judul & aria ("combobox", "input", ...). */
  nama?: string;
  /** Tipe kontrol aktif (registry `tipeInput.tsx`); dipakai baris "Tipe". */
  tipeKontrol?: string;
  /** Tipe yang boleh dipilih (baris disembunyikan bila kosong/tak ada). */
  opsiTipe?: { label: string; nilai: string }[];
  /** Ada tipe kontrol tersimpan? (menentukan tombol reset baris & reset global) */
  adaTipeKontrol?: boolean;
  /** Simpan setelan kotak ini ke papan salin (ikon "Salin setelan"). */
  onSalin?: () => void;
  /** Terapkan isi papan salin ke kotak ini (ikon "Tempel setelan"). */
  onTempel?: () => void;
  /** Ada setelan tersimpan yang bisa disalin? (ikon Salin nonaktif bila tidak) */
  bisaSalin?: boolean;
  /** Nama kotak asal salinan; `undefined` = papan salin kosong → ikon Tempel
   *  tak ditampilkan sama sekali. */
  asalSalinan?: string;
  /** Pengaturan khusus tipe aktif (mis. "Preset cepat" pada tipe `nominal`).
   *  `id` dipakai `htmlFor` label baris — harus sama dengan id kontrol yang
   *  dirender `isi`. */
  pengaturanTipe?: { id: string; label: string; judul?: string; isi: ReactNode };
  /** Ada pengaturan tipe tersimpan? (ikut menentukan reset global) */
  adaPengaturanTipe?: boolean;
  /** Simpan tipe kontrol (setelan komponen custom di server — bukan ukuran). */
  onUbahTipeKontrol?: (tipeBaru: string | null) => void;
  /** Nilai tinggi kotak yang ditampilkan (px). */
  tinggi: number;
  /** Nilai lebar total kotak yang ditampilkan (px). */
  lebar: number;
  /** Nilai lebar label terkunci yang ditampilkan (px). */
  lebarLabel: number;
  /** Nilai lebar kontrol terkunci yang ditampilkan (px). */
  lebarKontrol: number;
  /** Ada pengaturan tersimpan per baris? (menentukan tombol reset baris). */
  adaTinggi: boolean;
  adaLebar: boolean;
  adaLebarLabel: boolean;
  adaLebarKontrol: boolean;
  /** Ada flag expanding tersimpan? (ikut menentukan tombol reset global). */
  adaExpand: boolean;
  /** Ada flag label transparan tersimpan? */
  adaLabelTransparan: boolean;
  /** Ada setelan "label disembunyikan" tersimpan (untuk tombol kembalikan). */
  adaTanpaLabel?: boolean;
  /** Ada nilai awal combobox tersimpan? */
  adaNilaiDefault: boolean;
  /** True = LABEL mengembang saat total diubah; false = KONTROL (bawaan). */
  expandLabel: boolean;
  /** True = label TRANSPARAN (tanpa bg, teks bertitik dua). */
  labelTransparan: boolean;
  /** Label disembunyikan: kontrol mengisi penuh kotak. */
  tanpaLabel?: boolean;
  /** Daftar label opsi combobox; kosong = baris "nilai awal" disembunyikan. */
  opsi?: string[];
  /** Label opsi yang jadi nilai AWAL combobox; absen = ikut nilai pemanggil. */
  nilaiDefault?: string;
  /** Langkah tombol −/+ stepper angka; absen = baris "Langkah" disembunyikan
   *  (kotak yang bukan stepper). */
  langkah?: number;
  /** Ada langkah tersimpan? (menentukan tombol reset baris & reset global) */
  adaLangkah?: boolean;
  onUbah: (ukuran: UbahUkuranKombo) => void;
  onReset: () => void;
  /** Kembalikan SATU baris ke bawaan. */
  onResetBaris: (bidang: 'tinggi' | 'lebar' | 'lebarLabel' | 'lebarKontrol' | 'nilaiDefault' | 'tipeKontrol' | 'langkah' | 'tanpaLabel') => void;
}) {
  /** Interaksi di dalam KOTAK yang sedang diatur ATAU daftar opsi di dalam
   *  panel tidak menutup panel (lihat catatan pada `onInteractOutside`). */
  const interaksiDiKotak = (target: EventTarget | null) =>
    diDalamDaftarOpsi(target) || (target instanceof Node && refKotak?.current?.contains(target) === true);
  /** Ubah label → kontrol menyesuaikan, total tetap. Batas label dirapatkan
   *  agar kontrol tak keluar dari rentangnya. */
  const ubahLabel = (n: number) => {
    const labelBaru = jepit(n, Math.max(LEBAR_LABEL_MIN, lebar - LEBAR_KONTROL_MAKS), Math.min(LEBAR_LABEL_MAKS, lebar - LEBAR_KONTROL_MIN));
    onUbah({ lebarLabel: labelBaru, lebarKontrol: lebar - labelBaru });
  };
  /** Ubah kontrol → label menyesuaikan, total tetap. */
  const ubahKontrol = (n: number) => {
    const kontrolBaru = jepit(n, Math.max(LEBAR_KONTROL_MIN, lebar - LEBAR_LABEL_MAKS), Math.min(LEBAR_KONTROL_MAKS, lebar - LEBAR_LABEL_MIN));
    onUbah({ lebarKontrol: kontrolBaru, lebarLabel: lebar - kontrolBaru });
  };
  /** Ubah total → sisi yang mengembang yang terdampak. Yang DITULIS adalah
   *  `lebar` = total baru PERSIS (bukan `label + kontrol`): hasil pengukuran
   *  label+kontrol bisa beda beberapa px dari lebar kotak (border/rounding),
   *  sehingga menjumlahkan keduanya membuat stepper meleset dari ±step. */
  const ubahTotal = (n: number) => {
    const totalBaru = jepit(n, LEBAR_KOMBO_MIN, LEBAR_KOMBO_MAKS);
    const delta = totalBaru - lebar;
    if (expandLabel) {
      const labelBaru = jepit(lebarLabel + delta, LEBAR_LABEL_MIN, LEBAR_LABEL_MAKS);
      onUbah({ lebar: totalBaru, lebarLabel: labelBaru });
    } else {
      const kontrolBaru = jepit(lebarKontrol + delta, LEBAR_KONTROL_MIN, LEBAR_KONTROL_MAKS);
      onUbah({ lebar: totalBaru, lebarKontrol: kontrolBaru });
    }
  };
  /** Panel "Lainnya" dibuka atau tidak — bawaan TERBUKA supaya seluruh
   *  pengaturan langsung terlihat tanpa satu klik ekstra. */
  const [lainnyaBuka, setLainnyaBuka] = useState(true);
  /** Ada setelan tersimpan apa pun? → tombol "Kembalikan ke bawaan" hidup. */
  const adaSetelan = adaTinggi || adaLebar || adaLebarLabel || adaLebarKontrol
    || adaExpand || adaLabelTransparan || adaNilaiDefault || adaLangkah === true
    || adaPengaturanTipe === true;
  return (
    <PopoverContent
      /* Di SESARANG kotak (bukan di bawahnya): panel setinggi mungkin perlu
         ruang vertikal penuh (daftar opsi yang panjang), sedangkan meletakkannya
         di bawah menyembunyikan isi panel saat kotak berada di baris paling
         bawah. Radix membalik ke sisi sebaliknya (kiri) otomatis bila ruang
         di kanan tak cukup — jadi penempatannya mengikuti "view". */
      side="right"
      align="center"
      sideOffset={6}
      collisionPadding={8}
      /* Ukuran popover TETAP dan tak bergantung pada combobox: lebar dipatok
         (min = max) sehingga melebar/menyempitnya kotak combobox tak pernah
         ikut mengubahnya. Panel hanya dilebarkan saat kolom "Lainnya" dibuka
         (lihat hitungan di konstanta lebar sel di atas). */
      className="w-[370px] min-w-[370px] max-w-[370px] p-3 border-foreground/30"
      /* Klik KIRI di luar → popover tertutup (bawaan Radix). Yang DIKECUALIKAN
         adalah interaksi pada (a) daftar opsi di dalam panel dan (b) KOTAK yang
         sedang diatur — pengguna memakai kontrol yang sama dengan yang ia atur,
         jadi panel tak boleh hilang saat ia mengklik atau memberi fokus pada
         kontrol itu. (b) penting bagi klik-kanan di LABEL: membuka daftar opsi
         memindahkan fokus ke input, dan tanpa pengecualian ini panel ikut
         tertutup. Radix memeriksa fokus di luar lewat `onFocusOutside`, jadi
         kedua handler perlu guard yang sama. */
      onInteractOutside={(e) => { if (interaksiDiKotak(e.target)) e.preventDefault(); }}
      onFocusOutside={(e) => { if (interaksiDiKotak(e.target)) e.preventDefault(); }}
      /* Escape sengaja tak menutup: pengguna sering sedang mengetik di salah
         satu isian panel; menutupnyaralekan ketikan itu. */
      onEscapeKeyDown={(e) => e.preventDefault()}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-1">
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Tanpa nama jenis kotak: kontrol yang diatur jelas dari kotak yang
                baru saja diklik-kanan, dan judul pendek membuat panel 200px
                tetap satu baris. */}
            <p className="truncate text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Ukuran kotak
            </p>
            {label ? (
              <p className="truncate text-[11px] text-muted-foreground" title={label}>
                {label}
              </p>
            ) : null}
          </div>
          {/* SALIN & TEMPEL setelan antar kotak — dua langkah, tanpa daftar
              tujuan: salin di kotak asal (ikon Dokumen), lalu tempel di kotak
              lain (ikon Papan Tempel, muncul hanya bila papan salin berisi).
              Isinya hidup di memori aplikasi, jadi bisa lintas halaman. */}
          {onSalin !== undefined && (
            <Button
              id={`btn_salin_setelan_kombo_${kunci}`}
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={bisaSalin !== true}
              onClick={onSalin}
              aria-label="Salin setelan kotak ini"
              title={bisaSalin === true
                ? `Salin setelan ${nama} ini, lalu tempel ke kotak lain`
                : 'Belum ada setelan tersimpan untuk disalin'}
              className="shrink-0 text-muted-foreground"
            >
              <Copy />
            </Button>
          )}
          {onTempel !== undefined && asalSalinan !== undefined && (
            <Button
              id={`btn_tempel_setelan_kombo_${kunci}`}
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onTempel}
              aria-label={`Tempel setelan dari ${asalSalinan}`}
              title={`Tempel setelan dari "${asalSalinan}" ke ${nama} ini`}
              className="shrink-0 text-muted-foreground"
            >
              <ClipboardPaste />
            </Button>
          )}
          {/* Kembalikan SELURUH setelan komponen ini ke bawaan. Dulu baris penuh
              di bawah panel; kini ikon di kepala panel sehingga tingginya hemat
              satu baris + pemisah (±40px) — sejalan dengan tombol reset
              per-baris yang juga ikon. */}
          <Button
            id={`btn_reset_ukuran_kombo_${kunci}`}
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={!adaSetelan}
            onClick={onReset}
            aria-label="Kembalikan ke bawaan"
            title="Kembalikan ke bawaan"
            className="shrink-0 text-muted-foreground"
          >
            <RotateCcw />
          </Button>
          {/* Pengalih bagian "Lainnya" — bawaan TERBUKA. Panahnya BERGANTI,
              bukan berputar: panah BAWAH saat tertutup (isinya terbuka ke
              bawah) dan panah ATAS saat terbuka (isinya dilipat ke atas),
              jadi arahnya selalu menunjukkan apa yang akan terjadi.
              `aria-expanded` untuk aksesibilitas. */}
          <Button
            id={`btn_lainnya_kombo_${kunci}`}
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => setLainnyaBuka((b) => !b)}
            aria-expanded={lainnyaBuka}
            aria-controls={`panel_lainnya_kombo_${kunci}`}
            aria-label={lainnyaBuka ? 'Sembunyikan pengaturan lainnya' : 'Tampilkan pengaturan lainnya'}
            title={lainnyaBuka ? 'Sembunyikan pengaturan lainnya' : 'Tampilkan pengaturan lainnya'}
            className="shrink-0 text-muted-foreground"
          >
            {lainnyaBuka ? <ChevronUp /> : <ChevronDown />}
          </Button>
        </div>
        {/* GRID UKURAN 2 KOLOM × 2 BARIS: baris atas = ukuran kotak (Tinggi,
            Total), baris bawah = pembagian lebarnya (Label, Kontrol). Urutan
            itu menjaga pasangan yang berhubungan tetap berdampingan: Total
            (lebar kotak) di atas Label+Kontrol. */}
        <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
          <BarisUkuran
            id={`set_tinggi_kombo_${kunci}`}
            teks="Tinggi"
            resetId={`btn_reset_tinggi_kombo_${kunci}`}
            resetLabel="Kembalikan tinggi ke bawaan"
            adaAturan={adaTinggi}
            onReset={() => onResetBaris('tinggi')}
            stepper={
              <SpinBox
                id={`set_tinggi_kombo_${kunci}`}
                value={tinggi}
                min={TINGGI_KOMBO_MIN}
                max={TINGGI_KOMBO_MAKS}
                step={LANGKAH_TINGGI}
                lebar={LEBAR_STEPPER}
                title={`Tinggi kotak ${nama} (px)`}
                ariaLabel={`Tinggi kotak ${nama} (px)`}
                onChange={(n) => onUbah({ tinggi: n })}
              />
            }
          />
          <BarisUkuran
            id={`set_lebar_kombo_${kunci}`}
            teks="Total"
            resetId={`btn_reset_lebar_kombo_${kunci}`}
            resetLabel="Kembalikan lebar total ke bawaan"
            adaAturan={adaLebar}
            onReset={() => onResetBaris('lebar')}
            stepper={
              <SpinBox
                id={`set_lebar_kombo_${kunci}`}
                value={lebar}
                min={LEBAR_KOMBO_MIN}
                max={LEBAR_KOMBO_MAKS}
                step={LANGKAH_LEBAR}
                lebar={LEBAR_STEPPER}
                title={`Lebar total kotak ${nama} — label + kontrol (px)`}
                ariaLabel={`Lebar kotak ${nama} (px)`}
                onChange={ubahTotal}
              />
            }
          />
          <BarisUkuran
            id={`set_lebar_label_kombo_${kunci}`}
            teks="Label"
            resetId={`btn_reset_label_kombo_${kunci}`}
            resetLabel="Kembalikan lebar label ke bawaan"
            adaAturan={adaLebarLabel}
            onReset={() => onResetBaris('lebarLabel')}
            stepper={
              <SpinBox
                id={`set_lebar_label_kombo_${kunci}`}
                value={lebarLabel}
                min={LEBAR_LABEL_MIN}
                max={LEBAR_LABEL_MAKS}
                step={LANGKAH_LABEL}
                lebar={LEBAR_STEPPER}
                title="Lebar label terkunci (px)"
                ariaLabel={`Lebar label ${nama} (px)`}
                onChange={ubahLabel}
              />
            }
          />
          <BarisUkuran
            id={`set_lebar_kontrol_kombo_${kunci}`}
            teks="Kontrol"
            resetId={`btn_reset_kontrol_kombo_${kunci}`}
            resetLabel="Kembalikan lebar kontrol ke bawaan"
            adaAturan={adaLebarKontrol}
            onReset={() => onResetBaris('lebarKontrol')}
            stepper={
              <SpinBox
                id={`set_lebar_kontrol_kombo_${kunci}`}
                value={lebarKontrol}
                min={LEBAR_KONTROL_MIN}
                max={LEBAR_KONTROL_MAKS}
                step={LANGKAH_LEBAR}
                lebar={LEBAR_STEPPER}
                title="Lebar kontrol terkunci (px)"
                ariaLabel={`Lebar kontrol ${nama} (px)`}
                onChange={ubahKontrol}
              />
            }
          />
        </div>
        {/* "Lainnya" — DI BAWAH grid ukuran (bukan di sampingnya), jadi panel
            tak ikut melebar. Berisi Tipe, pengaturan tipe (mis. "Format"),
            Mengembang, Warna Label, dan Nilai awal; bawaan terbuka. Garis
            horizontal memisahkan kelompok ukuran dari kelompok pengaturan. */}
        {lainnyaBuka ? (
          <>
            <div aria-hidden className="border-t border-foreground/10" />
            <div id={`panel_lainnya_kombo_${kunci}`} className="flex flex-col gap-1.5">
              {/* Langkah tombol −/+ stepper ANGKA — interval perubahan nilai
                  per klik. Hanya untuk kotak stepper (`langkah` dikirim
                  pemanggil); stepper di popover ini sendiri pakai langkah 1
                  karena langkah yang diatur cuma butuh ketelitian 1-1. */}
              {langkah !== undefined ? (
                <BarisUkuran
                  id={`set_langkah_kombo_${kunci}`}
                  teks="Langkah"
                  resetId={`btn_reset_langkah_kombo_${kunci}`}
                  resetLabel="Kembalikan langkah ke bawaan"
                  adaAturan={adaLangkah === true}
                  onReset={() => onResetBaris('langkah')}
                  stepper={
                    <SpinBox
                      id={`set_langkah_kombo_${kunci}`}
                      value={langkah}
                      min={LANGKAH_STEPPER_MIN}
                      max={LANGKAH_STEPPER_MAKS}
                      step={1}
                      lebar={LEBAR_STEPPER}
                      title={`Langkah perubahan nilai ${nama} (interval tombol kurang/tambah)`}
                      ariaLabel={`Langkah ${nama}`}
                      onChange={(n) => onUbah({ langkah: n })}
                    />
                  }
                />
              ) : null}
              {/* Tipe + pengaturan khusus tipe AKTIF (mis. "Format" pada
                  Tanggal). Label memakai `LEBAR_LABEL_KOMBO` supaya
                  combobox-nya rata kiri. */}
              {opsiTipe !== undefined && opsiTipe.length > 1 ? (
                <BarisPilihan
                  id={`set_tipe_kombo_${kunci}`}
                  teks="Tipe"
                  judul="Tipe kontrol: menentukan format isi, tombol bawaan, dan cara mengetik (mis. Nominal punya papan rupiah)."
                  opsi={opsiTipe}
                  nilai={tipeKontrol ?? opsiTipe[0].nilai}
                  placeholder="Pilih tipe…"
                  namaDaftar="Buka daftar tipe input"
                  onPilih={(v) => onUbahTipeKontrol?.(v)}
                  resetId={`btn_reset_tipe_kombo_${kunci}`}
                  resetLabel="Kembalikan tipe input ke bawaan"
                  adaAturan={adaTipeKontrol === true}
                  onReset={() => onResetBaris('tipeKontrol')}
                />
              ) : null}
              {pengaturanTipe !== undefined ? (
                <div className="flex items-center gap-1.5">
                  <label
                    htmlFor={pengaturanTipe.id}
                    className="shrink-0 text-xs whitespace-nowrap text-muted-foreground"
                    style={{ width: LEBAR_LABEL_KOMBO }}
                    title={pengaturanTipe.judul}
                  >
                    {pengaturanTipe.label}
                  </label>
                  <div className="min-w-0 flex-1">{pengaturanTipe.isi}</div>
                </div>
              ) : null}
              {/* Sisi yang mengembang saat "Total" diubah — combobox (bukan
                  centang) supaya kedua sisi tampil sebagai pilihan bernama: pilot
                  "Kontrol" atau "Label". */}
              <BarisPilihan
                id={`set_expand_kombo_${kunci}`}
                teks="Mengembang"
                judul="Pilih sisi yang ikut melebar saat lebar total diubah: label atau kontrol."
                opsi={OPSI_MENGEMBANG}
                nilai={expandLabel ? 'Label' : 'Kontrol'}
                placeholder="Pilih sisi…"
                namaDaftar="Buka daftar sisi yang mengembang"
                onPilih={(v) => onUbah({ expandLabel: v === 'Label' })}
              />
              {/* "Label transparan" dikelompokkan di bawah tema Mengembang, pada baris
                  tersendiri yang bertanda "Warna Label:". */}
              <BarisPilihan
                id={`set_label_transparan_kombo_${kunci}`}
                teks="Warna Label:"
                judul="Transparan: label tanpa latar, teks bertitik dua. Tidak transparan: label berlatar penuh."
                opsi={OPSI_WARNA_LABEL}
                nilai={labelTransparan ? 'Transparan' : 'Tidak Transparan'}
                placeholder="Pilih warna label…"
                namaDaftar="Buka daftar warna label"
                onPilih={(v) => onUbah({ labelTransparan: v === 'Transparan' })}
              />
              {/* Tampil/sembunyi label. Saat disembunyikan, zona label tak
                  dirender sama sekali dan kontrol mengisi penuh kotak. */}
              <BarisPilihan
                id={`set_label_tampil_kombo_${kunci}`}
                teks="Label:"
                judul="Tampil: label seperti biasa. Sembunyi: label dihilangkan, kontrol mengisi penuh kotak (nama tetap terbaca pembaca layar)."
                opsi={OPSI_LABEL_TAMPIL}
                nilai={tanpaLabel ? 'Sembunyi' : 'Tampil'}
                placeholder="Pilih tampilan label…"
                namaDaftar="Buka daftar tampilan label"
                onPilih={(v) => onUbah({ tanpaLabel: v === 'Sembunyi' })}
              />
              {opsi !== undefined && opsi.length > 0 ? (
                <div className="flex items-center gap-1.5">
                  {/* Nilai AWAL combobox: pilih salah satu opsi yang ada. Dipakai
                      sebagai nilai awal yang ditampilkan; pengguna tetap bisa
                      menggantinya, dan nilai pemanggil menang saat berubah. */}
                  <label
                    htmlFor={`set_nilai_awal_kombo_${kunci}`}
                    className="shrink-0 text-xs whitespace-nowrap text-muted-foreground"
                    style={{ width: LEBAR_LABEL_KOMBO }}
                  >
                    Nilai awal
                  </label>
                  <div className="relative min-w-0 flex-1">
                    <ComboboxRoot
                      items={opsi}
                      value={nilaiDefault ?? null}
                      onValueChange={(v) => onUbah({ nilaiDefault: typeof v === 'string' ? v : null })}
                    >
                      <ComboboxInput
                        id={`set_nilai_awal_kombo_${kunci}`}
                        className="pr-7"
                        aria-label="Nilai awal combobox"
                        placeholder="Nilai awal…"
                      />
                      <ComboboxTrigger
                        className="absolute top-1/2 right-0 -translate-y-1/2"
                        aria-label="Buka daftar nilai"
                      />
                      <ComboboxContent>
                        <ComboboxEmpty>Tidak ada nilai.</ComboboxEmpty>
                        <ComboboxList>
                          {(o) => <ComboboxItem key={o} value={o}>{o}</ComboboxItem>}
                        </ComboboxList>
                      </ComboboxContent>
                    </ComboboxRoot>
                  </div>
                  <Button
                    id={`btn_reset_nilai_awal_kombo_${kunci}`}
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={!adaNilaiDefault}
                    onClick={() => onResetBaris('nilaiDefault')}
                    aria-label="Kembalikan nilai awal ke bawaan"
                    title="Kembalikan nilai awal ke bawaan"
                    className="shrink-0 text-muted-foreground"
                  >
                    <RotateCcw />
                  </Button>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </PopoverContent>
  );
}
