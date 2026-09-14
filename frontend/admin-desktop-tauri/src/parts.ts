import { FONT_FAMILY_DEFAULT, FONT_OPTIONS } from './fonts';
/** Daftar "belum dipakai" dihasilkan otomatis (scripts/audit-bagian.mjs). */
import { BELUM_DIPAKAI } from './parts-belum.gen';

/** Bagian UI yang bisa diatur atomik (Pengaturan → Bagian UI). Mencakup
 *  seluruh komponen shadcn/ui (dipakai maupun belum) + bagian struktural app.
 *  `font`, `size`, dan `kotak` (border/radius/padding) berlaku untuk KEDUA mode;
 *  hanya warna (bg/fg/border) yang dipisah per mode terang/gelap.
 *  Tiap bagian punya `sel` (selektor akar) untuk generator gaya runtime
 *  (src/partStyles.ts); sebagian memakai atribut `data-part` yang dipasang di
 *  komponen (TopBar, ExcelTable), sisanya `data-slot` komponen shadcn atau
 *  selektor struktural yang sudah ada. */
export type PartId =
  | 'ribbon'
  | 'tab_ribbon'
  | 'area_akun'
  | 'grup_ribbon'
  | 'menu_ribbon'
  | 'separator'
  | 'aspect_ratio'
  | 'scroll_area'
  | 'resizable'
  | 'collapsible'
  | 'tabs'
  | 'breadcrumb'
  | 'pagination'
  | 'menubar'
  | 'navigation_menu'
  | 'sidebar'
  | 'daftar_bagian'
  | 'judul_halaman'
  | 'subjudul'
  | 'teks_isi'
  | 'kartu'
  | 'badge'
  | 'kbd'
  | 'item'
  | 'empty'
  | 'accordion'
  | 'tabel_header'
  | 'tabel_sel'
  | 'tabel'
  | 'pager'
  | 'toolbar_tabel'
  | 'label_form'
  | 'input_form'
  | 'field'
  | 'keterangan_field'
  | 'input_group'
  | 'textarea'
  | 'checkbox'
  | 'radio'
  | 'switch'
  | 'slider'
  | 'input_otp'
  | 'calendar'
  | 'tombol'
  | 'toggle'
  | 'button_group'
  | 'dropdown'
  | 'popover'
  | 'hover_card'
  | 'tooltip'
  | 'command'
  | 'dialog'
  | 'sheet'
  | 'drawer'
  | 'alert'
  | 'progress'
  | 'skeleton'
  | 'spinner'
  | 'toast'
  | 'avatar'
  | 'carousel'
  | 'chart'
  // Sub-komponen (anak dari bagian induk — lihat `induk`).
  | 'accordion_item'
  | 'accordion_judul'
  | 'accordion_isi'
  | 'item_media'
  | 'item_konten'
  | 'item_judul'
  | 'item_keterangan'
  | 'item_aksi'
  | 'dialog_header'
  | 'dialog_judul'
  | 'dialog_keterangan'
  | 'dialog_footer'
  | 'dialog_tombol'
  | 'menu_pemicu'
  | 'menu_item'
  | 'menu_label'
  | 'menu_separator'
  | 'menu_sub'
  | 'toggle_item'
  | 'resizable_panel'
  | 'resizable_handle'
  | 'checkbox_indikator'
  | 'select_value'
  // Komponen khas aplikasi (bukan shadcn).
  | 'multiselect'
  | 'spinbox'
  | 'pesan_galat'
  | 'pemisah_ribbon';

export type PartMode = 'terang' | 'gelap';

/** Preset bayangan (box-shadow) untuk bagian. */
export type BayanganName = 'none' | 'sm' | 'md' | 'lg';
export const BAYANGAN: { id: BayanganName; label: string }[] = [
  { id: 'none', label: 'Tanpa' },
  { id: 'sm', label: 'Kecil' },
  { id: 'md', label: 'Sedang' },
  { id: 'lg', label: 'Besar' },
];

/** Tipografi & kotak — SATU set untuk kedua mode. Field kosong = bawaan. */
export interface PartGaya {
  /** Nilai opsi src/fonts.ts ("<family>|<weight>"); `_bawaan` tidak disimpan. */
  font?: string;
  size?: number;
  borderW?: number;
  radius?: number;
  padX?: number;
  padY?: number;
  /** Kotak lanjutan (px) — hanya berlaku untuk elemen akar bagian. */
  height?: number;
  minWidth?: number;
  gap?: number;
  margin?: number;
  /** Kelegapan 0–100 (%). */
  opacity?: number;
  /** Preset bayangan. */
  shadow?: BayanganName;
}

