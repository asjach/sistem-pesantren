<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Jatuhkan dua kolom `label` yang sudah benar-benar mati.
 *
 *  Dulu nama header kolom bisa datang dari dua tempat: `preset_tabel.label`
 *  (per preset) dan `preset_tabel_aktif.label` (susunan "Lengkap kustom").
 *  Sejak migrasi 2026_10_15_120000 sumbernya SATU - `toolbar_preset.label`
 *  (per TABEL, bukan per preset).
 *
 *  Kolom lama sempat dibiarkan karena jalurnya masih hidup (controller &
 *  request masih menulis/membacanya). Jalur itu dibersihkan lebih dulu
 *  (lihat commit pembersihan label), dan kedua kolom terbukti kosong:
 *  `preset_tabel.label` 0 baris, `preset_tabel_aktif.label` 0 baris. Tak ada
 *  kode yang menyentuhnya lagi, jadi aman dijatuhkan.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('preset_tabel', function (Blueprint $table) {
            $table->dropColumn('label');
        });
        Schema::table('preset_tabel_aktif', function (Blueprint $table) {
            $table->dropColumn('label');
        });
    }

    public function down(): void
    {
        Schema::table('preset_tabel', function (Blueprint $table) {
            $table->json('label')->nullable()->after('kolom');
        });
        Schema::table('preset_tabel_aktif', function (Blueprint $table) {
            $table->json('label')->nullable()->after('kolom');
        });
    }
};
