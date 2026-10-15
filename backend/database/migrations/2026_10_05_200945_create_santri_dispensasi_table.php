<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Santri tambahan dispensasi: tabel pivot `santri_dispensasi` (FK cascade
 * kedua sisi, unik per pasangan) tempat daftar penerima individual per paket.
 *
 * Dulu juga menyalin isi kolom JSON `dispensasi.santri_ids` ke sini lalu
 * menjatuhkan kolomnya. Karena database dibangun ulang dari nol dan kolom itu
 * kini tidak pernah ada (`create_dispensasi_table` sudah final), penyalinan
 * itu tak lagi punya sumber.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('santri_dispensasi', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dispensasi_id')->constrained('dispensasi')->cascadeOnDelete();
            $table->foreignId('santri_id')->constrained('santri')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['dispensasi_id', 'santri_id']);
            $table->index('santri_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('santri_dispensasi');
    }
};
