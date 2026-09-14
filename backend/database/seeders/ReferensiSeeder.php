<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ReferensiSeeder extends Seeder
{
    public function run(): void
    {
        // Baris global: lembaga_id = null (seed sekali untuk semua lembaga). No.51: nilai per-tabel.
        $agama = ['Islam', 'Kristen Protestan', 'Katolik', 'Buddha', 'Hindu', 'Kong Hu Cu'];
        foreach ($agama as $i => $a) DB::table('ref_agama')->updateOrInsert(['lembaga_id' => null, 'nama' => $a], ['urutan' => $i, 'is_active' => true]);

        $pendidikan = ['Tidak Sekolah', 'SD/MI', 'SMP/MTs', 'SMA/MA/SMK', 'D1/D2/D3', 'S1/D4', 'S2', 'S3'];
        foreach ($pendidikan as $i => $p) DB::table('ref_pendidikan')->updateOrInsert(['lembaga_id' => null, 'nama' => $p], ['urutan' => $i, 'is_active' => true]);

        $pekerjaan = ['Tidak Bekerja', 'Pensiunan', 'PNS', 'TNI/Polisi', 'Guru/Dosen', 'Wiraswasta', 'Pengacara/Jaksa/Hakim/Notaris', 'Dokter/Bidan/Perawat', 'Pilot/Pramugara/Pramugari', 'Pedagang', 'Petani/Peternak', 'Nelayan', 'Buruh (Tani/Pabrik/Bangunan)', 'Sopir/Masinis/Kondektur', 'Politikus', 'Lainnya'];
        foreach ($pekerjaan as $i => $p) DB::table('ref_pekerjaan')->updateOrInsert(['lembaga_id' => null, 'nama' => $p], ['urutan' => $i, 'is_active' => true]);

        $hobi = ['Olahraga', 'Kesenian', 'Membaca', 'Menulis', 'Jalan-jalan', 'Lainnya'];
        foreach ($hobi as $i => $h) DB::table('ref_hobi')->updateOrInsert(['lembaga_id' => null, 'nama' => $h], ['urutan' => $i, 'is_active' => true]);

        $cita_cita = ['PNS', 'TNI/Polri', 'Guru/Dosen', 'Dokter', 'Politikus', 'Wiraswasta', 'Seniman/Artis', 'Ilmuwan', 'Agamawan', 'Lainnya'];
        foreach ($cita_cita as $i => $c) DB::table('ref_cita_cita')->updateOrInsert(['lembaga_id' => null, 'nama' => $c], ['urutan' => $i, 'is_active' => true]);

        $kebutuhan = ['Tidak Ada', 'Lamban Belajar', 'Kesulitan Belajar Spesifik', 'Gangguan Komunikasi', 'Berbakat/memiliki kemampuan dan kecerdasan luar biasa', 'Lainnya'];
        foreach ($kebutuhan as $i => $k) DB::table('ref_kebutuhan_khusus')->updateOrInsert(['lembaga_id' => null, 'nama' => $k], ['urutan' => $i, 'is_active' => true]);

        // 20 kamus EMIS + dokumen + pegawai + 6 no.50 (global; lembaga tambah/shadow via controller). No.51: nilai per-tabel.
        $baru = [
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
            'ref_kategori_kas' => ['operasional', 'bos', 'spp'],
            'ref_metode_pembayaran' => ['Tunai', 'Transfer'],
            'ref_jalur_sertifikasi' => ['PSPL/PF/PLPG', 'PPG SM-3T', 'PPG S1 Basic Science Berasrama', 'PPG S1 PPGD Berasrama', 'PPG SMK Kolaboratif', 'PPG Terintegrasi', 'PPG Sertifikasi Jalur Pendidikan', 'PPG Kemenag', 'PLPG 2015', 'PPGJ 2015', 'PLPG 2016', 'PLPG 2017', 'PPG Pra Jabatan', 'PPG Dalam Jabatan'],
        ];
        foreach ($baru as $tabel => $daftar) {
            foreach ($daftar as $i => $nama) DB::table($tabel)->updateOrInsert(['lembaga_id' => null, 'nama' => $nama], ['urutan' => $i, 'is_active' => true]);
        }

        // Seed kota no.51: Kab. Bandung, Kota Bandung, Bandung.
        foreach (['Kab. Bandung', 'Kota Bandung', 'Bandung'] as $i => $nama) {
            DB::table('ref_kota')->updateOrInsert(['lembaga_id' => null, 'nama' => $nama], ['urutan' => $i + 1, 'is_active' => true]);
        }

        // Preset alamat global (contoh Bandung Raya; lembaga tambah miliknya via controller).
        DB::table('ref_alamat')->updateOrInsert(['lembaga_id' => null, 'nama' => 'Sekebolek'],
            ['provinsi' => 'Jawa Barat', 'kab_kota' => 'Kabupaten Bandung', 'kecamatan' => 'Margaasih',
             'desa_kelurahan' => 'Rahayu', 'alamat' => 'Kp. Kumambang', 'rt' => '05', 'rw' => '08',
             'kode_pos' => '40218', 'urutan' => 0, 'is_active' => true]);

        // Status siklus no.51 GANTI TOTAL (terkunci): awal 3 kode + 'kenaikan' (root PRD v1.7.1:
        // kenaikan kelas -> status_awal baris tapel-berikut), akhir 6 kode; is_aktif_bawaan=true HANYA untuk 'aktif' (invarian 102 terjaga).
        $awal = ['santri_baru' => 'Santri Baru', 'mengulang' => 'Mengulang', 'pindahan' => 'Pindahan', 'kenaikan' => 'Kenaikan Kelas'];
        foreach (array_values($awal) as $i => $nama) DB::table('ref_status_awal')->updateOrInsert(
            ['lembaga_id' => null, 'kode' => array_keys($awal)[$i]], ['nama' => $nama, 'urutan' => $i, 'is_active' => true]);

        $akhir = [
            ['aktif', 'Aktif', true, null],
            ['naik', 'Naik', false, null],
            ['tidak_naik', 'Tidak Naik', false, null],
            ['pindah_keluar', 'Pindah/Keluar', false, null],
            ['lulus', 'Lulus', false, null],
            ['tidak_lulus', 'Tidak Lulus', false, null],
        ];
        foreach ($akhir as $i => [$kode, $nama, $aktif, $term]) DB::table('ref_status_akhir')->updateOrInsert(
            ['lembaga_id' => null, 'kode' => $kode],
            ['nama' => $nama, 'is_aktif_bawaan' => $aktif, 'terminal_ke' => $term, 'urutan' => $i, 'is_active' => true]);
    }
}
