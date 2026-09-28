<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Pustaka aset cetak: stempel, tanda tangan, dan gambar pendukung yang
     * dipakai ulang banyak template. Logo lembaga dan fotoSantri/pegawai
     * tidak disimpan di sini karena sudah punya kolomnya masing-masing.
     */
    public function up(): void
    {
        Schema::create('aset_dokumen', function (Blueprint $table) {
            $table->id();
            // jenjang null = global (berlaku semua lembaga), sama seperti preset_tabel.
            $table->string('jenjang', 20)->nullable();
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('nama', 100);
            // Nama berkas di acak saat unggah: route penyajian disk lokal tidak
            // dilindungi middleware auth, jadi path tidak boleh dapat ditebak.
            $table->string('path', 255);
            $table->string('mime', 60)->default('image/png');
            $table->unsignedInteger('lebar_px')->default(0);
            $table->unsignedInteger('tinggi_px')->default(0);
            $table->unsignedBigInteger('ukuran_byte')->default(0);
            $table->foreignId('dibuat_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('jenjang');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('aset_dokumen');
    }
};
