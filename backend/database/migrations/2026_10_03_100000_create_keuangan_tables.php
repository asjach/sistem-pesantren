<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Tabel keuangan (tagihan/tunggakan/pembayaran) — tenant = lembaga (PK
 * `jenjang`).
 *
 * FK `jenjang` → `lembaga.jenjang` sengaja HANYA MySQL: SQLite tak mendukung
 * ADD FOREIGN KEY via ALTER, dan banyak tes membuat tagihan untuk jenjang
 * yang belum punya baris `lembaga`. Panjang kolom sudah `varchar(20)`
 * (disamakan dengan `lembaga.jenjang`, syarat FK) sejak awal.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('jenis_tagihan', function (Blueprint $table) {
            $table->id();
            $table->string('nama')->unique();

            $table->enum('tipe', ['bulanan', 'sekali', 'non_bulanan'])->default('non_bulanan');

            $table->string('jenjang', 20)->nullable();
            $table->unsignedInteger('urutan')->default(0);
            $table->boolean('is_active')->default(true);
            $table->text('keterangan')->nullable();
            $table->timestamps();

            $table->index('jenjang');
        });

        Schema::create('tarif_tagihan', function (Blueprint $table) {
            $table->id();
            $table->string('jenjang', 20);
            $table->string('tahun_ajaran', 20);
            $table->foreignId('jenis_id')->constrained('jenis_tagihan')->cascadeOnDelete();

            $table->string('tingkat', 100)->nullable();
            $table->unsignedBigInteger('nominal');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['jenjang', 'tahun_ajaran', 'jenis_id'], 'uq_tarif_tagihan');
        });

        Schema::create('tagihan', function (Blueprint $table) {
            $table->id();
            $table->foreignId('santri_id')->constrained('santri')->cascadeOnDelete();
            $table->string('jenjang', 20);
            $table->string('tahun_ajaran', 20);
            $table->foreignId('jenis_id')->constrained('jenis_tagihan');
            $table->string('periode', 20)->nullable();
            $table->unsignedBigInteger('nominal');

            $table->unsignedBigInteger('potongan')->default(0);
            $table->json('dispensasi_ids')->nullable();
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

        if (DB::getDriverName() === 'mysql') {
            Schema::table('jenis_tagihan', function (Blueprint $table): void {
                $table->foreign('jenjang', 'jenis_tagihan_jenjang_foreign')
                    ->references('jenjang')->on('lembaga')
                    ->cascadeOnUpdate()->restrictOnDelete();
            });
            Schema::table('tarif_tagihan', function (Blueprint $table): void {
                $table->foreign('jenjang', 'tarif_tagihan_jenjang_foreign')
                    ->references('jenjang')->on('lembaga')
                    ->cascadeOnUpdate()->restrictOnDelete();
            });
            Schema::table('tagihan', function (Blueprint $table): void {
                $table->foreign('jenjang', 'tagihan_jenjang_foreign')
                    ->references('jenjang')->on('lembaga')
                    ->cascadeOnUpdate()->restrictOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            Schema::table('tagihan', function (Blueprint $table): void {
                $table->dropForeign('tagihan_jenjang_foreign');
            });
            Schema::table('tarif_tagihan', function (Blueprint $table): void {
                $table->dropForeign('tarif_tagihan_jenjang_foreign');
            });
            Schema::table('jenis_tagihan', function (Blueprint $table): void {
                $table->dropForeign('jenis_tagihan_jenjang_foreign');
            });
        }

        Schema::dropIfExists('pembayaran');
        Schema::dropIfExists('tagihan');
        Schema::dropIfExists('tarif_tagihan');
        Schema::dropIfExists('jenis_tagihan');
    }
};
