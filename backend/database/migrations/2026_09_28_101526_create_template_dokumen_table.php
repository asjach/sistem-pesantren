<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Template cetak. Dua jenis dibedakan agar satu daftar & satu katalog nilai
     * melayani keduanya:
     * - jenis 'pdf': berkas PDF diunggah (hasil ekspor Word/CorelDRAW/Canva),
     *   lalu nilai superimpose di atasnya pada koordinat mm (lihat app/Services/Template/PdfIsian).
     * - jenis 'html': tata letak digambar sendiri lewat kanvas HTML lalu dirender
     *   dompdf (lihat app/Services/Template/PerenderHtml).
     *
     * Kolom `halaman` menyimpan ukuran tiap halaman dalam milimeter hasil baca
     * FPDI; nilainya pelarut (210.00014444) sehingga WAJIB dibulatkan sebelum disimpan.
     */
    public function up(): void
    {
        Schema::create('template_dokumen', function (Blueprint $table) {
            $table->id();
            $table->string('kode', 60)->unique();
            $table->string('nama', 120);
            $table->enum('kategori', ['surat', 'sertifikat', 'daftar', 'rapor', 'sk', 'berita_acara', 'lainnya'])->default('lainnya');
            $table->enum('jenis', ['pdf', 'html'])->default('pdf');
            $table->text('deskripsi')->nullable();
            // jenjang null = global (dipakai semua lembaga), terisi = khusus lembaga itu.
            $table->string('jenjang', 20)->nullable();
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->cascadeOnDelete();
            // Hanya untuk jenis 'pdf'; null pada jenis 'html'.
            $table->string('path_pdf', 255)->nullable();
            // [{lebar_mm, tinggi_mm}] satu entri per halaman; jenis 'html' selalu satu.
            $table->json('halaman')->nullable();
            $table->unsignedSmallInteger('jumlah_halaman')->default(1);
            // {versi: 1, medan: [...]} posisi & gaya tiap medan isian.
            $table->json('definisi')->nullable();
            $table->boolean('aktif')->default(true);
            $table->foreignId('dibuat_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['jenjang', 'kategori']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('template_dokumen');
    }
};
