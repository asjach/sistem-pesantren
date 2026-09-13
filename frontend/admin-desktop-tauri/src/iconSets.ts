/** Katalog set ikon antarmuka (9 koleksi Iconify) — dipilih dari menu pengguna. */
export type IconSetId =
  | 'lucide'
  | 'tabler'
  | 'ph'
  | 'heroicons'
  | 'ri'
  | 'iconoir'
  | 'radix'
  | 'bi'
  | 'material';

export const ICON_SETS: { id: IconSetId; nama: string }[] = [
  { id: 'lucide', nama: 'Lucide' },
  { id: 'tabler', nama: 'Tabler Icons' },
  { id: 'ph', nama: 'Phosphor' },
  { id: 'heroicons', nama: 'Heroicons' },
  { id: 'ri', nama: 'Remix Icon' },
  { id: 'iconoir', nama: 'Iconoir' },
  { id: 'radix', nama: 'Radix Icons' },
  { id: 'bi', nama: 'Bootstrap Icons' },
  { id: 'material', nama: 'Material Symbols' },
];

export const ICON_SET_DEFAULT: IconSetId = 'lucide';
