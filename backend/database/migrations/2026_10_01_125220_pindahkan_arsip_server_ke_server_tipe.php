<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Storage;

/**
 * Pola folder seragam `{lokasi}/{tipe}/*`: `dokumen/{tipe}/*` menjadi
 * `server/{tipe}/*` (cermin `SIMPES-Dokumen/lokal/{tipe}/*` di perangkat).
 * DB tak berubah (hanya menyimpan nama_file).
 */
return new class extends Migration
{
    /** @var list<string> */
    private const TIPE = ['santri', 'pegawai', 'lembaga'];

    public function up(): void
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

    public function down(): void
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
    }
};
