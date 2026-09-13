/** Katalog jenis huruf untuk grid tabel DAN antarmuka (UI/UX).
 *  Font Google & Aptos dibundel lokal di src/assets/fonts — berjalan offline.
 *  Nilai opsi berformat "<font-family>|<font-weight>"; FONT_FAMILY_DEFAULT
 *  berarti ikut font & ketebalan bawaan aplikasi. */

/** Nilai SelectItem "ikut bawaan" (Radix tidak mengizinkan string kosong). */
export const FONT_FAMILY_DEFAULT = '_bawaan';

export interface FontOption {
  value: string;
  label: string;
  group: 'sistem' | 'google' | 'aptos';
}

export const FONT_OPTIONS: FontOption[] = [
  { value: FONT_FAMILY_DEFAULT, label: 'Bawaan', group: 'sistem' },
  // Font sistem (terpasang di OS pengguna).
  { value: '"Helvetica Neue", Helvetica, Arial, sans-serif|400', label: 'Helvetica Neue', group: 'sistem' },
  { value: '"Helvetica Neue", Helvetica, Arial, sans-serif|300', label: 'Helvetica Neue Light', group: 'sistem' },
  { value: '"Segoe UI", "Noto Sans", Roboto, Arial, sans-serif|400', label: 'Segoe UI', group: 'sistem' },
  { value: 'Calibri, Candara, "Segoe UI", Optima, sans-serif|400', label: 'Calibri', group: 'sistem' },
  { value: 'Arial, "Helvetica Neue", Helvetica, sans-serif|400', label: 'Arial', group: 'sistem' },
  { value: 'Tahoma, Geneva, sans-serif|400', label: 'Tahoma', group: 'sistem' },
  { value: '"Trebuchet MS", Tahoma, sans-serif|400', label: 'Trebuchet MS', group: 'sistem' },
  { value: '"Lucida Sans Unicode", "Lucida Grande", sans-serif|400', label: 'Lucida Sans', group: 'sistem' },
  // Aptos & Aptos Narrow — dibundel lokal di src/assets/fonts (berjalan offline).
  { value: '"Aptos", sans-serif|400', label: 'Aptos', group: 'aptos' },
  { value: '"Aptos", sans-serif|700', label: 'Aptos Bold', group: 'aptos' },
  { value: '"Aptos Narrow", sans-serif|400', label: 'Aptos Narrow', group: 'aptos' },
  { value: '"Aptos Narrow", sans-serif|700', label: 'Aptos Narrow Bold', group: 'aptos' },
  // Google Fonts — sudah diunduh ke src/assets/fonts (berjalan offline).
  { value: '"Inter", sans-serif|300', label: 'Inter Light', group: 'google' },
  { value: '"Inter", sans-serif|400', label: 'Inter', group: 'google' },
  { value: '"Roboto", sans-serif|300', label: 'Roboto Light', group: 'google' },
  { value: '"Roboto", sans-serif|400', label: 'Roboto', group: 'google' },
  { value: '"Open Sans", sans-serif|300', label: 'Open Sans Light', group: 'google' },
  { value: '"Open Sans", sans-serif|400', label: 'Open Sans', group: 'google' },
  { value: '"Lato", sans-serif|300', label: 'Lato Light', group: 'google' },
  { value: '"Lato", sans-serif|400', label: 'Lato', group: 'google' },
  { value: '"Noto Sans", sans-serif|300', label: 'Noto Sans Light', group: 'google' },
  { value: '"Noto Sans", sans-serif|400', label: 'Noto Sans', group: 'google' },
  { value: '"Source Sans 3", sans-serif|300', label: 'Source Sans 3 Light', group: 'google' },
  { value: '"Source Sans 3", sans-serif|400', label: 'Source Sans 3', group: 'google' },
  { value: '"Work Sans", sans-serif|300', label: 'Work Sans Light', group: 'google' },
  { value: '"Work Sans", sans-serif|400', label: 'Work Sans', group: 'google' },
  { value: '"Plus Jakarta Sans", sans-serif|300', label: 'Plus Jakarta Sans Light', group: 'google' },
  { value: '"Plus Jakarta Sans", sans-serif|400', label: 'Plus Jakarta Sans', group: 'google' },
];

/** Pisahkan nilai opsi menjadi keluarga huruf & ketebalan. */
export function fontParts(value: string): { family: string; weight: string } {
  const [family, weight] = value.split('|');
  return { family, weight: weight || '400' };
}
