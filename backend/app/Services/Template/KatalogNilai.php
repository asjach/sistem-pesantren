<?php

namespace App\Services\Template;

/**
 * Katalog nilai untuk template cetak: satu sumber kebenaran tentang data apa
 * saja yang boleh ditarik ke dokumen, beserta tipe dan nilai contohnya.
 *
 * Sengaja berupa metadata murni (array) supaya bisa diserialisasi ke JSON dan
 * dibaca frontend untuk mengisi panel pemilih medan. Resolusi nilai sungguhan
 * ada di App\Services\Template\PengisiNilai.
 *
 * Kunci `sumber` pada medan menentukan asal nilainya:
 * - skalar  : diambil dari satu record yang dipilih pengguna (mis. satu Santri)
 * - tetap   : diketik pengguna sekali lalu memakainya untuk semua dokumen
 * - sistem  : dihitung saat mencetak (tanggal hari ini, nama pencetak)
 * - baris   : diambil dari koleksi pada baris ke-N (dipakai tipe baris_berulang)
 */
class KatalogNilai
{
    public const TIPE = ['teks', 'paragraf', 'tanggal', 'angka', 'gambar'];

    /**
     * Sumber nilai skalar.
     *
     * @return array<string, array{label: string, kelompok: string, pilih_data: ?string, catatan: ?string, medan: list<array{kunci: string, label: string, tipe: string, contoh: string|int|float|null, hitung: ?string}>}>
     */
    public static function sumber(): array
    {
        return [
            'santri' => [
                'label' => 'Data Santri',
                'kelompok' => 'Santri',
                'pilih_data' => 'santri',
                'catatan' => 'Pilih satu Santri saat mengisi dokumen.',
                'medan' => [
                    ['kunci' => 'nama_lengkap', 'label' => 'Nama Lengkap', 'tipe' => 'teks', 'contoh' => 'Ahmad Fauzi bin Abdul', 'hitung' => null],
                    ['kunci' => 'nama_singkat', 'label' => 'Nama Singkat', 'tipe' => 'teks', 'contoh' => 'Ahmad F.', 'hitung' => null],
                    ['kunci' => 'nik', 'label' => 'NIK', 'tipe' => 'teks', 'contoh' => '3201234567890123', 'hitung' => null],
                    ['kunci' => 'nisn', 'label' => 'NISN', 'tipe' => 'teks', 'contoh' => '0081234567', 'hitung' => null],
                    ['kunci' => 'jk', 'label' => 'Jenis Kelamin', 'tipe' => 'teks', 'contoh' => 'L', 'hitung' => null],
                    ['kunci' => 'jk_tercantum', 'label' => 'Jenis Kelamin (L/P)', 'tipe' => 'teks', 'contoh' => 'L', 'hitung' => 'jk_tercantum'],
                    ['kunci' => 'tmp_lahir', 'label' => 'Tempat Lahir', 'tipe' => 'teks', 'contoh' => 'Bandung', 'hitung' => null],
                    ['kunci' => 'tgl_lahir', 'label' => 'Tanggal Lahir', 'tipe' => 'tanggal', 'contoh' => '2012-05-17', 'hitung' => null],
                    ['kunci' => 'tgl_lahir_umur', 'label' => 'Tanggal & Umur', 'tipe' => 'teks', 'contoh' => '17 Mei 2012 (14 tahun)', 'hitung' => 'tgl_lahir_umur'],
                    ['kunci' => 'anak_ke', 'label' => 'Anak ke-', 'tipe' => 'angka', 'contoh' => 2, 'hitung' => null],
                    ['kunci' => 'j_saudara', 'label' => 'Jumlah Saudara', 'tipe' => 'angka', 'contoh' => 3, 'hitung' => null],
                    ['kunci' => 'agama', 'label' => 'Agama', 'tipe' => 'teks', 'contoh' => 'Islam', 'hitung' => null],
                    ['kunci' => 'kewarganegaraan', 'label' => 'Kewarganegaraan', 'tipe' => 'teks', 'contoh' => 'WNI', 'hitung' => null],
                    ['kunci' => 'bahasa_sehari', 'label' => 'Bahasa Sehari-hari', 'tipe' => 'teks', 'contoh' => 'Indonesia', 'hitung' => null],
                    ['kunci' => 'cita_cita', 'label' => 'Cita-cita', 'tipe' => 'teks', 'contoh' => 'Guru', 'hitung' => null],
                    ['kunci' => 'hobi', 'label' => 'Hobi', 'tipe' => 'teks', 'contoh' => 'Membaca', 'hitung' => null],
                    ['kunci' => 'tipe_santri', 'label' => 'Tipe Santri', 'tipe' => 'teks', 'contoh' => 'asrama', 'hitung' => null],
                    ['kunci' => 'tipe_santri_tercantum', 'label' => 'Tipe Santri (Asrama/Non Asrama)', 'tipe' => 'teks', 'contoh' => 'Asrama', 'hitung' => 'tipe_santri_tercantum'],
                    ['kunci' => 'kebutuhan_khusus', 'label' => 'Kebutuhan Khusus', 'tipe' => 'teks', 'contoh' => '-', 'hitung' => null],
                    ['kunci' => 'kebutuhan_disabilitas', 'label' => 'Kebutuhan Disabilitas', 'tipe' => 'teks', 'contoh' => '-', 'hitung' => null],
                    ['kunci' => 'no_hp_santri', 'label' => 'No. HP Santri', 'tipe' => 'teks', 'contoh' => '081234567890', 'hitung' => null],
                    ['kunci' => 'email_santri', 'label' => 'Email Santri', 'tipe' => 'teks', 'contoh' => 'ahmad@contoh.sch.id', 'hitung' => null],
                    ['kunci' => 'alamat', 'label' => 'Alamat (Jalan)', 'tipe' => 'paragraf', 'contoh' => 'Jl. Cendana No. 12 RT 001 RW 002', 'hitung' => null],
                    ['kunci' => 'alamat_lengkap', 'label' => 'Alamat Lengkap', 'tipe' => 'paragraf', 'contoh' => 'Jl. Cendana No. 12, Desa Sukamaju, Kab. Bandung, 40123', 'hitung' => 'alamat_lengkap'],
                    ['kunci' => 'kode_pos', 'label' => 'Kode Pos', 'tipe' => 'teks', 'contoh' => '40123', 'hitung' => null],
                    ['kunci' => 'rt', 'label' => 'RT', 'tipe' => 'teks', 'contoh' => '001', 'hitung' => null],
                    ['kunci' => 'rw', 'label' => 'RW', 'tipe' => 'teks', 'contoh' => '002', 'hitung' => null],
                    ['kunci' => 'provinsi', 'label' => 'Provinsi', 'tipe' => 'teks', 'contoh' => 'Jawa Barat', 'hitung' => null],
                    ['kunci' => 'kab_kota', 'label' => 'Kabupaten/Kota', 'tipe' => 'teks', 'contoh' => 'Kab. Bandung', 'hitung' => null],
                    ['kunci' => 'kecamatan', 'label' => 'Kecamatan', 'tipe' => 'teks', 'contoh' => 'Cileunyi', 'hitung' => null],
                    ['kunci' => 'desa_kelurahan', 'label' => 'Desa/Kelurahan', 'tipe' => 'teks', 'contoh' => 'Sukamaju', 'hitung' => null],
                    ['kunci' => 'status_tempat_tinggal', 'label' => 'Status Tempat Tinggal', 'tipe' => 'teks', 'contoh' => 'Milik Orang Tua', 'hitung' => null],
                    ['kunci' => 'kepala_keluarga', 'label' => 'Kepala Keluarga', 'tipe' => 'teks', 'contoh' => 'Bapak Ahmad', 'hitung' => null],
                    ['kunci' => 'no_kk', 'label' => 'No. KK', 'tipe' => 'teks', 'contoh' => '3201234567890123', 'hitung' => null],
                    ['kunci' => 'jarak_ke_pesantren', 'label' => 'Jarak ke Pesantren', 'tipe' => 'teks', 'contoh' => '5 km', 'hitung' => null],
                    ['kunci' => 'waktu_tempuh', 'label' => 'Waktu Tempuh', 'tipe' => 'teks', 'contoh' => '30 menit', 'hitung' => null],
                    ['kunci' => 'transportasi', 'label' => 'Transportasi', 'tipe' => 'teks', 'contoh' => 'Sepeda', 'hitung' => null],
                    ['kunci' => 'foto', 'label' => 'Foto Santri', 'tipe' => 'gambar', 'contoh' => null, 'hitung' => 'foto'],
                ],
            ],

            'keluarga_santri' => [
                'label' => 'Data Orang Tua',
                'kelompok' => 'Santri',
                'pilih_data' => 'santri',
                'catatan' => 'Mengikuti Santri yang dipilih.',
                'medan' => self::keluarga(),
            ],

            'penempatan_santri' => [
                'label' => 'Penempatan Santri',
                'kelompok' => 'Santri',
                'pilih_data' => 'santri',
                'catatan' => 'Kelas & NIS lokal mengikuti tahun ajaran dan jenjang aktif.',
                'medan' => [
                    ['kunci' => 'nis_lokal', 'label' => 'NIS Lokal', 'tipe' => 'teks', 'contoh' => '2026-0012', 'hitung' => null],
                    ['kunci' => 'nis_kemenag', 'label' => 'NIS Kemenag', 'tipe' => 'teks', 'contoh' => '211234', 'hitung' => null],
                    ['kunci' => 'no_urut', 'label' => 'No. Urut', 'tipe' => 'teks', 'contoh' => '12', 'hitung' => null],
                    ['kunci' => 'nama_kelas', 'label' => 'Nama Kelas', 'tipe' => 'teks', 'contoh' => '7A', 'hitung' => null],
                    ['kunci' => 'kelas_lengkap', 'label' => 'Kelas Lengkap', 'tipe' => 'teks', 'contoh' => 'Kelas 7A', 'hitung' => 'kelas_lengkap'],
                    ['kunci' => 'tingkat', 'label' => 'Tingkat', 'tipe' => 'teks', 'contoh' => 'VII', 'hitung' => null],
                    ['kunci' => 'tahun_ajaran', 'label' => 'Tahun Ajaran', 'tipe' => 'teks', 'contoh' => '2026/2027', 'hitung' => null],
                    ['kunci' => 'semester', 'label' => 'Semester', 'tipe' => 'teks', 'contoh' => 'Ganjil', 'hitung' => null],
                    ['kunci' => 'no_absen', 'label' => 'No. Absen', 'tipe' => 'angka', 'contoh' => 7, 'hitung' => null],
                    ['kunci' => 'tgl_masuk', 'label' => 'Tanggal Masuk', 'tipe' => 'tanggal', 'contoh' => '2026-07-01', 'hitung' => null],
                    ['kunci' => 'nama_sekolah_asal', 'label' => 'Sekolah Asal', 'tipe' => 'teks', 'contoh' => 'SDN Sukamaju 01', 'hitung' => null],
                    ['kunci' => 'npsn_sekolah_asal', 'label' => 'NPSN Sekolah Asal', 'tipe' => 'teks', 'contoh' => '20219876', 'hitung' => null],
                ],
            ],

            'lembaga' => [
                'label' => 'Data Lembaga',
                'kelompok' => 'Lembaga',
                'pilih_data' => 'lembaga',
                'catatan' => 'Mengikuti lembaga aktif.',
                'medan' => [
                    ['kunci' => 'nama', 'label' => 'Nama Lembaga', 'tipe' => 'teks', 'contoh' => 'Pondasi WLAN 2', 'hitung' => null],
                    ['kunci' => 'nama_singkat', 'label' => 'Nama Singkat', 'tipe' => 'teks', 'contoh' => 'Pondasi WLAN 2', 'hitung' => null],
                    ['kunci' => 'jenjang', 'label' => 'Jenjang', 'tipe' => 'teks', 'contoh' => 'MTS', 'hitung' => null],
                    ['kunci' => 'npsn', 'label' => 'NPSN', 'tipe' => 'teks', 'contoh' => '2112345', 'hitung' => null],
                    ['kunci' => 'nsm', 'label' => 'NSM', 'tipe' => 'teks', 'contoh' => '11223456789012', 'hitung' => null],
                    ['kunci' => 'akreditasi', 'label' => 'Akreditasi', 'tipe' => 'teks', 'contoh' => 'A', 'hitung' => null],
                    ['kunci' => 'mudir_am', 'label' => 'Nama Kepala Madrasah', 'tipe' => 'teks', 'contoh' => 'Drs. H. Ahmad Fauzi', 'hitung' => null],
                    ['kunci' => 'alamat', 'label' => 'Alamat (Jalan)', 'tipe' => 'paragraf', 'contoh' => 'Jl. Raya Cicadas No. 45', 'hitung' => null],
                    ['kunci' => 'alamat_lengkap', 'label' => 'Alamat Lengkap', 'tipe' => 'paragraf', 'contoh' => 'Jl. Raya Cicadas No. 45, Bandung, 40121', 'hitung' => 'alamat_lengkap'],
                    ['kunci' => 'provinsi', 'label' => 'Provinsi', 'tipe' => 'teks', 'contoh' => 'Jawa Barat', 'hitung' => null],
                    ['kunci' => 'kab_kota', 'label' => 'Kabupaten/Kota', 'tipe' => 'teks', 'contoh' => 'Kab. Bandung', 'hitung' => null],
                    ['kunci' => 'kecamatan', 'label' => 'Kecamatan', 'tipe' => 'teks', 'contoh' => 'Cibeunying Kidul', 'hitung' => null],
                    ['kunci' => 'kode_pos', 'label' => 'Kode Pos', 'tipe' => 'teks', 'contoh' => '40121', 'hitung' => null],
                    ['kunci' => 'telepon', 'label' => 'Telepon', 'tipe' => 'teks', 'contoh' => '022-8765432', 'hitung' => null],
                    ['kunci' => 'email', 'label' => 'Email', 'tipe' => 'teks', 'contoh' => 'info@pondasiwlan2.sch.id', 'hitung' => null],
                    ['kunci' => 'website', 'label' => 'Website', 'tipe' => 'teks', 'contoh' => 'https://pondasiwlan2.sch.id', 'hitung' => null],
                    ['kunci' => 'logo', 'label' => 'Logo Lembaga', 'tipe' => 'gambar', 'contoh' => null, 'hitung' => 'foto'],
                ],
            ],

            'pegawai' => [
                'label' => 'Data Pegawai',
                'kelompok' => 'Pegawai',
                'pilih_data' => 'pegawai',
                'catatan' => 'Pilih satu pegawai saat mengisi dokumen.',
                'medan' => [
                    ['kunci' => 'nama_lengkap', 'label' => 'Nama Lengkap', 'tipe' => 'teks', 'contoh' => 'Ahmad Fauzi, S.Pd.I.', 'hitung' => null],
                    ['kunci' => 'nip', 'label' => 'NIP', 'tipe' => 'teks', 'contoh' => '198705122011011004', 'hitung' => null],
                    ['kunci' => 'nipp', 'label' => 'NIPP', 'tipe' => 'teks', 'contoh' => '198705122011011004', 'hitung' => null],
                    ['kunci' => 'nik', 'label' => 'NIK', 'tipe' => 'teks', 'contoh' => '3201234567890123', 'hitung' => null],
                    ['kunci' => 'jenis_kelamin', 'label' => 'Jenis Kelamin', 'tipe' => 'teks', 'contoh' => 'L', 'hitung' => null],
                    ['kunci' => 'jenis_kelamin_tercantum', 'label' => 'Jenis Kelamin (L/P)', 'tipe' => 'teks', 'contoh' => 'L', 'hitung' => 'jk_tercantum'],
                    ['kunci' => 'tempat_lahir', 'label' => 'Tempat Lahir', 'tipe' => 'teks', 'contoh' => 'Bandung', 'hitung' => null],
                    ['kunci' => 'tanggal_lahir', 'label' => 'Tanggal Lahir', 'tipe' => 'tanggal', 'contoh' => '1987-05-12', 'hitung' => null],
                    ['kunci' => 'tgl_lahir_umur', 'label' => 'Tanggal & Umur', 'tipe' => 'teks', 'contoh' => '12 Mei 1987 (39 tahun)', 'hitung' => 'tgl_lahir_umur'],
                    ['kunci' => 'agama', 'label' => 'Agama', 'tipe' => 'teks', 'contoh' => 'Islam', 'hitung' => null],
                    ['kunci' => 'gol_darah', 'label' => 'Golongan Darah', 'tipe' => 'teks', 'contoh' => 'B', 'hitung' => null],
                    ['kunci' => 'pendidikan_terakhir', 'label' => 'Pendidikan Terakhir', 'tipe' => 'teks', 'contoh' => 'S1 Pendidikan Agama Islam', 'hitung' => null],
                    ['kunci' => 'jenis_ptk', 'label' => 'Jenis PTK', 'tipe' => 'teks', 'contoh' => 'Guru', 'hitung' => null],
                    ['kunci' => 'niat_npa', 'label' => 'NIAT/NPA', 'tipe' => 'teks', 'contoh' => '1234567890', 'hitung' => null],
                    ['kunci' => 'sertifikasi', 'label' => 'Sertifikasi', 'tipe' => 'teks', 'contoh' => 'sudah', 'hitung' => null],
                    ['kunci' => 'status_pernikahan', 'label' => 'Status Pernikahan', 'tipe' => 'teks', 'contoh' => 'Kawin', 'hitung' => null],
                    ['kunci' => 'no_hp', 'label' => 'No. HP', 'tipe' => 'teks', 'contoh' => '081234567890', 'hitung' => null],
                    ['kunci' => 'email_pribadi', 'label' => 'Email Pribadi', 'tipe' => 'teks', 'contoh' => 'ahmad@contoh.sch.id', 'hitung' => null],
                    ['kunci' => 'alamat', 'label' => 'Alamat (Jalan)', 'tipe' => 'paragraf', 'contoh' => 'Jl. Melati No. 8', 'hitung' => null],
                    ['kunci' => 'alamat_lengkap', 'label' => 'Alamat Lengkap', 'tipe' => 'paragraf', 'contoh' => 'Jl. Melati No. 8, Bandung, 40123', 'hitung' => 'alamat_lengkap'],
                    ['kunci' => 'kode_pos', 'label' => 'Kode Pos', 'tipe' => 'teks', 'contoh' => '40123', 'hitung' => null],
                    ['kunci' => 'tgl_mulai_kerja', 'label' => 'Tanggal Mulai Kerja', 'tipe' => 'tanggal', 'contoh' => '2012-07-01', 'hitung' => null],
                    ['kunci' => 'no_sk_awal', 'label' => 'No. SK Awal', 'tipe' => 'teks', 'contoh' => 'SK/001/2012', 'hitung' => null],
                    ['kunci' => 'status_aktif', 'label' => 'Status Aktif', 'tipe' => 'teks', 'contoh' => 'Ya', 'hitung' => null],
                    ['kunci' => 'foto', 'label' => 'Foto Pegawai', 'tipe' => 'gambar', 'contoh' => null, 'hitung' => 'foto'],
                ],
            ],

            'penempatan_pegawai' => [
                'label' => 'Penempatan Pegawai',
                'kelompok' => 'Pegawai',
                'pilih_data' => 'pegawai',
                'catatan' => 'Tugas & keaktifan mengikuti tahun ajaran dan jenjang aktif.',
                'medan' => [
                    ['kunci' => 'tugas_utama', 'label' => 'Tugas Utama', 'tipe' => 'teks', 'contoh' => 'Guru Matematika', 'hitung' => null],
                    ['kunci' => 'jenjang', 'label' => 'Jenjang Penempatan', 'tipe' => 'teks', 'contoh' => 'MTS', 'hitung' => null],
                    ['kunci' => 'tahun_ajaran', 'label' => 'Tahun Ajaran', 'tipe' => 'teks', 'contoh' => '2026/2027', 'hitung' => null],
                    ['kunci' => 'status_keaktifan', 'label' => 'Status Keaktifan', 'tipe' => 'teks', 'contoh' => 'aktif', 'hitung' => null],
                    ['kunci' => 'no_sk', 'label' => 'No. SK', 'tipe' => 'teks', 'contoh' => '800/SK/2026', 'hitung' => null],
                    ['kunci' => 'tgl_sk', 'label' => 'Tanggal SK', 'tipe' => 'tanggal', 'contoh' => '2026-07-15', 'hitung' => null],
                ],
            ],

            'psb_calon' => [
                'label' => 'Data Pendaftar PSB',
                'kelompok' => 'PSB',
                'pilih_data' => 'psb_calon',
                'catatan' => 'Data pendaftar, berguna saat PSB masih berjalan.',
                'medan' => [
                    ['kunci' => 'no_pendaftaran', 'label' => 'No. Pendaftaran', 'tipe' => 'teks', 'contoh' => 'PSB-2026-000123', 'hitung' => null],
                    ['kunci' => 'nama_lengkap', 'label' => 'Nama Lengkap', 'tipe' => 'teks', 'contoh' => 'Ahmad Fauzi bin Abdul', 'hitung' => null],
                    ['kunci' => 'jk', 'label' => 'Jenis Kelamin', 'tipe' => 'teks', 'contoh' => 'L', 'hitung' => null],
                    ['kunci' => 'tanggal_daftar', 'label' => 'Tanggal Daftar', 'tipe' => 'tanggal', 'contoh' => '2026-06-15', 'hitung' => null],
                    ['kunci' => 'tanggal_masuk', 'label' => 'Tanggal Masuk', 'tipe' => 'tanggal', 'contoh' => '2026-07-20', 'hitung' => null],
                    ['kunci' => 'status_pendaftaran', 'label' => 'Status Pendaftaran', 'tipe' => 'teks', 'contoh' => 'Diterima', 'hitung' => null],
                    ['kunci' => 'jenjang', 'label' => 'Jenjang', 'tipe' => 'teks', 'contoh' => 'MTS', 'hitung' => null],
                    ['kunci' => 'telp_ortu', 'label' => 'Telepon Orang Tua', 'tipe' => 'teks', 'contoh' => '081234567890', 'hitung' => null],
                    ['kunci' => 'email_ortu', 'label' => 'Email Orang Tua', 'tipe' => 'teks', 'contoh' => 'ortu@contoh.sch.id', 'hitung' => null],
                    ['kunci' => 'catatan', 'label' => 'Catatan', 'tipe' => 'paragraf', 'contoh' => '-', 'hitung' => null],
                ],
            ],

            'tetap' => [
                'label' => 'Nilai Tetap',
                'kelompok' => 'Lain-lain',
                'pilih_data' => null,
                'catatan' => 'Diketik sekali di formulir isian, lalu dipakai untuk semua dokumen (mis. nomor surat).',
                'medan' => [
                    ['kunci' => 'teks', 'label' => 'Teks Bebas', 'tipe' => 'paragraf', 'contoh' => 'Nomor: 123/MTS/2026', 'hitung' => null],
                    ['kunci' => 'tanggal', 'label' => 'Tanggal Tetap', 'tipe' => 'tanggal', 'contoh' => '2026-07-01', 'hitung' => null],
                ],
            ],

            'aset' => [
                'label' => 'Aset Dokumen',
                'kelompok' => 'Lain-lain',
                'pilih_data' => null,
                'catatan' => 'Logo, kop, stempel, atau tanda tangan dari pustaka aset. Dipilih di desainer, bukan dari daftar ini.',
                // Daftar aset berasal dari basis data dan bisa bertambah kapan
                // saja, jadi tidak bisa ditulis sebagai daftar kunci di sini.
                // Kunci medan dibentuk sebagai "aset:<id>" oleh desainer.
                'medan' => [],
            ],

            'sistem' => [
                'label' => 'Sistem',
                'kelompok' => 'Lain-lain',
                'pilih_data' => null,
                'catatan' => 'Dihitung otomatis saat mencetak.',
                'medan' => [
                    ['kunci' => 'tanggal_hari_ini', 'label' => 'Tanggal Hari Ini', 'tipe' => 'tanggal', 'contoh' => '2026-09-28', 'hitung' => null],
                    ['kunci' => 'tanggal_hari_ini_tercantum', 'label' => 'Tanggal Hari Ini (Indonesia)', 'tipe' => 'tanggal', 'contoh' => '2026-09-28', 'hitung' => 'tanggal_indonesia'],
                    ['kunci' => 'nama_aplikasi', 'label' => 'Nama Aplikasi', 'tipe' => 'teks', 'contoh' => 'SIMPES', 'hitung' => null],
                    ['kunci' => 'pencetak', 'label' => 'Dicetak Oleh', 'tipe' => 'teks', 'contoh' => 'Super', 'hitung' => null],
                ],
            ],
        ];
    }

