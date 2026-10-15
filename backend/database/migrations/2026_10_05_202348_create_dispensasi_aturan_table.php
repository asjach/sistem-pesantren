<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Aturan dispensasi per jenis tagihan (`dispensasi_aturan`, tiap baris punya
 * tipe/nilai sendiri; `jenis_id` null = berlaku semua jenis). Urutan
 * akumulatif = urut id.
 *
 * Dulu juga mengonversi kolom sasaran & nilai tunggal di `dispensasi`
 * (`jenis_id`, `paket`, `tingkat`, `kelas_id`, `tipe`, `nilai`, `prioritas`)
 * menjadi baris aturan lalu menjatuhkan kolomnya. Karena database dibangun
 * ulang dari nol dan kolom itu kini tidak pernah ada (`create_dispensasi_table`
 * sudah final), konversi itu tak lagi punya sumber.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dispensasi_aturan', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dispensasi_id')->constrained('dispensasi')->cascadeOnDelete();
            $table->foreignId('jenis_id')->nullable()->constrained('jenis_tagihan')->nullOnDelete();
            $table->enum('tipe', ['persen', 'nominal', 'bebas'])->default('nominal');
            $table->unsignedInteger('nilai')->default(0);
            $table->timestamps();

            $table->unique(['dispensasi_id', 'jenis_id']);
            $table->index('jenis_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dispensasi_aturan');
    }
};
