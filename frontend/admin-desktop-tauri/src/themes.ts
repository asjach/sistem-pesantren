// Galeri tema Top Populer ala VSCode — data-driven.
// Tiap tema: 3 warna inti per wajah (latar, teks, aksen) + pasangan sidebar.
// Kartu, border, secondary, muted DITURUNKAN via color-mix di index.css,
// jadi menambah tema = 1 objek di sini (tanpa sentuh CSS).
// Palet dirujuk dari repositori resmi masing-masing tema (Sept 2026).
// File ini mandiri (tanpa import) agar bisa dibaca skrip cek-kontras Node.

export interface TemaWajah {
  /** Latar halaman. */
  bg: string;
  /** Teks utama. */
  fg: string;
  /** Aksen (tombol, ring fokus, badge). Teks di atasnya dihitung otomatis. */
  accent: string;
}

export interface TemaPreset {
  id: string;
  nama: string;
  terang: TemaWajah;
  gelap: TemaWajah;
  /** Sidebar (dipakai di kedua mode). */
  sidebar: string;
  sidebarDeep: string;
}

export type ThemeName =
  | 'hijau' | 'monokai' | 'onedark' | 'dracula' | 'nord'
  | 'tokyo' | 'nightowl' | 'solarized' | 'github' | 'palenight'
  | 'gruvbox' | 'catppuccin' | 'ayu' | 'cobalt' | 'synthwave'
  | 'shadesofpurple' | 'tomorrow' | 'horizon' | 'panda' | 'winter'
  | 'rosepine' | 'geist'
  | 'kustom';