    /**
     * Koleksi baris untuk tipe medan `baris_berulang`. Semuanya beracuan pada
     * Santri yang dipilih (kecuali `daftar_santri_kelas` yang beracuan pada
     * kelas aktif), jadi tidak perlu memilih record tambahan.
     *
     * @return array<string, array{label: string, kelompok: string, catatan: ?string, medan: list<array{kunci: string, label: string, tipe: string, contoh: string|int|float|null}>}>
     */
    public static function koleksi(): array
    {
        return [
            'daftar_santri_kelas' => [
                'label' => 'Daftar Santri (Kelas Aktif)',
                'kelompok' => 'Santri',
                'catatan' => 'Mengikuti kelas yang sedang aktif. Cocok untuk daftar hadir & absen.',
                'medan' => [
                    ['kunci' => 'no_urut', 'label' => 'No. Urut', 'tipe' => 'angka', 'contoh' => 1],
                    ['kunci' => 'no_absen', 'label' => 'No. Absen', 'tipe' => 'angka', 'contoh' => 1],
                    ['kunci' => 'nis_lokal', 'label' => 'NIS Lokal', 'tipe' => 'teks', 'contoh' => '2026-0012'],
                    ['kunci' => 'nisn', 'label' => 'NISN', 'tipe' => 'teks', 'contoh' => '0081234567'],
                    ['kunci' => 'nama_lengkap', 'label' => 'Nama', 'tipe' => 'teks', 'contoh' => 'Ahmad Fauzi bin Abdul'],
                    ['kunci' => 'jk', 'label' => 'L/P', 'tipe' => 'teks', 'contoh' => 'L'],
                    ['kunci' => 'hadir', 'label' => 'Hadir', 'tipe' => 'teks', 'contoh' => 'H'],
                ],
            ],
            'nilai_santri' => [
                'label' => 'Nilai Santri',
                'kelompok' => 'Santri',
                'catatan' => 'Mengikuti Santri, tahun ajaran, dan semester aktif. Cocok untuk tabel nilai rapor.',
                'medan' => [
                    ['kunci' => 'no_urut', 'label' => 'No.', 'tipe' => 'angka', 'contoh' => 1],
                    ['kunci' => 'mata_pelajaran', 'label' => 'Mata Pelajaran', 'tipe' => 'teks', 'contoh' => 'Matematika'],
                    ['kunci' => 'nilai_formatif', 'label' => 'Nilai Formatif', 'tipe' => 'angka', 'contoh' => 82.5],
                    ['kunci' => 'nilai_sumatif', 'label' => 'Nilai Sumatif', 'tipe' => 'angka', 'contoh' => 84.0],
                    ['kunci' => 'nilai_akhir', 'label' => 'Nilai Akhir', 'tipe' => 'angka', 'contoh' => 83.4],
                    ['kunci' => 'predikat', 'label' => 'Predikat', 'tipe' => 'teks', 'contoh' => 'B'],
                ],
            ],
            'presensi_santri' => [
                'label' => 'Presensi Santri',
                'kelompok' => 'Santri',
                'catatan' => 'Riwayat kehadiran Santri yang dipilih.',
                'medan' => [
                    ['kunci' => 'no_urut', 'label' => 'No.', 'tipe' => 'angka', 'contoh' => 1],
                    ['kunci' => 'tanggal', 'label' => 'Tanggal', 'tipe' => 'tanggal', 'contoh' => '2026-09-01'],
                    ['kunci' => 'status', 'label' => 'Status', 'tipe' => 'teks', 'contoh' => 'hadir'],
                    ['kunci' => 'keterangan', 'label' => 'Keterangan', 'tipe' => 'paragraf', 'contoh' => '-'],
                ],
            ],
            'pelanggaran_santri' => [
                'label' => 'Pelanggaran Santri',
                'kelompok' => 'Santri',
                'catatan' => 'Catatan pelanggaran Santri yang dipilih.',
                'medan' => [
                    ['kunci' => 'no_urut', 'label' => 'No.', 'tipe' => 'angka', 'contoh' => 1],
                    ['kunci' => 'tanggal', 'label' => 'Tanggal', 'tipe' => 'tanggal', 'contoh' => '2026-09-05'],
                    ['kunci' => 'tipe_pelanggaran', 'label' => 'Jenis', 'tipe' => 'teks', 'contoh' => 'Terlambat'],
                    ['kunci' => 'deskripsi', 'label' => 'Deskripsi', 'tipe' => 'paragraf', 'contoh' => 'Masuk 20 menit setelah bel'],
                    ['kunci' => 'poin', 'label' => 'Poin', 'tipe' => 'angka', 'contoh' => -5],
                ],
            ],
            'rekap_tahfiz' => [
                'label' => 'Rekap Tahfiz',
                'kelompok' => 'Santri',
                // Catatan: nama surah sengaja tidak ditawarkan. Kolom
                // rekap_tahfiz_santri.surah_terakhir_id masih menggantung karena
                // tabel master surah belum ada di database.
                'catatan' => 'Progres hafalan Santri yang dipilih.',
                'medan' => [
                    ['kunci' => 'no_urut', 'label' => 'No.', 'tipe' => 'angka', 'contoh' => 1],
                    ['kunci' => 'juz_mutqin', 'label' => 'Juz Mutqin', 'tipe' => 'angka', 'contoh' => 3],
                    ['kunci' => 'juz_ziyadah', 'label' => 'Juz Ziyadah', 'tipe' => 'angka', 'contoh' => 1],
                    ['kunci' => 'ayat_terakhir', 'label' => 'Ayat Terakhir', 'tipe' => 'angka', 'contoh' => 255],
                ],
            ],
        ];
    }

