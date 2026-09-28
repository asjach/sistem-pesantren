/**
 * Bentuk data template cetak di sisi browser.
 *
 * Cerminan dari app/Services/Template/DefinisiMedan di backend. Milimeter
 * adalah satuan yang sama dengan TCPDF dan yang dibaca FPDI dari berkas PDF,
 * jadi tidak ada konversi yang tersembunyi di antara editor dan printer.
 */

/** Cara medan digambar di atas halaman PDF. */
export const TIPE_MEDAN = [
  'teks',
  'paragraf',
  'gambar',
  'centang',
  'tanda_tangan',
  'baris_berulang',
  'halaman_otomatis',
  'garis',
  'kotak',
] as const;

export type TipeMedan = (typeof TIPE_MEDAN)[number];

/** Tipe yang butuh posisi, ukuran, dan gaya teks. */
export const TIPE_BERPOSISI: TipeMedan[] = ['teks', 'paragraf', 'centang', 'halaman_otomatis'];

/** Tipe yang hanya menandai tempat, tidak mencetak apa pun. */
export const TIPE_TANDA: TipeMedan[] = ['tanda_tangan'];

/** Tipe yang mengisi kotak dengan baris koleksi. */
export const TIPE_BARIS: TipeMedan[] = ['baris_berulang'];

/**
 * Tipe gambar dekoratif: garis dan kotak.
 *
 * Isi medianya diisi medan lain; tipe ini hanya memakai sebagian ruang
 * halaman, jadi panel gaya huruf tidak relevan untuknya.
 */
export const TIPE_DEKORATIF: TipeMedan[] = ['garis', 'kotak'];

export const RATA = ['kiri', 'tengah', 'kanan'] as const;
export type Rata = (typeof RATA)[number];

export const SIZEMODE = ['sesuaikan', 'potong', 'asli'] as const;
export type Sizemode = (typeof SIZEMODE)[number];

/** Keluarga font yang tersedia untuk pencetakan PDF. */
export const FONT_PDF = ['helvetica', 'times', 'courier', 'dejavusans'] as const;
export type FontPdf = (typeof FONT_PDF)[number];

/** Sumber gambar untuk medan gambar. */
export const SUMBER_GAMBAR = ['santri', 'pegawai', 'lembaga', 'aset'] as const;
export type SumberGambar = (typeof SUMBER_GAMBAR)[number];

export const KATEGORI_TEMPLATE = [
  'surat',
  'sertifikat',
  'daftar',
  'rapor',
  'sk',
  'berita_acara',
  'lainnya',
] as const;
export type KategoriTemplate = (typeof KATEGORI_TEMPLATE)[number];

/**
 * Dua cara membuat halaman cetak.
 *
 * 'pdf' memakai berkas yang dirancang di luar aplikasi lalu diunggah.
 * 'html' tata letaknya digambar sendiri di desainer dan dicetak oleh dompdf.
 */
export const JENIS_TEMPLATE = ['pdf', 'html'] as const;
export type JenisTemplate = (typeof JENIS_TEMPLATE)[number];

export const LABEL_JENIS: Record<JenisTemplate, string> = {
  pdf: 'PDF eksternal',
  html: 'HTML desainer',
};

export const DESKRIPSI_JENIS: Record<JenisTemplate, string> = {
  pdf: 'Rancang halaman di Word, CorelDRAW, atau Canva lalu unggah PDF-nya di sini.',
  html: 'Gambar sendiri tata letaknya di kanvas, tanpa berkas PDF.',
};

export const LABEL_KATEGORI: Record<KategoriTemplate, string> = {
  surat: 'Surat',
  sertifikat: 'Sertifikat',
  daftar: 'Daftar',
  rapor: 'Rapor',
  sk: 'SK',
  berita_acara: 'Berita Acara',
  lainnya: 'Lainnya',
};

export interface GayaMedan {
  font: FontPdf;
  tebal: boolean;
  miring: boolean;
  /** dalam poin */
  ukuran: number;
  warna: string;
  rata: Rata;
  /** tinggi baris sebagai kelipatan ukuran huruf */
  baris: number;
  /** spasi antar huruf, dalam poin */
  spasi: number;
  huruf_besar: boolean;
  skala_otomatis: boolean;
  /** batas bawah ukuran huruf saat skala otomatis bekerja */
  huruf_min: number;
  /** tebal border atau garis dalam milimeter; hanya dipakai tipe garis dan kotak */
  tebal_mm: number;
  /** warna isian kotak; null berarti transparan */
  isi: string | null;
}

export interface KolomBaris {
  label: string;
  x: number;
  w: number;
  sumber: string;
  kunci: string;
  gaya: GayaMedan;
}

/** Gaya grid tabel: garis sel dan baris kepala. */
export interface GayaTabel {
  /** tebal garis sel dalam milimeter; 0 = tanpa garis */
  garis_sel: number;
  warna_garis: string;
  /** latar baris kepala; null = transparan */
  warna_kepala: string | null;
  tebal_kepala: boolean;
  ukuran_kepala: number;
}

