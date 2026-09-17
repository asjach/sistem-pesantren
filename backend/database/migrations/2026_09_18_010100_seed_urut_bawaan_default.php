<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Seed urut bawaan = menyalin perilaku $bawaan lama (tanpa mengubah hasil).
     * Setelah ini, default diatur dari halaman Kamus Label.
     */
    public function up(): void
    {
        $rows = [
            ['endpoint' => 'admin/santri', 'kunci' => ['jk', 'nama'], 'arah' => 'naik'],
            ['endpoint' => 'admin/kelas', 'kunci' => ['urutan', 'nama', 'id'], 'arah' => 'naik'],
            ['endpoint' => 'admin/lembaga', 'kunci' => ['nama'], 'arah' => 'naik'],
            ['endpoint' => 'admin/users', 'kunci' => ['id'], 'arah' => 'turun'],
            ['endpoint' => 'admin/tahun-ajaran', 'kunci' => ['aktif', 'mulai', 'id'], 'arah' => 'turun'],
            ['endpoint' => 'admin/mutasi-keluar', 'kunci' => ['id'], 'arah' => 'turun'],
            ['endpoint' => 'admin/alumni', 'kunci' => ['id'], 'arah' => 'turun'],
            ['endpoint' => 'admin/pengajuan-biodata', 'kunci' => ['id'], 'arah' => 'turun'],
            ['endpoint' => 'psb/antrean-daftar-ulang', 'kunci' => ['id'], 'arah' => 'turun'],
            ['endpoint' => 'admin/lembaga-santri', 'kunci' => ['aktif', 'id'], 'arah' => 'turun'],
        ];

        foreach ($rows as $row) {
            if (DB::table('urut_bawaan')->where('endpoint', $row['endpoint'])->exists()) {
                continue;
            }
            DB::table('urut_bawaan')->insert([
                'endpoint' => $row['endpoint'],
                'kunci' => json_encode($row['kunci']),
                'arah' => $row['arah'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        DB::table('urut_bawaan')
            ->whereIn('endpoint', [
                'admin/santri', 'admin/kelas', 'admin/lembaga', 'admin/users',
                'admin/tahun-ajaran', 'admin/mutasi-keluar', 'admin/alumni',
                'admin/pengajuan-biodata', 'psb/antrean-daftar-ulang', 'admin/lembaga-santri',
            ])
            ->delete();
    }
};