    /** Medan ayah/ibu/wali; disusun lewat helper agar tidak mengulang 36 baris. */
    private static function keluarga(): array
    {
        $medan = [];

        foreach (['ayah' => 'Ayah', 'ibu' => 'Ibu', 'wali' => 'Wali'] as $awalan => $nama) {
            $medan[] = ['kunci' => $awalan.'_nama', 'label' => 'Nama '.$nama, 'tipe' => 'teks', 'contoh' => $nama.' Example', 'hitung' => null];
            $medan[] = ['kunci' => $awalan.'_nik', 'label' => 'NIK '.$nama, 'tipe' => 'teks', 'contoh' => '3201234567890123', 'hitung' => null];
            $medan[] = ['kunci' => $awalan.'_tmp_lahir', 'label' => 'Tempat Lahir '.$nama, 'tipe' => 'teks', 'contoh' => 'Bandung', 'hitung' => null];
            $medan[] = ['kunci' => $awalan.'_tgl_lahir', 'label' => 'Tanggal Lahir '.$nama, 'tipe' => 'tanggal', 'contoh' => '1985-04-02', 'hitung' => null];
            $medan[] = ['kunci' => $awalan.'_status', 'label' => 'Status '.$nama, 'tipe' => 'teks', 'contoh' => 'Ayah', 'hitung' => null];
            $medan[] = ['kunci' => $awalan.'_pendidikan', 'label' => 'Pendidikan '.$nama, 'tipe' => 'teks', 'contoh' => 'SMA', 'hitung' => null];
            $medan[] = ['kunci' => $awalan.'_pekerjaan', 'label' => 'Pekerjaan '.$nama, 'tipe' => 'teks', 'contoh' => 'Wiraswasta', 'hitung' => null];
            $medan[] = ['kunci' => $awalan.'_penghasilan', 'label' => 'Penghasilan '.$nama, 'tipe' => 'teks', 'contoh' => 'Rp3.000.000', 'hitung' => null];
            $medan[] = ['kunci' => $awalan.'_telp', 'label' => 'Telepon '.$nama, 'tipe' => 'teks', 'contoh' => '081234567890', 'hitung' => null];
            $medan[] = ['kunci' => $awalan.'_alamat', 'label' => 'Alamat '.$nama, 'tipe' => 'paragraf', 'contoh' => 'Jl. Cendana No. 12', 'hitung' => null];
        }

        $medan[] = ['kunci' => 'yang_membiayai', 'label' => 'Yang Membiayai', 'tipe' => 'teks', 'contoh' => 'Ayah', 'hitung' => null];
        $medan[] = ['kunci' => 'alamat_ortu', 'label' => 'Alamat Orang Tua Lengkap', 'tipe' => 'paragraf', 'contoh' => 'Jl. Cendana No. 12, Bandung, 40123', 'hitung' => 'alamat_ortu'];

        // Catatan: telp_ortu & email_ortu sengaja tidak ada di sini. Kolomnya
        // hanya ada di psb_calon_santri (yang sudah ada di $fillable), tidak
        // ada di migrasi tabel santri maupun di Santri::$fillable.

        return $medan;
    }

