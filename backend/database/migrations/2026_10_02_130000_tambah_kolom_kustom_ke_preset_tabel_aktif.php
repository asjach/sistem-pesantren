<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Susunan kolom "Lengkap kustom" ikut tersimpan per user per tabel.
 *
 * Sebelumnya pilihan "Lengkap" hanya bisa berarti semua kolom; susunan kustom
 * (mis. beberapa kolom disembunyikan) berlaku pada sesi itu saja sehingga
 * hilang setelah muat ulang. Dua kolom ini menyimpan susunannya saat
 * `preset_id` null, tanpa membuat preset bernama baru.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('preset_tabel_aktif', function (Blueprint $table) {
            $table->json('kolom')->nullable()->after('preset_id');
            $table->json('label')->nullable()->after('kolom');
        });
    }

    public function down(): void
    {
        Schema::table('preset_tabel_aktif', function (Blueprint $table) {
            $table->dropColumn(['kolom', 'label']);
        });
    }
};