/** Warna — dipisah per mode. Field kosong = bawaan. */
export interface PartWarna {
  bg?: string;
  fg?: string;
  border?: string;
}

export type PetaGaya = Partial<Record<PartId, PartGaya>>;
export type PetaWarna = Partial<Record<PartId, PartWarna>>;

export interface PartOverrides {
  /** Tipografi & kotak (berlaku kedua mode). */
  gaya: PetaGaya;
  /** Warna mode terang. */
  terang: PetaWarna;
  /** Warna mode gelap. */
  gelap: PetaWarna;
}

export interface PartMeta {
  id: PartId;
  label: string;
  grup: string;
  /** Sub-kelompok di dalam grup (dua tingkat di daftar Bagian UI). */
  sub?: string;
  /** Bagian kontrol/overlay: boleh menimpa seluruh isinya (termasuk kontrol).
   *  Bagian kontainer tidak menimpa kontrol di dalamnya (tombol/input/label/
   *  badge/dropdown/dialog punya pengaturannya sendiri) agar proporsi terjaga. */
  kendali?: boolean;
  /** Selektor elemen pengukuran nilai bawaan di pratinjau (opsional). */
  ukurSel?: string;
  hint: string;
  /** Selektor akar bagian (digabung otomatis dengan scope mode terang/gelap). */
  sel: string;
  /** Belum ada elemen/komponen nyata di aplikasi — pengaturan hanya tampak di
   *  pratinjau editor, tidak berpengaruh ke halaman. */
  belumDipakai?: boolean;
  /** Bagian induk (untuk sub-komponen). Anak ditampilkan bersarang di bawah
   *  induknya pada daftar Bagian UI dan boleh diatur terpisah. */
  induk?: PartId;
}

