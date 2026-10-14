<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Urutan + tampil/sembunyi tab halaman gabungan (Data Induk, Penempatan,
 * Akademik, Santri Aktif, Penempatan Pegawai), SATU baris per halaman.
 *
 * - `urutan`: daftar rute tab sesuai urutan tampil. Rute didaftarkan di
 *   `src/lib/halaman.ts` (kode), jadi daftar ini hanya MENGATUR yang sudah
 *   ada — bukan membuat tab baru. Rute yang lahir kemudian dan belum ada di
 *   sini ditambahkan di akhir oleh frontend, tidak hilang.
 * - `sembunyi`: daftar rute yang disembunyikan. Disimpan sebagai daftar
 *   TERPISAH (bukan dengan membuang dari `urutan`) supaya menyembunyikan lalu
 *   menampilkan lagi tidak kehilangan posisi aslinya.
 *
 * Global untuk semua pengguna (tanpa `user_id`/`lembaga`): satu urutan yang
 * sama di seluruh pesantren, diatur super_admin.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pengaturan_halaman', function (Blueprint $table) {
            $table->id();
            $table->string('page_key', 60)->unique();
            $table->json('urutan')->nullable();
            $table->json('sembunyi')->nullable();
            $table->foreignId('diubah_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pengaturan_halaman');
    }
};
