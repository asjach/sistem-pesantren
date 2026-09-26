<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $pilihan = fn (string $kode, string $label, ?string $arah = null, bool $bawaan = false) => [
            'kode' => explode(',', $kode),
            'label' => $label,
            'arah' => $arah,
            'bawaan' => $bawaan,
        ];

        $preset = [
            'pegawai' => [
                $pilihan('nama', 'Nama', null, true),
                $pilihan('nip', 'NIP'),
                $pilihan('jk', 'JK'),
                $pilihan('status', 'Status'),
                $pilihan('mulai', 'Mulai Kerja'),
            ],
            'pegawai_lembaga' => [
                $pilihan('nama', 'Nama', null, true),
                $pilihan('nipp', 'NIPP'),
                $pilihan('lembaga', 'Lembaga'),
                $pilihan('tugas', 'Tugas'),
                $pilihan('aktif', 'Aktif'),
                $pilihan('mulai', 'Mulai'),
            ],
            'pegawai_keaktifan' => [
                $pilihan('nama', 'Nama', null, true),
                $pilihan('nipp', 'NIPP'),
                $pilihan('lembaga', 'Lembaga'),
                $pilihan('ta', 'Tahun Ajaran'),
                $pilihan('tugas', 'Tugas'),
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
            'pegawai', 'pegawai_lembaga', 'pegawai_keaktifan',
        ])->delete();
    }
};