export const PARTS: PartMeta[] = [
  // ---------- Struktur ----------
  {
    id: 'ribbon',
    label: 'Bilah ribbon',
    grup: 'Struktur',
    sub: 'Ribbon',
    hint: 'Strip atas berisi tab & panel menu.',
    sel: '#root header',
  },
  {
    id: 'tab_ribbon',
    label: 'Tab ribbon',
    grup: 'Struktur',
    sub: 'Ribbon',
    kendali: true,
    hint: 'Tombol tab (Beranda, Master, …).',
    sel: "#root header button[id^='tab_ribbon_']",
  },
  {
    id: 'area_akun',
    label: 'Area akun (kanan atas)',
    grup: 'Struktur',
    sub: 'Ribbon',
    kendali: true,
    hint: 'Area kanan atas strip ribbon: tombol mode & menu akun.',
    sel: "[data-part='area_akun']",
  },
  {
    id: 'grup_ribbon',
    label: 'Grup ribbon',
    grup: 'Struktur',
    sub: 'Grup & menu',
    hint: 'Label & wadah kelompok tombol di ribbon.',
    sel: "[data-part='grup_ribbon']",
  },
  {
    id: 'menu_ribbon',
    label: 'Tombol menu ribbon',
    grup: 'Struktur',
    sub: 'Grup & menu',
    kendali: true,
    hint: 'Tombol besar navigasi per halaman.',
    sel: "[data-part='menu_ribbon']",
  },
  {
    id: 'separator',
    label: 'Separator',
    grup: 'Struktur',
    sub: 'Bingkai',
    hint: 'Garis pemisah antar seksi.',
    sel: "[data-slot='separator']",
  },
  {
    id: 'aspect_ratio',
    label: 'Aspect Ratio',
    grup: 'Struktur',
    sub: 'Bingkai',
    hint: 'Wadah rasio aspek (foto/media).',
    sel: "[data-slot='aspect-ratio']",
  },
  {
    id: 'scroll_area',
    label: 'Scroll Area',
    grup: 'Struktur',
    sub: 'Bingkai',
    hint: 'Wadah dengan scrollbar kustom.',
    sel: "[data-slot='scroll-area']",
  },
  {
    id: 'resizable',
    label: 'Resizable',
    grup: 'Struktur',
    sub: 'Bingkai',
    hint: 'Panel resizable (split view).',
    sel: "[data-slot='resizable-panel-group']",
  },
  {
    id: 'collapsible',
    label: 'Collapsible',
    grup: 'Struktur',
    sub: 'Bingkai',
    hint: 'Wadah konten yang bisa dilipat.',
    sel: "[data-slot='collapsible']",
  },

  // ---------- Navigasi ----------
  {
    id: 'tabs',
    label: 'Tabs',
    grup: 'Navigasi',
    sub: 'Menu',
    kendali: true,
    hint: 'Tab konten (list, trigger, isi).',
    sel: "[data-slot='tabs'], [data-slot='tabs-list'], [data-slot='tabs-trigger'], [data-slot='tabs-content']",
  },
  {
    id: 'breadcrumb',
    label: 'Breadcrumb',
    grup: 'Navigasi',
    sub: 'Menu',
    hint: 'Jejak navigasi halaman.',
    sel: "[data-slot='breadcrumb']",
  },
  {
    id: 'pagination',
    label: 'Pagination',
    grup: 'Navigasi',
    sub: 'Menu',
    kendali: true,
    hint: 'Navigasi halaman (komponen pagination).',
    sel: "[data-slot='pagination']",
  },
  {
    id: 'menubar',
    label: 'Menubar',
    grup: 'Navigasi',
    sub: 'Bilah',
    kendali: true,
    hint: 'Bilah menu aplikasi.',
    sel: "[data-slot='menubar'], [data-slot='menubar-content']",
  },
  {
    id: 'navigation_menu',
    label: 'Navigation Menu',
    grup: 'Navigasi',
    sub: 'Bilah',
    kendali: true,
    hint: 'Menu navigasi dengan submenu.',
    sel: "[data-slot='navigation-menu'], [data-slot='navigation-menu-viewport']",
  },
  {
    id: 'sidebar',
    label: 'Sidebar',
    grup: 'Navigasi',
    sub: 'Bilah',
    kendali: true,
    hint: 'Sidebar aplikasi (komponen sidebar).',
    sel: "[data-slot='sidebar'], [data-slot='sidebar-container']",
  },
  {
    id: 'daftar_bagian',
    label: 'Daftar bagian UI',
    grup: 'Navigasi',
    sub: 'Bilah',
    kendali: true,
    hint: 'Tombol daftar bagian di halaman Bagian UI (editor).',
    sel: "[data-part='daftar_bagian']",
  },

  // ---------- Teks ----------
  {
    id: 'judul_halaman',
    label: 'Judul halaman',
    grup: 'Teks',
    sub: 'Judul',
    hint: 'Heading utama halaman (H1–H2).',
    sel: '#root main :is(h1, h2)',
  },
  {
    id: 'subjudul',
    label: 'Subjudul / seksi',
    grup: 'Teks',
    sub: 'Judul',
    hint: 'Heading kecil pemisah seksi (H3–H4).',
    sel: '#root main :is(h3, h4)',
  },
  {
    id: 'teks_isi',
    label: 'Area konten',
    grup: 'Teks',
    sub: 'Konten',
    hint: 'Area konten di bawah ribbon (paragraf & isi halaman).',
    sel: '#root main',
  },
  {
    id: 'kartu',
    label: 'Card',
    grup: 'Teks',
    sub: 'Konten',
    hint: 'Panel ber-border / komponen card.',
    sel: "#root main section, [data-slot='card']",
  },
  {
    id: 'badge',
    label: 'Badge',
    grup: 'Teks',
    sub: 'Konten',
    kendali: true,
    hint: 'Label kecil status.',
    sel: "[data-slot='badge']",
  },
  {
    id: 'kbd',
    label: 'Kbd',
    grup: 'Teks',
    sub: 'Konten',
    hint: 'Label pintasan keyboard.',
    sel: "[data-slot='kbd']",
  },
  {
    id: 'item',
    label: 'Item',
    grup: 'Teks',
    sub: 'Konten',
    hint: 'Baris item serbaguna (item, media + aksi).',
    sel: "[data-slot='item'], [data-slot='item-group']",
  },
  {
    id: 'empty',
    label: 'Empty',
    grup: 'Teks',
    sub: 'Konten',
    hint: 'Tampilan saat data kosong.',
    sel: "[data-slot='empty']",
  },
  {
    id: 'accordion',
    label: 'Accordion',
    grup: 'Teks',
    sub: 'Konten',
    kendali: true,
    hint: 'Daftar lipat (item, header, isi).',
    sel: "[data-slot='accordion']",
  },

  // ---------- Tabel ----------
  {
    id: 'tabel_header',
    label: 'Header tabel grid',
    grup: 'Tabel',
    sub: 'Grid',
    ukurSel: '.dsg-cell-header-container',
    hint: 'Baris judul kolom grid spreadsheet.',
    sel: '.simpes-dsg .dsg-row.dsg-row-header',
  },
  {
    id: 'tabel_sel',
    label: 'Sel tabel grid',
    grup: 'Tabel',
    sub: 'Grid',
    ukurSel: '.dsg-cell',
    hint: 'Isi sel grid (baca-saja & editor).',
    sel: '.simpes-dsg',
  },
  {
    id: 'tabel',
    label: 'Table',
    grup: 'Tabel',
    sub: 'Table',
    hint: 'Komponen table (header, baris, sel).',
    sel: "[data-slot='table']",
  },
  {
    id: 'pager',
    label: 'Pager',
    grup: 'Tabel',
    sub: 'Bilah bantu',
    hint: 'Footer halaman tabel (Hal x / y).',
    sel: '#pager',
  },
  {
    id: 'toolbar_tabel',
    label: 'Toolbar tabel',
    grup: 'Tabel',
    sub: 'Bilah bantu',
    hint: 'Bilah atas tabel (info baris, tombol aksi).',
    sel: "[data-part='toolbar_tabel']",
  },

  // ---------- Kontrol ----------
  {
    id: 'label_form',
    label: 'Label',
    grup: 'Kontrol',
    sub: 'Form',
    induk: 'field',
    kendali: true,
    hint: 'Label di atas input.',
    sel: "[data-slot='label'], [data-slot='field-label']",
  },
  {
    id: 'input_form',
    label: 'Input / Select',
    grup: 'Kontrol',
    sub: 'Form',
    kendali: true,
    hint: 'Kotak isian dan select.',
    sel: "[data-slot='input'], [data-slot='select-trigger']",
  },
  {
    id: 'field',
    label: 'Field',
    grup: 'Kontrol',
    sub: 'Form',
    hint: 'Pembungkus field (label + kontrol + keterangan).',
    sel: "[data-slot='field'], [data-slot='field-set'], [data-slot='field-legend'], [data-slot='field-group'], [data-slot='field-content'], [data-slot='field-title'], [data-slot='field-separator'], [data-slot='field-separator-content'], [data-slot='field-error']",
  },
  {
    id: 'keterangan_field',
    label: 'Keterangan field',
    grup: 'Kontrol',
    sub: 'Form',
    induk: 'field',
    hint: 'Teks bantuan di bawah kotak isian (field description).',
    sel: "[data-slot='field-description']",
  },
  {
    id: 'input_group',
    label: 'Input Group',
    grup: 'Kontrol',
    sub: 'Form',
    kendali: true,
    hint: 'Input dengan addon (ikon/teks) menyatu.',
    sel: "[data-slot='input-group']",
  },
  {
    id: 'textarea',
    label: 'Textarea',
    grup: 'Kontrol',
    sub: 'Form',
    kendali: true,
    hint: 'Kotak isian multi-baris.',
    sel: "[data-slot='textarea']",
  },
  {
    id: 'checkbox',
    label: 'Checkbox',
    grup: 'Kontrol',
    sub: 'Form',
    kendali: true,
    hint: 'Kotak centang.',
    sel: "[data-slot='checkbox']",
  },
  {
    id: 'radio',
    label: 'Radio Group',
    grup: 'Kontrol',
    sub: 'Form',
    kendali: true,
    hint: 'Pilihan tunggal (radio group).',
    sel: "[data-slot='radio-group'], [data-slot='radio-group-item']",
  },
  {
    id: 'switch',
    label: 'Switch',
    grup: 'Kontrol',
    sub: 'Form',
    kendali: true,
    hint: 'Sakelar on/off.',
    sel: "[data-slot='switch']",
  },
  {
    id: 'slider',
    label: 'Slider',
    grup: 'Kontrol',
    sub: 'Form',
    kendali: true,
    hint: 'Penggeser nilai.',
    sel: "[data-slot='slider']",
  },
  {
    id: 'input_otp',
    label: 'Input OTP',
    grup: 'Kontrol',
    sub: 'Form',
    kendali: true,
    hint: 'Isian kode sekali pakai.',
    sel: "[data-slot='input-otp']",
  },
  {
    id: 'calendar',
    label: 'Calendar',
    grup: 'Kontrol',
    sub: 'Form',
    kendali: true,
    hint: 'Pemilih tanggal.',
    sel: "[data-slot='calendar']",
  },
  {
    id: 'tombol',
    label: 'Button',
    grup: 'Kontrol',
    sub: 'Aksi',
    kendali: true,
    hint: 'Semua tombol & tombol ikon aksi.',
    sel: "[data-slot='button']",
  },
  {
    id: 'toggle',
    label: 'Toggle',
    grup: 'Kontrol',
    sub: 'Aksi',
    kendali: true,
    hint: 'Tombol toggle & grup toggle.',
    sel: "[data-slot='toggle'], [data-slot='toggle-group']",
  },
  {
    id: 'button_group',
    label: 'Button Group',
    grup: 'Kontrol',
    sub: 'Aksi',
    kendali: true,
    hint: 'Deretan tombol menyatu.',
    sel: "[data-slot='button-group']",
  },

  // ---------- Overlay ----------
  {
    id: 'dropdown',
    label: 'Dropdown Menu',
    grup: 'Overlay',
    sub: 'Melayang',
    kendali: true,
    hint: 'Menu melayang, pilihan select, menu klik-kanan.',
    sel: "[data-slot='dropdown-menu-content'], [data-slot='context-menu-content'], [data-slot='select-content']",
  },
  {
    id: 'popover',
    label: 'Popover',
    grup: 'Overlay',
    sub: 'Melayang',
    kendali: true,
    hint: 'Panel melayang yang bisa diisi apa pun.',
    sel: "[data-slot='popover-content']",
  },
  {
    id: 'hover_card',
    label: 'Hover Card',
    grup: 'Overlay',
    sub: 'Melayang',
    kendali: true,
    hint: 'Kartu informasi saat kursor diarahkan.',
    sel: "[data-slot='hover-card-content']",
  },
  {
    id: 'tooltip',
    label: 'Tooltip',
    grup: 'Overlay',
    sub: 'Melayang',
    kendali: true,
    hint: 'Keterangan singkat saat hover.',
    sel: "[data-slot='tooltip-content']",
  },
  {
    id: 'command',
    label: 'Command',
    grup: 'Overlay',
    sub: 'Melayang',
    kendali: true,
    hint: 'Palet perintah / pencarian dengan daftar.',
    sel: "[data-slot='command']",
  },
  {
    id: 'dialog',
    label: 'Dialog',
    grup: 'Overlay',
    sub: 'Panel',
    kendali: true,
    hint: 'Jendela dialog & konfirmasi.',
    sel: "[data-slot='dialog-content'], [data-slot='alert-dialog-content'], [data-slot='dialog-close']",
  },
  {
    id: 'sheet',
    label: 'Sheet',
    grup: 'Overlay',
    sub: 'Panel',
    kendali: true,
    hint: 'Panel geser dari tepi layar.',
    sel: "[data-slot='sheet-content']",
  },
  {
    id: 'drawer',
    label: 'Drawer',
    grup: 'Overlay',
    sub: 'Panel',
    kendali: true,
    hint: 'Panel bawah ala mobile.',
    sel: "[data-slot='drawer-content']",
  },

  // ---------- Umpan balik ----------
  {
    id: 'alert',
    label: 'Alert',
    grup: 'Umpan balik',
    sub: 'Status',
    hint: 'Pesan penting (info/peringatan/error).',
    sel: "[data-slot='alert']",
  },
  {
    id: 'progress',
    label: 'Progress',
    grup: 'Umpan balik',
    sub: 'Status',
    hint: 'Bilah kemajuan.',
    sel: "[data-slot='progress']",
  },
  {
    id: 'skeleton',
    label: 'Skeleton',
    grup: 'Umpan balik',
    sub: 'Status',
    hint: 'Placeholder saat memuat.',
    sel: "[data-slot='skeleton']",
  },
  {
    id: 'spinner',
    label: 'Spinner',
    grup: 'Umpan balik',
    sub: 'Status',
    hint: 'Indikator memuat berputar.',
    sel: "[data-slot='spinner']",
  },
  {
    id: 'toast',
    label: 'Sonner',
    grup: 'Umpan balik',
    sub: 'Status',
    kendali: true,
    hint: 'Notifikasi mengambang (sonner).',
    sel: '[data-sonner-toast], [data-sonner-toast] [data-title], [data-sonner-toast] [data-description], [data-sonner-toast] [data-button]',
  },

  // ---------- Media ----------
  {
    id: 'avatar',
    label: 'Avatar',
    grup: 'Media',
    sub: 'Media',
    hint: 'Foto/inisial pengguna.',
    sel: "[data-slot='avatar']",
  },
  {
    id: 'carousel',
    label: 'Carousel',
    grup: 'Media',
    sub: 'Media',
    kendali: true,
    hint: 'Slideshow geser.',
    sel: "[data-slot='carousel']",
  },
  {
    id: 'chart',
    label: 'Chart',
    grup: 'Media',
    sub: 'Media',
    hint: 'Wadah grafik.',
    sel: "[data-slot='chart']",
  },

  // ---------- Sub-komponen (anak dari induk di atas) ----------
  // Accordion
  {
    id: 'accordion_item',
    label: 'Item',
    grup: 'Teks',
    sub: 'Konten',
    induk: 'accordion',
    hint: 'Satu baris accordion.',
    sel: "[data-slot='accordion-item']",
  },
  {
    id: 'accordion_judul',
    label: 'Judul (trigger)',
    grup: 'Teks',
    sub: 'Konten',
    induk: 'accordion',
    hint: 'Judul yang diklik untuk membuka/menutup.',
    sel: "[data-slot='accordion-trigger']",
  },
  {
    id: 'accordion_isi',
    label: 'Isi',
    grup: 'Teks',
    sub: 'Konten',
    induk: 'accordion',
    hint: 'Isi yang dilipat.',
    sel: "[data-slot='accordion-content']",
  },
  // Item
  {
    id: 'item_media',
    label: 'Media',
    grup: 'Teks',
    sub: 'Konten',
    induk: 'item',
    hint: 'Ikon/avatar/foto di awal item.',
    sel: "[data-slot='item-media']",
  },
  {
    id: 'item_konten',
    label: 'Isi',
    grup: 'Teks',
    sub: 'Konten',
    induk: 'item',
    hint: 'Wadah judul + keterangan item.',
    sel: "[data-slot='item-content']",
  },
  {
    id: 'item_judul',
    label: 'Judul',
    grup: 'Teks',
    sub: 'Konten',
    induk: 'item',
    hint: 'Judul utama item.',
    sel: "[data-slot='item-title']",
  },
  {
    id: 'item_keterangan',
    label: 'Keterangan',
    grup: 'Teks',
    sub: 'Konten',
    induk: 'item',
    hint: 'Baris keterangan di bawah judul item.',
    sel: "[data-slot='item-description']",
  },
  {
    id: 'item_aksi',
    label: 'Aksi / header / footer',
    grup: 'Teks',
    sub: 'Konten',
    induk: 'item',
    hint: 'Area aksi, header, dan footer item.',
    sel: "[data-slot='item-actions'], [data-slot='item-header'], [data-slot='item-footer'], [data-slot='item-group']",
  },
  // Dialog
  {
    id: 'dialog_header',
    label: 'Header',
    grup: 'Overlay',
    sub: 'Panel',
    induk: 'dialog',
    hint: 'Area header dialog.',
    sel: "[data-slot='dialog-header'], [data-slot='alert-dialog-header']",
  },
  {
    id: 'dialog_judul',
    label: 'Judul',
    grup: 'Overlay',
    sub: 'Panel',
    induk: 'dialog',
    hint: 'Judul dialog.',
    sel: "[data-slot='dialog-title'], [data-slot='alert-dialog-title']",
  },
  {
    id: 'dialog_keterangan',
    label: 'Keterangan',
    grup: 'Overlay',
    sub: 'Panel',
    induk: 'dialog',
    hint: 'Deskripsi dialog.',
    sel: "[data-slot='dialog-description'], [data-slot='alert-dialog-description']",
  },
  {
    id: 'dialog_footer',
    label: 'Footer',
    grup: 'Overlay',
    sub: 'Panel',
    induk: 'dialog',
    hint: 'Area tombol di bawah dialog.',
    sel: "[data-slot='dialog-footer'], [data-slot='alert-dialog-footer']",
  },
  {
    id: 'dialog_tombol',
    label: 'Tombol aksi',
    grup: 'Overlay',
    sub: 'Panel',
    induk: 'dialog',
    hint: 'Tombol aksi/batal dialog konfirmasi.',
    sel: "[data-slot='alert-dialog-action'], [data-slot='alert-dialog-cancel']",
  },
  // Dropdown / menu
  {
    id: 'menu_pemicu',
    label: 'Pemicu',
    grup: 'Overlay',
    sub: 'Melayang',
    induk: 'dropdown',
    hint: 'Elemen yang diklik untuk membuka menu.',
    sel: "[data-slot='dropdown-menu-trigger'], [data-slot='context-menu-trigger']",
  },
  {
    id: 'menu_item',
    label: 'Item',
    grup: 'Overlay',
    sub: 'Melayang',
    induk: 'dropdown',
    hint: 'Baris pilihan pada menu/select.',
    sel: "[data-slot='dropdown-menu-item'], [data-slot='context-menu-item'], [data-slot='context-menu-checkbox-item'], [data-slot='select-item']",
  },
  {
    id: 'menu_label',
    label: 'Label',
    grup: 'Overlay',
    sub: 'Melayang',
    induk: 'dropdown',
    hint: 'Judul kelompok pada menu/select.',
    sel: "[data-slot='dropdown-menu-label'], [data-slot='context-menu-label'], [data-slot='select-label'], [data-slot='select-group']",
  },
  {
    id: 'menu_separator',
    label: 'Pemisah',
    grup: 'Overlay',
    sub: 'Melayang',
    induk: 'dropdown',
    hint: 'Garis pemisah antar kelompok menu.',
    sel: "[data-slot='dropdown-menu-separator'], [data-slot='context-menu-separator'], [data-slot='select-separator']",
  },
  {
    id: 'menu_sub',
    label: 'Sub-menu',
    grup: 'Overlay',
    sub: 'Melayang',
    induk: 'dropdown',
    hint: 'Pemicu & isi sub-menu bertingkat.',
    sel: "[data-slot='dropdown-menu-sub-trigger'], [data-slot='dropdown-menu-sub-content']",
  },
  // Toggle
  {
    id: 'toggle_item',
    label: 'Item toggle',
    grup: 'Kontrol',
    sub: 'Aksi',
    induk: 'toggle',
    hint: 'Tombol di dalam grup toggle.',
    sel: "[data-slot='toggle-group-item']",
  },
  // Resizable
  {
    id: 'resizable_panel',
    label: 'Panel',
    grup: 'Struktur',
    sub: 'Bingkai',
    induk: 'resizable',
    hint: 'Satu panel di dalam grup resizable.',
    sel: "[data-slot='resizable-panel']",
  },
  {
    id: 'resizable_handle',
    label: 'Pegangan',
    grup: 'Struktur',
    sub: 'Bingkai',
    induk: 'resizable',
    hint: 'Garis geser antar panel.',
    sel: "[data-slot='resizable-handle']",
  },
  // Checkbox
  {
    id: 'checkbox_indikator',
    label: 'Indikator centang',
    grup: 'Kontrol',
    sub: 'Form',
    induk: 'checkbox',
    hint: 'Ikon centang di dalam kotak.',
    sel: "[data-slot='checkbox-indicator']",
  },
  // Input / Select
  {
    id: 'select_value',
    label: 'Nilai select',
    grup: 'Kontrol',
    sub: 'Form',
    induk: 'input_form',
    hint: 'Teks nilai yang tampil pada select.',
    sel: "[data-slot='select-value']",
  },

  // ---------- Komponen khas aplikasi ----------
  {
    id: 'multiselect',
    label: 'Multi select',
    grup: 'Kontrol',
    sub: 'Form',
    kendali: true,
    hint: 'Pilih banyak nilai (dropdown bercentang).',
    sel: "[data-part='multiselect']",
  },
  {
    id: 'spinbox',
    label: 'Stepper angka (ribbon)',
    grup: 'Kontrol',
    sub: 'Form',
    kendali: true,
    hint: 'Spinbox −/+ untuk tinggi baris & ukuran huruf tabel.',
    sel: "[data-part='spinbox']",
  },
  {
    id: 'pesan_galat',
    label: 'Pesan galat',
    grup: 'Umpan balik',
    sub: 'Status',
    kendali: true,
    hint: 'Kotak pesan galat seragam di seluruh halaman.',
    sel: "[data-part='pesan_galat']",
  },
  {
    id: 'pemisah_ribbon',
    label: 'Pemisah ribbon',
    grup: 'Struktur',
    sub: 'Bingkai',
    hint: 'Garis pemisah antar grup di ribbon.',
    sel: "[data-part='pemisah_ribbon']",
  },
];

