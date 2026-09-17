<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Seed preset urut dari opsi yang sebelumnya hardcode di frontend
     * (`opsiUrut`), agar perilaku dropdown tidak berubah saat rilis.
     * Opsi santri "JK-Nama" ditandai bawaan (default urut saat halaman dibuka,
     * sebelumnya di-set di SantriPage).
     */
    public function up(): void
    {
        $pilihan = fn (string $kode, string $label, ?string $arah = null, bool $bawaan = false) => [
            'kode' => explode(',', $kode),
            'label' => $label,
            'arah' => $arah,
            'bawaan' => $bawaan,
        ];

        $preset = [
            'santri' => [
                $pilihan('jk,nama', 'JK-Nama', null, true),
                $pilihan('nama', 'Nama'),
                $pilihan('nik', 'NIK'),
                $pilihan('nisn', 'NISN'),
                $pilihan('jk', 'JK'),
                $pilihan('tipe', 'Tipe Santri'),
                $pilihan('status', 'Status'),
            ],
            'keanggotaan' => [
                $pilihan('nama', 'Nama'),
                $pilihan('jk', 'JK'),
                $pilihan('jk,nama', 'JK-Nama'),
                $pilihan('lembaga', 'Lembaga'),
                $pilihan('nis_lokal', 'NIS Lokal'),
                $pilihan('nis_kemenag', 'NIS Kemenag'),
                $pilihan('aktif', 'Aktif'),
                $pilihan('mulai', 'Mulai'),
                $pilihan('selesai', 'Selesai'),
            ],
            'users' => [
                $pilihan('nama', 'Nama'),
                $pilihan('email', 'Email'),
                $pilihan('hp', 'HP'),
                $pilihan('username', 'Username'),
            ],
            'tahun_ajaran' => [
                $pilihan('nama', 'Nama'),
                $pilihan('mulai', 'Mulai'),
                $pilihan('selesai', 'Selesai'),
                $pilihan('aktif', 'Aktif'),
            ],
            'lembaga' => [
                $pilihan('kode', 'Kode'),
                $pilihan('nama', 'Nama'),
                $pilihan('induk', 'Induk'),
                $pilihan('kelompok', 'Kelompok'),
                $pilihan('seleksi', 'Seleksi'),
            ],
            'kelas' => [
                $pilihan('nama', 'Nama'),
                $pilihan('lembaga', 'Lembaga'),
                $pilihan('ta', 'Tahun Ajaran'),
                $pilihan('tingkat', 'Tingkat'),
                $pilihan('urutan', 'Urutan'),
                $pilihan('kapasitas', 'Kapasitas'),
            ],
            'riwayat_belajar' => [
                $pilihan('santri', 'Santri'),
                $pilihan('kelas', 'Kelas'),
                $pilihan('lembaga', 'Lembaga'),
                $pilihan('tingkat', 'Tingkat'),
                $pilihan('absen', 'No. Absen'),
            ],
            'kenaikan_santri_genap' => [
                $pilihan('santri', 'Nama'),
                $pilihan('kelas', 'Kelas'),
                $pilihan('tingkat', 'Tingkat'),
            ],
            'mutasi_arsip' => [
                $pilihan('santri', 'Santri'),
                $pilihan('tanggal', 'Tanggal'),
            ],
            'kelulusan_alumni' => [
                $pilihan('santri', 'Santri'),
                $pilihan('ta', 'Tahun Ajaran'),
                $pilihan('kelas', 'Kelas'),
            ],
            'pengajuan_biodata' => [
                $pilihan('santri', 'Santri'),
                $pilihan('status', 'Status'),
            ],
            'psb' => [
                $pilihan('nama', 'Nama'),
                $pilihan('nik', 'NIK'),
                $pilihan('gelombang', 'Gelombang'),
                $pilihan('lembaga', 'Lembaga'),
                $pilihan('status', 'Status'),
            ],
        ];

        $sekarang = now();
        foreach ($preset as $tableKey => $opsi) {
            DB::table('urut_preset')->updateOrInsert(
                ['table_key' => $tableKey],
                ['opsi' => json_encode($opsi), 'created_at' => $sekarang, 'updated_at' => $sekarang],
            );
        }
    }

    public function down(): void
    {
        DB::table('urut_preset')->whereIn('table_key', [
            'santri', 'keanggotaan', 'users', 'tahun_ajaran', 'lembaga', 'kelas',
            'riwayat_belajar', 'kenaikan_santri_genap', 'mutasi_arsip',
            'kelulusan_alumni', 'pengajuan_biodata', 'psb',
        ])->delete();
    }
};
