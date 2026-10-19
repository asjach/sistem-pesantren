<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Setelan TABEL, GLOBAL per `table_key`: visibilitas kontrol toolbar
     * (peta kontrol → boolean; hanya `false` yang menyembunyikan), urutan kolom
     * data, perataan kolom, label kolom, dan judul tabel. Dikelola super_admin
     * untuk seluruh lembaga (tanpa `lembaga_id`, seperti `urut_preset`).
     *
     * Menggabungkan alter lama: `align` (2026_10_05), `tinggi` (2026_10_11),
     * `nilai_default` (2026_10_11), `label` (2026_10_15), dan `judul`
     * (2026_10_15). `lebar`/`tinggi`/`nilai_default` kini peta LAMA — setelan
     * komponen custom pindah ke `komponen_custom`, tapi kolomnya tetap ada
     * supaya klien lama tak rusak.
     */
    public function up(): void
    {
        Schema::create('toolbar_preset', function (Blueprint $table) {
            $table->id();
            $table->string('table_key', 60)->unique();
            $table->json('visibilitas');

            $table->json('lebar')->nullable();

            $table->json('tinggi')->nullable();

            $table->json('nilai_default')->nullable();

            $table->json('urutan')->nullable();

            $table->json('align')->nullable();

            $table->json('label')->nullable();

            $table->string('judul', 100)->nullable();
            $table->foreignId('dibuat_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('toolbar_preset');
    }
};