    /**
     * Bentuk JSON untuk frontend: daftar sumber + koleksi, dikelompokkan supaya
     * panel pemilih medan bisa menampilkan per kelompok.
     *
     * @return array{sumber: list<array>, koleksi: list<array>}
     */
    public static function untukFrontend(): array
    {
        $sumber = [];

        foreach (self::sumber() as $kunci => $definisi) {
            $sumber[] = [
                'kunci' => $kunci,
                'label' => $definisi['label'],
                'kelompok' => $definisi['kelompok'],
                'pilih_data' => $definisi['pilih_data'],
                'catatan' => $definisi['catatan'],
                'medan' => array_map(
                    fn (array $m) => [
                        'kunci' => $m['kunci'],
                        'label' => $m['label'],
                        'tipe' => $m['tipe'],
                        'contoh' => $m['contoh'],
                    ],
                    $definisi['medan'],
                ),
            ];
        }

        $koleksi = [];

        foreach (self::koleksi() as $kunci => $definisi) {
            $koleksi[] = [
                'kunci' => $kunci,
                'label' => $definisi['label'],
                'kelompok' => $definisi['kelompok'],
                'catatan' => $definisi['catatan'],
                'medan' => array_map(
                    fn (array $m) => [
                        'kunci' => $m['kunci'],
                        'label' => $m['label'],
                        'tipe' => $m['tipe'],
                        'contoh' => $m['contoh'],
                    ],
                    $definisi['medan'],
                ),
            ];
        }

        return [
            'sumber' => $sumber,
            'koleksi' => $koleksi,
            'tipe' => self::TIPE,
        ];
    }

