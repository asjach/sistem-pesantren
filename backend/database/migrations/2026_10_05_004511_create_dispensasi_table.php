<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Dispensasi (keringanan) tagihan per TA: satu paket (nama + TA + lingkup
 * lembaga + kuota + grup) dengan N aturan per jenis tagihan di
 * `dispensasi_aturan`, plus daftar penerima individual di `santri_dispensasi`.
 * Tagihan menyimpan potongan + id dispensasi yang diterapkan sebagai jejak.
 *
 * Menggabungkan alter lama: `kuota_bulan` (2026_10_08), `grup` (2026_10_08),
 * `jenjang` (2026_10_15), dan pembuangan kolom sasaran lama
 * (`jenis_id`, `paket`, `tingkat`, `kelas_id`, `santri_ids`, `tipe`, `nilai`,
 * `prioritas`) yang dulu dikonversi 1:1 ke `dispensasi_aturan` +
 * `santri_dispensasi` oleh `2026_10_05_202348` dan `2026_10_05_200945`.
 * Karena bentuk antaranya hanya sempat hidup beberapa jam, kolomnya tidak
 * dipertahankan sama sekali. Kolom `sifat` juga tidak ada: ditambahkan lalu
 * dicabut di hari yang sama (2026_10_08_183619).
 *
 * Kolom `potongan` + `dispensasi_ids` yang dulu ditambahkan ke `tagihan`
 * dari sini kini menyatu di `create_keuangan_tables` bersama tabelnya.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dispensasi', function (Blueprint $table) {
            $table->id();
            $table->string('nama', 100);
            $table->string('keterangan', 255)->nullable();
            $table->string('tahun_ajaran', 20);

            $table->string('jenjang', 20)->nullable();
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')
                ->cascadeOnUpdate()->restrictOnDelete();
            $table->index('jenjang');

            $table->unsignedInteger('kuota_bulan')->nullable();

            $table->string('grup', 50)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('tahun_ajaran')->references('nama')->on('tahun_ajaran')->cascadeOnUpdate()->cascadeOnDelete();
            $table->index(['tahun_ajaran', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dispensasi');
    }
};
