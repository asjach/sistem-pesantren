<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Tabel keuangan (tagihan/tunggakan/pembayaran) — tenant = lembaga (PK `jenjang`). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('jenis_tagihan', function (Blueprint $table) {
            $table->id();
            $table->string('nama')->unique();
            $table->enum('tipe', ['bulanan', 'sekali'])->default('sekali');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('tarif_tagihan', function (Blueprint $table) {
            $table->id();
            $table->string('jenjang', 50); // lembaga penerbit tagihan
            $table->string('paket', 20);     // MI | MD | MI-MD | MTS | MLN | ...
            $table->string('tahun_ajaran', 20);
            $table->foreignId('jenis_id')->constrained('jenis_tagihan')->cascadeOnDelete();
            $table->string('tingkat', 100)->nullable();
            $table->unsignedBigInteger('nominal');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['jenjang', 'paket', 'tahun_ajaran', 'jenis_id', 'tingkat'], 'uq_tarif_tagihan');
        });

        Schema::create('tagihan', function (Blueprint $table) {
            $table->id();
            $table->foreignId('santri_id')->constrained('santri')->cascadeOnDelete();
            $table->string('jenjang', 50);     // lembaga penerbit
            $table->string('paket', 20);
            $table->string('tahun_ajaran', 20);
            $table->foreignId('jenis_id')->constrained('jenis_tagihan');
            $table->string('periode', 20)->nullable(); // mis. '2026-07' (bulanan) / '2026-G1' (semester) / null (sekali)
            $table->unsignedBigInteger('nominal');
            $table->unsignedBigInteger('terbayar')->default(0);
            $table->enum('status', ['belum', 'sebagian', 'lunas'])->default('belum');
            $table->date('jatuh_tempo')->nullable();
            $table->timestamps();

            $table->index(['santri_id', 'tahun_ajaran', 'jenis_id']);
            $table->unique(['santri_id', 'jenis_id', 'periode'], 'uq_tagihan_santri_jenis_periode');
        });

        Schema::create('pembayaran', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tagihan_id')->constrained('tagihan')->cascadeOnDelete();
            $table->unsignedBigInteger('jumlah');
            $table->enum('metode', ['tunai', 'transfer'])->default('tunai');
            $table->enum('kas', ['tunai_tu', 'bank_lembaga', 'bank_pesantren'])->default('tunai_tu');
            $table->string('no_kwitansi')->nullable()->unique();
            $table->foreignId('diterima_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('status', ['aktif', 'batal'])->default('aktif');
            $table->string('catatan')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pembayaran');
        Schema::dropIfExists('tagihan');
        Schema::dropIfExists('tarif_tagihan');
        Schema::dropIfExists('jenis_tagihan');
    }
};