/** Gaya tabel bawaan untuk medan baru dan definisi lama tanpa gaya. */
export const GAYA_TABEL_BAWAAN: GayaTabel = {
  garis_sel: 0.25,
  warna_garis: '#7a7a7a',
  warna_kepala: '#f1f1f1',
  tebal_kepala: true,
  ukuran_kepala: 8.5,
};

export interface BagianBarisBerulang {
  sumber: string;
  jumlah: number;
  tinggi_baris: number;
  tinggi_kepala: number;
  kolom: KolomBaris[];
  gaya: GayaTabel;
}

export interface Medan {
  id: string;
  label: string;
  tipe: TipeMedan;
  /** nomor halaman, mulai 1 */
  halaman: number;
  x: number;
  y: number;
  w: number;
  h: number;
  sumber: string | null;
  kunci: string | null;
  gaya: GayaMedan;
  /** tipe centang */
  bawa?: string | null;
  huruf?: string;
  huruf_kosong?: string;
  /** tipe gambar */
  sizemode?: Sizemode;
  /** tipe halaman_otomatis */
  format?: string;
  /** tipe baris_berulang */
  baris_berulang?: BagianBarisBerulang;
}

export interface UkuranHalaman {
  lebar_mm: number;
  tinggi_mm: number;
}

export interface DefinisiTemplate {
  versi: number;
  medan: Medan[];
}

export interface TemplateRingkas {
  id: number;
  kode: string;
  nama: string;
  kategori: KategoriTemplate;
  jenis: JenisTemplate;
  deskripsi: string | null;
  jenjang: string | null;
  jumlah_halaman: number;
  aktif: boolean;
  punya_berkas: boolean;
  jumlah_medan: number;
  dibuat_pada: string | null;
}

export interface TemplateLengkap extends TemplateRingkas {
  halaman: UkuranHalaman[];
  definisi: DefinisiTemplate;
}

/* ---------------------------------------------------------------- katalog */

export interface MedanKatalog {
  kunci: string;
  label: string;
  tipe: 'teks' | 'paragraf' | 'tanggal' | 'angka' | 'gambar';
  contoh: string | number | null;
}

export interface SumberKatalog {
  kunci: string;
  label: string;
  kelompok: string;
  /** entitas yang dipilih pengguna; null untuk nilai tetap dan sistem */
  pilih_data: string | null;
  catatan: string | null;
  medan: MedanKatalog[];
}

export interface KoleksiKatalog {
  kunci: string;
  label: string;
  kelompok: string;
  catatan: string | null;
  medan: MedanKatalog[];
}

export interface KatalogNilai {
  sumber: SumberKatalog[];
  koleksi: KoleksiKatalog[];
  tipe: MedanKatalog['tipe'][];
}

/* ------------------------------------------------------------------ aset */

/**
 * Awal kunci medan gambar yang menunjuk satu aset, misalnya "aset:12".
 *
 * Daftar aset bertambah mengikuti isi pustaka, jadi tidak bisa ditulis sebagai daftar kunci
 * di katalog. Kuncinya membawa nomor aset. Harus sama dengan
 * App\Services\Template\KatalogNilai::AWAL_KUNCI_ASET di backend.
 */
export const AWAL_KUNCI_ASET = 'aset:';

export function kunciAset(id: number): string {
  return `${AWAL_KUNCI_ASET}${id}`;
}

/** Nomor aset dari kunci medan, atau null bila bukan kunci aset. */
export function idAsetDariKunci(kunci: string | null | undefined): number | null {
  if (!kunci?.startsWith(AWAL_KUNCI_ASET)) {
    return null;
  }

  const id = kunci.slice(AWAL_KUNCI_ASET.length);

  return /^\d+$/.test(id) && Number(id) > 0 ? Number(id) : null;
}

export interface AsetDokumen {
  id: number;
  nama: string;
  jenjang: string | null;
  mime: string;
  lebar_px: number;
  tinggi_px: number;
  ukuran_byte: number;
  url: string;
  dibuat_pada: string | null;
}

/* -------------------------------------------------------------- hasil ISI */

export interface HasilIsi {
  /** isi formulir: record yang dipilih, nilai tetap, dan konteks siklus */
  id_santri?: number | null;
  id_pegawai?: number | null;
  id_psb_calon?: number | null;
  kelas_id?: number | null;
  tahun_ajaran?: string | null;
  semester?: '1' | '2' | null;
  tanggal_absen?: string | null;
  tetap?: { teks?: string; tanggal?: string };
  unduh?: boolean;
}

/** Batas aman; cermin BATAS_* di backend. */
export const BATAS = {
  medan: 60,
  baris: 200,
  kolom: 12,
  ukuranHalaman: 2000,
} as const;
