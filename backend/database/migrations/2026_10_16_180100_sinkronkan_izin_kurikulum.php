<?php

use App\Services\SinkronIzin;
use Illuminate\Database\Migrations\Migration;

/**
 * Selaraskan izin DB dengan katalog (`IzinKatalog`) setelah modul `kurikulum`
 * ditambahkan. Tanpa ini, rute ber-`permission:kurikulum.*` menolak SEMUA peran
 * ("User does not have the right permissions.") pada DB yang sudah jalan.
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

    }
};
