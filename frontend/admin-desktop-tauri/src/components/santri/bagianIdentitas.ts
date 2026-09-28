import { pihakFields, SANTRI_IDENTITAS_FIELDS } from '@/components/santri/kolomIdentitas';
import type { ExcelField } from '@/components/ExcelTable';

/** Kelompokan field profil Santri — sumber tunggal untuk tampilan profil
 *  (baca-saja) dan form ubah detail, supaya label, urutan, dan pembagiannya
 *  selalu sama di kedua tempat. Kunci di sini adalah kunci DATA pada
 *  respons API (`nama_lengkap`), bukan kunci kolom tabel. */

export interface PanelIdentitas {
  judul: string;
  /** Kunci data `santri` dalam urutan tampil. */
  kunci: string[];
}

export interface BagianIdentitas {
  judul: string;
  panels: PanelIdentitas[];
}

/** Kunci data orang tua/wali diambil dari definisi kolom yang sama dengan
 *  Buku Induk agar tidak ada field yang terlewat. */
function kunciPihak(p: 'ayah' | 'ibu' | 'wali'): string[] {
  return pihakFields(p, p).map((f) => f.key);
}

export const BAGIAN_IDENTITAS: BagianIdentitas[] = [
  {
    judul: 'Identitas',
    panels: [
      {
        judul: 'Identitas dasar',
        // `id` hanya tampil di profil (baca-saja), tidak bisa diedit.
        kunci: ['nama_lengkap', 'nama_singkat', 'nik', 'nisn', 'jk', 'tipe_santri', 'id'],
      },
      { judul: 'Kelahiran', kunci: ['tmp_lahir', 'tgl_lahir', 'agama'] },
      { judul: 'Kontak', kunci: ['no_hp_santri', 'email_santri'] },
      {
        judul: 'Tambahan',
        kunci: [
          'kewarganegaraan', 'bahasa_sehari', 'cita_cita', 'hobi',
          'kebutuhan_khusus', 'kebutuhan_disabilitas', 'nomor_kip',
        ],
      },
    ],
  },
  {
    judul: 'Alamat',
    panels: [
      {
        judul: 'Domisili',
        kunci: [
          'alamat', 'rt', 'rw', 'desa_kelurahan', 'kecamatan',
          'kab_kota', 'provinsi', 'kode_pos',
        ],
      },
      {
        judul: 'Kondisi dan perjalanan',
        kunci: [
          'status_tempat_tinggal', 'jarak_ke_pesantren', 'waktu_tempuh',
          'transportasi', 'tanggal_masuk',
        ],
      },
    ],
  },
  {
    judul: 'Keluarga',
    panels: [
      // Urutan mengikuti letak di grid 2 kolom: baris 1 Ayah | Ibu, baris 2
      // Wali | Kartu keluarga.
      { judul: 'Ayah', kunci: kunciPihak('ayah') },
      { judul: 'Ibu', kunci: kunciPihak('ibu') },
      { judul: 'Wali', kunci: kunciPihak('wali') },
      {
        judul: 'Kartu keluarga',
        kunci: ['no_kk', 'kepala_keluarga', 'anak_ke', 'j_saudara', 'yang_membiayai'],
      },
    ],
  },
];

const KOLOM = new Map(SANTRI_IDENTITAS_FIELDS.map((f) => [f.key, f]));

/** Kunci data profil → kunci kolom tabel `santri` (hanya nama yang beda:
 *  data `nama_lengkap`, kolom `nama`). */
export function kolomDariKunci(kunci: string): string {
  return kunci === 'nama_lengkap' ? 'nama' : kunci;
}

/** Definisi kolom untuk sebuah kunci data, atau null bila fieldnya tidak ada
 *  di `santri` (mis. `id`) sehingga tidak bisa diedit. */
export function fieldUntuk(kunci: string): ExcelField | null {
  return KOLOM.get(kolomDariKunci(kunci)) ?? null;
}
