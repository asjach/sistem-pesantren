<?php

use App\Services\SinkronIzin;
use Illuminate\Database\Migrations\Migration;

/**
 * Selaraskan izin DB dengan katalog (`IzinKatalog`) setelah modul `penilaian`
 * ditambahkan. Tanpa ini, rute ber-`permission:penilaian.*` menolak SEMUA
 * peran ("User does not have the right permissions.") pada DB yang sudah jalan.
 *
 * Aditif & idempoten — lihat `SinkronIzin`.
 */
return new class extends Migration
{
    public function up(): void
    {
        SinkronIzin::jalankan();
    }

    public function down(): void
    {
        /* Aditif: izin yang sudah dibuat mungkin dipakai peran lain — tak dicabut. */
    }
};
