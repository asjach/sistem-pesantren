<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tabel `dokumen_lembaga` — berkas tingkat lembaga (izin operasional,
 * akreditasi, SK pendirian, dll), melengkapi `dokumen_santri` dan
 * `dokumen_pegawai`. Kolom keterangan memakai `catatan` (konvensi
 * ketiga tabel dokumen); `nama_file` = nama asli berkas terunggah.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dokumen_lembaga', function (Blueprint $table) {
            $table->id();
            $table->string('jenjang', 20);
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('jenis_dokumen')->nullable(); // bebas teks (mis. Izin Operasional, Akreditasi)
            $table->string('nama_file')->nullable(); // nama asli berkas terunggah
            $table->string('path_file')->nullable(); // null = baris checklist (belum diunggah)
            $table->enum('status_verifikasi', ['menunggu', 'valid', 'ditolak'])->default('menunggu');
            $table->text('catatan')->nullable();
            $table->timestamps();

            $table->index(['jenjang', 'jenis_dokumen']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dokumen_lembaga');
    }
};
