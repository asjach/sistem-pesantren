<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Urutan tampil jenis tagihan — dipakai crosstab Tagihan untuk mengurutkan
 * KOLOM (jenis, lalu periode di dalam jenisnya), bukan lagi mengikuti `id`.
 *
 * `0` = belum diatur. Jenis berurutan 0 tetap diurutkan menurut `id` supaya
 * tampilan lama tidak berubah sampai pengguna mengisi angkanya; nilai positif
 * naik ke depan sesuai angkanya. Angka sama boleh (seri dipecah `id`), dan
 * sengaja tidak unik supaya penomoran 10/20/30 (celah untuk menyisipkan)
 * tetap mungkin tanpa harus menomori ulang semuanya.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('jenis_tagihan', function (Blueprint $table) {
            $table->unsignedInteger('urutan')->default(0)->after('jenjang');
        });
    }

    public function down(): void
    {
        Schema::table('jenis_tagihan', function (Blueprint $table) {
            $table->dropColumn('urutan');
        });
    }
};
