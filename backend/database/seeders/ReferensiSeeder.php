<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ReferensiSeeder extends Seeder
{
    public function run(): void
    {
        // Nilai murni per lembaga operasional (tanpa baris global):
        // super_admin menambah ke semua lembaga; tiap lembaga kelola miliknya.
        $lembagas = DB::table('lembaga')->pluck('jenjang')->all();
        if (empty($lembagas)) {
            return;
        }

        /** @param list<array{0:string,1:array<string,mixed>}> $rows [nilai kunci, atribut] */
        $isi = function (string $table, string $key, array $rows) use ($lembagas): void {
            foreach ($lembagas as $lid) {
                foreach ($rows as [$nilai, $attrs]) {
                    // Hanya sisip bila belum ada: baris milik lembaga (mis.
                    // yang sengaja dipadamkan) tidak disentuh seeder.
                    $ada = DB::table($table)
                        ->where('jenjang', $lid)
                        ->where($key, $nilai)
                        ->exists();
                    if (! $ada) {
                        DB::table($table)->insert($attrs + ['jenjang' => $lid, $key => $nilai]);
                    }
                }
            }
        };

        $nama = fn (array $daftar, int $awal = 0): array => array_map(
            fn ($nama, $i) => [$nama, ['urutan' => $awal + $i, 'is_active' => true]],
            $daftar, array_keys($daftar)
        );

        $isi('ref_agama', 'nama', $nama(['Islam', 'Kristen Protestan', 'Katolik', 'Buddha', 'Hindu', 'Kong Hu Cu']));
        $isi('ref_pendidikan', 'nama', $nama(['Tidak Sekolah', 'SD/MI', 'SMP/MTs', 'SMA/MA/SMK', 'D1/D2/D3', 'S1/D4', 'S2', 'S3']));
        $isi('ref_pekerjaan', 'nama', $nama(['Tidak Bekerja', 'Pensiunan', 'PNS', 'TNI/Polisi', 'Guru/Dosen', 'Wiraswasta', 'Pengacara/Jaksa/Hakim/Notaris', 'Dokter/Bidan/Perawat', 'Pilot/Pramugara/Pramugari', 'Pedagang', 'Petani/Peternak', 'Nelayan', 'Buruh (Tani/Pabrik/Bangunan)', 'Sopir/Masinis/Kondektur', 'Politikus', 'Lainnya']));
        $isi('ref_hobi', 'nama', $nama(['Olahraga', 'Kesenian', 'Membaca', 'Menulis', 'Jalan-jalan', 'Lainnya']));
        $isi('ref_cita_cita', 'nama', $nama(['PNS', 'TNI/Polri', 'Guru/Dosen', 'Dokter', 'Politikus', 'Wiraswasta', 'Seniman/Artis', 'Ilmuwan', 'Agamawan', 'Lainnya']));
        $isi('ref_kebutuhan_khusus', 'nama', $nama(['Tidak Ada', 'Lamban Belajar', 'Kesulitan Belajar Spesifik', 'Gangguan Komunikasi', 'Berbakat/memiliki kemampuan dan kecerdasan luar biasa', 'Lainnya']));

        // 20 kamus EMIS + dokumen + pegawai + 6 no.50. No.51: nilai per-tabel.
        foreach ([
            'ref_penghasilan' => ['dibawah 800.000', '800.001 - 1.200.000', '1.200.001 - 2.000.000', '2.000.001 - 3.000.000', 'diatas 3.000.000', 'Tidak Berpenghasilan'],
            'ref_transportasi' => ['Jalan Kaki', 'Sepeda', 'Sepeda Motor', 'Mobil Pribadi', 'Antar Jemput Sekolah', 'Angkutan Umum', 'Perahu/Sampan', 'Kendaraan Pribadi', 'Kereta Api', 'Ojek', 'Andong/Bendi/Sado/Dokarr/Delman/Becak', 'Lainnya'],
            'ref_status_tinggal' => ['Tinggal dengan Ayah Kandung', 'Tinggal dengan Ibu Kandung', 'Tinggal dengan Wali', 'Ikut Saudara/Kerabat', 'Asrama Madrasah', 'Kontrak/Kos', 'Tinggal di Asrama Pesantren', 'Panti Asuhan', 'Rumah Singgah', 'Lainnya'],
            'ref_jarak' => ['Kurang dari 5 km', 'Antara 5-10 km', 'Antara 11-20 km', 'Antara 21-30 km', 'Lebih dari 30 km'],
            'ref_waktu_tempuh' => ['1-10 menit', '10-19 menit', '20-29 menit', '30-39 menit', '1-2 jam', '> 2 jam'],
            'ref_bahasa_sehari_hari' => ['Bahasa Sunda', 'Bahasa Indonesia'],
            'ref_disabilitas' => ['Tidak Ada', 'Tuna Netra', 'Tuna Rungu', 'Tuna Daksa', 'Tuna Grahita', 'Tuna Laras', 'Tuna Wicara', 'Lainnya'],
            'ref_tmp_lahir' => ['Bandung', 'Kab. Bandung', 'Kota Bandung', 'Cimahi', 'Tasikmalaya', 'Garut', 'Cianjur', 'Jakarta'],
            'ref_status_ortu' => ['Masih Hidup', 'Sudah Meninggal', 'Tidak Diketahui'],
            'ref_yang_membiayai' => ['Orang Tua', 'Wali/Orang Tua Asuh', 'Tanggungan Sendiri', 'Lainnya'],
            'ref_provinsi' => ['Jawa Barat', 'DKI Jakarta', 'Jawa Tengah', 'Jawa Timur'],
            'ref_kecamatan' => ['Margaasih', 'Lainnya'],
            'ref_desa_kelurahan' => ['Rahayu', 'Lainnya'],
            'ref_alasan_mutasi' => ['Kendala Ekonomi', 'Kendala Akademik', 'Sakit', 'Menikah', 'Ikut pindah orang tua', 'pelanggaran disiplin', 'kurang perhatian orang tua', 'pengaruh teman/lingkungan', 'Hilang/Tidak ada kabar', 'Lainnya'],
            'ref_jenis_dokumen_santri' => ['Kartu Keluarga', 'Pas Foto', 'Akta Kelahiran', 'Ijazah', 'Transkrip Ijazah', 'Surat Pindah', 'Surat Kenal Lahir'],
            'ref_jenis_dokumen_pegawai' => ['Kartu Keluarga', 'KTP', 'Nomor Rekening', 'NPWP', 'BPJS', 'SK', 'Kartu Anggota'],
            'ref_status_pernikahan' => ['Lajang', 'Gadis', 'Menikah', 'Duda/Janda'],
            'ref_gol_darah' => ['A', 'B', 'AB', 'O'],
            'ref_jenis_ptk' => ['Pendidik', 'Tenaga Kependidikan'],
            'ref_jenjang_sertifikasi' => ['RA', 'MI', 'MTS', 'MA', 'MAK', 'SLB'],
            'ref_tingkat' => ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
            'ref_tugas_utama' => ['Guru Mapel', 'Guru Kelas'],
            'ref_tipe_pelanggaran' => ['ringan', 'sedang', 'berat'],
            'ref_jalur_sertifikasi' => ['PSPL/PF/PLPG', 'PPG SM-3T', 'PPG S1 Basic Science Berasrama', 'PPG S1 PPGD Berasrama', 'PPG SMK Kolaboratif', 'PPG Terintegrasi', 'PPG Sertifikasi Jalur Pendidikan', 'PPG Kemenag', 'PLPG 2015', 'PPGJ 2015', 'PLPG 2016', 'PLPG 2017', 'PPG Pra Jabatan', 'PPG Dalam Jabatan'],
        ] as $tabel => $daftar) {
            $isi($tabel, 'nama', $nama($daftar));
        }

        // Seed kota no.51: Kab. Bandung, Kota Bandung, Bandung.
        $isi('ref_kota', 'nama', $nama(['Kab. Bandung', 'Kota Bandung', 'Bandung'], 1));

        // Preset alamat (contoh Bandung Raya; tiap lembaga dapat salinannya).
        $isi('ref_alamat', 'nama', [[
            'Sekebolek',
            ['provinsi' => 'Jawa Barat', 'kab_kota' => 'Kabupaten Bandung', 'kecamatan' => 'Margaasih',
                'desa_kelurahan' => 'Rahayu', 'alamat' => 'Kp. Kumambang', 'rt' => '05', 'rw' => '08',
                'kode_pos' => '40218', 'urutan' => 0, 'is_active' => true],
        ]]);

        // Status siklus no.51 GANTI TOTAL (terkunci): awal 4 kode + 'kenaikan' + 'lanjutan'
        // (root PRD v1.7.1: kenaikan kelas -> status_awal baris tapel-berikut;
        // salin ganjil→genap -> status_awal baris genap 'lanjutan'),
        // akhir 6 kode; is_aktif_bawaan=true HANYA untuk 'aktif' (invarian 102 terjaga).
        $isi('ref_status_awal', 'kode', [
            ['santri_baru', ['nama' => 'Santri Baru', 'urutan' => 0, 'is_active' => true]],
            ['mengulang', ['nama' => 'Mengulang', 'urutan' => 1, 'is_active' => true]],
            ['pindahan', ['nama' => 'Pindahan', 'urutan' => 2, 'is_active' => true]],
            ['kenaikan', ['nama' => 'Kenaikan Kelas', 'urutan' => 3, 'is_active' => true]],
            ['lanjutan', ['nama' => 'Lanjutan Semester', 'urutan' => 4, 'is_active' => true]],
        ]);

        $isi('ref_status_akhir', 'kode', [
            ['aktif', ['nama' => 'Aktif', 'is_aktif_bawaan' => true, 'terminal_ke' => null, 'urutan' => 0, 'is_active' => true]],
            ['naik', ['nama' => 'Naik', 'is_aktif_bawaan' => false, 'terminal_ke' => null, 'urutan' => 1, 'is_active' => true]],
            ['tidak_naik', ['nama' => 'Tidak Naik', 'is_aktif_bawaan' => false, 'terminal_ke' => null, 'urutan' => 2, 'is_active' => true]],
            ['pindah_keluar', ['nama' => 'Pindah/Keluar', 'is_aktif_bawaan' => false, 'terminal_ke' => null, 'urutan' => 3, 'is_active' => true]],
            ['lulus', ['nama' => 'Lulus', 'is_aktif_bawaan' => false, 'terminal_ke' => null, 'urutan' => 4, 'is_active' => true]],
            ['tidak_lulus', ['nama' => 'Tidak Lulus', 'is_aktif_bawaan' => false, 'terminal_ke' => null, 'urutan' => 5, 'is_active' => true]],
        ]);
    }
}
