<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Storage;

/**
 * Samakan struktur folder server dengan arsip lokal: `{tipe}/dokumen/*`
 * menjadi `dokumen/{tipe}/*`. DB tak berubah (hanya menyimpan nama_file).
 */
return new class extends Migration
{
    /** @var list<string> */
    private const TIPE = ['santri', 'pegawai', 'lembaga'];

    public function up(): void
    {
        $disk = Storage::disk('local');
        foreach (self::TIPE as $tipe) {
            $lama = "{$tipe}/dokumen";
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
    }

    public function down(): void
    {
        $disk = Storage::disk('local');
        foreach (self::TIPE as $tipe) {
            $lama = "dokumen/{$tipe}";
            $baru = "{$tipe}/dokumen";
            if (! $disk->exists($lama)) {
                continue;
            }
            foreach ($disk->allFiles($lama) as $path) {
                $disk->move($path, $baru.'/'.basename($path));
            }
        }
    }
};