/** Bagian yang belum punya komponen/elemen nyata di aplikasi (hanya contoh di
 *  pratinjau) ditandai otomatis dari `scripts/audit-bagian.mjs`; lihat
 *  `src/parts-belum.gen.ts` (jangan diedit manual). */
for (const p of PARTS) {
  if (BELUM_DIPAKAI.has(p.id)) p.belumDipakai = true;
}

export const PART_IDS: PartId[] = PARTS.map((p) => p.id);
export const PART_BY_ID = new Map<PartId, PartMeta>(PARTS.map((p) => [p.id, p]));
export const PART_GROUPS: string[] = [...new Set(PARTS.map((p) => p.grup))];
export const EMPTY_PARTS: PartOverrides = { gaya: {}, terang: {}, gelap: {} };

const HEX = /^#[0-9a-f]{6}$/i;
const FONT_VALUES = new Set(FONT_OPTIONS.map((f) => f.value));
/** Rentang aman tiap properti numerik (px). */
export const RENTANG: Record<
  | 'size'
  | 'borderW'
  | 'radius'
  | 'padX'
  | 'padY'
  | 'height'
  | 'minWidth'
  | 'gap'
  | 'margin'
  | 'opacity',
  [number, number]
> = {
  size: [8, 72],
  borderW: [0, 8],
  radius: [0, 32],
  padX: [0, 64],
  padY: [0, 64],
  height: [0, 200],
  minWidth: [0, 800],
  gap: [0, 64],
  margin: [0, 64],
  opacity: [0, 100],
};

