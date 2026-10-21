<?php

use App\Services\SinkronIzin;
use Illuminate\Database\Migrations\Migration;

/** Pastikan izin navigasi.atur tersedia dan diberikan sesuai katalog. */
return new class extends Migration
{
    public function up(): void
    {
        SinkronIzin::jalankan();
    }

    public function down(): void {}
};
