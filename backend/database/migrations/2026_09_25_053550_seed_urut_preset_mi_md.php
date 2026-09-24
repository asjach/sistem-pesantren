<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $pilihan = fn (string $kode, string $label, bool $bawaan = false) => [
            'kode' => [$kode],
            'label' => $label,
            'arah' => 'naik',
            'bawaan' => $bawaan,
        ];

        $preset = [
            'mi_md_mi' => [
                $pilihan('nama', 'Nama', true),
                $pilihan('nis_mi', 'NIS MI'),
                $pilihan('kelas_mi', 'Kelas MI'),
            ],
            'mi_md_md' => [
                $pilihan('nama', 'Nama', true),
                $pilihan('nis_md', 'NIS MD'),
                $pilihan('kelas_md', 'Kelas MD'),
            ],
            'mi_md_beda' => [
                $pilihan('nama', 'Nama', true),
                $pilihan('kelas_mi', 'Kelas MI'),
                $pilihan('kelas_md', 'Kelas MD'),
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
        DB::table('urut_preset')->whereIn('table_key', ['mi_md_mi', 'mi_md_md', 'mi_md_beda'])->delete();
    }
};
