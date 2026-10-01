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
     * - `is_active_lembaga` = sedang menjadi santri lembaga ini; `tgl_masuk` diisi saat
     *   diterima (PSB/dialog/import), `tgl_selesai` saat kelulusan/mutasi.
     * - Multi-lembaga paralel diizinkan (mis. MI + MD), maks 1 baris aktif per
     *   santri+lembaga — invariant dijaga service.
     *
     * NIS Kemenag hasil generate boleh digenerate ulang & duplikat, jadi tanpa unique.
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
            $table->enum('is_active_lembaga', ['Ya', 'Tidak'])->default('Ya');
            $table->date('tgl_masuk')->nullable();
            $table->date('tgl_selesai')->nullable();
            $table->string('tahaj_masuk', 50)->nullable(); // tahun ajaran masuk
            $table->string('tingkat_masuk', 20)->nullable();
            $table->string('no_urut', 20)->nullable(); // boleh bersufiks huruf (mis. '706x')
            $table->string('nama_sekolah_asal')->nullable();
            $table->string('npsn_sekolah_asal', 20)->nullable();
            $table->string('nss_sekolah_asal', 30)->nullable();
            $table->text('alamat_sekolah_asal')->nullable();
            $table->timestamps();

            // NIS lokal unik per lembaga; NULL boleh berulang (multi-NULL MySQL).
            $table->unique(['jenjang', 'nis_lokal'], 'uq_lembaga_santri_nis_lokal');
            $table->index(['santri_id', 'is_active_lembaga']);
            $table->index(['jenjang', 'is_active_lembaga']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lembaga_santri');
    }
};
