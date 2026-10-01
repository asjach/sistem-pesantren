<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Storage;

/**
 * Byte dokumen server masuk pohon dokumen: `server/{tipe}/*` menjadi
 * `dokumen/{tipe}/*` (sejajar foto_profil). DB tak berubah (nama_file saja).
 * Folder `server/` yang kosong ikut dibersihkan.
 */
return new class extends Migration
{
    /** @var list<string> */
    private const TIPE = ['santri', 'pegawai', 'lembaga'];

    public function up(): void
    {
        $disk = Storage::disk('local');
        foreach (self::TIPE as $tipe) {
            $lama = "server/{$tipe}";
            $baru = "dokumen/{$tipe}";
            if (! $disk->exists($lama)) {
                continue;
            }
            foreach ($disk->allFiles($lama) as $path) {
                $tujuan = $baru.'/'.basename($path);
                if (! $disk->move($path, $tujuan) || ! $disk->exists($tujuan)) {
                    throw new RuntimeException("Gagal memindah {$path} ke {$tujuan}.");
                }
            }
        }
        $this->bersihkan($disk, 'server');
    }

    public function down(): void
    {
        $disk = Storage::disk('local');
        foreach (self::TIPE as $tipe) {
            $lama = "dokumen/{$tipe}";
            $baru = "server/{$tipe}";
            if (! $disk->exists($lama)) {
                continue;
            }
            foreach ($disk->allFiles($lama) as $path) {
                $tujuan = $baru.'/'.basename($path);
                if (! $disk->move($path, $tujuan) || ! $disk->exists($tujuan)) {
                    throw new RuntimeException("Gagal memindah {$path} ke {$tujuan}.");
                }
            }
        }
    }

    private function bersihkan($disk, string $folder): void
    {
        if ($disk->exists($folder) && count($disk->allFiles($folder)) === 0) {
            $disk->deleteDirectory($folder);
        }
    }
};