function angka(v: unknown, kunci: keyof typeof RENTANG): number | undefined {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return undefined;
  const [lo, hi] = RENTANG[kunci];
  const r = Math.round(n);
  return r < lo || r > hi ? undefined : r;
}

/** Validasi + bersihkan gaya tipografi/kotak (nilai asing dibuang). */
export function bersihkanGaya(v: unknown): PartGaya | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const s: PartGaya = {};
  if (typeof o.font === 'string' && o.font !== FONT_FAMILY_DEFAULT && FONT_VALUES.has(o.font)) {
    s.font = o.font;
  }
  for (const k of Object.keys(RENTANG) as (keyof typeof RENTANG)[]) {
    const n = angka(o[k], k);
    if (n != null) s[k] = n;
  }
  if (typeof o.shadow === 'string' && BAYANGAN.some((b) => b.id === o.shadow)) {
    s.shadow = o.shadow as BayanganName;
  }
  return Object.keys(s).length ? s : undefined;
}

/** Validasi + bersihkan warna bagian (hex saja; nilai asing dibuang). */
export function bersihkanWarna(v: unknown): PartWarna | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const s: PartWarna = {};
  for (const k of ['bg', 'fg', 'border'] as const) {
    const c = typeof o[k] === 'string' ? (o[k] as string).toLowerCase() : '';
    if (HEX.test(c)) s[k] = c;
  }
  return Object.keys(s).length ? s : undefined;
}

