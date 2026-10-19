<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Grup santri custom: kelompok bentukan manual (mis. peserta ekskul) yang
 * dipakai opsi "Custom" pada dialog Buat Tagihan. Anggota disimpan di tabel
 * pivot (FK cascade kedua sisi, unik per pasangan) supaya hapus grup/santri
 * otomatis membersihkan keanggotaan.
 *
 * Kolom lingkup (`jenjang`, `tahun_ajaran`, `is_active`) DULU ditambahkan
 * migrasi terpisah `2026_10_13_090000_tambah_scope_ke_grup_santri_custom`;
 * kini menyatu di sini supaya definisi tabelnya utuh di satu tempat.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('grup_santri_custom', function (Blueprint $table) {
            $table->id();
            $table->string('nama', 100)->unique();
            $table->string('keterangan', 1000)->nullable();

            $table->string('jenjang', 50)->nullable();
            $table->string('tahun_ajaran', 20)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('anggota_grup_santri_custom', function (Blueprint $table) {
            $table->id();
            $table->foreignId('grup_id')->constrained('grup_santri_custom')->cascadeOnDelete();
            $table->foreignId('santri_id')->constrained('santri')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['grup_id', 'santri_id']);
            $table->index('santri_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('anggota_grup_santri_custom');
        Schema::dropIfExists('grup_santri_custom');
    }
};
