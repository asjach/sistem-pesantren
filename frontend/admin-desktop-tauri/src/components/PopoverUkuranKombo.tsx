import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { PopoverClose, PopoverContent } from '@/components/ui/popover';
import LabeledStepper from '@/components/LabeledStepper';
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

/** Lebar label (px) — SAMA untuk semua baris supaya kolomnya rata. */
const LEBAR_LABEL = 52;

/** Baris alat: stepper berlabel mengisi baris, satuan "px" + tombol reset
 *  per-baris di kanan. */
function BarisUkuran({ stepper, resetId, resetLabel, adaAturan, onReset }: {
  stepper: ReactNode;
  resetId: string;
  resetLabel: string;
  adaAturan: boolean;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="min-w-0 flex-1">{stepper}</div>
      <span className="shrink-0 text-xs text-muted-foreground">px</span>
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

/** Isi popover pengaturan ukuran KOTAK combobox — dibuka lewat KLIK KANAN
 *  pada kotak `LabeledCombobox` (lihat `LabeledCombobox`).
 *
 *  Komponen ini "bodoh": ia hanya menampilkan nilai & memanggil balik. Sumber
 *  penyimpanannya ditentukan pemanggil — SERVER (saat combobox hidup di
 *  toolbar tabel, berlaku global) atau perangkat (combobox form biasa).
 *
 *  Popover TIDAK menutup saat klik di luar atau Escape — hanya tombol × yang
 *  menutupnya — supaya pengguna bisa membuka dropdown combobox dan mengecek
 *  hasilnya tanpa kehilangan panel pengaturan ini. */
export default function PopoverUkuranKombo({ kunci, label, tinggi, lebar, lebarLabel, lebarKontrol, adaTinggi, adaLebar, adaLebarLabel, adaLebarKontrol, onUbah, onReset, onResetBaris }: {
  kunci: string;
  /** Label combobox yang sedang diatur — ditampilkan agar jelas komponen mana
   *  yang berubah. */
  label?: string;
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
  onUbah: (ukuran: UbahUkuranKombo) => void;
  onReset: () => void;
  /** Kembalikan SATU baris ke bawaan. */
  onResetBaris: (bidang: 'tinggi' | 'lebar' | 'lebarLabel' | 'lebarKontrol') => void;
}) {
  return (
    <PopoverContent
      align="start"
      side="bottom"
      sideOffset={6}
      /* Ukuran popover TETAP dan tak bergantung pada combobox: lebar dipatok
         (min = max) sehingga melebar/menyempitnya kotak combobox tak pernah
         ikut mengubah popover ini. */
      className="w-[248px] min-w-[248px] max-w-[248px] p-3 border-foreground/30"
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
              Ukuran kotak combobox
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
        <BarisUkuran
          resetId={`btn_reset_tinggi_kombo_${kunci}`}
          resetLabel="Kembalikan tinggi ke bawaan"
          adaAturan={adaTinggi}
          onReset={() => onResetBaris('tinggi')}
          stepper={
            <LabeledStepper
              label="Tinggi"
              htmlFor={`set_tinggi_kombo_${kunci}`}
              lebarLabel={LEBAR_LABEL}
              kelolaLebar={false}
              value={tinggi}
              min={TINGGI_KOMBO_MIN}
              max={TINGGI_KOMBO_MAKS}
              step={LANGKAH_TINGGI}
              title="Tinggi kotak combobox (px)"
              aria-label="Tinggi kotak combobox (px)"
              onChange={(n) => onUbah({ tinggi: n })}
            />
          }
        />
        <BarisUkuran
          resetId={`btn_reset_lebar_kombo_${kunci}`}
          resetLabel="Kembalikan lebar total ke bawaan"
          adaAturan={adaLebar}
          onReset={() => onResetBaris('lebar')}
          stepper={
            <LabeledStepper
              label="Total"
              htmlFor={`set_lebar_kombo_${kunci}`}
              lebarLabel={LEBAR_LABEL}
              kelolaLebar={false}
              value={lebar}
              min={LEBAR_KOMBO_MIN}
              max={LEBAR_KOMBO_MAKS}
              step={LANGKAH_LEBAR}
              title="Lebar total kotak combobox — label + kontrol (px)"
              aria-label="Lebar kotak combobox (px)"
              onChange={(n) => onUbah({ lebar: n })}
            />
          }
        />
        <BarisUkuran
          resetId={`btn_reset_label_kombo_${kunci}`}
          resetLabel="Kembalikan lebar label ke bawaan"
          adaAturan={adaLebarLabel}
          onReset={() => onResetBaris('lebarLabel')}
          stepper={
            <LabeledStepper
              label="Label"
              htmlFor={`set_lebar_label_kombo_${kunci}`}
              lebarLabel={LEBAR_LABEL}
              kelolaLebar={false}
              value={lebarLabel}
              min={LEBAR_LABEL_MIN}
              max={LEBAR_LABEL_MAKS}
              step={LANGKAH_LABEL}
              title="Lebar label terkunci (px)"
              aria-label="Lebar label combobox (px)"
              onChange={(n) => onUbah({ lebarLabel: n })}
            />
          }
        />
        <BarisUkuran
          resetId={`btn_reset_kontrol_kombo_${kunci}`}
          resetLabel="Kembalikan lebar kontrol ke bawaan"
          adaAturan={adaLebarKontrol}
          onReset={() => onResetBaris('lebarKontrol')}
          stepper={
            <LabeledStepper
              label="Kontrol"
              htmlFor={`set_lebar_kontrol_kombo_${kunci}`}
              lebarLabel={LEBAR_LABEL}
              kelolaLebar={false}
              value={lebarKontrol}
              min={LEBAR_KONTROL_MIN}
              max={LEBAR_KONTROL_MAKS}
              step={LANGKAH_LEBAR}
              title="Lebar kontrol terkunci (px)"
              aria-label="Lebar kontrol combobox (px)"
              onChange={(n) => onUbah({ lebarKontrol: n })}
            />
          }
        />
        <p className="text-[11px] text-muted-foreground">
          Bila lebar kontrol dikunci, lebar total diabaikan (kotak rangkul isi).
        </p>
        <Button
          id={`btn_reset_ukuran_kombo_${kunci}`}
          type="button"
          variant="ghost"
          size="sm"
          disabled={!(adaTinggi || adaLebar || adaLebarLabel || adaLebarKontrol)}
          onClick={onReset}
          className="justify-start px-1 text-muted-foreground"
        >
          <RotateCcw />
          Kembalikan ke bawaan
        </Button>
      </div>
    </PopoverContent>
  );
}