    /** @return list<array{kunci: string, label: string, tipe: string, contoh: mixed}> */
    public static function medan(string $sumber, string $kunci): array
    {
        return self::sumber()[$sumber]['medan'] ?? self::koleksi()[$sumber]['medan'] ?? [];
    }

    public static function dikenal(string $kunci): bool
    {
        return array_key_exists($kunci, self::sumber()) || array_key_exists($kunci, self::koleksi());
    }

    /**
     * Awal kunci medan yang menunjuk satu aset, misalnya "aset:12".
     *
     * Aset tidak bisa ditulis sebagai daftar kunci di sumber() karena
     * bertambah dan berkurang mengikuti isi pustaka. Karena itu kuncinya
     * membawa nomor aset, dan satu tempat ini menjadi kesepakatan antara
     * desainer di frontend dan resolver di backend.
     */
    public const AWAL_KUNCI_ASET = 'aset:';

    public static function kunciAset(int $id): string
    {
        return self::AWAL_KUNCI_ASET.$id;
    }

    /**
     * Sumber yang medannya tidak bisa ditulis sebagai daftar tetap karena
     * berasal dari isi basis data.
     *
     * Daftar aset bertambah mengikuti pustaka aset, jadi tidak bisa ditulis di sini
     * seperti nama atau tanggal. Pengecualian ini disebut eksplisit supaya
     * pemeriksaan katalog tidak perlu menghafal nama sumbernya.
     *
     * @return list<string>
     */
    public static function sumberDinamis(): array
    {
        return ['aset'];
    }

    /** Nomor aset dari kunci medan, atau null bila bukan kunci aset. */
    public static function idAsetDariKunci(?string $kunci): ?int
    {
        if ($kunci === null || ! str_starts_with($kunci, self::AWAL_KUNCI_ASET)) {
            return null;
        }

        $id = substr($kunci, strlen(self::AWAL_KUNCI_ASET));

        return ctype_digit($id) && (int) $id > 0 ? (int) $id : null;
    }
}
