<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Keanggotaan santri per lembaga (bukan pivot murni):
     * - `nis_lokal` diisi manual per lembaga; `nis_kemenag` digenerate manual di
     *   halaman Buku Induk (NSM 12 digit + YY tahun diterima + 4 digit akhir nis_lokal).
     * - `is_active` = sedang menjadi santri lembaga ini; `tgl_mulai` diisi saat
     *   diterima (PSB/dialog/import), `tgl_selesai` saat kelulusan/mutasi.
     * - Multi-lembaga paralel diizinkan (mis. MI + MD), maks 1 baris aktif per
     *   santri+lembaga — invariant dijaga service.
     */
    public function up(): void
    {
        Schema::create('lembaga_santri', function (Blueprint $table) {
            $table->id();
            $table->foreignId('santri_id')->constrained('santri')->cascadeOnDelete();
            $table->string('jenjang', 20);
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('nis_lokal', 20)->nullable();
            $table->string('nis_kemenag', 20)->nullable();
            $table->boolean('is_active')->default(true);
            $table->date('tgl_mulai')->nullable();
            $table->date('tgl_selesai')->nullable();
            $table->timestamps();

            // NIS (lokal & kemenag) unik per lembaga; NULL boleh berulang (multi-NULL MySQL).
            $table->unique(['jenjang', 'nis_lokal'], 'uq_lembaga_santri_nis_lokal');
            $table->unique(['jenjang', 'nis_kemenag'], 'uq_lembaga_santri_nis_kemenag');
            $table->index(['santri_id', 'is_active']);
            $table->index(['jenjang', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lembaga_santri');
    }
};