/** Validasi `simpes_parts` dari penyimpanan (aman terhadap data rusak).
 *  Bentuk lama (semua properti terpisah per mode) dimigrasi: properti
 *  tipografi/kotak diambil dari mode terang (fallback gelap); warna tetap
 *  dipertahankan per mode masing-masing. Properti usang (mis. lebar/tinggi)
 *  otomatis dibuang karena tidak ada di RENTANG. */
export function normalizeParts(v: unknown): PartOverrides {
  const hasil: PartOverrides = { gaya: {}, terang: {}, gelap: {} };
  if (!v || typeof v !== 'object') return hasil;
  const o = v as Record<string, unknown>;
  if (o.gaya && typeof o.gaya === 'object') {
    for (const id of PART_IDS) {
      const g = bersihkanGaya((o.gaya as Record<string, unknown>)[id]);
      if (g) hasil.gaya[id] = g;
    }
    for (const mode of ['terang', 'gelap'] as PartMode[]) {
      const src = o[mode];
      if (!src || typeof src !== 'object') continue;
      for (const id of PART_IDS) {
        const w = bersihkanWarna((src as Record<string, unknown>)[id]);
        if (w) hasil[mode][id] = w;
      }
    }
    return hasil;
  }
  const lamaTerang = (o.terang && typeof o.terang === 'object' ? o.terang : {}) as Record<string, unknown>;
  const lamaGelap = (o.gelap && typeof o.gelap === 'object' ? o.gelap : {}) as Record<string, unknown>;
  for (const id of PART_IDS) {
    const g = bersihkanGaya({ ...(lamaGelap[id] as object), ...(lamaTerang[id] as object) });
    if (g) hasil.gaya[id] = g;
    const wt = bersihkanWarna(lamaTerang[id]);
    if (wt) hasil.terang[id] = wt;
    const wg = bersihkanWarna(lamaGelap[id]);
    if (wg) hasil.gelap[id] = wg;
  }
  return hasil;
}

/** Gabung patch ke gaya; nilai `undefined` menghapus field (kosong = undefined). */
export function gabungGaya(ada: PartGaya | undefined, patch: Partial<PartGaya>): PartGaya | undefined {
  const next: PartGaya = { ...ada };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete next[k as keyof PartGaya];
    else (next as Record<string, unknown>)[k] = v;
  }
  return bersihkanGaya(next);
}

/** Gabung patch ke warna; nilai `undefined` menghapus field (kosong = undefined). */
export function gabungWarna(ada: PartWarna | undefined, patch: Partial<PartWarna>): PartWarna | undefined {
  const next: PartWarna = { ...ada };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete next[k as keyof PartWarna];
    else (next as Record<string, unknown>)[k] = v;
  }
  return bersihkanWarna(next);
}
