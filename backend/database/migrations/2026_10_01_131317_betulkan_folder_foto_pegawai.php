<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Ralat nama folder foto pegawai: `dokumen/guru/foto_profil/*` menjadi
 * `dokumen/pegawai/foto_profil/*`. Path di DB (foto_url) ikut diperbarui.
 */
return new class extends Migration
{
    public function up(): void
    {
        $this->pindah(false);
    }

    public function down(): void
    {
        $this->pindah(true);
    }

    private function pindah(bool $mundur): void
    {
        $dari = $mundur ? 'dokumen/pegawai/foto_profil' : 'dokumen/guru/foto_profil';
        $ke = $mundur ? 'dokumen/guru/foto_profil' : 'dokumen/pegawai/foto_profil';
        $disk = Storage::disk('local');
        if ($disk->exists($dari)) {
            foreach ($disk->allFiles($dari) as $path) {
                $tujuan = $ke.'/'.basename($path);
                if (! $disk->move($path, $tujuan) || ! $disk->exists($tujuan)) {
                    throw new RuntimeException("Gagal memindah {$path} ke {$tujuan}.");
                }
            }
        }
        DB::table('pegawai')
            ->where('foto_url', 'like', "{$dari}/%")
            ->update(['foto_url' => DB::raw("REPLACE(foto_url, '{$dari}/', '{$ke}/')")]);
    }
};
