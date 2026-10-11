import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { PopoverClose, PopoverContent } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import SpinBox from '@/components/SpinBox';
import {
  ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxRoot, ComboboxTrigger,
} from '@/components/ui/combobox';
import { RotateCcw, X as XIcon } from '@/icons';
import {
  LEBAR_KOMBO_MAKS,
  LEBAR_KOMBO_MIN,
  LEBAR_KONTROL_MAKS,
  LEBAR_KONTROL_MIN,
  LEBAR_LABEL_MAKS,
  LEBAR_LABEL_MIN,
  TINGGI_KOMBO_MAKS,
  TINGGI_KOMBO_MIN,
  type UbahUkuranKombo,
} from '@/components/ukuranKombo';

/** Langkah tombol −/+ (px) — 1px terlalu halus untuk ukuran kotak. */
const LANGKAH_TINGGI = 2;
const LANGKAH_LEBAR = 10;
const LANGKAH_LABEL = 4;

/** Lebar label baris (px) — SAMA semua baris supaya stepper sejajar. */
const LEBAR_LABEL_BARIS = 48;
/** Lebar kotak stepper (px) — SAMA semua baris; cukup untuk 4 digit. */
const LEBAR_STEPPER = 84;

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

/** Pil toggle (segmented): aktif = terisi, mati = outline. */
function Pil({ id, teks, nama, aktif, onPilih }: {
  id: string;
  teks: string;
  nama: string;
  aktif: boolean;
  onPilih: () => void;
}) {
  return (
    <Button
      id={id}
      type="button"
      variant={aktif ? 'default' : 'outline'}
      aria-label={nama}
      aria-pressed={aktif}
      onClick={onPilih}
      className="h-6 rounded-full px-2 text-xs"
    >
      {teks}
    </Button>
  );
}

/** Jepit ke rentang (px bulat). */
const jepit = (n: number, min: number, maks: number) => Math.min(maks, Math.max(min, Math.round(n)));

/** Isi popover pengaturan ukuran KOTAK combobox — dibuka lewat KLIK KANAN
 *  pada kotak `LabeledCombobox` (lihat `LabeledCombobox`).
 *
 *  Total, label, dan kontrol SALING TERHUBUNG: total = label + kontrol.
 *  - Ubah label → kontrol menyesuaikan (total tetap); ubah kontrol → label
 *    menyesuaikan. Sisi lawan dijepit ke rentangnya, jadi sisi yang diubah
 *    pun tertahan bila lawan mentok.
 *  - Ubah total → sisi yang BERTANDA expanding yang terdampak (bawaan:
 *    kontrol); total tertulis mengikuti hasil aktual bila sisi itu mentok.
 *  - Tepat satu sisi mengembang (dua checkbox saling lepas).
 *
 *  Komponen ini "bodoh": ia hanya menampilkan nilai & memanggil balik. Sumber
 *  penyimpanannya ditentukan pemanggil — SERVER (saat combobox hidup di
 *  toolbar tabel, berlaku global) atau perangkat (combobox form biasa).
 *
 *  Popover TIDAK menutup saat klik di luar atau Escape — hanya tombol × yang
 *  menutupnya — supaya pengguna bisa membuka dropdown combobox dan mengecek
 *  hasilnya tanpa kehilangan panel pengaturan ini. */
