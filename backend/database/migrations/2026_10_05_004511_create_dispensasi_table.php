<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Dispensasi (keringanan) tagihan per TA: target kriteria akademik
 * (paket/tingkat/kelas multi) atau tambahan santri individual, tipe
 * persen/nominal/bebas, akumulatif urut prioritas. Tagihan menyimpan
 * potongan + id dispensasi yang diterapkan sebagai jejak.
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
            $table->foreignId('jenis_id')->nullable()->constrained('jenis_tagihan')->nullOnDelete();
            $table->json('paket')->nullable();
            $table->json('tingkat')->nullable();
            $table->json('kelas_id')->nullable();
            $table->json('santri_ids')->nullable();
            $table->enum('tipe', ['persen', 'nominal', 'bebas'])->default('nominal');
            $table->unsignedInteger('nilai')->default(0);
            $table->integer('prioritas')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('tahun_ajaran')->references('nama')->on('tahun_ajaran')->cascadeOnUpdate()->cascadeOnDelete();
            $table->index(['tahun_ajaran', 'is_active']);
        });

        Schema::table('tagihan', function (Blueprint $table) {
            $table->unsignedBigInteger('potongan')->default(0)->after('nominal');
            $table->json('dispensasi_ids')->nullable()->after('potongan');
        });
    }

    public function down(): void
    {
        Schema::table('tagihan', function (Blueprint $table) {
            $table->dropColumn(['potongan', 'dispensasi_ids']);
        });

        Schema::dropIfExists('dispensasi');
    }
};
