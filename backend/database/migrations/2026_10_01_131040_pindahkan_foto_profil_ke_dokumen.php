<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Foto profil masuk pohon dokumen: `santri/foto/*` menjadi
 * `dokumen/santri/foto_profil/*`, `pegawai/foto/*` menjadi
 * `dokumen/guru/foto_profil/*`. Path di DB (foto_url) ikut diperbarui.
 */
return new class extends Migration
{
    /** @var list<array{tabel:string, kolom:string, lama:string, baru:string}> */
    private const PINDAH = [
        ['tabel' => 'santri', 'kolom' => 'foto_url', 'lama' => 'santri/foto', 'baru' => 'dokumen/santri/foto_profil'],
        ['tabel' => 'pegawai', 'kolom' => 'foto_url', 'lama' => 'pegawai/foto', 'baru' => 'dokumen/guru/foto_profil'],
    ];

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
        $disk = Storage::disk('local');
        foreach (self::PINDAH as $p) {
            $dari = $mundur ? $p['baru'] : $p['lama'];
            $ke = $mundur ? $p['lama'] : $p['baru'];
            if ($disk->exists($dari)) {
                foreach ($disk->allFiles($dari) as $path) {
                    $tujuan = $ke.'/'.basename($path);
                    if (! $disk->move($path, $tujuan) || ! $disk->exists($tujuan)) {
                        throw new RuntimeException("Gagal memindah {$path} ke {$tujuan}.");
                    }
                }
            }
            DB::table($p['tabel'])
                ->where($p['kolom'], 'like', ($mundur ? $p['baru'] : $p['lama']).'/%')
                ->update([$p['kolom'] => DB::raw("REPLACE({$p['kolom']}, '".($mundur ? $p['baru'] : $p['lama'])."/', '".($mundur ? $p['lama'] : $p['baru'])."/')")]);
        }
    }
};
