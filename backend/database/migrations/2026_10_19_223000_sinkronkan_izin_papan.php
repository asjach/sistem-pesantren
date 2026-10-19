<?php

use App\Services\SinkronIzin;
use Illuminate\Database\Migrations\Migration;

/**
 * Selaraskan izin di DB dengan katalog (`IzinKatalog`).
 *
 * Modul `papan` baru ditambahkan ke katalog (izin papan.lihat & papan.ubah).
 * Tanpa migrasi ini, izin itu tidak pernah dibuat di database yang sudah
 * jalan, sehingga rute `papan/*` menolak SEMUA peran dengan "User does not
 * have the right permissions." — termasuk super_admin.
 *
 * Aditif & idempoten: hanya menambah izin yang belum ada, tanpa mencabut
 * penyesuaian matriks dari halaman Kelola Izin.
 */
return new class extends Migration
{
    public function up(): void
    {
        SinkronIzin::jalankan();
    }

    public function down(): void {}
};
