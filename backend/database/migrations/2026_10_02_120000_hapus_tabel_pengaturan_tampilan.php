<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Standar tampilan lembaga dihapus: setelan tampilan (tema, warna, density,
 * icon set, gaya per bagian UI, lebar kolom, beku, tinggi baris, perataan,
 * preset aktif) kini disimpan per perangkat pengguna — tidak ada lagi yang
 * ditulis ke server.
 *
 * Gaya per bagian UI tetap punya editor sendiri di halaman
 * `/pengaturan/tampilan`, hanya tidak lagi punya lapisan standar bersama.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('pengaturan_tampilan');
    }

    public function down(): void
    {
        Schema::create('pengaturan_tampilan', function (Blueprint $table) {
            $table->id();
            $table->string('jenjang', 20)->unique();
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->cascadeOnDelete();
            $table->json('data');
            // Naik setiap perubahan agar klien bisa memantau & memuat ulang.
            $table->unsignedInteger('versi')->default(1);
            $table->foreignId('diubah_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }
};