export default function PopoverUkuranKombo({ kunci, label, nama = 'combobox', tinggi, lebar, lebarLabel, lebarKontrol, adaTinggi, adaLebar, adaLebarLabel, adaLebarKontrol, adaExpand, adaLabelTransparan, adaNilaiDefault, expandLabel, labelTransparan, opsi, nilaiDefault, onUbah, onReset, onResetBaris }: {
  kunci: string;
  /** Label kotak yang sedang diatur — ditampilkan agar jelas komponen mana
   *  yang berubah. */
  label?: string;
  /** Kata ganti jenis kotak di judul & aria ("combobox", "input", ...). */
  nama?: string;
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
  /** Ada nilai awal combobox tersimpan? */
  adaNilaiDefault: boolean;
  /** True = LABEL mengembang saat total diubah; false = KONTROL (bawaan). */
  expandLabel: boolean;
  /** True = label TRANSPARAN (tanpa bg, teks bertitik dua). */
  labelTransparan: boolean;
  /** Daftar label opsi combobox; kosong = baris "nilai awal" disembunyikan. */
  opsi?: string[];
  /** Label opsi yang jadi nilai AWAL combobox; absen = ikut nilai pemanggil. */
  nilaiDefault?: string;
  onUbah: (ukuran: UbahUkuranKombo) => void;
  onReset: () => void;
  /** Kembalikan SATU baris ke bawaan. */
  onResetBaris: (bidang: 'tinggi' | 'lebar' | 'lebarLabel' | 'lebarKontrol' | 'nilaiDefault') => void;
}) {
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
  return (
    <PopoverContent
      align="start"
      side="bottom"
      sideOffset={6}
      /* Ukuran popover TETAP dan tak bergantung pada combobox: lebar dipatok
         (min = max) sehingga melebar/menyempitnya kotak combobox tak pernah
         ikut mengubah popover ini. */
      className="w-[240px] min-w-[240px] max-w-[240px] p-3 border-foreground/30"
      /* Popover ini SENGAJA hanya bisa ditutup lewat tombol ×: klik di luar
         (termasuk membuka dropdown combobox untuk mengecek hasilnya) dan
         tombol Escape tidak menutupnya. Tanpa ini popover hilang begitu
         pengguna mengklik combobox untuk memeriksa lebarnya. */
      onInteractOutside={(e) => e.preventDefault()}
      onEscapeKeyDown={(e) => e.preventDefault()}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-1">
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Ukuran kotak {nama}
            </p>
            {label ? (
              <p className="truncate text-[11px] text-muted-foreground" title={label}>
                {label}
              </p>
            ) : null}
          </div>
          <PopoverClose asChild>
            <Button
              id={`btn_tutup_ukuran_kombo_${kunci}`}
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Tutup pengaturan ukuran"
              title="Tutup"
              /* Merah (destruktif) mengikuti konvensi tombol ikon "tutup/hapus"
                 di project ini — lihat KenaikanKelasPage/KelulusanPage. */
              className="-mr-1 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <XIcon />
            </Button>
          </PopoverClose>
        </div>
        <div className="flex flex-col gap-2">
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
        </div>
        <div aria-hidden className="border-t border-foreground/10" />
        <div className="flex items-center gap-1.5">
          <label
            htmlFor={`set_expand_kombo_${kunci}`}
            className="shrink-0 text-xs whitespace-nowrap text-muted-foreground"
            title="Dicentang: label yang mengembang lebar (kontrol tetap). Tidak dicentang: kontrol yang mengembang (label tetap)."
          >
            Mengembang (label)
          </label>
          <Checkbox
            id={`set_expand_kombo_${kunci}`}
            checked={expandLabel}
            onCheckedChange={(c) => onUbah({ expandLabel: !!c })}
            aria-label="Mengembang label"
          />
        </div>
        {/* "Label transparan" dikelompokkan di bawah tema Mengembang, pada baris
            tersendiri yang bertanda "Warna Label:". */}
        <div className="flex items-center gap-1.5">
          <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">Warna Label:</span>
          <Pil
            id={`set_label_transparan_kombo_${kunci}`}
            teks="Label transparan"
            nama="Label transparan"
            aktif={labelTransparan}
            onPilih={() => onUbah({ labelTransparan: !labelTransparan })}
          />
        </div>
        {opsi !== undefined && opsi.length > 0 ? (
          <>
            <div aria-hidden className="border-t border-foreground/10" />
            {/* Nilai AWAL combobox: pilih salah satu opsi yang ada. Dipakai
                sebagai nilai awal yang ditampilkan; pengguna tetap bisa
                menggantinya, dan nilai pemanggil menang saat berubah. */}
            <div className="flex items-center gap-1.5">
              <label
                htmlFor={`set_nilai_awal_kombo_${kunci}`}
                className="shrink-0 text-xs whitespace-nowrap text-muted-foreground"
                style={{ width: LEBAR_LABEL_BARIS }}
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
          </>
        ) : null}
        <div aria-hidden className="border-t border-foreground/10" />
        <Button
          id={`btn_reset_ukuran_kombo_${kunci}`}
          type="button"
          variant="ghost"
          size="sm"
          disabled={!(adaTinggi || adaLebar || adaLebarLabel || adaLebarKontrol || adaExpand || adaLabelTransparan || adaNilaiDefault)}
          onClick={onReset}
          className="-mx-1 justify-start px-1 text-muted-foreground"
        >
          <RotateCcw />
          Kembalikan ke bawaan
        </Button>
      </div>
    </PopoverContent>
  );
}
