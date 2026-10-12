<?php

use App\Services\SinkronIzin;
use Illuminate\Database\Migrations\Migration;

/**
 * Selaraskan izin di DB dengan katalog (`IzinKatalog`).
 *
 *  Tanpa ini, menambah modul ke katalog tidak pernah sampai ke database yang
 *  sudah jalan: izin modul itu tak pernah dibuat, sehingga rute ber-
 *  `permission:` menolak SEMUA peran dengan "User does not have the right
 *  permissions." — persis yang terjadi pada modul `komponen_custom` (setelan
 *  komponen custom: ukuran, tipe input, nilai awal, pengaturan tipe).
 *
 *  Aditif & idempoten: hanya menambah izin yang belum ada dan memberikannya ke
 *  peran sesuai bawaan katalog; penyesuaian matriks dari Kelola Izin tak
 *  dicabut.
 */
return new class extends Migration
{
    public function up(): void
    {
        SinkronIzin::jalankan();
    }

    public function down(): void
    {
        /* Aditif: tak ada yang dibatalkan. Izin yang dibuat di sini mungkin
           sudah dipakai peran lain, jadi menghapusnya di `down()` berisiko
           mencabut akses yang sah. */
    }
};
