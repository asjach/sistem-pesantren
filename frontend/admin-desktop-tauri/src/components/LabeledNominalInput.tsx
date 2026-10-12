import LabeledTextInput from '@/components/LabeledTextInput';
import { AksiKananNominal, PRESET_NOMINAL } from '@/components/tipeInput';

/** Nominal cepat bawaan (rupiah) — 9 tombol, tampil 3 per baris. */
export { PRESET_NOMINAL };

/** Kotak label + input angka nominal (rupiah): `type="number"` dengan papan
 *  ketik + preset nominal cepat di ujung kanan.
 *
 *  Seluruh perilaku nominal kini milik TIPE `nominal` di registry
 *  (`components/tipeInput.tsx`) — komponen ini cuma meminta tipe itu, jadi
 *  perilaku uang bisa pula dipilih dari popover pengaturan tanpa perlu membungkus
 *  `LabeledTextInput` ini di tiap pemanggilan.
 *
 *  `value` + `onValueChange` adalah SATU-SATUNYA jalur nilai: nominal cepat
 *  menambah, papan angka menempel digit, dan tombol reset mengembalikan ke 0. */
export default function LabeledNominalInput({ preset = PRESET_NOMINAL, value, onValueChange, ...props }: {
  /** Daftar nominal cepat di panel atas. */
  preset?: number[];
  /** Nilai terkontrol (teks angka). */
  value: string;
  /** Dipanggil tiap nilai berubah — diketik, ditempel dari angka, atau nominal. */
  onValueChange: (nilai: string) => void;
} & Omit<React.ComponentProps<typeof LabeledTextInput>, 'aksiKanan' | 'type' | 'tipeKontrol' | 'value' | 'onChange' | 'defaultValue'>) {
  return (
    <LabeledTextInput
      nama="nominal"
      tipeKontrol="nominal"
      /* Preset non-bawaan hanya untuk kotak ini: aksiKanan tipe `nominal`
         di-override dengan preset milik pemanggil. */
      bawaanTipe={preset === PRESET_NOMINAL ? undefined : { aksiKanan: (ctx) => <AksiKananNominal {...ctx} preset={preset} /> }}
      {...props}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    />
  );
}