export const THEME_PRESETS: TemaPreset[] = [
  {
    id: 'hijau', nama: 'Hijau Pesantren',
    terang: { bg: '#f2f5f1', fg: '#1d241e', accent: '#2c5c38' },
    gelap: { bg: '#101511', fg: '#e8ede8', accent: '#2c5c38' },
    sidebar: '#17351f', sidebarDeep: '#122b1a',
  },
  {
    id: 'monokai', nama: 'Monokai',
    terang: { bg: '#fdf7f9', fg: '#22201f', accent: '#c81e5b' },
    gelap: { bg: '#272822', fg: '#f8f8f2', accent: '#f92672' },
    sidebar: '#1e1f1c', sidebarDeep: '#171814',
  },
  {
    id: 'onedark', nama: 'One Dark Pro',
    terang: { bg: '#f4f8fd', fg: '#1b2026', accent: '#2b64d8' },
    gelap: { bg: '#282c34', fg: '#abb2bf', accent: '#61afef' },
    sidebar: '#21252b', sidebarDeep: '#1b1f23',
  },
  {
    id: 'dracula', nama: 'Dracula',
    terang: { bg: '#faf7fd', fg: '#211c26', accent: '#7c3aed' },
    gelap: { bg: '#282a36', fg: '#f8f8f2', accent: '#bd93f9' },
    sidebar: '#21222c', sidebarDeep: '#191a21',
  },
  {
    id: 'nord', nama: 'Nord',
    terang: { bg: '#f4f8fa', fg: '#1b232a', accent: '#2e7d96' },
    gelap: { bg: '#2e3440', fg: '#eceff4', accent: '#88c0d0' },
    sidebar: '#272c36', sidebarDeep: '#212630',
  },
  {
    id: 'tokyo', nama: 'Tokyo Night',
    terang: { bg: '#e1e2e7', fg: '#343b58', accent: '#34548a' },
    gelap: { bg: '#1a1b26', fg: '#c0caf5', accent: '#7aa2f7' },
    sidebar: '#16161e', sidebarDeep: '#0f0f14',
  },
  {
    id: 'nightowl', nama: 'Night Owl',
    terang: { bg: '#fbfbfb', fg: '#403f53', accent: '#3b62c4' },
    gelap: { bg: '#011627', fg: '#d6deeb', accent: '#7fdbca' },
    sidebar: '#011627', sidebarDeep: '#010e1a',
  },
  {
    id: 'solarized', nama: 'Solarized',
    terang: { bg: '#fdf6e3', fg: '#586e75', accent: '#268bd2' },
    gelap: { bg: '#002b36', fg: '#839496', accent: '#268bd2' },
    sidebar: '#073642', sidebarDeep: '#00212b',
  },
  {
    id: 'github', nama: 'GitHub',
    terang: { bg: '#ffffff', fg: '#1f2328', accent: '#0969da' },
    gelap: { bg: '#0d1117', fg: '#e6edf3', accent: '#4493f8' },
    sidebar: '#0d1117', sidebarDeep: '#010409',
  },
  {
    id: 'palenight', nama: 'Material Palenight',
    terang: { bg: '#f5f4f8', fg: '#373844', accent: '#7c3aed' },
    gelap: { bg: '#292d3e', fg: '#a6accd', accent: '#c792ea' },
    sidebar: '#232634', sidebarDeep: '#1b1d26',
  },
  {
    id: 'gruvbox', nama: 'Gruvbox',
    terang: { bg: '#fbf1c7', fg: '#3c3836', accent: '#79740e' },
    gelap: { bg: '#282828', fg: '#ebdbb2', accent: '#b8bb26' },
    sidebar: '#1d2021', sidebarDeep: '#141617',
  },
  {
    id: 'catppuccin', nama: 'Catppuccin Mocha',
    terang: { bg: '#eff1f5', fg: '#4c4f69', accent: '#8839ef' },
    gelap: { bg: '#1e1e2e', fg: '#cdd6f4', accent: '#cba6f7' },
    sidebar: '#181825', sidebarDeep: '#11111b',
  },
  {
    id: 'ayu', nama: 'Ayu Dark',
    terang: { bg: '#fafafa', fg: '#5c6166', accent: '#fa8d3e' },
    gelap: { bg: '#0a0e14', fg: '#b3b1ad', accent: '#ffb454' },
    sidebar: '#0a0e14', sidebarDeep: '#06090d',
  },
  {
    id: 'cobalt', nama: 'Cobalt2',
    terang: { bg: '#fbf6e9', fg: '#193549', accent: '#8f6f00' },
    gelap: { bg: '#193549', fg: '#ffffff', accent: '#ffc600' },
    sidebar: '#123043', sidebarDeep: '#0c2233',
  },
  {
    id: 'synthwave', nama: "SynthWave '84",
    terang: { bg: '#fbf0f7', fg: '#33262e', accent: '#c2257b' },
    gelap: { bg: '#262335', fg: '#ffffff', accent: '#ff7edb' },
    sidebar: '#241b2f', sidebarDeep: '#1a1428',
  },
  {
    id: 'shadesofpurple', nama: 'Shades of Purple',
    terang: { bg: '#f7f4ff', fg: '#2d2b55', accent: '#7c3aed' },
    gelap: { bg: '#2d2b55', fg: '#e9e6ff', accent: '#fad000' },
    sidebar: '#1e1e3f', sidebarDeep: '#16162c',
  },
  {
    id: 'tomorrow', nama: 'Tomorrow Night Blue',
    terang: { bg: '#f0f6fd', fg: '#002451', accent: '#0a58ca' },
    gelap: { bg: '#002451', fg: '#ffffff', accent: '#bbdaff' },
    sidebar: '#001c40', sidebarDeep: '#001126',
  },
  {
    id: 'horizon', nama: 'Horizon',
    terang: { bg: '#faf4ef', fg: '#2f2b28', accent: '#be185d' },
    gelap: { bg: '#1c1e26', fg: '#fdf0ed', accent: '#e95378' },
    sidebar: '#1e2028', sidebarDeep: '#14151b',
  },
  {
    id: 'panda', nama: 'Panda',
    terang: { bg: '#f5f5f5', fg: '#242526', accent: '#0a6bc2' },
    gelap: { bg: '#292a2b', fg: '#e6e6e6', accent: '#45a9f9' },
    sidebar: '#242526', sidebarDeep: '#1b1c1d',
  },
  {
    id: 'winter', nama: 'Winter is Coming',
    terang: { bg: '#edf6fd', fg: '#0b2536', accent: '#03648a' },
    gelap: { bg: '#011627', fg: '#a7dbf7', accent: '#219fd5' },
    sidebar: '#011627', sidebarDeep: '#010e1a',
  },
  {
    id: 'rosepine', nama: 'Rosé Pine',
    terang: { bg: '#faf4ed', fg: '#575279', accent: '#907aa9' },
    gelap: { bg: '#232136', fg: '#e0def4', accent: '#c4a7e7' },
    sidebar: '#1f1d2e', sidebarDeep: '#191724',
  },
  {
    id: 'geist', nama: 'Vercel Geist',
    terang: { bg: '#ffffff', fg: '#09090b', accent: '#18181b' },
    gelap: { bg: '#09090b', fg: '#fafafa', accent: '#e4e4e7' },
    sidebar: '#0a0a0a', sidebarDeep: '#000000',
  },
];

export const PRESET_IDS: string[] = THEME_PRESETS.map((t) => t.id);

export function findPreset(id: string | null | undefined): TemaPreset {
  return THEME_PRESETS.find((t) => t.id === id) ?? THEME_PRESETS[0];
}
